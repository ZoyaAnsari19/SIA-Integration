import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import formbody from '@fastify/formbody';
import { env } from './config/env.js';
import { registerRoutes } from './routes/index.js';
import { registerErrorHandler } from './middleware/errorHandler.js';
import { registerRequestLogger } from './middleware/requestLogger.js';

// Global BigInt serialization fix
(BigInt.prototype as any).toJSON = function() {
  return this.toString();
};

export async function buildApp() {
  const app = Fastify({ logger: true });

  // Enable CORS for frontend requests
  // Use CORS_ORIGIN env var if set, otherwise allow all origins
  const corsOrigin = process.env.CORS_ORIGIN;
  const corsConfig: any = {
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  };
  
  if (corsOrigin) {
    // Parse comma-separated origins from env var
    // Normalize origins (remove trailing slashes for matching)
    const allowedOrigins = corsOrigin.split(',').map(origin => {
      const trimmed = origin.trim();
      return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
    });
    
    corsConfig.origin = (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void) => {
      // Allow requests with no origin (same-origin, mobile apps, etc.)
      if (!origin) {
        cb(null, true);
        return;
      }
      // Normalize origin (remove trailing slash for matching)
      const normalizedOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;

      // Always allow localhost for local development, regardless of CORS_ORIGIN
      const isLocalhost =
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedOrigin);
      if (isLocalhost) {
        cb(null, true);
        return;
      }

      // Check if origin is in allowed list
      if (allowedOrigins.includes(normalizedOrigin)) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    };
  } else {
    // Fallback: Allow all origins if CORS_ORIGIN not set
    corsConfig.origin = true;
  }
  
  await app.register(cors, corsConfig);

  // Register formbody plugin for application/x-www-form-urlencoded (ICICI payment gateway callback)
  await app.register(formbody);

  // Register multipart plugin for file uploads
  // Note: For course videos, we use direct browser upload (bypasses server)
  // This limit is for legacy upload endpoint and other file uploads
  await app.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024 * 1024, // 5GB max file size (for admin video uploads)
      files: 10, // Max number of files
    },
  });

  await app.register(swagger, {
    openapi: {
      info: { 
        title: 'MLM API', 
        version: '0.1.0',
        description: 'MLM Commission System API with KYC verification'
      },
      servers: [
        {
          url: `http://localhost:${env.port}`,
          description: 'Local development server'
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT token obtained from /api/v1/users/login'
          },
          adminAuth: {
            type: 'http',
            scheme: 'bearer',
            description: 'Admin token (ADMIN_TOKEN from environment)'
          }
        }
      },
      tags: [
        { name: 'Authentication', description: 'User authentication endpoints' },
        { name: 'Dashboard', description: 'User dashboard statistics and overview endpoints' },
        { name: 'Income History', description: 'Income history endpoints (self, global help, spot, team, direct)' },
        { name: 'Profile', description: 'User profile management endpoints' },
        { name: 'My Course', description: 'User course/purchase history endpoints' },
        { name: 'Team', description: 'Team management and statistics endpoints' },
        { name: 'Payment History', description: 'Payment and wallet transaction history endpoints' },
        { name: 'Path Rank', description: 'Path rank and level eligibility endpoints' },
        { name: 'Fees', description: 'Fee rules and transaction history endpoints' },
        { name: 'Withdraw', description: 'Withdraw request management endpoints' },
        { name: 'Reports', description: 'Report generation and download endpoints' },
        { name: 'Users', description: 'User management endpoints including levels and eligibility' },
        { name: 'Commissions', description: 'User commission history and reports endpoints' },
        { name: 'Wallet', description: 'User wallet transactions and ledger entries endpoints' },
        { name: 'KYC', description: 'KYC submission and status endpoints' },
        { name: 'Admin KYC', description: 'Admin KYC management endpoints' },
        { name: 'Admin Users', description: 'Admin user management endpoints' },
        { name: 'Packages', description: 'Package management endpoints' },
        { name: 'Admin Packages', description: 'Admin package management endpoints' },
        { name: 'Purchases', description: 'Purchase endpoints' },
        { name: 'Admin Purchases', description: 'Admin purchase management endpoints' },
        { name: 'Reports', description: 'Reporting endpoints' },
        { name: 'Admin Dashboard', description: 'Admin dashboard statistics endpoints' },
        { name: 'Admin Reports', description: 'Admin reports and analytics endpoints' },
        { name: 'Admin Levels', description: 'Admin level management endpoints - configure level titles, rewards, and commission percentages' },
        { name: 'Admin Commissions', description: 'Admin commission management endpoints - view and manually credit/debit commissions' },
        { name: 'Admin Scheduled Commissions', description: 'Admin scheduled commissions management endpoints' },
        { name: 'Admin Eligibility', description: 'Admin eligibility management endpoints' },
        { name: 'Admin System', description: 'Admin system management endpoints (jobs, stats, audit)' },
        { name: 'Admin Fees', description: 'Admin fee rules and transaction management endpoints' },
        { name: 'Admin', description: 'Admin management endpoints' },
        { name: 'Leaderboard', description: 'Leaderboard and ranking endpoints with badges' },
        { name: 'SIA Public', description: 'Public SIA ecosystem endpoints (validate refer ID for Secure Pharma etc.)' }
      ]
    },
  });
  await app.register(swaggerUI, { 
    routePrefix: '/docs',
    uiConfig: {
      persistAuthorization: true,
      displayRequestDuration: true,
      deepLinking: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
    },
    staticCSP: false, // Disable strict CSP to allow Swagger UI to work
    transformSpecification: (swaggerObject, req, reply) => {
      return swaggerObject;
    },
    transformSpecificationClone: true,
  });

  // Register request/response logging (only logs when DEBUG=true)
  registerRequestLogger(app);

  await registerRoutes(app);

  app.get('/health', async () => {
    const out: { status: string; db?: string } = { status: 'ok' };
    if (process.env.NODE_ENV !== 'production' && process.env.DATABASE_URL) {
      const url = process.env.DATABASE_URL;
      const match = url.match(/@([^/]+)\//);
      out.db = match ? match[1] : url.replace(/:[^:@]+@/, ':****@').split('/')[0];
    }
    return out;
  });
  
  // Redirect root to Swagger UI
  app.get('/', async (req, reply) => {
    return reply.redirect('/docs');
  });

  registerErrorHandler(app);

  return app;
}
