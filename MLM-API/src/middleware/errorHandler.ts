import { FastifyInstance } from 'fastify';

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err, _req, reply) => {
    const status = (err as any).statusCode || 500;
    reply.code(status).send({ error: err.name || 'Error', message: err.message });
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({ error: 'NotFound' });
  });
}


