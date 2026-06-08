import { FastifyInstance } from 'fastify';
import { adminAuth } from '../middleware/adminAuth.js';
import { checkPermission } from '../middleware/checkPermission.js';
import { superAdminAuth } from '../middleware/superAdminAuth.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { bunnyCDNService } from '../modules/bunny-cdn/bunny-cdn.service.js';
import {
  SUPPORT_ALLOWED_IMAGE_TYPES,
  SUPPORT_UPLOAD_ALLOWED_MIME_TYPES,
  SUPPORT_MAX_FILE_SIZE_MB,
  classifySupportAttachmentType,
  resolveSupportAttachmentExtension,
} from '../modules/support/support-upload.config.js';

const SUPPORT_ATTACHMENTS_FOLDER = 'support_attachments';

/** Normalize a single attachment row (from DB or request body) to { url, type, filename }. Only include if url is present. */
function normalizeAttachmentItem(row: unknown): { url: string; type: string; filename: string } | null {
  if (!row || typeof row !== 'object') return null;
  const a = row as Record<string, unknown>;
  const url =
    (typeof a.url === 'string' && a.url) ||
    (typeof a.file_url === 'string' && a.file_url) ||
    (typeof a.attachment_url === 'string' && a.attachment_url) ||
    (typeof (a as any).cdnUrl === 'string' && (a as any).cdnUrl) ||
    (typeof a.href === 'string' && a.href) ||
    '';
  if (!url) return null;
  const type =
    (typeof a.type === 'string' && a.type) ||
    (typeof a.mime_type === 'string' && a.mime_type) ||
    '';
  const filename =
    (typeof a.filename === 'string' && a.filename) ||
    (typeof a.file_name === 'string' && a.file_name) ||
    (typeof a.name === 'string' && a.name) ||
    '';
  return { url, type, filename };
}

export async function adminSupportRoutes(app: FastifyInstance) {
  /**
   * GET /admin/support/tickets
   * List tickets (filter: status, assigned_to, search_name, search_id, page, limit).
   * - SUB_ADMIN: see unassigned + assigned to me
   * - SUPER_ADMIN: see all
   */
  app.get('/support/tickets', {
    preHandler: [adminAuth, checkPermission('TICKET_VIEW')],
    schema: {
      description: 'List support tickets',
      tags: ['Admin Support'],
    },
  }, async (request, reply) => {
    try {
      const admin = (request as any).admin;
      const page = Math.max(1, parseInt((request.query as any)?.page || '1', 10));
      const limit = Math.min(50, Math.max(1, parseInt((request.query as any)?.limit || '20', 10)));
      const status = (request.query as any)?.status;
      const assignedTo = (request.query as any)?.assigned_to;
      const searchName = ((request.query as any)?.search_name || '').trim();
      const searchId = ((request.query as any)?.search_id || '').trim();
      const dateFromStr = ((request.query as any)?.date_from || '').trim();
      const dateToStr = ((request.query as any)?.date_to || '').trim();

      const where: Prisma.support_ticketsWhereInput = {};
      if (status && ['open', 'in_progress', 'closed'].includes(status)) {
        where.status = status;
      }
      if (assignedTo === 'me' && admin?.user_id) {
        where.assigned_to = BigInt(admin.user_id);
      } else if (assignedTo && assignedTo !== 'me') {
        where.assigned_to = BigInt(assignedTo);
      }

      if (searchName || searchId) {
        where.user = {};
        if (searchName) {
          (where.user as Prisma.usersWhereInput).name = {
            contains: searchName,
            mode: 'insensitive',
          };
        }
        if (searchId) {
          (where.user as Prisma.usersWhereInput).display_id = {
            contains: searchId,
            mode: 'insensitive',
          };
        }
      }

      if (dateFromStr || dateToStr) {
        const updatedAt: { gte?: Date; lte?: Date } = {};
        if (dateFromStr) {
          const from = new Date(`${dateFromStr}T00:00:00+05:30`);
          if (!isNaN(from.getTime())) {
            updatedAt.gte = from;
          }
        }
        if (dateToStr) {
          const to = new Date(`${dateToStr}T23:59:59+05:30`);
          if (!isNaN(to.getTime())) {
            updatedAt.lte = to;
          }
        }
        if (updatedAt.gte || updatedAt.lte) {
          where.updated_at = updatedAt;
        }
      }

      const [items, total] = await Promise.all([
        prisma.support_tickets.findMany({
          where,
          orderBy: { updated_at: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            user: { select: { id: true, display_id: true, name: true, email: true, phone: true } },
            assigned_to_user: { select: { id: true, name: true, email: true } },
            pre_question: { select: { id: true, question: true } },
            messages: {
              orderBy: { created_at: 'desc' },
              take: 1,
              select: { message_text: true, created_at: true, sender_type: true },
            },
          },
        }),
        prisma.support_tickets.count({ where }),
      ]);

      const total_pages = Math.ceil(total / limit);
      return reply.send({
        items: items.map((t) => ({
          id: Number(t.id),
          user_id: Number(t.user_id),
          user: t.user,
          pre_question_id: t.pre_question_id,
          pre_question: t.pre_question?.question ?? null,
          subject: t.subject,
          status: t.status,
          assigned_to: t.assigned_to != null ? Number(t.assigned_to) : null,
          assigned_to_user: t.assigned_to_user,
          created_at: t.created_at.toISOString(),
          updated_at: t.updated_at.toISOString(),
          closed_at: t.closed_at?.toISOString() ?? null,
          last_message: t.messages[0]
            ? {
                text: t.messages[0].message_text,
                sender_type: t.messages[0].sender_type,
                created_at: t.messages[0].created_at.toISOString(),
              }
            : null,
        })),
        total,
        page,
        limit,
        total_pages,
      });
    } catch (e) {
      console.error('Admin support tickets list error:', e);
      return reply.code(500).send({ message: 'Failed to load tickets' });
    }
  });

  /**
   * GET /admin/support/summary
   * Get summary counts of support tickets by status (open, in_progress, closed).
   * Used for admin dashboard KPIs.
   */
  app.get('/support/summary', {
    preHandler: [adminAuth, checkPermission('TICKET_VIEW')],
    schema: {
      description: 'Get summary counts of support tickets by status',
      tags: ['Admin Support'],
      response: {
        '200': {
          type: 'object',
          properties: {
            open: { type: 'number' },
            in_progress: { type: 'number' },
            closed: { type: 'number' },
          },
        },
        '500': { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
      try {
        const [openCount, inProgressCount, closedCount] = await Promise.all([
          prisma.support_tickets.count({ where: { status: 'open' } }),
          prisma.support_tickets.count({ where: { status: 'in_progress' } }),
          prisma.support_tickets.count({ where: { status: 'closed' } }),
        ]);
        return reply.send({
          open: openCount,
          in_progress: inProgressCount,
          closed: closedCount,
        });
      } catch (e) {
        console.error('Admin support summary error:', e);
        return reply.code(500).send({ message: 'Failed to load support summary' });
      }
  });

  /**
   * GET /admin/support/tickets/:id
   * Get ticket thread (admin with TICKET_VIEW can view any ticket)
   */
  app.get('/support/tickets/:id', {
    preHandler: [adminAuth, checkPermission('TICKET_VIEW')],
    schema: {
      description: 'Get ticket thread',
      tags: ['Admin Support'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: {
        '200': {
          type: 'object',
          properties: {
            id: { type: 'number' },
            user_id: { type: 'number' },
            user: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'number' },
                display_id: { type: 'string', nullable: true },
                name: { type: 'string', nullable: true },
                email: { type: 'string', nullable: true },
                phone: { type: 'string', nullable: true },
              },
            },
            pre_question_id: { type: 'number', nullable: true },
            pre_question: { type: 'string', nullable: true },
            subject: { type: 'string', nullable: true },
            status: { type: 'string' },
            assigned_to: { type: 'number', nullable: true },
            assigned_to_user: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'number' },
                name: { type: 'string', nullable: true },
                email: { type: 'string', nullable: true },
              },
            },
            created_at: { type: 'string', nullable: true },
            updated_at: { type: 'string', nullable: true },
            closed_at: { type: 'string', nullable: true },
            messages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  sender_type: { type: 'string' },
                  sender_user_id: { type: 'number', nullable: true },
                  message_text: { type: 'string', nullable: true },
                  attachment_urls: { type: 'array', nullable: true },
                  created_at: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        '404': { type: 'object' },
        '500': { type: 'object' },
      },
    },
  }, async (request, reply) => {
      try {
        const ticketId = BigInt((request.params as { id: string }).id);
        const ticket = await prisma.support_tickets.findUnique({
          where: { id: ticketId },
          include: {
            user: { select: { id: true, display_id: true, name: true, email: true, phone: true } },
            assigned_to_user: { select: { id: true, name: true, email: true } },
            pre_question: { select: { id: true, question: true, category: true } },
          },
        });
        if (!ticket) {
          return reply.code(404).send({ message: 'Ticket not found' });
        }

        // Always load messages with a direct query so thread never comes empty
        const messagesList = await prisma.support_ticket_messages.findMany({
          where: { ticket_id: ticketId },
          orderBy: { created_at: 'asc' },
        });

        const responsePayload = {
          id: Number(ticket.id),
          user_id: Number(ticket.user_id),
          user: ticket.user
            ? {
                id: Number(ticket.user.id),
                display_id: ticket.user.display_id,
                name: ticket.user.name,
                email: ticket.user.email,
                phone: ticket.user.phone,
              }
            : null,
          pre_question_id: ticket.pre_question_id,
          pre_question: ticket.pre_question?.question ?? null,
          subject: ticket.subject ?? null,
          status: ticket.status ?? 'open',
          assigned_to: ticket.assigned_to != null ? Number(ticket.assigned_to) : null,
          assigned_to_user: ticket.assigned_to_user
            ? {
                id: Number(ticket.assigned_to_user.id),
                name: ticket.assigned_to_user.name,
                email: ticket.assigned_to_user.email,
              }
            : null,
          created_at: ticket.created_at ? new Date(ticket.created_at).toISOString() : null,
          updated_at: ticket.updated_at ? new Date(ticket.updated_at).toISOString() : null,
          closed_at: ticket.closed_at ? new Date(ticket.closed_at).toISOString() : null,
          messages: messagesList.map((m) => {
            const rawAttachments = Array.isArray(m.attachment_urls) ? m.attachment_urls : [];
            const attachment_urls: Array<{ url: string; type: string; filename: string }> = [];
            for (let i = 0; i < rawAttachments.length; i++) {
              const row = rawAttachments[i];
              try {
                console.log('[AdminSupport] raw attachment row', JSON.stringify(row));
              } catch {
                console.log('[AdminSupport] raw attachment row', row);
              }
              const normalized = normalizeAttachmentItem(row);
              if (normalized) attachment_urls.push(normalized);
            }
            return {
              id: Number(m.id),
              sender_type: m.sender_type,
              sender_user_id: m.sender_user_id != null ? Number(m.sender_user_id) : null,
              message_text: m.message_text ?? null,
              attachment_urls: attachment_urls.length > 0 ? attachment_urls : null,
              created_at: m.created_at ? new Date(m.created_at).toISOString() : null,
            };
          }),
        };

        console.log('[AdminSupport] GET ticket', ticketId.toString(), 'messages:', responsePayload.messages.length, responsePayload.messages.length > 0 ? 'first_id=' + responsePayload.messages[0].id : '');

        return reply.send(responsePayload);
      } catch (e) {
        console.error('Admin support get ticket error:', e);
        return reply.code(500).send({ message: 'Failed to load ticket' });
      }
  });

  /**
   * POST /admin/support/tickets/:id/assign
   * Assign ticket to current admin (take ticket). Requires TICKET_MANAGE.
   */
  app.post('/support/tickets/:id/assign', {
    preHandler: [adminAuth, checkPermission('TICKET_MANAGE')],
    schema: {
      description: 'Assign ticket to me (take ticket)',
      tags: ['Admin Support'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: { '200': { type: 'object' }, '400': { type: 'object' }, '404': { type: 'object' } },
    },
  }, async (request, reply) => {
      try {
        const admin = (request as any).admin;
        const adminUserId = BigInt(admin?.user_id || 0);
        const ticketId = BigInt((request.params as { id: string }).id);

        const ticket = await prisma.support_tickets.findUnique({
          where: { id: ticketId },
        });
        if (!ticket) {
          return reply.code(404).send({ message: 'Ticket not found' });
        }
        if (ticket.status === 'closed') {
          return reply.code(400).send({ message: 'Cannot assign closed ticket' });
        }
        // Allow current admin to take the ticket even if it was previously assigned.
        // This keeps behavior simple for Sub-Admins: "Assign to me" always works for non-closed tickets.

        await prisma.support_tickets.update({
          where: { id: ticketId },
          data: {
            assigned_to: adminUserId,
            status: 'in_progress',
            updated_at: new Date(),
          },
        });

        return reply.send({
          ticket_id: Number(ticketId),
          assigned_to: Number(adminUserId),
          status: 'in_progress',
        });
      } catch (e) {
        console.error('Admin support assign error:', e);
        return reply.code(500).send({ message: 'Failed to assign ticket' });
      }
  });

  /**
   * POST /admin/support/tickets/:id/messages
   * Add admin reply (text and/or attachment_urls). Requires TICKET_MANAGE; ticket must be assigned to this admin (or SUPER_ADMIN can reply to any).
   */
  app.post('/support/tickets/:id/messages', {
    preHandler: [adminAuth, checkPermission('TICKET_MANAGE')],
    schema: {
      description: 'Add admin reply to ticket',
      tags: ['Admin Support'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          message_text: { type: 'string' },
          attachment_urls: {
            type: 'array',
            items: { type: 'object', properties: { url: { type: 'string' }, type: { type: 'string' }, filename: { type: 'string' } } },
          },
        },
      },
      response: { '200': { type: 'object' }, '400': { type: 'object' }, '403': { type: 'object' }, '404': { type: 'object' } },
    },
  }, async (request, reply) => {
      try {
        const admin = (request as any).admin;
        const adminUserId = BigInt(admin?.user_id || 0);
        const isSuperAdmin = admin?.role === 'SUPER_ADMIN';
        const ticketId = BigInt((request.params as { id: string }).id);
        const body = (request.body || {}) as { message_text?: string; attachment_urls?: unknown[] };
        const message_text = typeof body.message_text === 'string' ? body.message_text.trim() || null : null;
        const attachment_urls_raw = Array.isArray(body.attachment_urls) ? body.attachment_urls : [];

        // Terminal log: admin sent message (voice / image / file)
        const hasText = !!message_text;
        const rawCount = attachment_urls_raw.length;
        console.log(
          '[AdminSupport] Admin sent message: ticket_id=%s, text=%s, attachments_raw=%d',
          ticketId.toString(),
          hasText ? 'yes' : 'no',
          rawCount,
        );

        // Normalize and keep only attachments that have a url (do not persist nulls)
        const attachment_urls: Array<{ url: string; type: string; filename: string }> = [];
        for (const item of attachment_urls_raw) {
          const normalized = normalizeAttachmentItem(item);
          if (normalized) attachment_urls.push(normalized);
        }

        if (attachment_urls.length > 0) {
          const types = attachment_urls.map((a) => (a.type || 'file').toLowerCase());
          console.log('[AdminSupport] Attachments in message: count=%d, types=%s', attachment_urls.length, types.join(', '));
          attachment_urls.forEach((a, i) => {
            console.log('[AdminSupport]   [%d] type=%s filename=%s url=%s', i, a.type, a.filename, a.url ? `${a.url.slice(0, 50)}...` : '');
          });
        }

        const ticket = await prisma.support_tickets.findUnique({
          where: { id: ticketId },
        });
        if (!ticket) {
          return reply.code(404).send({ message: 'Ticket not found' });
        }
        if (ticket.status === 'closed') {
          return reply.code(400).send({ message: 'Cannot reply to closed ticket' });
        }
        if (!isSuperAdmin && ticket.assigned_to !== adminUserId) {
          return reply.code(403).send({ message: 'Ticket is not assigned to you. Assign it first.' });
        }
        if (!message_text && attachment_urls.length === 0) {
          return reply.code(400).send({ message: 'Either message_text or at least one attachment is required' });
        }

        const msg = await prisma.support_ticket_messages.create({
          data: {
            ticket_id: ticketId,
            sender_type: 'admin',
            sender_user_id: adminUserId,
            message_text: message_text || null,
            attachment_urls:
              attachment_urls.length > 0
                ? (attachment_urls as Prisma.InputJsonValue)
                : undefined,
          },
        });

        await prisma.support_tickets.update({
          where: { id: ticketId },
          data: { updated_at: new Date() },
        });

        console.log('[AdminSupport] Message saved: message_id=%s ticket_id=%s attachments=%d', msg.id.toString(), ticketId.toString(), attachment_urls.length);

        return reply.send({
          message_id: Number(msg.id),
          message_text: msg.message_text,
          attachment_urls: msg.attachment_urls,
          created_at: msg.created_at.toISOString(),
        });
      } catch (e) {
        console.error('Admin support reply error:', e);
        return reply.code(500).send({ message: 'Failed to send reply' });
      }
  });

  /**
   * POST /admin/support/tickets/:id/reassign
   * Reassign ticket to another admin. SUPER_ADMIN only.
   */
  app.post('/support/tickets/:id/reassign', {
    preHandler: [adminAuth, superAdminAuth],
    schema: {
      description: 'Reassign ticket to another admin (Super Admin only)',
      tags: ['Admin Support'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['assigned_to'],
        properties: { assigned_to: { type: 'integer' } },
      },
      response: { '200': { type: 'object' }, '400': { type: 'object' }, '404': { type: 'object' } },
    },
  }, async (request, reply) => {
      try {
        const ticketId = BigInt((request.params as { id: string }).id);
        const assigned_to = BigInt(((request.body || {}) as { assigned_to?: number | string }).assigned_to ?? 0);

        const ticket = await prisma.support_tickets.findUnique({
          where: { id: ticketId },
        });
        if (!ticket) {
          return reply.code(404).send({ message: 'Ticket not found' });
        }
        if (ticket.status === 'closed') {
          return reply.code(400).send({ message: 'Cannot reassign closed ticket' });
        }

        const targetUser = await prisma.users.findUnique({
          where: { id: assigned_to },
          select: { role: true },
        });
        if (!targetUser || (targetUser.role !== 'SUB_ADMIN' && targetUser.role !== 'SUPER_ADMIN')) {
          return reply.code(400).send({ message: 'assigned_to must be a sub-admin or super admin user id' });
        }

        await prisma.support_tickets.update({
          where: { id: ticketId },
          data: {
            assigned_to: assigned_to,
            status: 'in_progress',
            updated_at: new Date(),
          },
        });

        return reply.send({
          ticket_id: Number(ticketId),
          assigned_to: Number(assigned_to),
          status: 'in_progress',
        });
      } catch (e) {
        console.error('Admin support reassign error:', e);
        return reply.code(500).send({ message: 'Failed to reassign ticket' });
      }
  });

  /**
   * POST /admin/support/tickets/:id/close
   * Close ticket from admin side. Requires TICKET_MANAGE.
   * - SUPER_ADMIN can close any ticket.
   * - SUB_ADMIN can close only tickets assigned to them.
   */
  app.post('/support/tickets/:id/close', {
    preHandler: [adminAuth, checkPermission('TICKET_MANAGE')],
    schema: {
      description: 'Close support ticket (admin/sub-admin)',
      tags: ['Admin Support'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: {
        '200': {
          type: 'object',
          properties: {
            ticket_id: { type: 'number' },
            status: { type: 'string' },
            closed_at: { type: 'string' },
          },
        },
        '400': { type: 'object' },
        '403': { type: 'object' },
        '404': { type: 'object' },
      },
    },
  }, async (request, reply) => {
      try {
        const admin = (request as any).admin || {};
        const rawId = (request.params as { id: string }).id;

        // Basic id validation
        if (!rawId || !/^\d+$/.test(rawId)) {
          console.warn('[AdminSupport] Close ticket - invalid id', { rawId });
          return reply.code(400).send({ error: 'invalid_id', message: 'Invalid ticket id' });
        }

        const adminUserId = BigInt(admin.user_id || 0);
        const isSuperAdmin = admin.role === 'SUPER_ADMIN';
        const ticketId = BigInt(rawId);

        console.log('[AdminSupport] Close ticket request', {
          ticketId: rawId,
          adminUserId: admin.user_id != null ? String(admin.user_id) : 'null',
          adminRole: admin.role || 'UNKNOWN',
        });

        const ticket = await prisma.support_tickets.findUnique({
          where: { id: ticketId },
        });
        if (!ticket) {
          console.warn('[AdminSupport] Close ticket - not found', { ticketId: rawId });
          return reply.code(404).send({ error: 'not_found', message: 'Ticket not found' });
        }

        console.log('[AdminSupport] Close ticket - current state', {
          ticketId: String(ticket.id),
          status: ticket.status,
          assigned_to: ticket.assigned_to != null ? ticket.assigned_to.toString() : null,
        });

        // If ticket already closed, treat as idempotent success
        if (ticket.status === 'closed') {
          const closedAtIso = ticket.closed_at ? ticket.closed_at.toISOString() : new Date().toISOString();
          return reply.send({
            ticket_id: Number(ticket.id),
            status: 'closed',
            closed_at: closedAtIso,
          });
        }

        // Permission: SUPER_ADMIN can close any ticket; SUB_ADMIN only if assigned_to == adminUserId
        if (!isSuperAdmin) {
          const assigned = ticket.assigned_to;
          const isAssignedToAdmin = assigned != null && assigned === adminUserId;

          if (!isAssignedToAdmin) {
            console.warn('[AdminSupport] Close ticket - forbidden (not assigned)', {
              ticketId: String(ticket.id),
              ticketAssignedTo: assigned != null ? assigned.toString() : null,
              adminUserId: adminUserId.toString(),
              adminRole: admin.role || 'UNKNOWN',
            });
            return reply.code(403).send({
              error: 'forbidden',
              message: 'Ticket is not assigned to you. Assign it first or contact an admin.',
            });
          }
        }

        const now = new Date();
        await prisma.support_tickets.update({
          where: { id: ticketId },
          data: {
            status: 'closed',
            closed_at: now,
            closed_by_user_id: adminUserId,
            updated_at: now,
          },
        });

        console.log('[AdminSupport] Ticket closed successfully', {
          ticketId: rawId,
          closedBy: adminUserId.toString(),
          closedAt: now.toISOString(),
        });

        return reply.send({
          ticket_id: Number(ticket.id),
          status: 'closed',
          closed_at: now.toISOString(),
        });
      } catch (e) {
        console.error('Admin support close error:', e);
        return reply.code(500).send({ error: 'internal_error', message: 'Failed to close ticket' });
      }
  });

  /**
   * POST /admin/support/upload
   * Upload one attachment for admin reply (image). Query: ticket_id. Admin must have ticket assigned (or SUPER_ADMIN).
   */
  app.post('/support/upload', {
    preHandler: [adminAuth, checkPermission('TICKET_MANAGE')],
    schema: {
      description: 'Upload attachment for admin reply (image/voice)',
      tags: ['Admin Support'],
      consumes: ['multipart/form-data'],
      querystring: { type: 'object', required: ['ticket_id'], properties: { ticket_id: { type: 'string' } } },
      response: {
        '200': {
          type: 'object',
          properties: {
            url: { type: 'string' },
            type: { type: 'string' },
            filename: { type: 'string' },
          },
          required: ['url', 'type', 'filename'],
        },
        '400': { type: 'object' },
        '403': { type: 'object' },
        '404': { type: 'object' },
      },
    },
  }, async (request, reply) => {
      const reqUrl = `${(request as any).method} ${(request as any).url}`;
      console.log('[AdminSupport upload] handler entered', reqUrl);
      try {
        const admin = (request as any).admin;
        const adminUserId = BigInt(admin?.user_id || 0);
        const isSuperAdmin = admin?.role === 'SUPER_ADMIN';
        const ticketId = BigInt(((request.query || {}) as { ticket_id?: string }).ticket_id || '0');

        const ticket = await prisma.support_tickets.findUnique({
          where: { id: ticketId },
        });
        if (!ticket) {
          return reply.code(404).send({ message: 'Ticket not found' });
        }
        if (ticket.status === 'closed') {
          return reply.code(400).send({ message: 'Cannot add attachments to closed ticket' });
        }
        if (!isSuperAdmin && ticket.assigned_to !== adminUserId) {
          return reply.code(403).send({ message: 'Ticket is not assigned to you' });
        }

        const data = await request.file();
        if (!data) {
          return reply.code(400).send({ message: 'No file uploaded' });
        }
        const buf = await data.toBuffer();
        const mimetype = data.mimetype || 'application/octet-stream';
        if (!bunnyCDNService.isValidFileType(mimetype, SUPPORT_UPLOAD_ALLOWED_MIME_TYPES)) {
          return reply.code(400).send({
            message:
              'Invalid file type. Allowed: images (JPG, PNG, GIF, WebP), audio (WebM, OGG, MP4, MPEG), or PDF. Max 5MB.',
          });
        }
        if (!bunnyCDNService.isValidFileSize(buf.length, SUPPORT_MAX_FILE_SIZE_MB)) {
          return reply.code(400).send({ message: `File too large. Max ${SUPPORT_MAX_FILE_SIZE_MB}MB` });
        }
        const ext = resolveSupportAttachmentExtension(mimetype, data.filename);
        const storageFilename = `t${ticketId}_admin${adminUserId}_${Date.now()}.${ext}`;
        const folder = `${SUPPORT_ATTACHMENTS_FOLDER}/${ticketId}`;
        const cdnUrl = await bunnyCDNService.uploadFile(buf, storageFilename, folder);
        if (!cdnUrl || typeof cdnUrl !== 'string' || cdnUrl.trim() === '') {
          console.error('[AdminSupport upload] CDN URL missing or invalid', { cdnUrl, type: typeof cdnUrl });
          return reply.code(500).send({ message: 'Upload succeeded but CDN URL was not returned' });
        }
        const publicUrl = cdnUrl.trim();
        const displayFilename = data.filename || storageFilename;
        const mimeType = mimetype.includes(';') ? mimetype.split(';')[0].trim() : mimetype;
        const responsePayload = {
          url: publicUrl,
          type: mimeType,
          filename: displayFilename,
        };
        console.log('[AdminSupport upload] Admin uploaded file: ticket_id=%s type=%s filename=%s', ticketId.toString(), mimeType, displayFilename);
        console.log('[AdminSupport upload] before reply.send', JSON.stringify(responsePayload));
        const sent = reply.header('Content-Type', 'application/json').send(responsePayload);
        console.log('[AdminSupport upload] reply.send() executed');
        return sent;
      } catch (e) {
        console.error('Admin support upload error:', e);
        return reply.code(500).send({ message: 'Failed to upload' });
      }
  });

  // ---------- Pre-questions CRUD (Super Admin only) ----------
  app.get('/support/pre-questions', {
    preHandler: [adminAuth, checkPermission('TICKET_VIEW')],
    schema: {
      description: 'List all pre-questions (admin; includes inactive)',
      tags: ['Admin Support'],
      response: {
        '200': {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  question: { type: 'string' },
                  category: { type: 'string', nullable: true },
                  sort_order: { type: 'number' },
                  is_active: { type: 'boolean' },
                  fee_rule_code: { type: 'string', nullable: true },
                  created_at: { type: 'string' },
                  updated_at: { type: 'string' },
                },
              },
            },
          },
        },
        '500': { type: 'object' },
      },
    },
  }, async (request, reply) => {
      try {
        const items = await prisma.support_pre_questions.findMany({
          orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
        });
        const result = items.map((q) => ({
          id: q.id,
          question: q.question,
          category: q.category,
          sort_order: q.sort_order,
          is_active: q.is_active,
          fee_rule_code: q.fee_rule_code ?? null,
          created_at: q.created_at.toISOString(),
          updated_at: q.updated_at.toISOString(),
        }));
        console.log('[AdminSupport] Pre-questions result count:', result.length, result.length > 0 ? 'first id=' + result[0].id : '');
        return reply.send({ items: result });
      } catch (e) {
        console.error('Admin support pre-questions list error:', e);
        return reply.code(500).send({ message: 'Failed to load pre-questions' });
      }
  });

  app.post('/support/pre-questions', {
    preHandler: [adminAuth, superAdminAuth],
    schema: {
      description: 'Create pre-question (Super Admin only)',
      tags: ['Admin Support'],
      body: {
        type: 'object',
        required: ['question'],
        properties: {
          question: { type: 'string' },
          category: { type: 'string' },
          sort_order: { type: 'integer' },
          fee_rule_code: { type: 'string', nullable: true },
        },
      },
      response: {
        '200': {
          type: 'object',
          properties: {
            id: { type: 'number' },
            question: { type: 'string' },
            category: { type: 'string', nullable: true },
            sort_order: { type: 'number' },
            is_active: { type: 'boolean' },
            fee_rule_code: { type: 'string', nullable: true },
            created_at: { type: 'string' },
          },
        },
        '400': { type: 'object' },
        '500': { type: 'object' },
      },
    },
  }, async (request, reply) => {
      try {
        const body = (request.body || {}) as { question?: string; category?: string; sort_order?: number; fee_rule_code?: string | null };
        const question = typeof body.question === 'string' ? body.question.trim() : '';
        if (!question) {
          return reply.code(400).send({ message: 'question is required' });
        }
        const feeRuleCode = body.fee_rule_code === '' || body.fee_rule_code === undefined ? null : (body.fee_rule_code?.trim() || null);
        const q = await prisma.support_pre_questions.create({
          data: {
            question,
            category: body.category?.trim() || 'general',
            sort_order: body.sort_order ?? 0,
            is_active: true,
            fee_rule_code: feeRuleCode,
          },
        });
        console.log('[AdminSupport] Pre-question created:', { id: q.id, question: q.question, fee_rule_code: q.fee_rule_code });
        return reply.send({
          id: q.id,
          question: q.question,
          category: q.category,
          sort_order: q.sort_order,
          is_active: q.is_active,
          fee_rule_code: q.fee_rule_code ?? null,
          created_at: q.created_at.toISOString(),
        });
      } catch (e) {
        console.error('Admin support pre-questions create error:', e);
        return reply.code(500).send({ message: 'Failed to create pre-question' });
      }
  });

  app.put('/support/pre-questions/:id', {
    preHandler: [adminAuth, superAdminAuth],
    schema: {
      description: 'Update pre-question (Super Admin only)',
      tags: ['Admin Support'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          category: { type: 'string' },
          sort_order: { type: 'integer' },
          is_active: { type: 'boolean' },
          fee_rule_code: { type: 'string', nullable: true },
        },
      },
      response: { '200': { type: 'object' }, '404': { type: 'object' } },
    },
  }, async (request, reply) => {
      try {
        const id = parseInt((request.params as { id: string }).id, 10);
        if (Number.isNaN(id)) {
          return reply.code(400).send({ message: 'Invalid id' });
        }
        const body = (request.body || {}) as { question?: string; category?: string; sort_order?: number; is_active?: boolean; fee_rule_code?: string | null };
        const existing = await prisma.support_pre_questions.findUnique({ where: { id } });
        if (!existing) {
          return reply.code(404).send({ message: 'Pre-question not found' });
        }
        const feeRuleCode = body.fee_rule_code === undefined ? undefined : (body.fee_rule_code === '' ? null : (body.fee_rule_code?.trim() || null));
        const q = await prisma.support_pre_questions.update({
          where: { id },
          data: {
            ...(typeof body.question === 'string' && { question: body.question.trim() }),
            ...(typeof body.category === 'string' && { category: body.category.trim() }),
            ...(typeof body.sort_order === 'number' && { sort_order: body.sort_order }),
            ...(typeof body.is_active === 'boolean' && { is_active: body.is_active }),
            ...(feeRuleCode !== undefined && { fee_rule_code: feeRuleCode }),
            updated_at: new Date(),
          },
        });
        return reply.send({
          id: q.id,
          question: q.question,
          category: q.category,
          sort_order: q.sort_order,
          is_active: q.is_active,
          fee_rule_code: q.fee_rule_code ?? null,
          updated_at: q.updated_at.toISOString(),
        });
      } catch (e) {
        console.error('Admin support pre-questions update error:', e);
        return reply.code(500).send({ message: 'Failed to update pre-question' });
      }
  });

  app.delete('/support/pre-questions/:id', {
    preHandler: [adminAuth, superAdminAuth],
    schema: {
      description: 'Delete pre-question (Super Admin only)',
      tags: ['Admin Support'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: { '200': { type: 'object' }, '404': { type: 'object' } },
    },
  }, async (request, reply) => {
      try {
        const id = parseInt((request.params as { id: string }).id, 10);
        if (Number.isNaN(id)) {
          return reply.code(400).send({ message: 'Invalid id' });
        }
        const existing = await prisma.support_pre_questions.findUnique({ where: { id } });
        if (!existing) {
          return reply.code(404).send({ message: 'Pre-question not found' });
        }
        await prisma.support_pre_questions.delete({ where: { id } });
        return reply.send({ deleted: true, id });
      } catch (e) {
        console.error('Admin support pre-questions delete error:', e);
        return reply.code(500).send({ message: 'Failed to delete pre-question' });
      }
  });
}
