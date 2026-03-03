import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export class Logger {
  private static instance: Logger;
  private logFile: string | null = null;
  private logDir: string | null = null;
  private maxFileSize = 10 * 1024 * 1024; // 10MB
  private maxFiles = 5;

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setLogDir(dir: string): void {
    this.logDir = dir;
    this.ensureLogDirExists();
    this.logFile = path.join(dir, `app-${new Date().toISOString().split('T')[0]}.log`);
  }

  public setMaxFileSize(size: number): void {
    this.maxFileSize = size;
  }

  public setMaxFiles(count: number): void {
    this.maxFiles = count;
  }

  private ensureLogDirExists(): void {
    if (this.logDir && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private rotateLogFile(): void {
    if (!this.logFile) return;

    try {
      const stats = fs.statSync(this.logFile);
      if (stats.size >= this.maxFileSize) {
        const dir = path.dirname(this.logFile);
        const baseName = path.basename(this.logFile, '.log');
        
        // 旋转日志文件
        for (let i = this.maxFiles - 1; i > 0; i--) {
          const oldFile = path.join(dir, `${baseName}.${i}.log`);
          const newFile = path.join(dir, `${baseName}.${i + 1}.log`);
          
          if (fs.existsSync(oldFile)) {
            if (fs.existsSync(newFile)) {
              fs.unlinkSync(newFile);
            }
            fs.renameSync(oldFile, newFile);
          }
        }
        
        const firstBackup = path.join(dir, `${baseName}.1.log`);
        if (fs.existsSync(firstBackup)) {
          fs.unlinkSync(firstBackup);
        }
        fs.renameSync(this.logFile, firstBackup);
      }
    } catch (error) {
      console.error('Error rotating log file:', error);
    }
  }

  public log(level: LogLevel, message: string, meta?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}${meta ? ' ' + JSON.stringify(meta) : ''}\n`;
    
    // 输出到控制台
    switch (level) {
      case LogLevel.DEBUG:
        console.log(logMessage);
        break;
      case LogLevel.INFO:
        console.info(logMessage);
        break;
      case LogLevel.WARN:
        console.warn(logMessage);
        break;
      case LogLevel.ERROR:
        console.error(logMessage);
        break;
    }

    // 输出到文件
    if (this.logFile) {
      try {
        this.rotateLogFile();
        fs.appendFileSync(this.logFile, logMessage);
      } catch (error) {
        console.error('Error writing to log file:', error);
      }
    }
  }

  public debug(message: string, meta?: any): void {
    this.log(LogLevel.DEBUG, message, meta);
  }

  public info(message: string, meta?: any): void {
    this.log(LogLevel.INFO, message, meta);
  }

  public warn(message: string, meta?: any): void {
    this.log(LogLevel.WARN, message, meta);
  }

  public error(message: string, meta?: any): void {
    this.log(LogLevel.ERROR, message, meta);
  }
}

export const logger = Logger.getInstance();