import { existsSync, mkdirSync } from 'fs';
import { promises as fs } from 'fs';
import { join } from 'path';

// Sentry-compatible interfaces
export interface SentryUser {
  id?: string;
  username?: string;
  email?: string;
  ip_address?: string;
  [key: string]: any;
}

export interface SentryContext {
  [key: string]: any;
}

export interface SentryExtra {
  [key: string]: any;
}

export interface SentryTags {
  [key: string]: string;
}

export enum SeverityLevel {
  Fatal = 'fatal',
  Error = 'error',
  Warning = 'warning',
  Info = 'info',
  Debug = 'debug',
}

export interface ISentryLogger {
  captureException(exception: Error, context?: SentryContext): Promise<string>;
  captureMessage(message: string, level?: SeverityLevel): Promise<string>;
  setUser(user: SentryUser): void;
  setTag(key: string, value: string): void;
  setTags(tags: SentryTags): void;
  setExtra(key: string, value: any): void;
  setExtras(extras: SentryExtra): void;
  setContext(name: string, context: SentryContext): void;
  addBreadcrumb(breadcrumb: { message: string; level?: SeverityLevel; category?: string; data?: any }): void;
  withScope(callback: (scope: any) => void): void;
}

class FileLogger implements ISentryLogger {
  private logsDir: string;
  private logFile: string;
  private user: SentryUser | null = null;
  private tags: SentryTags = {};
  private extras: SentryExtra = {};
  private contexts: { [name: string]: SentryContext } = {};
  private breadcrumbs: Array<{ message: string; level?: SeverityLevel; category?: string; data?: any; timestamp: Date }> = [];
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

  private formatLogEntry(level: SeverityLevel, message: string, data?: any): string {
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

  async captureException(exception: Error, context?: SentryContext): Promise<string> {
    const errorData = {
      name: exception.name,
      message: exception.message,
      stack: exception.stack,
      context
    };

    const logEntry = this.formatLogEntry(SeverityLevel.Error, `Exception: ${exception.message}`, errorData);
    await this.writeLogAsync(logEntry);

    return this.generateEventId();
  }

  async captureMessage(message: string, level: SeverityLevel = SeverityLevel.Info): Promise<string> {
    const logEntry = this.formatLogEntry(level, message);
    await this.writeLogAsync(logEntry);

    return this.generateEventId();
  }

  setUser(user: SentryUser): void {
    this.user = user;
  }

  setTag(key: string, value: string): void {
    this.tags[key] = value;
  }

  setTags(tags: SentryTags): void {
    this.tags = { ...this.tags, ...tags };
  }

  setExtra(key: string, value: any): void {
    this.extras[key] = value;
  }

  setExtras(extras: SentryExtra): void {
    this.extras = { ...this.extras, ...extras };
  }

  setContext(name: string, context: SentryContext): void {
    this.contexts[name] = context;
  }

  addBreadcrumb(breadcrumb: { message: string; level?: SeverityLevel; category?: string; data?: any }): void {
    this.breadcrumbs.push({
      ...breadcrumb,
      timestamp: new Date()
    });

    // Keep only last 100 breadcrumbs to prevent memory issues
    if (this.breadcrumbs.length > 100) {
      this.breadcrumbs = this.breadcrumbs.slice(-100);
    }
  }

  withScope(callback: (scope: any) => void): void {
    // Create a temporary scope with current state
    const scope = {
      setUser: (user: SentryUser) => this.setUser(user),
      setTag: (key: string, value: string) => this.setTag(key, value),
      setTags: (tags: SentryTags) => this.setTags(tags),
      setExtra: (key: string, value: any) => this.setExtra(key, value),
      setExtras: (extras: SentryExtra) => this.setExtras(extras),
      setContext: (name: string, context: SentryContext) => this.setContext(name, context),
      addBreadcrumb: (breadcrumb: any) => this.addBreadcrumb(breadcrumb)
    };

    callback(scope);
  }

  private generateEventId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  // Additional utility methods
  async info(message: string, data?: any): Promise<string> {
    return this.captureMessage(message, SeverityLevel.Info);
  }

  async warn(message: string, data?: any): Promise<string> {
    return this.captureMessage(message, SeverityLevel.Warning);
  }

  async error(message: string, data?: any): Promise<string> {
    return this.captureMessage(message, SeverityLevel.Error);
  }

  async debug(message: string, data?: any): Promise<string> {
    return this.captureMessage(message, SeverityLevel.Debug);
  }

  async fatal(message: string, data?: any): Promise<string> {
    return this.captureMessage(message, SeverityLevel.Fatal);
  }
}

// Logger factory function
export function createLogger(): ISentryLogger {
  // Fallback to file logger
  return new FileLogger();
}

// Default logger instance
export const logger = createLogger();

export default logger;
