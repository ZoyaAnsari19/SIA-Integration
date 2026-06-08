import { FastifyInstance } from 'fastify';
import { prisma } from '../config/prisma';
import { requireUser } from '../middleware/jwt';

export async function courseCartRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/cart
   * Get user's shopping cart
   */
  app.get('/', {
    preHandler: requireUser,
    schema: {
      description: 'Get user shopping cart',
      tags: ['Cart'],
      summary: 'Get Cart'
    }
  }, async (request, reply) => {
    const userId = BigInt((request as any).user.user_id);

    const entries = await prisma.course_cart_entries.findMany({
      where: { user_id: userId },
      include: {
        course: {
          select: {
            id: true,
            slug: true,
            title: true,
            short_description: true,
            price: true,
            original_price: true,
            thumbnail_url: true,
            language: true,
            level: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const total = entries.reduce((sum, entry) => {
      return sum + Number(entry.course.price) * entry.quantity;
    }, 0);

    const formattedEntries = entries.map(entry => ({
      ...entry,
      courseId: entry.course_id, // Add courseId for frontend compatibility
      course_id: entry.course_id, // Keep original field
      course: {
        ...entry.course,
        price: Number(entry.course.price),
        original_price: entry.course.original_price ? Number(entry.course.original_price) : null,
      }
    }));

    return reply.send({
      cart: {
        items: formattedEntries,
        total,
        itemCount: entries.length,
      },
    });
  });

  /**
   * POST /api/v1/cart/items
   * Add course to cart
   */
  app.post('/items', {
    preHandler: requireUser,
    schema: {
      description: 'Add course to cart',
      tags: ['Cart'],
      summary: 'Add to Cart',
      body: {
        type: 'object',
        properties: {
          courseId: { type: 'string' },
          // Optional request_type for aligning cart behaviour with purchase types
          // (activation, reinvestment, renew, upgrade). Currently only reinvestment
          // needs special handling (allow adding course even if already owned).
          request_type: {
            type: 'string',
            enum: ['activation', 'reinvestment', 'renew', 'upgrade'],
            nullable: true,
          },
        },
        required: ['courseId']
      }
    }
  }, async (request, reply) => {
    const userId = BigInt((request as any).user.user_id);
    const { courseId, request_type } = request.body as {
      courseId: string;
      request_type?: 'activation' | 'reinvestment' | 'renew' | 'upgrade';
    };

    if (!courseId) {
      return reply.status(400).send({ error: 'Course ID is required' });
    }

    const course = await prisma.courses.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      return reply.status(404).send({ error: 'Course not found' });
    }

    if (!course.is_published) {
      return reply.status(400).send({ error: 'Course is not available' });
    }

    // For normal activation/upgrade flows, prevent adding a course the user already owns.
    // For reinvestment and renewal, we ALLOW buying the same course again, so we skip this check.
    if (request_type !== 'reinvestment' && request_type !== 'renew') {
      const purchase = await prisma.purchases.findFirst({
        where: {
          user_id: userId,
          course_id: courseId,
          purchase_type: 'COURSE_PURCHASE',
          status: 'completed',
        },
      });

      if (purchase) {
        return reply.status(400).send({ error: 'You already own this course' });
      }
    }

    let entry;
    try {
      entry = await prisma.course_cart_entries.upsert({
        where: {
          user_id_course_id: {
            user_id: userId,
            course_id: courseId,
          },
        },
        update: {
          quantity: 1,
        },
        create: {
          user_id: userId,
          course_id: courseId,
          quantity: 1,
        },
        include: {
          course: {
            select: {
              id: true,
              slug: true,
              title: true,
              price: true,
              thumbnail_url: true,
            },
          },
        },
      });
    } catch (e: any) {
      // Handle rare race condition where another request created the same
      // (user_id, course_id) entry between the SELECT and INSERT inside upsert.
      if (e?.code === 'P2002') {
        const existing = await prisma.course_cart_entries.findUnique({
          where: {
            user_id_course_id: {
              user_id: userId,
              course_id: courseId,
            },
          },
          include: {
            course: {
              select: {
                id: true,
                slug: true,
                title: true,
                price: true,
                thumbnail_url: true,
              },
            },
          },
        });

        if (!existing) {
          throw e;
        }

        entry = existing;
      } else {
        console.error('Error adding course to cart:', e);
        throw e;
      }
    }

    return reply.status(201).send({
      message: 'Course added to cart',
      item: {
        ...entry,
        course: {
          ...entry.course,
          price: Number(entry.course.price),
        }
      },
    });
  });

  /**
   * DELETE /api/v1/cart/items/:courseId
   * Remove course from cart
   */
  app.delete('/items/:courseId', {
    preHandler: requireUser,
    schema: {
      description: 'Remove course from cart',
      tags: ['Cart'],
      summary: 'Remove from Cart',
      params: {
        type: 'object',
        properties: {
          courseId: { type: 'string' }
        },
        required: ['courseId']
      }
    }
  }, async (request, reply) => {
    const userId = BigInt((request as any).user.user_id);
    const { courseId } = request.params as { courseId: string };

    await prisma.course_cart_entries.deleteMany({
      where: {
        user_id: userId,
        course_id: courseId,
      },
    });

    return reply.send({ message: 'Course removed from cart' });
  });

  /**
   * DELETE /api/v1/cart/clear
   * Clear entire cart
   */
  app.delete('/clear', {
    preHandler: requireUser,
    schema: {
      description: 'Clear entire cart',
      tags: ['Cart'],
      summary: 'Clear Cart'
    }
  }, async (request, reply) => {
    const userId = BigInt((request as any).user.user_id);

    await prisma.course_cart_entries.deleteMany({
      where: { user_id: userId },
    });

    return reply.send({ message: 'Cart cleared' });
  });
}



