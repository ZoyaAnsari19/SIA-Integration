import { FastifyRequest, FastifyReply } from 'fastify';
import util from 'node:util';

/**
 * Logger utility that conditionally logs based on DEBUG environment variable
 * Local dev default: enabled unless DEBUG is explicitly false-ish.
 */
class Logger {
  private isDebugEnabled: boolean = false;

  constructor() {
    // Check if DEBUG is enabled (case-insensitive, accepts 'true', '1', 'yes')
    // Re-check on each access to allow runtime changes
    this.updateDebugStatus();
  }

  private updateDebugStatus(): void {
    const debugEnvRaw = process.env.DEBUG;
    if (debugEnvRaw === undefined || debugEnvRaw === null || debugEnvRaw.trim() === '') {
      // Default to enabled in non-production to make local debugging easy.
      this.isDebugEnabled = process.env.NODE_ENV !== 'production';
      return;
    }

    const debugEnv = debugEnvRaw.toLowerCase().trim();
    if (debugEnv === 'false' || debugEnv === '0' || debugEnv === 'no') {
      this.isDebugEnabled = false;
      return;
    }
    this.isDebugEnabled = debugEnv === 'true' || debugEnv === '1' || debugEnv === 'yes';
  }

  private pretty(obj: unknown, opts?: { maxLength?: number }): string {
    const out = util.inspect(obj, { depth: 6, colors: true, maxArrayLength: 50, breakLength: 120 });
    const maxLength = opts?.maxLength ?? 20_000;
    if (out.length <= maxLength) return out;
    return out.slice(0, maxLength) + `\n... (truncated, total ${out.length} chars)`;
  }

  private divider(title: string): void {
    const ts = new Date().toISOString();
    // Keep it readable in terminals; avoid JSON walls.
    console.log(`\n========== ${title} @ ${ts} ==========\n`);
  }

  /**
   * Log request details
   */
  logRequest(req: FastifyRequest): void {
    this.updateDebugStatus();
    if (!this.isDebugEnabled) return;

    // Get body - it should be available in preValidation hook
    const body = req.body !== undefined ? this.sanitizeBody(req.body) : null;
    
    // Get params - handle both regular params and wildcard params
    const params = req.params || {};
    // Also check for wildcard params (like * in routes)
    if ((req as any).params && typeof (req as any).params === 'object') {
      Object.assign(params, (req as any).params);
    }

    this.divider('REQUEST');
    console.log(`${req.method} ${req.url}`);
    const routePath = (req as any).routeOptions?.url || req.url;
    if (routePath && routePath !== req.url) console.log(`route: ${routePath}`);
    console.log(`ip: ${req.ip} | host: ${req.hostname}`);
    if (Object.keys(params).length > 0) console.log(`params:\n${this.pretty(params)}`);
    if (req.query && Object.keys(req.query as any).length > 0) console.log(`query:\n${this.pretty(req.query)}`);
    if (body !== null) console.log(`body:\n${this.pretty(body, { maxLength: 10_000 })}`);
    const headers = this.sanitizeHeaders(req.headers);
    if (headers && Object.keys(headers).length > 0) console.log(`headers:\n${this.pretty(headers, { maxLength: 10_000 })}`);
  }

  /**
   * Log response details
   */
  logResponse(req: FastifyRequest, reply: FastifyReply, responseTime?: number, payload?: any): void {
    this.updateDebugStatus();
    if (!this.isDebugEnabled) return;

    this.divider('RESPONSE');
    const routePath = (req as any).routeOptions?.url || req.url;
    console.log(`${req.method} ${req.url}`);
    if (routePath && routePath !== req.url) console.log(`route: ${routePath}`);
    console.log(`status: ${reply.statusCode}${responseTime ? ` | time: ${responseTime}ms` : ''}`);

    if (payload !== undefined) {
      try {
        if (Buffer.isBuffer(payload)) {
          console.log(`response: <Buffer ${payload.length} bytes>`);
        } else if (payload && typeof payload === 'object' && 'pipe' in payload) {
          console.log('response: <Stream>');
        } else if (typeof payload === 'string') {
          // Often JSON string
          try {
            const parsed = JSON.parse(payload);
            console.log(`response:\n${this.pretty(parsed, { maxLength: 15_000 })}`);
          } catch {
            console.log(`response:\n${payload.length > 15_000 ? payload.slice(0, 15_000) + '\n... (truncated)' : payload}`);
          }
        } else {
          console.log(`response:\n${this.pretty(payload, { maxLength: 15_000 })}`);
        }
      } catch {
        console.log('response: <unprintable>');
      }
    }
  }

  /**
   * Log error
   */
  logError(error: Error, context?: Record<string, any>): void {
    this.updateDebugStatus();
    if (!this.isDebugEnabled) return;

    const logData = {
      timestamp: new Date().toISOString(),
      type: 'ERROR',
      message: error.message,
      stack: error.stack,
      ...context,
    };

    this.divider('ERROR');
    console.error(this.pretty(logData, { maxLength: 30_000 }));
  }

  /**
   * General info log
   */
  info(message: string, data?: any): void {
    this.updateDebugStatus();
    if (!this.isDebugEnabled) return;

    const logData = {
      timestamp: new Date().toISOString(),
      type: 'INFO',
      message,
      ...(data && { data }),
    };

    this.divider('INFO');
    console.log(this.pretty(logData, { maxLength: 30_000 }));
  }

  /**
   * Sanitize sensitive data from request body
   */
  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sensitiveFields = ['password', 'token', 'secret', 'authorization', 'apiKey', 'apikey'];
    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    }

    return sanitized;
  }

  /**
   * Sanitize sensitive data from headers
   */
  private sanitizeHeaders(headers: any): any {
    if (!headers || typeof headers !== 'object') return headers;

    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    const sanitized = { ...headers };

    for (const header of sensitiveHeaders) {
      const lowerHeader = header.toLowerCase();
      for (const key in sanitized) {
        if (key.toLowerCase() === lowerHeader) {
          sanitized[key] = '***REDACTED***';
        }
      }
    }

    return sanitized;
  }
}

// Export singleton instance
export const logger = new Logger();

