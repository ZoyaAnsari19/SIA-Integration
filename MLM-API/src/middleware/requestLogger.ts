import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger.js';

/**
 * Register request/response logging hooks
 * Logs all incoming requests and outgoing responses when DEBUG=true
 */
export function registerRequestLogger(app: FastifyInstance): void {
  // Store response payload for logging
  const responsePayloads = new WeakMap<FastifyReply, any>();

  // Log basic request info early (before body parsing)
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Store request start time for logging
    (request as any).requestStartTime = Date.now();
  });

  // Log full request details after body is parsed (preValidation runs after body parsing)
  app.addHook('preValidation', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      logger.logRequest(request);
    } catch (error) {
      // Don't let logger errors break the request
      console.error('Logger error in preValidation:', error);
    }
  });

  // Capture response payload before sending
  app.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
    // Store the payload for logging in onResponse
    responsePayloads.set(reply, payload);
    return payload;
  });

  // Log outgoing response
  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Use elapsedTime instead of deprecated getResponseTime()
      const responseTime = (reply as any).elapsedTime || reply.getResponseTime?.();
      const payload = responsePayloads.get(reply);
      logger.logResponse(request, reply, responseTime, payload);
    } catch (error) {
      // Don't let logger errors break the response
      console.error('Logger error in onResponse:', error);
    }
  });

  // Log errors
  app.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    try {
      logger.logError(error, {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
      });
    } catch (logError) {
      // Don't let logger errors break error handling
      console.error('Logger error in onError:', logError);
    }
  });
}

