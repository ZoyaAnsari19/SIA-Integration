import { FastifyReply, FastifyRequest } from 'fastify';
import jwt, { Secret } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || JWT_SECRET;

export async function adminAuth(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers['authorization'] || '';
  const token = header.toString().replace(/^Bearer\s+/i, '');
  
  if (!token) {
    return reply.code(401).send({ error: 'unauthorized', message: 'No token provided' });
  }

  // First, try to verify as JWT token (from admin login)
  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET as Secret) as any;
    // Check for admin roles: SUPER_ADMIN, SUB_ADMIN, or legacy 'admin'
    if (decoded.role === 'SUPER_ADMIN' || decoded.role === 'SUB_ADMIN' || decoded.role === 'admin' || decoded.admin === true) {
      // Valid admin JWT token
      (req as any).admin = decoded;
      return; // Success
    }
  } catch (e) {
    // Not a valid JWT, continue to check as ADMIN_TOKEN
  }

  // Fallback: Check if token matches ADMIN_TOKEN (direct token authentication)
  const adminToken = process.env.ADMIN_TOKEN;
  if (adminToken && token === adminToken) {
    // Valid direct admin token
    (req as any).admin = { role: 'admin', authenticated: true };
    return; // Success
  }

  // Neither JWT nor direct token is valid
  return reply.code(401).send({ error: 'unauthorized', message: 'Invalid admin token' });
}


