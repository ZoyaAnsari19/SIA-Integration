import { FastifyInstance } from 'fastify';
import { requireUser } from '../middleware/jwt.js';
import { createPayment, paymentCallback } from './icici-payment.controller.js';

export async function iciciPaymentRoutes(app: FastifyInstance) {
  /**
   * POST /api/v1/payments/icici/create-payment
   * Create ICICI payment and get redirect URL
   */
  app.post('/create-payment', {
    preHandler: requireUser,
    schema: {
      description: 'Create ICICI payment for course purchase',
      tags: ['Payments'],
      summary: 'Create ICICI Payment',
      body: {
        type: 'object',
        properties: {
          courseId: { type: ['string', 'null'] },
          courseIds: {
            type: ['array', 'null'],
            items: { type: 'string' }
          },
          amount: { type: ['number', 'null'] },
          customerName: { type: ['string', 'null'] },
          customerEmail: { type: ['string', 'null'] },
          customerMobile: { type: ['string', 'null'] }
        }
      }
    },
    // Log request for debugging
    onRequest: async (request, reply) => {
      console.log('=== CREATE PAYMENT REQUEST ===');
      console.log('Method:', request.method);
      console.log('URL:', request.url);
      console.log('Headers:', JSON.stringify(request.headers, null, 2));
      console.log('Body:', JSON.stringify(request.body, null, 2));
      console.log('================================');
    }
  }, createPayment);

  /**
   * POST /api/v1/payments/icici/callback
   * Payment callback from ICICI gateway (public endpoint, no auth)
   * Gateway sends application/x-www-form-urlencoded
   * Fastify automatically parses form-urlencoded bodies
   */
  app.post('/callback', {
    schema: {
      description: 'ICICI payment gateway callback',
      tags: ['Payments'],
      summary: 'Payment Callback',
      consumes: ['application/x-www-form-urlencoded'],
      // No body schema - gateway sends form-urlencoded
    },
    // Disable body schema validation for form-urlencoded
    bodyLimit: 1048576, // 1MB limit
  }, async (request, reply) => {
    // Fastify should parse form-urlencoded automatically
    // Log raw body for debugging
    console.log('Callback route - Content-Type:', request.headers['content-type']);
    console.log('Callback route - Body type:', typeof request.body);
    console.log('Callback route - Body:', request.body);
    return paymentCallback(request, reply);
  });
}
