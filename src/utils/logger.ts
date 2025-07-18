// Simple logger utility
export class Logger {
    private prefix: string;

    constructor(prefix: string = 'BalancerV3Adapter') {
        this.prefix = prefix;
    }

    info(message: string, ...args: any[]): void {
        console.log(`[${this.prefix}] INFO: ${message}`, ...args);
    }

    error(message: string, ...args: any[]): void {
        console.error(`[${this.prefix}] ERROR: ${message}`, ...args);
    }

    warn(message: string, ...args: any[]): void {
        console.warn(`[${this.prefix}] WARN: ${message}`, ...args);
    }

    debug(message: string, ...args: any[]): void {
        console.debug(`[${this.prefix}] DEBUG: ${message}`, ...args);
    }
}
