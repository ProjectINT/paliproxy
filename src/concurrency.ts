/**
 * Мьютекс для защиты критических секций от одновременного доступа
 * Обеспечивает последовательное выполнение асинхронных операций
 */
export class AsyncMutex {
    private locked: boolean = false;
    private queue: Array<() => void> = [];

    /**
     * Получение блокировки
     */
    async acquire(): Promise<void> {
        return new Promise<void>((resolve) => {
            if (!this.locked) {
                this.locked = true;
                resolve();
            } else {
                this.queue.push(resolve);
            }
        });
    }

    /**
     * Освобождение блокировки
     */
    release(): void {
        if (!this.locked) {
            throw new Error('Cannot release unlocked mutex');
        }

        const next = this.queue.shift();
        if (next) {
            next();
        } else {
            this.locked = false;
        }
    }

    /**
     * Выполнение функции с блокировкой
     */
    async runWithLock<T>(fn: () => Promise<T>): Promise<T> {
        await this.acquire();
        try {
            return await fn();
        } finally {
            this.release();
        }
    }

    /**
     * Проверка, заблокирован ли мьютекс
     */
    isLocked(): boolean {
        return this.locked;
    }

    /**
     * Получение размера очереди ожидания
     */
    getQueueSize(): number {
        return this.queue.length;
    }
}

/**
 * Семафор для ограничения количества одновременных операций
 */
export class AsyncSemaphore {
    private permits: number;
    private readonly maxPermits: number;
    private queue: Array<() => void> = [];

    constructor(permits: number) {
        if (permits <= 0) {
            throw new Error('Permits must be positive');
        }
        this.permits = permits;
        this.maxPermits = permits;
    }

    /**
     * Получение разрешения
     */
    async acquire(): Promise<void> {
        return new Promise<void>((resolve) => {
            if (this.permits > 0) {
                this.permits--;
                resolve();
            } else {
                this.queue.push(resolve);
            }
        });
    }

    /**
     * Освобождение разрешения
     */
    release(): void {
        if (this.permits >= this.maxPermits) {
            throw new Error('Cannot release more permits than maximum');
        }

        const next = this.queue.shift();
        if (next) {
            next();
        } else {
            this.permits++;
        }
    }

    /**
     * Выполнение функции с семафором
     */
    async runWithPermit<T>(fn: () => Promise<T>): Promise<T> {
        await this.acquire();
        try {
            return await fn();
        } finally {
            this.release();
        }
    }

    /**
     * Получение количества доступных разрешений
     */
    getAvailablePermits(): number {
        return this.permits;
    }

    /**
     * Получение размера очереди ожидания
     */
    getQueueSize(): number {
        return this.queue.length;
    }
}

/**
 * ReadWrite блокировка для эффективного управления чтением/записью
 */
export class AsyncReadWriteLock {
    private readers: number = 0;
    private writers: number = 0;
    private writeQueue: Array<() => void> = [];
    private readQueue: Array<() => void> = [];

    /**
     * Получение блокировки для чтения
     */
    async acquireRead(): Promise<void> {
        return new Promise<void>((resolve) => {
            if (this.writers === 0 && this.writeQueue.length === 0) {
                this.readers++;
                resolve();
            } else {
                this.readQueue.push(resolve);
            }
        });
    }

    /**
     * Освобождение блокировки чтения
     */
    releaseRead(): void {
        if (this.readers <= 0) {
            throw new Error('Cannot release read lock: no active readers');
        }

        this.readers--;
        
        // Если нет читателей и есть ожидающие писатели
        if (this.readers === 0 && this.writeQueue.length > 0) {
            const nextWriter = this.writeQueue.shift()!;
            this.writers++;
            nextWriter();
        }
    }

    /**
     * Получение блокировки для записи
     */
    async acquireWrite(): Promise<void> {
        return new Promise<void>((resolve) => {
            if (this.readers === 0 && this.writers === 0) {
                this.writers++;
                resolve();
            } else {
                this.writeQueue.push(resolve);
            }
        });
    }

    /**
     * Освобождение блокировки записи
     */
    releaseWrite(): void {
        if (this.writers <= 0) {
            throw new Error('Cannot release write lock: no active writers');
        }

        this.writers--;

        // Сначала обслуживаем ожидающих писателей
        if (this.writeQueue.length > 0) {
            const nextWriter = this.writeQueue.shift()!;
            this.writers++;
            nextWriter();
        } else {
            // Затем всех ожидающих читателей
            while (this.readQueue.length > 0) {
                const nextReader = this.readQueue.shift()!;
                this.readers++;
                nextReader();
            }
        }
    }

    /**
     * Выполнение функции с блокировкой чтения
     */
    async runWithReadLock<T>(fn: () => Promise<T>): Promise<T> {
        await this.acquireRead();
        try {
            return await fn();
        } finally {
            this.releaseRead();
        }
    }

    /**
     * Выполнение функции с блокировкой записи
     */
    async runWithWriteLock<T>(fn: () => Promise<T>): Promise<T> {
        await this.acquireWrite();
        try {
            return await fn();
        } finally {
            this.releaseWrite();
        }
    }

    /**
     * Получение статуса блокировки
     */
    getStatus() {
        return {
            readers: this.readers,
            writers: this.writers,
            readQueue: this.readQueue.length,
            writeQueue: this.writeQueue.length
        };
    }
}

/**
 * Условная переменная для ожидания определенных условий
 */
export class AsyncCondition {
    private waitQueue: Array<{
        condition: () => boolean;
        resolve: () => void;
    }> = [];

    /**
     * Ожидание выполнения условия
     */
    async wait(condition: () => boolean): Promise<void> {
        if (condition()) {
            return;
        }

        return new Promise<void>((resolve) => {
            this.waitQueue.push({ condition, resolve });
        });
    }

    /**
     * Уведомление о возможном изменении условий
     */
    notifyAll(): void {
        let i = 0;
        while (i < this.waitQueue.length) {
            const waiter = this.waitQueue[i];
            if (waiter && waiter.condition()) {
                this.waitQueue.splice(i, 1);
                waiter.resolve();
            } else {
                i++;
            }
        }
    }

    /**
     * Получение количества ожидающих
     */
    getWaitingCount(): number {
        return this.waitQueue.length;
    }
}
