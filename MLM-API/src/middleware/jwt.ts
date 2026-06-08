import { FastifyReply, FastifyRequest } from 'fastify';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export function signToken(payload: object, expiresIn = '7d') {
  return jwt.sign(payload as any, JWT_SECRET as Secret, { expiresIn } as SignOptions);
}

export async function requireUser(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers['authorization'] || '';
  const token = header.toString().replace(/^Bearer\s+/i, '');
  try {
    const decoded = jwt.verify(token, JWT_SECRET as Secret) as any;
    
    // Check if user is blocked/inactive
    if (decoded.user_id) {
      const user = await prisma.users.findUnique({
        where: { id: BigInt(decoded.user_id) },
        select: { status: true }
      });
      
      if (!user) {
        return reply.code(401).send({ error: 'user_not_found', message: 'User not found' });
      }
      
      if (user.status === 'inactive') {
        return reply.code(403).send({ error: 'account_blocked', message: 'Your account has been blocked. Please contact support.' });
      }
    }
    
    (req as any).user = decoded;
  } catch (e) {
    return reply.code(401).send({ error: 'unauthorized' });
  }
}


