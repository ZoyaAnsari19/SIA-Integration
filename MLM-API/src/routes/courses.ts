import { FastifyInstance } from 'fastify';
import { prisma } from '../config/prisma.js';
import { requireUser } from '../middleware/jwt.js';
import jwt, { Secret } from 'jsonwebtoken';

export async function coursesRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/courses
   * Get all published courses (with filters)
   */
  app.get('/', {
    schema: {
      description: 'Get all published courses with optional filters',
      tags: ['Courses'],
      summary: 'List Courses',
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          level: { type: 'string', enum: ['BASIC', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT', 'PROFESSIONAL'] },
          language: { type: 'string', enum: ['HINDI', 'ENGLISH', 'BILINGUAL'] },
          search: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { category, level, language, search } = request.query as any;

    const where: any = { is_published: true };
    
    if (category) where.category = category;
    if (level) where.level = level;
    if (language) where.language = language;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { short_description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const courses = await prisma.courses.findMany({
      where,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        short_description: true,
        price: true,
        original_price: true,
        language: true,
        level: true,
        category: true,
        thumbnail_url: true,
        rating: true,
        total_ratings: true,
        total_students: true,
        total_lessons: true,
        total_duration: true,
        created_at: true,
      },
    });

    // Convert Decimals to Numbers
    const formattedCourses = courses.map(course => ({
      ...course,
      price: Number(course.price),
      original_price: course.original_price ? Number(course.original_price) : null,
      rating: Number(course.rating)
    }));

    return reply.send({ courses: formattedCourses });
  });

  /**
   * GET /api/v1/courses/by-package/:packageId
   * Resolve the primary published course linked to a given package.
   * Used by the MLM dashboard to redirect users to the course app before starting payment.
   */
  app.get('/by-package/:packageId', {
    schema: {
      description: 'Get primary published course linked to a package',
      tags: ['Courses'],
      summary: 'Get Course by Package',
      params: {
        type: 'object',
        properties: {
          packageId: { type: 'string' },
        },
        required: ['packageId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            course: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                slug: { type: 'string' },
                title: { type: 'string' },
                package_id: { type: ['number', 'null'] },
                price: { type: 'number' },
              },
            },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { packageId } = request.params as { packageId: string };

    const numericPackageId = Number(packageId);
    if (!Number.isFinite(numericPackageId) || numericPackageId <= 0) {
      return reply.status(400).send({
        error: 'invalid_package_id',
        message: 'packageId must be a positive number',
      });
    }

    const course = await prisma.courses.findFirst({
      where: {
        package_id: numericPackageId,
        is_published: true,
      },
      orderBy: {
        created_at: 'asc',
      },
      select: {
        id: true,
        slug: true,
        title: true,
        package_id: true,
        price: true,
      },
    });

    if (!course) {
      return reply.status(404).send({
        error: 'course_not_found_for_package',
        message: `No published course is linked with package ID ${numericPackageId}.`,
      });
    }

    return reply.send({
      course: {
        ...course,
        price: Number(course.price),
      },
    });
  });

  /**
   * GET /api/v1/courses/:slug
   * Get course by slug (public endpoint, but checks enrollment if authenticated)
   */
  app.get('/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    
    // Try to get userId from token if available (optional auth)
    let userId: bigint | null = null;
    try {
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '');
        const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
        const decoded = jwt.verify(token, JWT_SECRET as Secret) as any;
        userId = decoded?.user_id ? BigInt(decoded.user_id) : null;
      }
    } catch (err) {
      // Token invalid or missing - continue without userId
      userId = null;
    }

    const course = await prisma.courses.findFirst({
      where: { slug, is_published: true },
      include: {
        ratings: {
          take: 5,
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!course) {
      return reply.status(404).send({ error: 'Course not found' });
    }

    let isEnrolled = false;
    if (userId) {
      // Debug: Log values for troubleshooting
      app.log.info({ userId: userId.toString(), courseId: course.id }, 'Checking enrollment');
      
      // Check for direct course purchase
      const directPurchase = await prisma.purchases.findFirst({
        where: {
          user_id: userId,
          course_id: course.id,
          purchase_type: 'COURSE_PURCHASE',
          status: 'completed',
        },
      });
      
      // If no direct purchase, check for package purchase
      if (!directPurchase && course.package_id) {
        const packagePurchase = await prisma.purchases.findFirst({
          where: {
            user_id: userId,
            package_id: course.package_id,
            purchase_type: 'DIRECT_PACKAGE',
            status: 'completed',
          },
        });
        
        app.log.info({ 
          directPurchaseFound: !!directPurchase, 
          packagePurchaseFound: !!packagePurchase,
          packageId: course.package_id 
        }, 'Enrollment check result');
        isEnrolled = !!packagePurchase;
      } else {
        app.log.info({ purchaseFound: !!directPurchase, purchaseId: directPurchase?.id?.toString() }, 'Enrollment check result');
        isEnrolled = !!directPurchase;
      }
    }

    return reply.send({
      course: {
        ...course,
        price: Number(course.price),
        original_price: course.original_price ? Number(course.original_price) : null,
        rating: Number(course.rating),
        isEnrolled,
      },
    });
  });

  /**
   * GET /api/v1/courses/:slug/modules
   * Get course modules (requires enrollment)
   */
  app.get('/:slug/modules', {
    preHandler: requireUser,
    schema: {
      description: 'Get course modules and videos (enrolled users only)',
      tags: ['Courses'],
      summary: 'Get Course Modules',
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string' }
        },
        required: ['slug']
      }
    }
  }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const userId = BigInt((request as any).user.user_id);
    const userRole = (request as any).user.role || 'STUDENT';

    const course = await prisma.courses.findFirst({
      where: { slug },
    });

    if (!course) {
      return reply.status(404).send({ error: 'Course not found' });
    }

    // Check enrollment (unless admin - SUPER_ADMIN or SUB_ADMIN)
    if (userRole !== 'SUPER_ADMIN' && userRole !== 'SUB_ADMIN') {
      // Check for direct course purchase
      const directPurchase = await prisma.purchases.findFirst({
        where: {
          user_id: userId,
          course_id: course.id,
          purchase_type: 'COURSE_PURCHASE',
          status: 'completed',
        },
      });

      // If no direct purchase, check for package purchase
      if (!directPurchase && course.package_id) {
        const packagePurchase = await prisma.purchases.findFirst({
          where: {
            user_id: userId,
            package_id: course.package_id,
            purchase_type: 'DIRECT_PACKAGE',
            status: 'completed',
          },
        });

        if (!packagePurchase) {
          return reply.status(403).send({ error: 'You must purchase this course to access modules' });
        }
      } else if (!directPurchase) {
        return reply.status(403).send({ error: 'You must purchase this course to access modules' });
      }
    }

    const modules = await prisma.course_modules.findMany({
      where: { course_id: course.id },
      orderBy: { order_index: 'asc' },
      include: {
        videos: {
          where: { is_published: true },
          orderBy: { order_index: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            video_url: true,
            duration_seconds: true,
            order_index: true,
            is_preview: true,
          },
        },
      },
    });

    return reply.send({ modules });
  });

  /**
   * GET /api/v1/courses/my-courses
   * Get my enrolled courses
   * Returns courses from both:
   * 1. Direct course purchases (COURSE_PURCHASE)
   * 2. Package purchases (DIRECT_PACKAGE) - courses linked via package_id
   */
  app.get('/my-courses', {
    preHandler: requireUser,
    schema: {
      description: 'Get list of courses the user has enrolled in (from direct purchases and package purchases)',
      tags: ['Courses'],
      summary: 'My Enrolled Courses'
    }
  }, async (request, reply) => {
    const userId = BigInt((request as any).user.user_id);

    // 1. Get courses from direct course purchases (existing logic)
    const coursePurchases = await prisma.purchases.findMany({
      where: {
        user_id: userId,
        purchase_type: 'COURSE_PURCHASE',
        status: 'completed',
      },
      orderBy: { purchased_at: 'desc' },
    });

    // Get course IDs from direct purchases
    const courseIds = coursePurchases.map((p: any) => p.course_id).filter((id: any) => id !== null) as string[];
    const coursesFromDirectPurchase = await prisma.courses.findMany({
      where: { id: { in: courseIds } },
      select: {
        id: true,
        slug: true,
        title: true,
        short_description: true,
        thumbnail_url: true,
        total_lessons: true,
        total_duration: true,
        rating: true,
        total_ratings: true,
      },
    });

    // Map direct purchases to courses
    const enrolledFromDirect = coursePurchases.map((purchase: any) => {
      const course = coursesFromDirectPurchase.find((c: any) => c.id === purchase.course_id);
      if (!course) return null;
      
      return {
        ...course,
        purchasedAt: purchase.purchased_at,
        rating: Number(course.rating),
        source: 'direct' as const,
      };
    }).filter((c: any) => c !== null);

    // 2. Get courses from package purchases (new logic)
    const packagePurchases = await prisma.purchases.findMany({
      where: {
        user_id: userId,
        purchase_type: 'DIRECT_PACKAGE',
        status: 'completed',
      },
      select: {
        package_id: true,
        purchased_at: true,
      },
      orderBy: { purchased_at: 'desc' },
    });

    // Extract unique package IDs
    const packageIds = Array.from(new Set(packagePurchases.map((p: any) => p.package_id)));
    
    // Find courses linked to these packages
    // Note: For "My Courses", we show ALL courses linked to packages (even if unpublished)
    // because user has already purchased the package and should have access
    const coursesFromPackages = await prisma.courses.findMany({
      where: {
        package_id: { in: packageIds },
        // Removed is_published filter - users should see courses from their purchased packages
      },
      select: {
        id: true,
        slug: true,
        title: true,
        short_description: true,
        thumbnail_url: true,
        total_lessons: true,
        total_duration: true,
        rating: true,
        total_ratings: true,
        package_id: true,
      },
    });

    // Create a map of package_id -> earliest purchase date
    const packagePurchaseDateMap = new Map<number, Date>();
    for (const purchase of packagePurchases) {
      const existingDate = packagePurchaseDateMap.get(purchase.package_id);
      if (!existingDate || purchase.purchased_at < existingDate) {
        packagePurchaseDateMap.set(purchase.package_id, purchase.purchased_at);
      }
    }

    // Map package purchases to courses
    const enrolledFromPackages = coursesFromPackages.map((course: any) => {
      const purchaseDate = course.package_id ? packagePurchaseDateMap.get(course.package_id) : null;
      if (!purchaseDate) return null;
      
      return {
        id: course.id,
        slug: course.slug,
        title: course.title,
        short_description: course.short_description,
        thumbnail_url: course.thumbnail_url,
        total_lessons: course.total_lessons,
        total_duration: course.total_duration,
        rating: Number(course.rating),
        total_ratings: course.total_ratings,
        purchasedAt: purchaseDate,
        source: 'package' as const,
      };
    }).filter((c: any) => c !== null);

    // 3. Combine both lists and deduplicate by course.id
    type EnrolledCourse = {
      id: string;
      slug: string;
      title: string;
      short_description: string | null;
      thumbnail_url: string | null;
      total_lessons: number;
      total_duration: number;
      rating: number;
      total_ratings: number;
      purchasedAt: Date;
      source: 'direct' | 'package';
    };
    
    const allCourses: EnrolledCourse[] = [...enrolledFromDirect, ...enrolledFromPackages].filter((c): c is EnrolledCourse => c !== null);
    const courseMap = new Map<string, EnrolledCourse>();
    
    for (const course of allCourses) {
      const existing = courseMap.get(course.id);
      if (!existing) {
        courseMap.set(course.id, course);
      } else {
        // If duplicate, keep the one with earlier purchase date
        if (course.purchasedAt < existing.purchasedAt) {
          courseMap.set(course.id, course);
        }
      }
    }

    // Convert map to array and sort by purchase date (newest first)
    const enrolledCourses = Array.from(courseMap.values()).sort(
      (a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime()
    );

    return reply.send({ courses: enrolledCourses });
  });
}



