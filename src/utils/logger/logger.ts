import { existsSync, mkdirSync } from 'fs';
import { promises as fs } from 'fs';
import { join } from 'path';
import type {
  SeverityLevel,
  Breadcrumb,
  User,
  EventHint,
  CaptureContext,
  ScopeContext,
  ScopeData
} from '@sentry/core';

export interface ISentryLogger {
  captureException(exception: Error, hint?: EventHint, context?: CaptureContext): Promise<string>;
  captureMessage(message: string, level?: SeverityLevel, hint?: EventHint, context?: CaptureContext): Promise<string>;
  setUser(user: User): void;
  setTag(key: string, value: string): void;
  setTags(tags: Record<string, string>): void;
  setExtra(key: string, value: unknown): void;
  setExtras(extras: Record<string, unknown>): void;
  setContext(name: string, context: ScopeContext): void;
  addBreadcrumb(breadcrumb: Breadcrumb): void;
  withScope(callback: (scope: ScopeData) => void): void;
}

class FileLogger implements ISentryLogger {
  private logsDir: string;
  private logFile: string;
  private user: User | null = null;
  private tags: Record<string, string> = {};
  private extras: Record<string, unknown> = {};
  private contexts: Record<string, ScopeContext> = {};
  private breadcrumbs: Breadcrumb[] = [];
  private maxLogFileSize: number = 5 * 1024 * 1024; // 5 MB

  constructor(logsDir: string = './logs') {
    this.logsDir = logsDir;
    this.logFile = join(logsDir, 'app.log');
    this.ensureLogDir();
  }

  private ensureLogDir(): void {
    if (!existsSync(this.logsDir)) {
      mkdirSync(this.logsDir, { recursive: true });
    }
  }

  private formatLogEntry(level: SeverityLevel | string, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      user: this.user,
      tags: Object.keys(this.tags).length > 0 ? this.tags : undefined,
      extras: Object.keys(this.extras).length > 0 ? this.extras : undefined,
      contexts: Object.keys(this.contexts).length > 0 ? this.contexts : undefined,
      breadcrumbs: this.breadcrumbs.length > 0 ? this.breadcrumbs.slice(-10) : undefined, // Keep last 10 breadcrumbs
      data
    };

    return JSON.stringify(logEntry, null, 2) + '\n---\n';
  }

  private async rotateLogFile(): Promise<void> {
    const stats = existsSync(this.logFile) ? await fs.stat(this.logFile) : null;
    if (stats && stats.size > this.maxLogFileSize) {
      const rotatedFile = `${this.logFile}.${new Date().toISOString().replace(/[:.]/g, '-')}`;
      await fs.rename(this.logFile, rotatedFile);
    }
  }

  private async writeLogAsync(logEntry: string): Promise<void> {
    try {
      await this.rotateLogFile();
      await fs.appendFile(this.logFile, logEntry);
    } catch (writeError) {
      console.error('Failed to write to log file:', writeError);
    }
  }

  async captureException(exception: Error, _hint?: EventHint, _context?: CaptureContext): Promise<string> {
    const errorData = {
      name: exception.name,
      message: exception.message,
      stack: exception.stack,
      context: _context
    };
    const logEntry = this.formatLogEntry('error', `Exception: ${exception.message}`, errorData);
    await this.writeLogAsync(logEntry);
    return this.generateEventId();
  }

  async captureMessage(message: string, level: SeverityLevel | string = 'info', _hint?: EventHint, _context?: CaptureContext): Promise<string> {
    const logEntry = this.formatLogEntry(level, message);
    await this.writeLogAsync(logEntry);
    return this.generateEventId();
  }

  setUser(user: User): void {
    this.user = user;
  }

  setTag(key: string, value: string): void {
    this.tags[key] = value;
  }

  setTags(tags: Record<string, string>): void {
    this.tags = { ...this.tags, ...tags };
  }

  setExtra(key: string, value: unknown): void {
    this.extras[key] = value;
  }

  setExtras(extras: Record<string, unknown>): void {
    this.extras = { ...this.extras, ...extras };
  }

  setContext(name: string, context: ScopeContext): void {
    this.contexts[name] = context;
  }

  addBreadcrumb(breadcrumb: Breadcrumb): void {
    this.breadcrumbs.push({
      ...breadcrumb,
      timestamp: Math.floor(Date.now() / 1000) as number
    });
    if (this.breadcrumbs.length > 100) {
      this.breadcrumbs = this.breadcrumbs.slice(-100);
    }
  }

  withScope(callback: (scope: ScopeData) => void): void {
    callback({} as ScopeData);
  }

  private generateEventId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  async info(message: string, _data?: unknown): Promise<string> {
    return this.captureMessage(message, 'info');
  }

  async warn(message: string, _data?: unknown): Promise<string> {
    return this.captureMessage(message, 'warning');
  }

  async error(message: string, _data?: unknown): Promise<string> {
    return this.captureMessage(message, 'error');
  }

  async debug(message: string, _data?: unknown): Promise<string> {
    return this.captureMessage(message, 'debug');
  }

  async fatal(message: string, _data?: unknown): Promise<string> {
    return this.captureMessage(message, 'fatal');
  }
}

export function createLogger(): ISentryLogger {
  return new FileLogger();
}

export const logger = createLogger();

export default logger;
