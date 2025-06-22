export class Logger {
  private readonly prefix = '[Analytics SDK]';
  
  constructor(private readonly enabled: boolean = false) {}

  debug(...args: unknown[]): void {
    if (this.enabled) {
      console.debug(this.prefix, ...args);
    }
  }

  info(...args: unknown[]): void {
    if (this.enabled) {
      console.info(this.prefix, ...args);
    }
  }

  warn(...args: unknown[]): void {
    console.warn(this.prefix, ...args);
  }

  error(...args: unknown[]): void {
    console.error(this.prefix, ...args);
  }
}