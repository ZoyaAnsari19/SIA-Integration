import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { superAdminAuth } from '../middleware/superAdminAuth.js';

const activityLogsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  admin_user_id: z.string().optional().transform((val) => val ? BigInt(val) : undefined),
  action_type: z.string().optional(),
  target_user_id: z.string().optional().transform((val) => val ? BigInt(val) : undefined),
  status: z.enum(['success', 'failed', 'error']).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

export async function adminActivityLogsRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/admin/activity-logs:
   *   get:
   *     tags:
   *       - Admin Activity Logs
   *     summary: Get admin activity logs (Super Admin only)
   *     description: Retrieve activity logs of sub-admin actions. Only SUPER_ADMIN can access this endpoint.
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *           maximum: 100
   *       - in: query
   *         name: admin_user_id
   *         schema:
   *           type: string
   *         description: Filter by sub-admin user ID
   *       - in: query
   *         name: action_type
   *         schema:
   *           type: string
   *         description: Filter by action type (e.g., KYC_APPROVE, PACKAGE_ASSIGN)
   *       - in: query
   *         name: target_user_id
   *         schema:
   *           type: string
   *         description: Filter by target user ID
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [success, failed, error]
   *       - in: query
   *         name: start_date
   *         schema:
   *           type: string
   *           format: date
   *         description: Start date for filtering (YYYY-MM-DD)
   *       - in: query
   *         name: end_date
   *         schema:
   *           type: string
   *           format: date
   *         description: End date for filtering (YYYY-MM-DD)
   *     responses:
   *       '200':
   *         description: Activity logs retrieved successfully
   *       '403':
   *         description: Forbidden - Only SUPER_ADMIN can access
   */
  app.get('/activity-logs', {
    preHandler: [adminAuth, superAdminAuth],
    schema: {
      description: 'Get admin activity logs (Super Admin only)',
      tags: ['Admin Activity Logs'],
      summary: 'Get Activity Logs',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          admin_user_id: { type: 'string' },
          action_type: { type: 'string' },
          target_user_id: { type: 'string' },
          status: { type: 'string', enum: ['success', 'failed', 'error'] },
          start_date: { type: 'string' },
          end_date: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            logs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  admin_user_id: { type: 'string' },
                  admin_name: { type: 'string', nullable: true },
                  admin_email: { type: 'string', nullable: true },
                  action_type: { type: 'string' },
                  target_user_id: { type: 'string', nullable: true },
                  target_user_display_id: { type: 'string', nullable: true },
                  target_entity_type: { type: 'string', nullable: true },
                  target_entity_id: { type: 'string', nullable: true },
                  action_details: { type: 'object' },
                  action_summary: { type: 'string', nullable: true },
                  ip_address: { type: 'string', nullable: true },
                  user_agent: { type: 'string', nullable: true },
                  status: { type: 'string' },
                  error_message: { type: 'string', nullable: true },
                  created_at: { type: 'string', format: 'date-time' },
                },
              },
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                total: { type: 'number' },
                total_pages: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const query = activityLogsQuerySchema.parse(req.query);
      const page = query.page;
      const limit = query.limit;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};

      if (query.admin_user_id) {
        where.admin_user_id = query.admin_user_id;
      }

      if (query.action_type) {
        where.action_type = query.action_type;
      }

      if (query.target_user_id) {
        where.target_user_id = query.target_user_id;
      }

      if (query.status) {
        where.status = query.status;
      }

      // Date range filter
      if (query.start_date || query.end_date) {
        where.created_at = {};
        if (query.start_date) {
          where.created_at.gte = new Date(query.start_date + 'T00:00:00.000Z');
        }
        if (query.end_date) {
          const endDate = new Date(query.end_date + 'T23:59:59.999Z');
          where.created_at.lte = endDate;
        }
      }

      // Get total count
      const total = await prisma.admin_activity_logs.count({ where });

      // Get logs with admin info using Prisma
      // Use explicit select to ensure action_summary is included
      const logs = await prisma.admin_activity_logs.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          admin_user_id: true,
          action_type: true,
          target_user_id: true,
          target_entity_type: true,
          target_entity_id: true,
          action_details: true,
          action_summary: true, // Explicitly select action_summary
          ip_address: true,
          user_agent: true,
          status: true,
          error_message: true,
          metadata: true,
          created_at: true,
          admin: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Debug: Check if action_summary is being fetched by Prisma
      const walletLogs = logs.filter(l => l.action_type === 'WALLET_MANAGE');
      if (walletLogs.length > 0) {
        console.log(`🔍 [ACTIVITY LOGS] Prisma returned ${walletLogs.length} WALLET_MANAGE logs`);
        walletLogs.slice(0, 5).forEach(log => {
          const logAny = log as any;
          console.log(`  Log ID ${log.id}:`, {
            has_action_summary_field: 'action_summary' in log,
            action_summary_direct: log.action_summary,
            action_summary_via_any: logAny.action_summary,
            action_summary_type: typeof log.action_summary,
            all_keys: Object.keys(log).filter(k => k.includes('summary') || k.includes('action')),
            raw_log_keys: Object.keys(log).slice(0, 10)
          });
        });
      }

      // Get log IDs for direct DB query
      const logIds = logs.map(log => log.id);

      // CRITICAL: Query action_summary directly from database using raw SQL
      // This ensures we get action_summary even if Prisma has issues
      let actionSummaryMap: Map<bigint, string | null> = new Map();
      if (logIds.length > 0) {
        try {
          const idStrings = logIds.map(id => id.toString());
          const idList = idStrings.join(',');
          
          const summaryQuery = `
            SELECT 
              id,
              action_summary
            FROM admin_activity_logs
            WHERE id IN (${idList})
          `;
          
          const rawSummaries = await prisma.$queryRawUnsafe<Array<{ id: bigint; action_summary: string | null }>>(summaryQuery);
          
          for (const row of rawSummaries) {
            actionSummaryMap.set(row.id, row.action_summary);
          }
          
          console.log(`✅ [ACTIVITY LOGS] Fetched action_summary for ${actionSummaryMap.size}/${logIds.length} logs from direct DB query`);
          
          // Debug: Show sample summaries
          if (actionSummaryMap.size > 0) {
            const sampleEntries = Array.from(actionSummaryMap.entries()).slice(0, 3);
            sampleEntries.forEach(([id, summary]) => {
              console.log(`  📝 Log ID ${id}: action_summary = "${summary}"`);
            });
          }
        } catch (summaryErr) {
          console.error('❌ [ACTIVITY LOGS] Error querying action_summary from DB:', summaryErr);
        }
      } else {
        console.warn('⚠️ [ACTIVITY LOGS] No log IDs to query action_summary for');
      }

      // CRITICAL: Query action_details directly from database using raw SQL
      // This bypasses Prisma's JSONB handling which seems to be returning empty objects
      let actionDetailsMap: Map<bigint, any> = new Map();
      if (logIds.length > 0) {
        try {
          // Convert BigInt array to string array for SQL
          const idStrings = logIds.map(id => id.toString());
          
          console.log(`🔍 [ACTIVITY LOGS] Querying action_details for ${logIds.length} logs, IDs:`, idStrings.slice(0, 5));
          
          // Use $queryRawUnsafe with proper SQL - this is safe because we control the input (BigInt IDs from our own query)
          // Convert BigInt IDs to string for SQL IN clause
          const idList = idStrings.join(',');
          const query = `
            SELECT 
              id,
              action_details::text as action_details_text
            FROM admin_activity_logs
            WHERE id IN (${idList})
          `;
          
          console.log(`🔍 [ACTIVITY LOGS] Executing query for ${logIds.length} logs`);
          console.log(`🔍 [ACTIVITY LOGS] Query:`, query.substring(0, 300));
          
          const rawActionDetails = await prisma.$queryRawUnsafe<Array<{ id: bigint; action_details_text: string | null }>>(query);
          
          console.log(`📊 [ACTIVITY LOGS] Query executed, got ${rawActionDetails.length} rows (expected ${logIds.length})`);
          if (rawActionDetails.length > 0) {
            console.log(`📊 [ACTIVITY LOGS] First row sample:`, {
              id: rawActionDetails[0].toString(),
              has_text: !!rawActionDetails[0].action_details_text,
              text_length: rawActionDetails[0].action_details_text?.length || 0,
              text_preview: rawActionDetails[0].action_details_text?.substring(0, 150) || 'null'
            });
          } else {
            console.error(`❌ [ACTIVITY LOGS] Query returned 0 rows! Expected ${logIds.length} rows.`);
            console.error(`❌ [ACTIVITY LOGS] Query was:`, query);
          }
          
          console.log(`📊 [ACTIVITY LOGS] Raw query returned ${rawActionDetails.length} rows (expected ${logIds.length})`);
          
          for (const row of rawActionDetails) {
            if (row.action_details_text && row.action_details_text !== 'null' && row.action_details_text.trim() !== '') {
              try {
                const parsed = JSON.parse(row.action_details_text);
                actionDetailsMap.set(row.id, parsed);
                
                // Debug for WALLET_MANAGE
                const log = logs.find(l => l.id === row.id);
                if (log?.action_type === 'WALLET_MANAGE') {
                  console.log('✅ [ACTIVITY LOGS] Parsed action_details from DB for WALLET_MANAGE:', {
                    id: row.id.toString(),
                    keys: Object.keys(parsed),
                    main_wallet_amount: parsed.main_wallet_amount,
                    spot_wallet_amount: parsed.spot_wallet_amount,
                    reason: parsed.reason,
                    text_preview: row.action_details_text.substring(0, 150),
                  });
                }
              } catch (parseErr) {
                console.error(`❌ [ACTIVITY LOGS] Error parsing action_details for log ${row.id}:`, parseErr, {
                  text: row.action_details_text?.substring(0, 100)
                });
              }
            } else {
              const log = logs.find(l => l.id === row.id);
              if (log?.action_type === 'WALLET_MANAGE') {
                console.warn(`⚠️ [ACTIVITY LOGS] Empty/null action_details_text for WALLET_MANAGE log ${row.id}:`, {
                  text: row.action_details_text,
                  is_null: row.action_details_text === null,
                });
              }
            }
          }
          
          console.log(`✅ [ACTIVITY LOGS] Fetched action_details for ${actionDetailsMap.size}/${logIds.length} logs from direct DB query`);
          
          // Additional debug: Check if we got all WALLET_MANAGE logs
          const walletManageLogs = logs.filter(l => l.action_type === 'WALLET_MANAGE');
          const walletManageWithDetails = walletManageLogs.filter(l => actionDetailsMap.has(l.id));
          console.log(`💰 [ACTIVITY LOGS] WALLET_MANAGE logs: ${walletManageWithDetails.length}/${walletManageLogs.length} have action_details`);
        } catch (dbErr) {
          console.error('❌ [ACTIVITY LOGS] Error querying action_details from DB:', dbErr);
          // Log the error details
          console.error('DB Error details:', {
            logIdsCount: logIds.length,
            logIds: logIds.map(id => id.toString()).slice(0, 5),
            error: dbErr instanceof Error ? dbErr.message : String(dbErr),
            stack: dbErr instanceof Error ? dbErr.stack : undefined
          });
        }
      } else {
        console.warn('⚠️ [ACTIVITY LOGS] No log IDs to query action_details for');
      }

      // Get target user info for logs that have target_user_id
      const logsWithDetails = await Promise.all(
        logs.map(async (log) => {
          try {
            let targetUserDisplayId = null;
            if (log.target_user_id) {
              try {
                const targetUser = await prisma.users.findUnique({
                  where: { id: log.target_user_id },
                  select: { display_id: true },
                });
                targetUserDisplayId = targetUser?.display_id || null;
              } catch (err) {
                console.error(`Error fetching target user ${log.target_user_id}:`, err);
                // Continue without target user display id
              }
            }

            // Get action_details from direct DB query result
            let actionDetails: any = null;
            const dbActionDetails = actionDetailsMap.get(log.id);
            
            if (dbActionDetails) {
              actionDetails = dbActionDetails;
              if (log.action_type === 'WALLET_MANAGE' || log.action_type === 'ACTIVATION_REJECT' || log.action_type === 'ACTIVATION_APPROVE') {
                console.log(`✅ [RESPONSE] Using action_details from direct DB query for ${log.action_type}:`, {
                  id: log.id.toString(),
                  keys: Object.keys(actionDetails),
                  keys_count: Object.keys(actionDetails).length,
                  main_wallet_amount: actionDetails.main_wallet_amount,
                  spot_wallet_amount: actionDetails.spot_wallet_amount,
                  reason: actionDetails.reason,
                });
              }
            } else {
              // If DB query didn't return it, try one more time with individual query
              if (log.action_type === 'WALLET_MANAGE' || log.action_type === 'ACTIVATION_REJECT' || log.action_type === 'ACTIVATION_APPROVE') {
                console.warn(`⚠️ [RESPONSE] No action_details from batch DB query for ${log.action_type} log ${log.id}, trying individual query...`);
                try {
                  const individualResult = await prisma.$queryRawUnsafe<Array<{ action_details_text: string | null }>>(
                    `SELECT action_details::text as action_details_text FROM admin_activity_logs WHERE id = ${log.id}`
                  );
                  if (individualResult && individualResult.length > 0 && individualResult[0]?.action_details_text) {
                    const dbText = individualResult[0].action_details_text;
                    if (dbText && dbText !== 'null' && dbText.trim() !== '') {
                      actionDetails = JSON.parse(dbText);
                      console.log(`✅ [RESPONSE] Got action_details from individual DB query for ${log.action_type}:`, {
                        id: log.id.toString(),
                        keys: Object.keys(actionDetails),
                        keys_count: Object.keys(actionDetails).length,
                      });
                    }
                  }
                } catch (indErr) {
                  console.error(`❌ [RESPONSE] Error in individual DB query for log ${log.id}:`, indErr);
                }
              }
              
              // Final fallback to Prisma result
              if (!actionDetails && log.action_details !== null && log.action_details !== undefined) {
                try {
                  if (typeof log.action_details === 'object') {
                    const stringified = JSON.stringify(log.action_details);
                    if (stringified && stringified !== '{}' && stringified !== 'null') {
                      actionDetails = JSON.parse(stringified);
                    } else {
                      actionDetails = log.action_details as any;
                    }
                  } else if (typeof log.action_details === 'string') {
                    actionDetails = JSON.parse(log.action_details);
                  } else {
                    actionDetails = log.action_details;
                  }
                } catch (e) {
                  console.error('❌ Error processing action_details from Prisma:', e);
                  actionDetails = null;
                }
              }
              
              if ((log.action_type === 'WALLET_MANAGE' || log.action_type === 'ACTIVATION_REJECT' || log.action_type === 'ACTIVATION_APPROVE') && !actionDetails) {
                console.error(`❌ [RESPONSE] FINAL: No action_details found for ${log.action_type} log ${log.id} - will return null`);
              }
            }
            
            // Final validation before returning
            if ((log.action_type === 'WALLET_MANAGE' || log.action_type === 'ACTIVATION_REJECT' || log.action_type === 'ACTIVATION_APPROVE') && actionDetails) {
              console.log(`✅ [RESPONSE] FINAL: Returning action_details for ${log.action_type} log ${log.id}:`, {
                keys_count: Object.keys(actionDetails).length,
                has_main_wallet: actionDetails.main_wallet_amount !== undefined,
                has_spot_wallet: actionDetails.spot_wallet_amount !== undefined,
                has_reason: !!actionDetails.reason,
              });
            }

            // Debug action_summary - check what Prisma actually returned
            const logAny = log as any;
            if (log.action_type === 'WALLET_MANAGE') {
              console.log(`📋 [RESPONSE] action_summary for log ${log.id}:`, {
                has_summary_field: 'action_summary' in log,
                summary_direct: log.action_summary,
                summary_via_any: logAny.action_summary,
                summary_type: typeof log.action_summary,
                summary_length: log.action_summary?.length || 0,
                all_log_keys: Object.keys(log).filter(k => k.includes('summary') || k.includes('action'))
              });
            }

            // Get action_summary - try multiple sources
            // 1. First try direct DB query result (most reliable)
            let summaryValue = actionSummaryMap.get(log.id) || null;
            
            // 2. Fallback to Prisma result if DB query didn't return it
            if (!summaryValue) {
              summaryValue = (log as any).action_summary || logAny.action_summary || null;
            }

            // Final debug before returning
            if (log.action_type === 'WALLET_MANAGE') {
              console.log(`📤 [FINAL RESPONSE] Log ${log.id} action_summary:`, {
                from_db_query: actionSummaryMap.has(log.id),
                db_query_value: actionSummaryMap.get(log.id),
                from_prisma: !!(log as any).action_summary,
                prisma_value: (log as any).action_summary,
                final_summaryValue: summaryValue,
                summaryType: typeof summaryValue,
                willReturn: summaryValue || 'null',
                summaryLength: summaryValue?.length || 0
              });
            }

            return {
              id: log.id.toString(),
              admin_user_id: log.admin_user_id.toString(),
              admin_name: log.admin?.name || null,
              admin_email: log.admin?.email || null,
              action_type: log.action_type,
              target_user_id: log.target_user_id ? log.target_user_id.toString() : null,
              target_user_display_id: targetUserDisplayId,
              target_entity_type: log.target_entity_type,
              target_entity_id: log.target_entity_id,
              action_details: actionDetails,
              action_summary: summaryValue || null, // Ensure it's always included, even if null
              ip_address: log.ip_address,
              user_agent: log.user_agent,
              status: log.status,
              error_message: log.error_message,
              created_at: log.created_at.toISOString(),
            };
          } catch (err) {
            console.error('Error processing log:', err);
            // Return a minimal log entry if processing fails
            return {
              id: log.id.toString(),
              admin_user_id: log.admin_user_id.toString(),
              admin_name: null,
              admin_email: null,
              action_type: log.action_type,
              target_user_id: log.target_user_id ? log.target_user_id.toString() : null,
              target_user_display_id: null,
              target_entity_type: log.target_entity_type,
              target_entity_id: log.target_entity_id,
              action_details: log.action_details as any,
              ip_address: log.ip_address,
              user_agent: log.user_agent,
              status: log.status,
              error_message: log.error_message,
              created_at: log.created_at.toISOString(),
            };
          }
        })
      );

      const totalPages = Math.ceil(total / limit);

      // Final check: Log how many logs have action_details
      const logsWithDetailsCount = logsWithDetails.filter(l => l.action_details && Object.keys(l.action_details).length > 0).length;
      const walletManageLogs = logsWithDetails.filter(l => l.action_type === 'WALLET_MANAGE');
      const walletManageWithDetails = walletManageLogs.filter(l => l.action_details && Object.keys(l.action_details).length > 0);
      
      console.log(`📤 [ACTIVITY LOGS] Sending response:`, {
        total_logs: logsWithDetails.length,
        logs_with_details: logsWithDetailsCount,
        wallet_manage_logs: walletManageLogs.length,
        wallet_manage_with_details: walletManageWithDetails.length,
        sample_wallet_log: walletManageLogs[0] ? {
          id: walletManageLogs[0].id,
          has_action_details: !!walletManageLogs[0].action_details,
          action_details_keys: walletManageLogs[0].action_details ? Object.keys(walletManageLogs[0].action_details).length : 0,
          action_details_sample: walletManageLogs[0].action_details ? JSON.stringify(walletManageLogs[0].action_details).substring(0, 200) : 'null'
        } : 'none'
      });

      return reply.send({
        logs: logsWithDetails,
        pagination: {
          page,
          limit,
          total,
          total_pages: totalPages,
        },
      });
    } catch (error: any) {
      console.error('Error fetching activity logs:', error);
      console.error('Error stack:', error?.stack);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'validation_error',
          message: 'Invalid query parameters',
          details: error.errors,
        });
      }
      
      return reply.code(500).send({
        error: 'internal_error',
        message: 'Failed to fetch activity logs',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      });
    }
  });
}
