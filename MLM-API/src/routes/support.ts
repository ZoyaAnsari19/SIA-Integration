import { FastifyInstance } from 'fastify';
import { requireUser } from '../middleware/jwt.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { bunnyCDNService } from '../modules/bunny-cdn/bunny-cdn.service.js';
import { FeeService } from '../modules/fees/feeService.js';
import {
  SUPPORT_ALLOWED_IMAGE_TYPES,
  SUPPORT_ALLOWED_VOICE_TYPES,
  SUPPORT_ALLOWED_PDF_TYPES,
  SUPPORT_UPLOAD_ALLOWED_MIME_TYPES,
  SUPPORT_MAX_FILE_SIZE_MB,
  classifySupportAttachmentType,
  resolveSupportAttachmentExtension,
} from '../modules/support/support-upload.config.js';

const SUPPORT_ATTACHMENTS_FOLDER = 'support_attachments';

export async function supportRoutes(app: FastifyInstance) {
  /**
   * GET /support/pre-questions
   * List active pre-defined questions for support (no auth required for listing, or require auth - keeping auth for consistency with "support" area)
   */
  app.get('/pre-questions', {
    preHandler: [requireUser],
    schema: {
      description: 'List active pre-defined support questions',
      tags: ['Support'],
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
                  fee_rule_code: { type: 'string', nullable: true },
                  fee_amount: { type: 'number', nullable: true },
                },
              },
            },
            general_support_fee_amount: { type: 'number', nullable: true },
          },
        },
        '500': { type: 'object' },
      },
    },
  }, async (request, reply) => {
      try {
        const items = await prisma.support_pre_questions.findMany({
          where: { is_active: true },
          orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
          select: { id: true, question: true, category: true, sort_order: true, fee_rule_code: true },
        });
        const codes = [...new Set(items.map((q) => q.fee_rule_code).filter(Boolean))] as string[];
        const feeAmountByCode: Record<string, number> = {};
        if (codes.length > 0) {
          const rules = await prisma.fee_rules.findMany({
            where: { rule_code: { in: codes }, is_active: true },
            select: { rule_code: true, amount: true },
          });
          for (const r of rules) {
            feeAmountByCode[r.rule_code] = Number(r.amount);
          }
        }
        const list = items.map((q) => ({
          id: q.id,
          question: q.question,
          category: q.category,
          sort_order: q.sort_order,
          fee_rule_code: q.fee_rule_code ?? null,
          fee_amount: q.fee_rule_code ? (feeAmountByCode[q.fee_rule_code] ?? null) : null,
        }));
        const supportTicketRule = await prisma.fee_rules.findFirst({
          where: { rule_code: 'SUPPORT_TICKET', is_active: true },
          select: { amount: true },
        });
        const generalSupportFeeAmount = supportTicketRule ? Number(supportTicketRule.amount) : null;
        console.log('[Support] Pre-questions (user) count:', list.length);
        return reply.send({ items: list, general_support_fee_amount: generalSupportFeeAmount });
      } catch (e) {
        console.error('Support pre-questions list error:', e);
        return reply.code(500).send({ message: 'Failed to load pre-questions' });
      }
  });

  /**
   * POST /support/tickets
   * Create a new ticket (pre_question_id optional, first message text required)
   */
  app.post('/tickets', {
    preHandler: [requireUser],
    schema: {
      description: 'Create a new support ticket',
      tags: ['Support'],
      body: {
        type: 'object',
        required: ['message_text'],
        properties: {
          pre_question_id: { type: 'integer', nullable: true },
          message_text: { type: 'string' },
          subject: { type: 'string', nullable: true },
          attachment_urls: {
            type: 'array',
            items: { type: 'object', properties: { url: { type: 'string' }, type: { type: 'string' }, filename: { type: 'string' } } },
          },
        },
      },
      response: {
        '200': {
          type: 'object',
          properties: {
            ticket_id: { type: 'integer' },
            status: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
            // Optional: how much fee (if any) was charged for this ticket
            ticket_fee_charged: { type: 'number', nullable: true },
          },
        },
        '400': { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
      try {
        const userId = BigInt((request as any).user.user_id);
        const body = (request.body || {}) as { pre_question_id?: number; message_text?: string; subject?: string; attachment_urls?: unknown[] };
        const { pre_question_id, message_text, subject, attachment_urls } = body;
        if (!message_text || typeof message_text !== 'string' || !message_text.trim()) {
          return reply.code(400).send({ message: 'message_text is required' });
        }
        const attachmentList = Array.isArray(attachment_urls) ? attachment_urls : [];

        // Fee logic: topic-based OR 2nd-ticket fee, never both.
        // - If user selected a topic (pre_question_id) that has fee_rule_code → charge only that topic fee.
        // - Else (no topic or topic has no fee_rule_code): first ticket free, 2nd+ charge SUPPORT_TICKET.
        let ticketFeeCharged = 0;
        let ruleCodeToCharge: string | null = null;

        if (pre_question_id != null) {
          const preQuestion = await prisma.support_pre_questions.findUnique({
            where: { id: pre_question_id, is_active: true },
            select: { fee_rule_code: true },
          });
          if (preQuestion?.fee_rule_code) {
            ruleCodeToCharge = preQuestion.fee_rule_code;
          }
        }

        if (ruleCodeToCharge) {
          // Topic-based fee: charge only this rule (no SUPPORT_TICKET).
          const feeCheck = await FeeService.checkFeeApplicable(userId, ruleCodeToCharge);
          if (!feeCheck.applicable && feeCheck.amount > 0) {
            return reply.code(400).send({
              error: 'INSUFFICIENT_BALANCE',
              message: feeCheck.message || `Insufficient balance for ${ruleCodeToCharge} fee`,
              required_amount: feeCheck.amount,
            });
          }
          if (feeCheck.applicable && feeCheck.amount > 0) {
            try {
              await FeeService.deductFee(userId, ruleCodeToCharge, null, 'support_ticket');
              ticketFeeCharged = feeCheck.amount;
            } catch (error: any) {
              if (error.code === 'INSUFFICIENT_BALANCE') {
                return reply.code(400).send({
                  error: 'INSUFFICIENT_BALANCE',
                  message: error.message || `Insufficient balance for ${ruleCodeToCharge} fee`,
                  required_amount: error.required,
                  available_balance: error.available,
                });
              }
              throw error;
            }
          }
        } else {
          // No topic fee: first ticket free, 2nd+ apply SUPPORT_TICKET.
          const totalTicketsBefore = await prisma.support_tickets.count({
            where: { user_id: userId },
          });
          if (totalTicketsBefore >= 1) {
            const feeCheck = await FeeService.checkFeeApplicable(userId, 'SUPPORT_TICKET');
            if (!feeCheck.applicable && feeCheck.amount > 0) {
              return reply.code(400).send({
                error: 'INSUFFICIENT_BALANCE',
                message: feeCheck.message || 'Insufficient balance for support ticket fee',
                required_amount: feeCheck.amount,
              });
            }
            if (feeCheck.applicable && feeCheck.amount > 0) {
              try {
                await FeeService.deductFee(userId, 'SUPPORT_TICKET', null, 'support_ticket');
                ticketFeeCharged = feeCheck.amount;
              } catch (error: any) {
                if (error.code === 'INSUFFICIENT_BALANCE') {
                  return reply.code(400).send({
                    error: 'INSUFFICIENT_BALANCE',
                    message: error.message || 'Insufficient balance for support ticket fee',
                    required_amount: error.required,
                    available_balance: error.available,
                  });
                }
                throw error;
              }
            }
          }
        }

        const ticket = await prisma.support_tickets.create({
          data: {
            user_id: userId,
            pre_question_id: pre_question_id ?? null,
            subject: subject?.trim() || null,
            status: 'open',
          },
        });

        const firstMessage = await prisma.support_ticket_messages.create({
          data: {
            ticket_id: ticket.id,
            sender_type: 'user',
            sender_user_id: userId,
            message_text: message_text.trim(),
            attachment_urls: attachmentList.length > 0 ? (attachmentList as Prisma.InputJsonValue) : undefined,
          },
        });
        console.log('[Support] Created ticket', ticket.id, 'first message id:', firstMessage.id);

        return reply.send({
          ticket_id: Number(ticket.id),
          status: ticket.status,
          created_at: ticket.created_at.toISOString(),
          ticket_fee_charged: ticketFeeCharged || null,
        });
      } catch (e) {
        console.error('Support create ticket error:', e);
        return reply.code(500).send({ message: 'Failed to create ticket' });
      }
  });

  /**
   * GET /support/tickets
   * List my tickets (paginated)
   */
  app.get('/tickets', {
    preHandler: [requireUser],
    schema: {
      description: 'List my support tickets',
      tags: ['Support'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', default: '1' },
          limit: { type: 'string', default: '20' },
          status: { type: 'string', enum: ['open', 'in_progress', 'closed'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number', nullable: true },
                  subject: { type: 'string', nullable: true },
                  status: { type: 'string' },
                  pre_question_id: { type: 'number', nullable: true },
                  pre_question: { type: 'string', nullable: true },
                  created_at: { type: 'string', nullable: true },
                  updated_at: { type: 'string', nullable: true },
                  last_message: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      text: { type: 'string', nullable: true },
                      created_at: { type: 'string', nullable: true },
                    },
                  },
                },
                additionalProperties: false,
              },
            },
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            total_pages: { type: 'number' },
          },
        },
        '500': { type: 'object' },
      },
    },
  }, async (request, reply) => {
      try {
        const userId = BigInt((request as any).user.user_id);
        const q = (request.query || {}) as { page?: string; limit?: string; status?: string };
        const page = Math.max(1, parseInt(q.page || '1', 10));
        const limit = Math.min(50, Math.max(1, parseInt(q.limit || '20', 10)));
        const status = q.status;

        const sep = '════════════════════════════════════════════════════════════';
        console.log('\n' + sep);
        console.log('  📥 GET /api/v1/support/tickets — REQUEST');
        console.log(sep);
        console.log('  URL:     ', request.url);
        console.log('  Query:   ', `page=${page}, limit=${limit}${status ? `, status=${status}` : ''}`);
        console.log('  user_id: ', String(userId));
        console.log(sep + '\n');

        const where: { user_id: bigint; status?: string } = { user_id: userId };
        if (status && ['open', 'in_progress', 'closed'].includes(status)) {
          where.status = status;
        }

        const [tickets, total] = await Promise.all([
          prisma.support_tickets.findMany({
            where,
            orderBy: { updated_at: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            select: {
              id: true,
              pre_question_id: true,
              subject: true,
              status: true,
              created_at: true,
              updated_at: true,
              pre_question: { select: { question: true } },
              messages: {
                orderBy: { created_at: 'desc' },
                take: 1,
                select: { message_text: true, created_at: true },
              },
            },
          }),
          prisma.support_tickets.count({ where }),
        ]);

        const total_pages = Math.ceil(total / limit);
        // Map Prisma results into plain JSON-safe objects
        const plainItems = tickets.map((t) => {
          const firstMsg = Array.isArray(t.messages) ? t.messages[0] : null;
          return {
            id: t.id != null ? Number(t.id) : null,
            pre_question_id: t.pre_question_id ?? null,
            pre_question: t.pre_question?.question ?? null,
            subject: t.subject ?? null,
            status:
              t.status && ['open', 'in_progress', 'closed'].includes(String(t.status))
                ? String(t.status)
                : 'open',
            created_at: t.created_at ? new Date(t.created_at).toISOString() : null,
            updated_at: t.updated_at ? new Date(t.updated_at).toISOString() : null,
            last_message: firstMsg
              ? {
                  text: firstMsg.message_text ?? null,
                  created_at: firstMsg.created_at
                    ? new Date(firstMsg.created_at).toISOString()
                    : null,
                }
              : null,
          };
        });

        if (plainItems.length > 0) {
          console.log('Serialized ticket[0]:', JSON.stringify(plainItems[0]));
        }

        const responseBody = {
          items: plainItems,
          total: Number(total),
          page,
          limit,
          total_pages,
        };

        console.log('\n' + sep);
        console.log('  📤 GET /api/v1/support/tickets — RESPONSE');
        console.log(sep);
        console.log('  total: ', responseBody.total, '  |  page: ', responseBody.page, '  |  items: ', responseBody.items.length);
        responseBody.items.forEach((i, idx) => {
          const subj = (i.subject || i.pre_question || '(no subject)').slice(0, 50);
          console.log('  [' + (idx + 1) + ']  id:', i.id, '  |  subject:', subj, '  |  status:', i.status);
        });
        console.log(sep + '\n');

        return reply.send(responseBody);
      } catch (e) {
        console.error('Support my tickets list error:', e);
        return reply.code(500).send({ message: 'Failed to load tickets' });
      }
  });

  /**
   * GET /support/tickets/:id
   * Get one ticket with full thread (only owner)
   */
  app.get('/tickets/:id', {
    preHandler: [requireUser],
    schema: {
      description: 'Get ticket thread',
      tags: ['Support'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: {
        '200': {
          type: 'object',
          properties: {
            id: { type: 'number' },
            pre_question_id: { type: 'number', nullable: true },
            pre_question: { type: 'string', nullable: true },
            subject: { type: 'string', nullable: true },
            status: { type: 'string' },
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
        '403': { type: 'object' },
        '404': { type: 'object' },
        '500': { type: 'object' },
      },
    },
  }, async (request, reply) => {
      try {
        const userId = BigInt((request as any).user.user_id);
        const ticketId = BigInt((request.params as { id: string }).id);

        const ticket = await prisma.support_tickets.findFirst({
          where: { id: ticketId, user_id: userId },
          include: { pre_question: { select: { id: true, question: true, category: true } } },
        });
        if (!ticket) {
          return reply.code(404).send({ message: 'Ticket not found' });
        }

        // Always load messages with a direct query so thread never comes empty
        const messagesList = await prisma.support_ticket_messages.findMany({
          where: { ticket_id: ticketId },
          orderBy: { created_at: 'asc' },
        });

        const payload = {
          id: Number(ticket.id),
          pre_question_id: ticket.pre_question_id,
          pre_question: ticket.pre_question?.question ?? null,
          subject: ticket.subject ?? null,
          status: ticket.status ?? 'open',
          created_at: ticket.created_at ? new Date(ticket.created_at).toISOString() : null,
          updated_at: ticket.updated_at ? new Date(ticket.updated_at).toISOString() : null,
          closed_at: ticket.closed_at ? new Date(ticket.closed_at).toISOString() : null,
          messages: messagesList.map((m) => ({
            id: Number(m.id),
            sender_type: m.sender_type,
            sender_user_id: m.sender_user_id != null ? Number(m.sender_user_id) : null,
            message_text: m.message_text ?? null,
            attachment_urls: m.attachment_urls as Record<string, unknown>[] | null,
            created_at: m.created_at ? new Date(m.created_at).toISOString() : null,
          })),
        };
        console.log('[Support] GET ticket', ticketId.toString(), 'messages count:', payload.messages.length);
        return reply.send(payload);
      } catch (e) {
        console.error('Support get ticket error:', e);
        return reply.code(500).send({ message: 'Failed to load ticket' });
      }
  });

  /**
   * POST /support/upload
   * Upload one attachment (image, audio, or PDF) for support. Returns { url, type, filename } (CDN URL only, never base64).
   * Query: ticket_id (optional) - if provided, must be your ticket; if omitted, use for new-ticket first message.
   * Max 5MB. Allowed: image/* (JPEG, PNG, GIF, WebP), audio/* (WebM, OGG, MP4, MPEG), application/pdf.
   */
  app.post('/upload', {
    preHandler: [requireUser],
    schema: {
      description: 'Upload support attachment. Use returned url in POST /support/tickets or POST /support/tickets/:id/messages',
      tags: ['Support'],
      consumes: ['multipart/form-data'],
      querystring: { type: 'object', properties: { ticket_id: { type: 'string' } } },
      response: { '200': { type: 'object', properties: { url: { type: 'string' }, type: { type: 'string' }, filename: { type: 'string' } } }, '400': { type: 'object' }, '404': { type: 'object' } },
    },
  }, async (request, reply) => {
      try {
        const userId = BigInt((request as any).user.user_id);
        const ticketIdRaw = ((request.query || {}) as { ticket_id?: string }).ticket_id;
        const ticketId = ticketIdRaw ? BigInt(ticketIdRaw) : null;

        if (ticketId != null) {
          const ticket = await prisma.support_tickets.findFirst({
            where: { id: ticketId, user_id: userId },
          });
          if (!ticket) {
            return reply.code(404).send({ message: 'Ticket not found' });
          }
          if (ticket.status === 'closed') {
            return reply.code(400).send({ message: 'Cannot add attachments to closed ticket' });
          }
        }

        const data = await request.file();
        if (!data) {
          return reply.code(400).send({ message: 'No file uploaded' });
        }
        const buf = await data.toBuffer();
        const mimetype = data.mimetype;
        if (!bunnyCDNService.isValidFileType(mimetype, SUPPORT_UPLOAD_ALLOWED_MIME_TYPES)) {
          return reply.code(400).send({ message: 'Invalid file type. Allowed: images (JPG, PNG, GIF, WebP), audio (WebM, OGG, MP4, MPEG), or PDF. Max 5MB.' });
        }
        if (!bunnyCDNService.isValidFileSize(buf.length, SUPPORT_MAX_FILE_SIZE_MB)) {
          return reply.code(400).send({ message: `File too large. Max ${SUPPORT_MAX_FILE_SIZE_MB}MB` });
        }
        const ext = resolveSupportAttachmentExtension(mimetype, data.filename);
        const folder = ticketId != null ? `${SUPPORT_ATTACHMENTS_FOLDER}/${ticketId}` : `${SUPPORT_ATTACHMENTS_FOLDER}/pending`;
        const filename = ticketId != null ? `t${ticketId}_u${userId}_${Date.now()}.${ext}` : `u${userId}_${Date.now()}.${ext}`;
        const cdnUrl = await bunnyCDNService.uploadFile(buf, filename, folder);
        const type = classifySupportAttachmentType(mimetype);
        return reply.send({ url: cdnUrl, type, filename: data.filename });
      } catch (e) {
        console.error('Support upload error:', e);
        return reply.code(500).send({ message: 'Failed to upload' });
      }
  });

  /**
   * POST /support/tickets/:id/messages
   * Add a message to ticket (owner only). Body: message_text (optional), attachment_urls (optional, from POST /support/upload).
   */
  app.post('/tickets/:id/messages', {
    preHandler: [requireUser],
    schema: {
      description: 'Add message to ticket (text and/or attachment_urls from /support/upload)',
      tags: ['Support'],
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
      response: { '200': { type: 'object' }, '400': { type: 'object' }, '404': { type: 'object' } },
    },
  }, async (request, reply) => {
      try {
        const userId = BigInt((request as any).user.user_id);
        const ticketId = BigInt((request.params as { id: string }).id);
        const body = (request.body || {}) as { message_text?: string; attachment_urls?: unknown[] };
        const message_text = typeof body.message_text === 'string' ? body.message_text.trim() || null : null;
        const attachment_urls = Array.isArray(body.attachment_urls) ? body.attachment_urls : [];

        const ticket = await prisma.support_tickets.findFirst({
          where: { id: ticketId, user_id: userId },
        });
        if (!ticket) {
          return reply.code(404).send({ message: 'Ticket not found' });
        }
        if (ticket.status === 'closed') {
          return reply.code(400).send({ message: 'Cannot add message to closed ticket' });
        }
        if (!message_text && attachment_urls.length === 0) {
          return reply.code(400).send({ message: 'Either message_text or at least one attachment is required' });
        }

        const msg = await prisma.support_ticket_messages.create({
          data: {
            ticket_id: ticketId,
            sender_type: 'user',
            sender_user_id: userId,
            message_text: message_text || null,
            attachment_urls: attachment_urls.length > 0 ? (attachment_urls as Prisma.InputJsonValue) : undefined,
          },
        });

        await prisma.support_tickets.update({
          where: { id: ticketId },
          data: { updated_at: new Date() },
        });

        return reply.send({
          message_id: Number(msg.id),
          message_text: msg.message_text,
          attachment_urls: msg.attachment_urls,
          created_at: msg.created_at.toISOString(),
        });
      } catch (e) {
        console.error('Support add message error:', e);
        return reply.code(500).send({ message: 'Failed to send message' });
      }
  });

  /**
   * POST /support/tickets/:id/close
   * Close ticket (only ticket owner)
   */
  app.post('/tickets/:id/close', {
    preHandler: [requireUser],
    schema: {
      description: 'Close ticket (only you can close your ticket)',
      tags: ['Support'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: { '200': { type: 'object' }, '403': { type: 'object' }, '404': { type: 'object' } },
    },
  }, async (request, reply) => {
      try {
        const userId = BigInt((request as any).user.user_id);
        const ticketId = BigInt((request.params as { id: string }).id);

        const ticket = await prisma.support_tickets.findFirst({
          where: { id: ticketId, user_id: userId },
        });
        if (!ticket) {
          return reply.code(404).send({ message: 'Ticket not found' });
        }
        if (ticket.status === 'closed') {
          return reply.code(400).send({ message: 'Ticket is already closed' });
        }

        await prisma.support_tickets.update({
          where: { id: ticketId },
          data: {
            status: 'closed',
            closed_at: new Date(),
            closed_by_user_id: userId,
            updated_at: new Date(),
          },
        });

        return reply.send({
          ticket_id: Number(ticketId),
          status: 'closed',
          closed_at: new Date().toISOString(),
        });
      } catch (e) {
        console.error('Support close ticket error:', e);
        return reply.code(500).send({ message: 'Failed to close ticket' });
      }
  });
}
