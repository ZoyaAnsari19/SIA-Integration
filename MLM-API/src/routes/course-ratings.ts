import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { requireUser } from '../middleware/jwt';

const ratingSchema = z.object({
  courseId: z.string(),
  rating: z.number().min(1).max(5),
  review: z.string().optional(),
});

export async function courseRatingsRoutes(app: FastifyInstance) {
  /**
   * POST /api/v1/ratings
   * Add or update rating for a course
   */
  app.post('/', {
    preHandler: requireUser,
    schema: {
      description: 'Add or update course rating',
      tags: ['Ratings'],
      summary: 'Rate Course',
      body: {
        type: 'object',
        properties: {
          courseId: { type: 'string' },
          rating: { type: 'number', minimum: 1, maximum: 5 },
          review: { type: 'string' }
        },
        required: ['courseId', 'rating']
      }
    }
  }, async (request, reply) => {
    const { courseId, rating, review } = ratingSchema.parse(request.body);
    const userId = BigInt((request as any).user.user_id);
    const userRole = (request as any).user.role || 'STUDENT';

    // Check if user purchased the course (unless admin - SUPER_ADMIN or SUB_ADMIN)
    if (userRole !== 'SUPER_ADMIN' && userRole !== 'SUB_ADMIN') {
      const purchase = await prisma.purchases.findFirst({
        where: {
          user_id: userId,
          course_id: courseId,
          purchase_type: 'COURSE_PURCHASE',
          status: 'completed',
        },
      });

      if (!purchase) {
        return reply.status(403).send({ error: 'You must purchase this course to rate it' });
      }
    }

    const courseRating = await prisma.course_ratings.upsert({
      where: {
        user_id_course_id: {
          user_id: userId,
          course_id: courseId,
        },
      },
      update: {
        rating,
        review: review || null,
      },
      create: {
        user_id: userId,
        course_id: courseId,
        rating,
        review: review || null,
      },
    });

    // Recalculate course average rating
    const ratings = await prisma.course_ratings.findMany({
      where: { course_id: courseId },
      select: { rating: true },
    });

    const averageRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

    await prisma.courses.update({
      where: { id: courseId },
      data: {
        rating: averageRating,
        total_ratings: ratings.length,
      },
    });

    return reply.send({
      message: 'Rating saved successfully',
      rating: courseRating,
    });
  });

  /**
   * GET /api/v1/ratings/course/:courseId
   * Get ratings for a course (paginated)
   */
  app.get('/course/:courseId', {
    schema: {
      description: 'Get course ratings with pagination',
      tags: ['Ratings'],
      summary: 'Get Course Ratings',
      params: {
        type: 'object',
        properties: {
          courseId: { type: 'string' }
        },
        required: ['courseId']
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 10 }
        }
      }
    }
  }, async (request, reply) => {
    const { courseId } = request.params as { courseId: string };
    const { page = 1, limit = 10 } = request.query as any;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [ratings, total] = await Promise.all([
      prisma.course_ratings.findMany({
        where: { course_id: courseId },
        orderBy: { created_at: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.course_ratings.count({
        where: { course_id: courseId },
      }),
    ]);

    // Get user names
    const userIds = ratings.map(r => r.user_id);
    const users = await prisma.users.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });

    const userMap = new Map(users.map(u => [u.id.toString(), u.name]));

    const formattedRatings = ratings.map(r => ({
      ...r,
      user_id: r.user_id.toString(),
      user: {
        id: r.user_id.toString(),
        name: userMap.get(r.user_id.toString()) || 'Unknown',
      },
    }));

    return reply.send({
      ratings: formattedRatings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  });

  /**
   * GET /api/v1/ratings/course/:courseId/my-rating
   * Get user's rating for a course
   */
  app.get('/course/:courseId/my-rating', {
    preHandler: requireUser,
    schema: {
      description: "Get user's rating for a course",
      tags: ['Ratings'],
      summary: 'My Rating',
      params: {
        type: 'object',
        properties: {
          courseId: { type: 'string' }
        },
        required: ['courseId']
      }
    }
  }, async (request, reply) => {
    const { courseId } = request.params as { courseId: string };
    const userId = BigInt((request as any).user.user_id);

    const rating = await prisma.course_ratings.findUnique({
      where: {
        user_id_course_id: {
          user_id: userId,
          course_id: courseId,
        },
      },
    });

    return reply.send({ rating: rating || null });
  });
}



