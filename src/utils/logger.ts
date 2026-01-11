/**
 * Simple logger utility for Lambda functions
 * Uses console.warn for CloudWatch compatibility
 */
export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  info(message: string, data?: any): void {
    console.warn(`[${this.context}] INFO: ${message}`, data ? JSON.stringify(data) : '');
  }

  error(message: string, error?: any): void {
    console.error(`[${this.context}] ERROR: ${message}`, error);
  }

  warn(message: string, data?: any): void {
    console.warn(`[${this.context}] WARN: ${message}`, data ? JSON.stringify(data) : '');
  }

  debug(message: string, data?: any): void {
    if (process.env.DEBUG === 'true') {
      console.warn(`[${this.context}] DEBUG: ${message}`, data ? JSON.stringify(data) : '');
    }
  }
}
