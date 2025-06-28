import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { LogLevel, ExecResult, SystemInfo, OVPNConfig } from './types';

const execAsync = promisify(exec);

/**
 * Утилиты для логирования
 */
export class Logger {
    private levels: Record<LogLevel, number> = {
        error: 0,
        warn: 1,
        info: 2,
        debug: 3
    };
    private currentLevel: number = 2; // default to 'info' level

    constructor(level: LogLevel = 'info') {
        this.setLevel(level);
    }

    setLevel(level: LogLevel): void {
        this.currentLevel = this.levels[level] || this.levels.info;
    }

    private log(level: LogLevel, message: string, ...args: any[]): void {
        if (this.levels[level] <= this.currentLevel) {
            const timestamp = new Date().toISOString();
            const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
            console.log(prefix, message, ...args);
        }
    }

    error(message: string, ...args: any[]): void {
        this.log('error', message, ...args);
    }

    warn(message: string, ...args: any[]): void {
        this.log('warn', message, ...args);
    }

    info(message: string, ...args: any[]): void {
        this.log('info', message, ...args);
    }

    debug(message: string, ...args: any[]): void {
        this.log('debug', message, ...args);
    }
}

// Создаем глобальный логгер
export const logger = new Logger((process.env.LOG_LEVEL as LogLevel) || 'info');

/**
 * Задержка выполнения
 */
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Безопасное выполнение асинхронной функции с повторными попытками
 */
export async function retryAsync<T>(
    fn: () => Promise<T>,
    retries: number = 3,
    delayMs: number = 1000
): Promise<T> {
    let lastError: Error;
    
    for (let i = 0; i <= retries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;
            
            if (i < retries) {
                logger.warn(`Attempt ${i + 1} failed, retrying in ${delayMs}ms:`, (error as Error).message);
                await delay(delayMs);
                delayMs *= 2; // Exponential backoff
            }
        }
    }
    
    throw lastError!;
}

/**
 * Проверка существования файла
 */
export function fileExists(filePath: string): boolean {
    try {
        return fs.existsSync(filePath);
    } catch {
        return false;
    }
}

/**
 * Безопасное чтение JSON файла
 */
export function readJsonFile<T = any>(filePath: string): T | null {
    try {
        if (!fileExists(filePath)) {
            return null;
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content) as T;
    } catch (error) {
        logger.error(`Failed to read JSON file ${filePath}:`, (error as Error).message);
        return null;
    }
}

/**
 * Безопасная запись JSON файла
 */
export function writeJsonFile(filePath: string, data: any): boolean {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        logger.error(`Failed to write JSON file ${filePath}:`, (error as Error).message);
        return false;
    }
}

/**
 * Получение списка файлов в директории с фильтрацией
 */
export function getFilesInDirectory(dirPath: string, extensions: string[] = []): string[] {
    try {
        if (!fs.existsSync(dirPath)) {
            return [];
        }
        
        const files = fs.readdirSync(dirPath);
        
        if (extensions.length === 0) {
            return files.map(file => path.join(dirPath, file));
        }
        
        return files
            .filter(file => extensions.some(ext => file.endsWith(ext)))
            .map(file => path.join(dirPath, file));
    } catch (error) {
        logger.error(`Failed to read directory ${dirPath}:`, (error as Error).message);
        return [];
    }
}

/**
 * Форматирование размера файла в человекочитаемый вид
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) {return '0 Bytes';}
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Форматирование времени в человекочитаемый вид
 */
export function formatDuration(ms: number): string {
    if (ms < 1000) {
        return `${ms}ms`;
    }
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

/**
 * Генерация случайного ID
 */
export function generateId(length: number = 8): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
}

/**
 * Валидация IP адреса
 */
export function isValidIP(ip: string): boolean {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Валидация URL
 */
export function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Очистка строки от небезопасных символов
 */
export function sanitizeString(str: string): string {
    if (typeof str !== 'string') {
        return '';
    }
    
    return str
        .replace(/[<>"'&]/g, '') // Удаляем потенциально опасные символы
        .trim();
}

/**
 * Получение информации о системе
 */
export function getSystemInfo(): SystemInfo {
    return {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        uptime: os.uptime(),
        nodeVersion: process.version,
        hostname: os.hostname()
    };
}

/**
 * Проверка наличия команды в системе
 */
export function commandExists(command: string): boolean {
    try {
        const which = process.platform === 'win32' ? 'where' : 'which';
        execAsync(`${which} ${command}`, { stdio: 'ignore' } as any);
        return true;
    } catch {
        return false;
    }
}

/**
 * Выполнение команды shell с таймаутом
 */
export async function execWithTimeout(command: string, timeout: number = 30000): Promise<ExecResult> {
    try {
        const { stdout, stderr } = await execAsync(command, { timeout });
        return { stdout: stdout.trim(), stderr: stderr.trim() };
    } catch (error) {
        throw new Error(`Command timeout or error: ${(error as Error).message}`);
    }
}

/**
 * Throttling функции
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    
    return function(this: any, ...args: Parameters<T>): void {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Debouncing функции
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    
    return function(this: any, ...args: Parameters<T>): void {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * Создание безопасного временного файла
 */
export function createTempFile(prefix: string = 'palivpn', extension: string = '.tmp'): string {
    const randomName = crypto.randomBytes(16).toString('hex');
    const fileName = `${prefix}-${randomName}${extension}`;
    
    return path.join(os.tmpdir(), fileName);
}

/**
 * Парсинг конфигурационного файла OpenVPN
 */
export function parseOVPNConfig(filePath: string): OVPNConfig | null {
    try {
        if (!fileExists(filePath)) {
            throw new Error(`OVPN file not found: ${filePath}`);
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const config: OVPNConfig = {};
        let inDataBlock: string | null = null;
        
        lines.forEach(line => {
            line = line.trim();
            
            // Пропускаем комментарии и пустые строки
            if (line.startsWith('#') || line.startsWith(';') || !line) {
                return;
            }
            
            // Обработка блоков данных (сертификаты, ключи)
            if (line.startsWith('<') && line.endsWith('>')) {
                const tag = line.slice(1, -1);
                if (inDataBlock) {
                    inDataBlock = null;
                } else {
                    inDataBlock = tag;
                    config[tag] = '';
                }
                return;
            }
            
            if (inDataBlock) {
                config[inDataBlock] += line + '\n';
                return;
            }
            
            // Обработка обычных параметров
            const [key, ...valueParts] = line.split(/\s+/);
            const value = valueParts.join(' ');
            
            if (key) {
                config[key] = value || true;
            }
        });
        
        return config;
    } catch (error) {
        logger.error(`Failed to parse OVPN config ${filePath}:`, (error as Error).message);
        return null;
    }
}
