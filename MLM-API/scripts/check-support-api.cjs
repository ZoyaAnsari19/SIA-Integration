#!/usr/bin/env node
/**
 * Quick check: simulate GET /api/v1/support/tickets response for user_id 280.
 * Run: node scripts/check-support-api.cjs
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const safeNum = (v) => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const safeStr = (v) => (v != null && typeof v === 'string' ? v : null);
const safeDate = (v) => {
  if (v == null) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

async function main() {
  const userId = BigInt(280);
  const [items, total] = await Promise.all([
    prisma.support_tickets.findMany({
      where: { user_id: userId },
      orderBy: { updated_at: 'desc' },
      take: 5,
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
    prisma.support_tickets.count({ where: { user_id: userId } }),
  ]);

  const response = {
    items: items.map((t) => {
      const firstMsg = Array.isArray(t.messages) ? t.messages[0] : null;
      return {
        id: safeNum(t.id),
        pre_question_id: t.pre_question_id ?? null,
        pre_question: safeStr(t.pre_question?.question ?? null),
        subject: safeStr(t.subject),
        status: ['open', 'in_progress', 'closed'].includes(String(t.status ?? '')) ? String(t.status) : 'open',
        created_at: safeDate(t.created_at),
        updated_at: safeDate(t.updated_at),
        last_message: firstMsg
          ? { text: safeStr(firstMsg.message_text), created_at: safeDate(firstMsg.created_at) }
          : null,
      };
    }),
    total: Number(total),
    page: 1,
    limit: 5,
    total_pages: Math.ceil(Number(total) / 5),
  };

  console.log('Support list API response shape (first 5 tickets):');
  console.log(JSON.stringify(response, null, 2));
  const ok = response.items.every((t) => t.id != null && (t.subject != null || t.pre_question != null || t.last_message?.text));
  console.log(ok ? '\n✅ All items have id and at least subject/pre_question or last_message.' : '\n⚠️ Some items missing id/subject/last_message.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
