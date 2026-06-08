import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { adminAuth } from '../middleware/adminAuth';
import { checkPermission } from '../middleware/checkPermission.js';
import { bunnyCDNService } from '../modules/bunny-cdn/bunny-cdn.service.js';

// Allowed video MIME types for video uploads
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
// Increased limit for admin video uploads - can handle large course videos
const MAX_VIDEO_SIZE_MB = 5000; // 5GB limit for admin uploads

// Allowed image MIME types for thumbnail uploads
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const MAX_THUMBNAIL_SIZE_MB = 5;

// Validation Schemas
const videoSchema = z.object({
  title: z.string().min(1, 'Video title is required'),
  description: z.string().optional(),
  video_url: z.string().min(1, 'Video URL is required'),
  video_provider: z.string().default('BUNNY').optional(),
  duration_seconds: z.number().int().min(0).default(0),
  order_index: z.number().int().min(1),
  is_preview: z.boolean().default(false).optional(),
  is_published: z.boolean().default(true).optional(),
});

const moduleSchema = z.object({
  title: z.string().min(1, 'Module title is required'),
  description: z.string().optional(),
  order_index: z.number().int().min(1),
  videos: z.array(videoSchema).optional().default([]),
});

const createCourseSchema = z.object({
  title: z.string().min(1, 'Course title is required'),
  slug: z.string().min(1, 'Course slug is required').regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens').optional(),
  short_description: z.string().optional(),
  long_description: z.string().optional(),
  price: z.number().min(0, 'Price must be non-negative'),
  original_price: z.number().min(0).optional(),
  package_id: z.number().int().positive('Package ID is required'), // CRITICAL: Link to MLM package
  language: z.enum(['HINDI', 'ENGLISH', 'BILINGUAL']),
  level: z.enum(['BASIC', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT', 'PROFESSIONAL']),
  category: z.string().min(1, 'Category is required'),
  thumbnail_url: z.string().url().optional(),
  is_published: z.boolean().default(false),
  modules: z.array(moduleSchema).optional().default([]),
});

const updateCourseSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  short_description: z.string().optional(),
  long_description: z.string().optional(),
  price: z.number().min(0).optional(),
  original_price: z.number().min(0).optional().nullable(),
  package_id: z.number().int().positive().optional(), // Can update package mapping
  language: z.enum(['HINDI', 'ENGLISH', 'BILINGUAL']).optional(),
  level: z.enum(['BASIC', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT', 'PROFESSIONAL']).optional(),
  category: z.string().min(1).optional(),
  thumbnail_url: z.string().url().optional().nullable(),
  is_published: z.boolean().optional(),
});

// Helper function to generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Helper function to calculate course stats from modules/videos
function calculateCourseStats(modules: any[]): { totalLessons: number; totalDuration: number } {
  let totalLessons = 0;
  let totalDuration = 0;

  if (modules && Array.isArray(modules)) {
    modules.forEach((module) => {
      if (module.videos && Array.isArray(module.videos)) {
        module.videos.forEach((video: any) => {
          if (video.is_published !== false) {
            totalLessons++;
            totalDuration += video.duration_seconds || 0;
          }
        });
      }
    });
  }

  return { totalLessons, totalDuration };
}

export async function adminCoursesRoutes(app: FastifyInstance) {
  // CRITICAL: Register video routes FIRST before any /:id routes
  // Fastify matches routes in registration order, so specific routes must come first
  
  /**
   * POST /api/v1/admin/courses/thumbnail/upload
   * Upload course thumbnail image to Bunny CDN
   */
  app.post('/thumbnail/upload', {
    preHandler: [adminAuth, checkPermission('COURSE_MANAGE')],
    schema: {
      description: 'Upload course thumbnail image to Bunny CDN',
      tags: ['Admin - Courses'],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            thumbnail_url: { type: 'string', description: 'CDN URL of uploaded thumbnail' },
            uploaded_at: { type: 'string', format: 'date-time' },
          },
        },
        400: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      // Get uploaded file from multipart/form-data
      const data = await request.file();

      if (!data) {
        return reply.code(400).send({ message: 'No file uploaded' });
      }

      // Validate file type
      if (!bunnyCDNService.isValidFileType(data.mimetype, ALLOWED_IMAGE_TYPES)) {
        return reply.code(400).send({
          message: 'Invalid file type. Allowed: JPG, PNG, GIF, WebP',
        });
      }

      // Read file buffer
      const fileBuffer = await data.toBuffer();

      // Validate file size
      if (!bunnyCDNService.isValidFileSize(fileBuffer.length, MAX_THUMBNAIL_SIZE_MB)) {
        return reply.code(400).send({
          message: `File too large. Maximum size: ${MAX_THUMBNAIL_SIZE_MB}MB`,
        });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const extension = data.filename.split('.').pop() || 'jpg';
      const filename = `course_thumbnail_${timestamp}.${extension}`;

      // Upload to Bunny CDN in course_thumbnails folder
      const cdnUrl = await bunnyCDNService.uploadFile(
        fileBuffer,
        filename,
        'course_thumbnails'
      );

      return reply.send({
        thumbnail_url: cdnUrl,
        uploaded_at: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Course thumbnail upload error:', error);
      return reply.code(500).send({
        message: error.message || 'Failed to upload thumbnail',
      });
    }
  });

  /**
   * DELETE /api/v1/admin/courses/videos/:videoId
   * Delete video by ID only (no schema to avoid Fastify validation 400)
   */
  app.delete('/videos/:videoId', {
    preHandler: [adminAuth, checkPermission('COURSE_MANAGE')],
    handler: async (request, reply) => {
      const { videoId } = request.params as { videoId: string };
      if (!videoId || typeof videoId !== 'string') {
        return reply.status(400).send({ error: 'Invalid video ID' });
      }
      try {
        const video = await prisma.course_videos.findUnique({
          where: { id: videoId },
        });
        if (!video) {
          return reply.status(404).send({ error: 'Video not found' });
        }
        await prisma.course_videos.delete({
          where: { id: video.id },
        });
        return reply.send({ message: 'Video deleted successfully' });
      } catch (error: any) {
        console.error('Delete video error:', error);
        if (error.code === 'P2025') {
          return reply.status(404).send({ error: 'Video not found' });
        }
        return reply.status(500).send({ error: 'Failed to delete video', message: error.message });
      }
    },
  });
  
  /**
   * DELETE /api/v1/admin/courses/:courseId/modules/:moduleId/videos/:videoId
   * Delete video (legacy route - kept for compatibility)
   */
  app.delete('/:courseId/modules/:moduleId/videos/:videoId', {
    preHandler: [adminAuth, checkPermission('COURSE_MANAGE')],
    schema: {
      description: 'Delete video',
      tags: ['Admin - Courses'],
      summary: 'Delete Video',
      params: {
        type: 'object',
        properties: {
          courseId: { type: 'string' },
          moduleId: { type: 'string' },
          videoId: { type: 'string' }
        },
        required: ['courseId', 'moduleId', 'videoId']
      }
    }
  }, async (request, reply) => {
    const { courseId, moduleId, videoId } = request.params as { courseId: string; moduleId: string; videoId: string };

    const video = await prisma.course_videos.findFirst({
      where: {
        id: videoId,
        module_id: moduleId,
        module: {
          course_id: courseId,
        },
      },
    });

    if (!video) {
      return reply.status(404).send({ error: 'Video not found' });
    }

    await prisma.course_videos.delete({
      where: { id: video.id },
    });

    return reply.send({
      message: 'Video deleted successfully',
    });
  });

  /**
   * PUT /api/v1/admin/courses/:courseId/modules/:moduleId/videos/:videoId
   * Update video
   */
  app.put('/:courseId/modules/:moduleId/videos/:videoId', {
    preHandler: [adminAuth, checkPermission('COURSE_MANAGE')],
    schema: {
      description: 'Update video',
      tags: ['Admin - Courses'],
      summary: 'Update Video',
      params: {
        type: 'object',
        properties: {
          courseId: { type: 'string' },
          moduleId: { type: 'string' },
          videoId: { type: 'string' }
        },
        required: ['courseId', 'moduleId', 'videoId']
      }
    }
  }, async (request, reply) => {
    const { courseId, moduleId, videoId } = request.params as { courseId: string; moduleId: string; videoId: string };
    
    try {
      const validatedData = videoSchema.partial().parse(request.body);

      // Verify the video belongs to the module and course
      const video = await prisma.course_videos.findFirst({
        where: {
          id: videoId,
          module_id: moduleId,
          module: {
            course_id: courseId,
          },
        },
      });
      
      if (!video) {
        return reply.status(404).send({ error: 'Video not found' });
      }

      // Log what's being updated
      console.log('📹 Updating video with data:', {
        videoId: video.id,
        duration_seconds: validatedData.duration_seconds,
        title: validatedData.title,
      });

      const updated = await prisma.course_videos.update({
        where: { id: video.id },
        data: validatedData,
      });

      console.log('✅ Video updated successfully:', {
        id: updated.id,
        duration_seconds: updated.duration_seconds,
      });

      return reply.send({
        message: 'Video updated successfully',
        video: updated,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }
      throw error;
    }
  });

  /**
   * POST /api/v1/admin/courses
   * Create a new course with package mapping
   */
  app.post('/', {
    preHandler: [adminAuth, checkPermission('COURSE_MANAGE')],
    schema: {
      description: 'Create a new course with MLM package mapping',
      tags: ['Admin - Courses'],
      summary: 'Create Course',
      body: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          slug: { type: 'string' },
          short_description: { type: 'string' },
          long_description: { type: 'string' },
          price: { type: 'number' },
          original_price: { type: 'number' },
          package_id: { type: 'number', description: 'MLM Package ID to link with this course' },
          language: { type: 'string', enum: ['HINDI', 'ENGLISH', 'BILINGUAL'] },
          level: { type: 'string', enum: ['BASIC', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT', 'PROFESSIONAL'] },
          category: { type: 'string' },
          thumbnail_url: { type: 'string' },
          is_published: { type: 'boolean' }
        },
        required: ['title', 'price', 'package_id', 'language', 'level', 'category']
      }
    }
  }, async (request, reply) => {
    try {
      const validatedData = createCourseSchema.parse(request.body);
      let { slug, modules, package_id, ...courseData } = validatedData;

      // Validate package exists
      const pkg = await prisma.packages.findUnique({
        where: { id: package_id }
      });

      if (!pkg) {
        return reply.status(404).send({ error: 'Package not found' });
      }

      // Generate slug if not provided
      if (!slug) {
        slug = generateSlug(courseData.title);
      }

      // Check if slug already exists
      const existingCourse = await prisma.courses.findUnique({
        where: { slug },
      });

      if (existingCourse) {
        return reply.status(409).send({ error: 'Course with this slug already exists' });
      }

      // Calculate course stats
      const { totalLessons, totalDuration } = calculateCourseStats(modules || []);

      // Create course
      const course = await prisma.courses.create({
        data: {
          ...courseData,
          slug,
          package_id, // Link to MLM package
          total_lessons: totalLessons,
          total_duration: totalDuration,
        },
      });

      // Create modules and videos if provided
      if (modules && modules.length > 0) {
        for (const moduleData of modules) {
          const { videos, ...moduleFields } = moduleData;
          const module = await prisma.course_modules.create({
            data: {
              ...moduleFields,
              course_id: course.id,
            },
          });

          // Create videos for this module
          if (videos && videos.length > 0) {
            for (const videoData of videos) {
              await prisma.course_videos.create({
                data: {
                  ...videoData,
                  module_id: module.id,
                },
              });
            }
          }
        }
      }

      // Fetch created course with modules and videos
      const createdCourse = await prisma.courses.findUnique({
        where: { id: course.id },
        include: {
          modules: {
            orderBy: { order_index: 'asc' },
            include: {
              videos: {
                orderBy: { order_index: 'asc' },
              },
            },
          },
        },
      });

      return reply.status(201).send({
        message: 'Course created successfully',
        course: createdCourse,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }
      throw error;
    }
  });

  /**
   * GET /api/v1/admin/courses
   * List all courses (admin view)
   */
  app.get('/', {
    preHandler: [adminAuth, checkPermission('COURSE_VIEW')],
    schema: {
      description: 'List all courses with filters',
      tags: ['Admin - Courses'],
      summary: 'List Courses',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 50 },
          search: { type: 'string' },
          is_published: { type: 'string', enum: ['true', 'false'] }
        }
      }
    }
  }, async (request, reply) => {
    const { page = 1, limit = 50, search, is_published } = request.query as any;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { short_description: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (is_published !== undefined) {
      where.is_published = is_published === 'true';
    }

    const [courses, total] = await Promise.all([
      prisma.courses.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { created_at: 'desc' },
        include: {
          modules: {
            select: {
              id: true,
              title: true,
              videos: {
                select: { id: true }
              }
            },
          },
        },
      }),
      prisma.courses.count({ where }),
    ]);

    // Format with video counts and decimal conversion
    const formattedCourses = courses.map(course => ({
      ...course,
      price: Number(course.price),
      original_price: course.original_price ? Number(course.original_price) : null,
      rating: Number(course.rating),
      module_count: course.modules.length,
      video_count: course.modules.reduce((sum, m) => sum + m.videos.length, 0),
    }));

    return reply.send({
      courses: formattedCourses,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  });

  /**
   * GET /api/v1/admin/courses/:id
   * Get course details (admin view)
   */
  app.get('/:id', {
    preHandler: [adminAuth, checkPermission('COURSE_VIEW')],
    schema: {
      description: 'Get course details',
      tags: ['Admin - Courses'],
      summary: 'Get Course',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const course = await prisma.courses.findUnique({
      where: { id },
      include: {
        modules: {
          orderBy: { order_index: 'asc' },
          include: {
            videos: {
              orderBy: { order_index: 'asc' },
            },
          },
        },
      },
    });

    if (!course) {
      return reply.status(404).send({ error: 'Course not found' });
    }

    // Get purchase count
    const purchaseCount = await prisma.purchases.count({
      where: {
        course_id: id,
        purchase_type: 'COURSE_PURCHASE',
        status: 'completed',
      },
    });

    return reply.send({
      course: {
        ...course,
        price: Number(course.price),
        original_price: course.original_price ? Number(course.original_price) : null,
        rating: Number(course.rating),
        purchase_count: purchaseCount,
      },
    });
  });

  /**
   * PUT /api/v1/admin/courses/:id
   * Update course (can change package mapping)
   */
  app.put('/:id', {
    preHandler: [adminAuth, checkPermission('COURSE_MANAGE')],
    schema: {
      description: 'Update course details (including package mapping)',
      tags: ['Admin - Courses'],
      summary: 'Update Course',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          slug: { type: 'string' },
          short_description: { type: 'string' },
          long_description: { type: 'string' },
          price: { type: 'number' },
          original_price: { type: 'number' },
          package_id: { type: 'number', description: 'Change linked MLM package' },
          language: { type: 'string', enum: ['HINDI', 'ENGLISH', 'BILINGUAL'] },
          level: { type: 'string', enum: ['BASIC', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT', 'PROFESSIONAL'] },
          category: { type: 'string' },
          thumbnail_url: { type: 'string' },
          is_published: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const validatedData = updateCourseSchema.parse(request.body);

      const course = await prisma.courses.findUnique({ where: { id } });
      if (!course) {
        return reply.status(404).send({ error: 'Course not found' });
      }

      // If updating package_id, validate it exists
      if (validatedData.package_id) {
        const pkg = await prisma.packages.findUnique({
          where: { id: validatedData.package_id }
        });
        if (!pkg) {
          return reply.status(404).send({ error: 'Package not found' });
        }
      }

      // If updating slug, check uniqueness
      if (validatedData.slug && validatedData.slug !== course.slug) {
        const existing = await prisma.courses.findUnique({
          where: { slug: validatedData.slug }
        });
        if (existing) {
          return reply.status(409).send({ error: 'Course with this slug already exists' });
        }
      }

      const updated = await prisma.courses.update({
        where: { id },
        data: validatedData,
        include: {
          modules: {
            orderBy: { order_index: 'asc' },
            include: {
              videos: {
                orderBy: { order_index: 'asc' },
              },
            },
          },
        },
      });

      return reply.send({
        message: 'Course updated successfully',
        course: {
          ...updated,
          price: Number(updated.price),
          original_price: updated.original_price ? Number(updated.original_price) : null,
          rating: Number(updated.rating),
        },
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }
      throw error;
    }
  });

  /**
   * DELETE /api/v1/admin/courses/:id
   * Delete course
   */
  app.delete('/:id', {
    preHandler: [adminAuth, checkPermission('COURSE_MANAGE')],
    schema: {
      description: 'Delete course',
      tags: ['Admin - Courses'],
      summary: 'Delete Course',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const course = await prisma.courses.findUnique({ where: { id } });
    if (!course) {
      return reply.status(404).send({ error: 'Course not found' });
    }

    // Check if there are any purchases
    const purchaseCount = await prisma.purchases.count({
      where: {
        course_id: id,
        purchase_type: 'COURSE_PURCHASE',
      },
    });

    if (purchaseCount > 0) {
      return reply.status(400).send({
        error: 'Cannot delete course with existing purchases',
        purchaseCount,
      });
    }

    await prisma.courses.delete({ where: { id } });

    return reply.send({ message: 'Course deleted successfully' });
  });

  /**
   * POST /api/v1/admin/courses/:courseId/modules
   * Create module for a course
   */
  app.post('/:courseId/modules', {
    preHandler: [adminAuth, checkPermission('COURSE_MANAGE')],
    schema: {
      description: 'Create module for a course',
      tags: ['Admin - Courses'],
      summary: 'Create Module',
      params: {
        type: 'object',
        properties: {
          courseId: { type: 'string' }
        },
        required: ['courseId']
      },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          order_index: { type: 'number' }
        },
        required: ['title', 'order_index']
      }
    }
  }, async (request, reply) => {
    const { courseId } = request.params as { courseId: string };
    const { title, description, order_index } = request.body as any;

    const course = await prisma.courses.findUnique({ where: { id: courseId } });
    if (!course) {
      return reply.status(404).send({ error: 'Course not found' });
    }

    const module = await prisma.course_modules.create({
      data: {
        course_id: courseId,
        title,
        description,
        order_index,
      },
    });

    return reply.status(201).send({
      message: 'Module created successfully',
      module,
    });
  });

  /**
   * POST /api/v1/admin/courses/:courseId/modules/:moduleId/videos
   * Create video for a module
   */
  app.post('/:courseId/modules/:moduleId/videos', {
    preHandler: [adminAuth, checkPermission('COURSE_MANAGE')],
    schema: {
      description: 'Create video for a module',
      tags: ['Admin - Courses'],
      summary: 'Create Video',
      params: {
        type: 'object',
        properties: {
          courseId: { type: 'string' },
          moduleId: { type: 'string' }
        },
        required: ['courseId', 'moduleId']
      }
    }
  }, async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    
    try {
      const validatedData = videoSchema.parse(request.body);

      const module = await prisma.course_modules.findUnique({
        where: { id: moduleId }
      });
      if (!module) {
        return reply.status(404).send({ error: 'Module not found' });
      }

      // Ensure duration_seconds is set (default to 0 if not provided)
      const videoData = {
        ...validatedData,
        module_id: moduleId,
        duration_seconds: validatedData.duration_seconds ?? 0,
        video_provider: validatedData.video_provider ?? 'BUNNY',
        is_preview: validatedData.is_preview ?? false,
        is_published: validatedData.is_published ?? true,
      };

      console.log('📹 Creating video with data:', {
        title: videoData.title,
        duration_seconds: videoData.duration_seconds,
        order_index: videoData.order_index,
        module_id: videoData.module_id,
      });

      const video = await prisma.course_videos.create({
        data: videoData,
      });

      console.log('✅ Video created successfully:', {
        id: video.id,
        duration_seconds: video.duration_seconds,
      });

      return reply.status(201).send({
        message: 'Video created successfully',
        video,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }
      throw error;
    }
  });

  /**
   * @openapi
   * /api/v1/admin/courses/:courseId/modules/:moduleId/videos/upload-url:
   *   post:
   *     tags:
   *       - Admin - Courses
   *     summary: Get presigned upload URL for direct browser upload
   *     description: |
   *       Generate a presigned upload URL for direct browser upload to Bunny CDN.
   *       This allows faster uploads by bypassing the server.
   *       Returns upload URL and CDN URL that can be used for direct upload.
   *     operationId: getVideoUploadUrl
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: courseId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: moduleId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - filename
   *               - fileSize
   *               - mimeType
   *             properties:
   *               filename:
   *                 type: string
   *                 description: Original filename
   *               fileSize:
   *                 type: number
   *                 description: File size in bytes
   *               mimeType:
   *                 type: string
   *                 description: MIME type of the file
   *     responses:
   *       '200':
   *         description: Upload URL generated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 uploadUrl:
   *                   type: string
   *                   format: uri
   *                 cdnUrl:
   *                   type: string
   *                   format: uri
   *                 accessKey:
   *                   type: string
   *                   description: Access key for upload (temporary, expires in 1 hour)
   *                 expiresAt:
   *                   type: string
   *                   format: date-time
   *       '400':
   *         description: Validation error
   *       '401':
   *         description: Unauthorized
   *       '404':
   *         description: Course or module not found
   */
  app.post('/:courseId/modules/:moduleId/videos/upload-url', {
    preHandler: [adminAuth, checkPermission('COURSE_MANAGE')],
    schema: {
      description: 'Get presigned upload URL for direct browser upload',
      tags: ['Admin - Courses'],
      summary: 'Get Video Upload URL',
      params: {
        type: 'object',
        properties: {
          courseId: { type: 'string' },
          moduleId: { type: 'string' }
        },
        required: ['courseId', 'moduleId']
      },
      body: {
        type: 'object',
        required: ['filename', 'fileSize', 'mimeType'],
        properties: {
          filename: { type: 'string' },
          fileSize: { type: 'number' },
          mimeType: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            uploadUrl: { type: 'string' },
            cdnUrl: { type: 'string' },
            accessKey: { type: 'string' },
            expiresAt: { type: 'string', format: 'date-time' },
          },
        },
        400: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
      security: [{ adminAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      const { courseId, moduleId } = request.params as { courseId: string; moduleId: string };
      const { filename, fileSize, mimeType } = request.body as { filename: string; fileSize: number; mimeType: string };

      // Verify course exists
      const course = await prisma.courses.findUnique({
        where: { id: courseId }
      });
      if (!course) {
        return reply.code(404).send({ message: 'Course not found' });
      }

      // Verify module exists and belongs to course
      const module = await prisma.course_modules.findFirst({
        where: {
          id: moduleId,
          course_id: courseId
        }
      });
      if (!module) {
        return reply.code(404).send({ message: 'Module not found or does not belong to this course' });
      }

      // Validate file type
      if (!bunnyCDNService.isValidFileType(mimeType, ALLOWED_VIDEO_TYPES)) {
        return reply.code(400).send({
          message: 'Invalid file type. Allowed: MP4, WebM, MOV, AVI',
        });
      }

      // Validate file size
      if (!bunnyCDNService.isValidFileSize(fileSize, MAX_VIDEO_SIZE_MB)) {
        return reply.code(400).send({
          message: `File too large. Maximum size: ${MAX_VIDEO_SIZE_MB}MB`,
        });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const extension = filename.split('.').pop() || 'mp4';
      const uniqueFilename = `course_video_${courseId}_${moduleId}_${timestamp}.${extension}`;

      // Generate presigned upload URL
      const { uploadUrl, cdnUrl, accessKey } = bunnyCDNService.generatePresignedUploadUrl(
        uniqueFilename,
        'course_videos',
        3600 // 1 hour expiration
      );

      const expiresAt = new Date(Date.now() + 3600000).toISOString();

      return reply.send({
        uploadUrl,
        cdnUrl,
        accessKey,
        expiresAt,
      });
    } catch (error) {
      console.error('Upload URL generation error:', error);
      return reply.code(500).send({
        message: 'Failed to generate upload URL',
      });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/courses/:courseId/modules/:moduleId/videos/upload:
   *   post:
   *     tags:
   *       - Admin - Courses
   *     summary: Upload video file
   *     description: |
   *       Upload video file for course module to Bunny CDN.
   *       Returns CDN URL that can be used when creating videos.
   *       NOTE: For faster uploads, use /upload-url endpoint for direct browser upload.
   *     operationId: uploadCourseVideo
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: courseId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: moduleId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required:
   *               - file
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *                 description: Video file (MP4, WebM, MOV, AVI, max 5GB for admin uploads)
   *     responses:
   *       '200':
   *         description: Video file uploaded successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 video_url:
   *                   type: string
   *                   format: uri
   *                   example: "https://mlm-cdn.b-cdn.net/course_videos/course_video_123_456_1234567890.mp4"
   *                 uploaded_at:
   *                   type: string
   *                   format: date-time
   *       '400':
   *         description: Validation error (invalid file type or size)
   *       '401':
   *         description: Unauthorized
   *       '404':
   *         description: Course or module not found
   *       '500':
   *         description: Internal server error
   */
  app.post('/:courseId/modules/:moduleId/videos/upload', {
    preHandler: [adminAuth, checkPermission('COURSE_MANAGE')],
    schema: {
      description: 'Upload video file for course module to Bunny CDN',
      tags: ['Admin - Courses'],
      summary: 'Upload Video File',
      consumes: ['multipart/form-data'],
      params: {
        type: 'object',
        properties: {
          courseId: { type: 'string' },
          moduleId: { type: 'string' }
        },
        required: ['courseId', 'moduleId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            video_url: { type: 'string' },
            uploaded_at: { type: 'string', format: 'date-time' },
          },
        },
        400: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
      security: [{ adminAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      const { courseId, moduleId } = request.params as { courseId: string; moduleId: string };

      // Verify course exists
      const course = await prisma.courses.findUnique({
        where: { id: courseId }
      });
      if (!course) {
        return reply.code(404).send({ message: 'Course not found' });
      }

      // Verify module exists and belongs to course
      const module = await prisma.course_modules.findFirst({
        where: {
          id: moduleId,
          course_id: courseId
        }
      });
      if (!module) {
        return reply.code(404).send({ message: 'Module not found or does not belong to this course' });
      }

      // Get uploaded file from multipart/form-data
      const data = await request.file();

      if (!data) {
        return reply.code(400).send({ message: 'No file uploaded' });
      }

      // Validate file type
      if (!bunnyCDNService.isValidFileType(data.mimetype, ALLOWED_VIDEO_TYPES)) {
        return reply.code(400).send({
          message: 'Invalid file type. Allowed: MP4, WebM, MOV, AVI',
        });
      }

      // Read file buffer
      const fileBuffer = await data.toBuffer();

      // Validate file size
      if (!bunnyCDNService.isValidFileSize(fileBuffer.length, MAX_VIDEO_SIZE_MB)) {
        return reply.code(400).send({
          message: `File too large. Maximum size: ${MAX_VIDEO_SIZE_MB}MB`,
        });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const extension = data.filename.split('.').pop() || 'mp4';
      const filename = `course_video_${courseId}_${moduleId}_${timestamp}.${extension}`;

      // Upload to Bunny CDN with proper Content-Type
      const cdnUrl = await bunnyCDNService.uploadFile(
        fileBuffer,
        filename,
        'course_videos',
        data.mimetype
      );

      return reply.send({
        video_url: cdnUrl,
        uploaded_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Video upload error:', error);
      return reply.code(500).send({
        message: 'Failed to upload video file',
      });
    }
  });
}

