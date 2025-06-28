import { EventEmitter } from 'events';
import {
    DelayedSwitchConfig,
    PendingSwitchRequest,
    ActiveOperation,
    SwitchDecision,
    SwitchReason,
    SwitchPriority,
    OperationType,
    VPNConfig,
    ChannelSwitchManager as IChannelSwitchManager
} from './types';
import { logger, generateId, delay } from './utils';
import { AsyncMutex } from './concurrency';

/**
 * Менеджер отложенного переключения каналов связи
 * Управляет переключением VPN с учетом критичности операций и данных
 */
export class ChannelSwitchManager extends EventEmitter implements IChannelSwitchManager {
    private readonly config: DelayedSwitchConfig;
    private readonly switchMutex = new AsyncMutex();
    private readonly operationsMutex = new AsyncMutex();
    
    private _pendingSwitches: PendingSwitchRequest[] = [];
    private _activeOperations: ActiveOperation[] = [];
    private schedulerTimer: NodeJS.Timeout | null = null;
    private _isEnabled: boolean = true;

    constructor(config: DelayedSwitchConfig) {
        super();
        this.config = config;
        this._isEnabled = config.enabled;
        
        if (this._isEnabled) {
            this.startScheduler();
        }
    }

    /**
     * Проверка активности системы отложенного переключения
     */
    get isEnabled(): boolean {
        return this._isEnabled;
    }

    /**
     * Получение списка ожидающих переключений
     */
    get pendingSwitches(): PendingSwitchRequest[] {
        return [...this._pendingSwitches];
    }

    /**
     * Получение списка активных операций
     */
    get activeOperations(): ActiveOperation[] {
        return [...this._activeOperations];
    }

    /**
     * Запрос на переключение канала с учетом критичности
     */
    async requestSwitch(
        targetVPN: VPNConfig,
        reason: SwitchReason,
        priority: SwitchPriority,
        criticalityLevel: number = 50
    ): Promise<string> {
        if (!this._isEnabled) {
            throw new Error('Delayed switching is disabled');
        }

        return this.switchMutex.runWithLock(async () => {
            const switchId = generateId(16);
            const now = Date.now();
            
            // Получаем решение о переключении
            const decision = this.getSwitchDecision(targetVPN, reason, priority);
            
            const switchRequest: PendingSwitchRequest = {
                id: switchId,
                targetVPN,
                reason,
                priority,
                requestedAt: now,
                scheduledAt: decision.scheduledAt || (now + decision.delayMs),
                criticalityLevel,
                canCancel: decision.action !== 'immediate',
                metadata: {
                    decision,
                    originalDelay: decision.delayMs
                }
            };

            logger.info(`Switch request ${switchId}: ${decision.action} (delay: ${decision.delayMs}ms, reason: ${decision.reason})`);

            if (decision.action === 'immediate') {
                // Немедленное переключение
                this.emit('immediateSwitch', switchRequest);
                return switchId;
            } else if (decision.action === 'delayed') {
                // Отложенное переключение
                this._pendingSwitches.push(switchRequest);
                this._pendingSwitches.sort((a, b) => a.scheduledAt - b.scheduledAt);
                
                this.emit('switchScheduled', switchRequest);
                logger.debug(`Switch ${switchId} scheduled for ${new Date(switchRequest.scheduledAt).toISOString()}`);
            } else if (decision.action === 'postponed') {
                // Отложено до завершения критичных операций
                switchRequest.scheduledAt = now + this.config.maxDelayMs;
                this._pendingSwitches.push(switchRequest);
                
                this.emit('switchPostponed', switchRequest);
                logger.warn(`Switch ${switchId} postponed due to critical operations`);
            } else {
                // Отменено
                this.emit('switchCancelled', switchRequest);
                throw new Error(`Switch request cancelled: ${decision.reason}`);
            }

            return switchId;
        });
    }

    /**
     * Отмена запланированного переключения
     */
    cancelSwitch(switchId: string): boolean {
        return this.switchMutex.runWithLock(async () => {
            const index = this._pendingSwitches.findIndex(s => s.id === switchId);
            
            if (index === -1) {
                return false;
            }

            const switchRequest = this._pendingSwitches[index];
            
            if (switchRequest && !switchRequest.canCancel) {
                logger.warn(`Cannot cancel switch ${switchId}: cancellation not allowed`);
                return false;
            }

            this._pendingSwitches.splice(index, 1);
            this.emit('switchCancelled', switchRequest);
            
            logger.info(`Switch ${switchId} cancelled successfully`);
            return true;
        }) as any; // Возвращаем результат синхронно для простоты API
    }

    /**
     * Регистрация активной операции
     */
    registerOperation(operation: Omit<ActiveOperation, 'id'>): string {
        return this.operationsMutex.runWithLock(async () => {
            const operationId = generateId(12);
            const activeOperation: ActiveOperation = {
                ...operation,
                id: operationId
            };

            this._activeOperations.push(activeOperation);
            
            logger.debug(`Operation ${operationId} registered (type: ${operation.type}, criticality: ${operation.criticalityLevel})`);
            this.emit('operationStarted', activeOperation);

            // Автоматическое завершение по истечении времени
            if (operation.estimatedDuration > 0) {
                setTimeout(() => {
                    this.completeOperation(operationId);
                }, operation.estimatedDuration);
            }

            return operationId;
        }) as any;
    }

    /**
     * Завершение операции
     */
    completeOperation(operationId: string): void {
        this.operationsMutex.runWithLock(async () => {
            const index = this._activeOperations.findIndex(op => op.id === operationId);
            
            if (index === -1) {
                return;
            }

            const operation = this._activeOperations[index];
            this._activeOperations.splice(index, 1);
            
            if (operation.onComplete) {
                try {
                    operation.onComplete();
                } catch (error) {
                    logger.error(`Error in operation completion callback:`, error);
                }
            }

            logger.debug(`Operation ${operationId} completed`);
            this.emit('operationCompleted', operation);

            // Проверяем, можно ли теперь выполнить отложенные переключения
            this.checkPendingSwitches();
        });
    }

    /**
     * Принудительное прерывание операции
     */
    interruptOperation(operationId: string): boolean {
        return this.operationsMutex.runWithLock(async () => {
            const index = this._activeOperations.findIndex(op => op.id === operationId);
            
            if (index === -1) {
                return false;
            }

            const operation = this._activeOperations[index];
            
            if (!operation.canInterrupt) {
                logger.warn(`Cannot interrupt operation ${operationId}: interruption not allowed`);
                return false;
            }

            this._activeOperations.splice(index, 1);
            
            if (operation.onInterrupt) {
                try {
                    operation.onInterrupt();
                } catch (error) {
                    logger.error(`Error in operation interruption callback:`, error);
                }
            }

            logger.info(`Operation ${operationId} interrupted`);
            this.emit('operationInterrupted', operation);

            return true;
        }) as any;
    }

    /**
     * Получение оптимального времени для переключения
     */
    getOptimalSwitchTime(): number {
        const now = Date.now();
        const criticalOps = this._activeOperations.filter(op => 
            op.criticalityLevel >= this.config.criticalityThresholds.immediate
        );

        if (criticalOps.length === 0) {
            return now; // Можно переключаться немедленно
        }

        // Находим время завершения самой долгой критичной операции
        const maxEndTime = Math.max(...criticalOps.map(op => 
            op.startedAt + op.estimatedDuration
        ));

        return Math.min(maxEndTime + this.config.gracePeriodMs, now + this.config.maxDelayMs);
    }

    /**
     * Получение решения о переключении
     */
    getSwitchDecision(targetVPN: VPNConfig, reason: SwitchReason, priority: SwitchPriority): SwitchDecision {
        const now = Date.now();
        const criticalityLevel = this.getPriorityLevel(priority);
        
        // Анализируем активные операции
        const criticalOperations = this._activeOperations.filter(op => 
            op.criticalityLevel >= this.config.criticalityThresholds.normal
        );

        const highCriticalOperations = this._activeOperations.filter(op => 
            op.criticalityLevel >= this.config.criticalityThresholds.immediate
        );

        // Немедленное переключение для критичных случаев
        if (
            reason === 'emergency' || 
            priority === 'emergency' ||
            criticalityLevel >= this.config.criticalityThresholds.immediate
        ) {
            return {
                action: 'immediate',
                delayMs: 0,
                reason: 'Emergency or critical priority',
                affectedOperations: this._activeOperations.map(op => op.id)
            };
        }

        // Проверяем наличие критичных операций
        if (highCriticalOperations.length > 0) {
            const optimalTime = this.getOptimalSwitchTime();
            const delayMs = Math.max(0, optimalTime - now);

            if (delayMs > this.config.maxDelayMs) {
                return {
                    action: 'postponed',
                    delayMs: this.config.maxDelayMs,
                    reason: 'Too many critical operations, exceeds max delay',
                    affectedOperations: highCriticalOperations.map(op => op.id)
                };
            }

            return {
                action: 'delayed',
                delayMs,
                reason: 'Waiting for critical operations to complete',
                affectedOperations: highCriticalOperations.map(op => op.id),
                scheduledAt: optimalTime
            };
        }

        // Определяем задержку на основе приоритета и количества операций
        let delayMs = 0;

        if (criticalOperations.length > 0) {
            if (criticalityLevel >= this.config.criticalityThresholds.fast) {
                delayMs = Math.min(5000, this.getAverageOperationRemainingTime());
            } else if (criticalityLevel >= this.config.criticalityThresholds.normal) {
                delayMs = Math.min(15000, this.getAverageOperationRemainingTime() * 2);
            } else {
                delayMs = Math.min(30000, this.getAverageOperationRemainingTime() * 3);
            }
        } else {
            // Нет критичных операций, можно переключаться с небольшой задержкой
            delayMs = priority === 'high' ? 1000 : priority === 'normal' ? 2000 : 5000;
        }

        return {
            action: 'delayed',
            delayMs,
            reason: `Scheduled based on priority ${priority} and ${criticalOperations.length} active operations`,
            affectedOperations: criticalOperations.map(op => op.id)
        };
    }

    /**
     * Запуск планировщика переключений
     */
    private startScheduler(): void {
        if (this.schedulerTimer) {
            return;
        }

        this.schedulerTimer = setInterval(() => {
            this.processScheduledSwitches();
        }, 1000); // Проверяем каждую секунду

        logger.debug('Switch scheduler started');
    }

    /**
     * Остановка планировщика
     */
    private stopScheduler(): void {
        if (this.schedulerTimer) {
            clearInterval(this.schedulerTimer);
            this.schedulerTimer = null;
        }

        logger.debug('Switch scheduler stopped');
    }

    /**
     * Обработка запланированных переключений
     */
    private async processScheduledSwitches(): Promise<void> {
        if (!this._isEnabled || this._pendingSwitches.length === 0) {
            return;
        }

        const now = Date.now();
        const readySwitches = this._pendingSwitches.filter(s => s.scheduledAt <= now);

        for (const switchRequest of readySwitches) {
            try {
                await this.executePendingSwitch(switchRequest);
            } catch (error) {
                logger.error(`Failed to execute pending switch ${switchRequest.id}:`, error);
                this.emit('switchFailed', switchRequest, error);
            }
        }
    }

    /**
     * Выполнение отложенного переключения
     */
    private async executePendingSwitch(switchRequest: PendingSwitchRequest): Promise<void> {
        return this.switchMutex.runWithLock(async () => {
            // Удаляем из очереди
            const index = this._pendingSwitches.findIndex(s => s.id === switchRequest.id);
            if (index !== -1) {
                this._pendingSwitches.splice(index, 1);
            }

            // Проверяем, можно ли выполнить переключение сейчас
            const decision = this.getSwitchDecision(
                switchRequest.targetVPN,
                switchRequest.reason,
                switchRequest.priority
            );

            if (decision.action === 'immediate' || decision.delayMs <= 1000) {
                logger.info(`Executing delayed switch ${switchRequest.id} to ${switchRequest.targetVPN.name}`);
                this.emit('switchExecuted', switchRequest);
            } else {
                // Нужно еще подождать
                switchRequest.scheduledAt = Date.now() + decision.delayMs;
                this._pendingSwitches.push(switchRequest);
                this._pendingSwitches.sort((a, b) => a.scheduledAt - b.scheduledAt);
                
                logger.debug(`Switch ${switchRequest.id} rescheduled for ${new Date(switchRequest.scheduledAt).toISOString()}`);
            }
        });
    }

    /**
     * Проверка возможности выполнения отложенных переключений
     */
    private checkPendingSwitches(): void {
        // Проверяем, можно ли выполнить какие-то переключения раньше срока
        const now = Date.now();
        
        for (const switchRequest of this._pendingSwitches) {
            const decision = this.getSwitchDecision(
                switchRequest.targetVPN,
                switchRequest.reason,
                switchRequest.priority
            );

            if (decision.action === 'immediate') {
                // Можно выполнить немедленно
                switchRequest.scheduledAt = now;
                logger.debug(`Switch ${switchRequest.id} moved to immediate execution due to cleared operations`);
            }
        }
    }

    /**
     * Получение числового уровня приоритета
     */
    private getPriorityLevel(priority: SwitchPriority): number {
        const levels = {
            low: 10,
            normal: 30,
            high: 60,
            critical: 80,
            emergency: 100
        };
        return levels[priority] || 30;
    }

    /**
     * Получение среднего времени завершения операций
     */
    private getAverageOperationRemainingTime(): number {
        if (this._activeOperations.length === 0) {
            return 0;
        }

        const now = Date.now();
        const remainingTimes = this._activeOperations.map(op => {
            const elapsed = now - op.startedAt;
            return Math.max(0, op.estimatedDuration - elapsed);
        });

        return remainingTimes.reduce((sum, time) => sum + time, 0) / remainingTimes.length;
    }

    /**
     * Включение/отключение системы отложенного переключения
     */
    setEnabled(enabled: boolean): void {
        this._isEnabled = enabled;
        
        if (enabled && !this.schedulerTimer) {
            this.startScheduler();
        } else if (!enabled && this.schedulerTimer) {
            this.stopScheduler();
        }

        logger.info(`Delayed switching ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Очистка всех переключений и операций
     */
    clear(): void {
        this._pendingSwitches.length = 0;
        this._activeOperations.length = 0;
        
        logger.info('Cleared all pending switches and active operations');
        this.emit('cleared');
    }

    /**
     * Остановка менеджера
     */
    stop(): void {
        this.stopScheduler();
        this.clear();
        this.removeAllListeners();
        
        logger.info('Channel switch manager stopped');
    }
}
