/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success' | 'debug';
  category: 'system' | 'converter' | 'compiler';
  message: string;
}

type LogListener = (logs: LogEntry[]) => void;

class AppLogger {
  private logs: LogEntry[] = [];
  private listeners: Set<LogListener> = new Set();

  constructor() {
    this.info('system', 'HEIC Batch Converter Pro Engine initialized.');
    this.info('system', `Browser Platform: ${navigator.platform || 'Unknown'}`);
    this.info('system', `User Agent: ${navigator.userAgent}`);
    
    // Check for standard modern features
    const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
    const hasCanvasCapture = typeof HTMLCanvasElement !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream;
    this.info('system', `MediaRecorder API Support: ${hasMediaRecorder ? 'YES' : 'NO'}`);
    this.info('system', `Canvas captureStream API Support: ${hasCanvasCapture ? 'YES' : 'NO'}`);

    if (hasMediaRecorder) {
      // Test some standard MIME types
      const mimeTypesToTest = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4;codecs=avc1',
        'video/mp4;codecs=h264',
        'video/mp4',
      ];
      const supported = mimeTypesToTest.filter(m => MediaRecorder.isTypeSupported(m));
      this.info('system', `Supported MediaRecorder MIME formats: ${supported.length > 0 ? supported.join(', ') : 'None'}`);
    }
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public clear(): void {
    this.logs = [];
    this.info('system', 'Activity logs cleared by user.');
    this.notify();
  }

  private addEntry(level: LogEntry['level'], category: LogEntry['category'], message: string) {
    const entry: LogEntry = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toLocaleTimeString(undefined, { hour12: false, fractionalSecondDigits: 3 } as any),
      level,
      category,
      message,
    };
    this.logs.push(entry);
    this.notify();
    
    // Output beautiful developer console logs as well
    const colors = {
      info: 'color: #3b82f6; font-weight: bold',
      warn: 'color: #eab308; font-weight: bold',
      error: 'color: #ef4444; font-weight: bold',
      success: 'color: #10b981; font-weight: bold',
      debug: 'color: #6b7280',
    };
    console.log(`%c[${category.toUpperCase()}] [${level.toUpperCase()}] %c${message}`, colors[level], 'color: inherit');
  }

  public info(category: LogEntry['category'], message: string) {
    this.addEntry('info', category, message);
  }

  public warn(category: LogEntry['category'], message: string) {
    this.addEntry('warn', category, message);
  }

  public error(category: LogEntry['category'], message: string) {
    this.addEntry('error', category, message);
  }

  public success(category: LogEntry['category'], message: string) {
    this.addEntry('success', category, message);
  }

  public debug(category: LogEntry['category'], message: string) {
    this.addEntry('debug', category, message);
  }

  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    // Initial sync
    listener(this.getLogs());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const logsCopy = this.getLogs();
    this.listeners.forEach(listener => {
      try {
        listener(logsCopy);
      } catch (e) {
        console.error('Error notifying log listener', e);
      }
    });
  }
}

export const logger = new AppLogger();
