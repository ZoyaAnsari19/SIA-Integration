import { FastifyInstance } from 'fastify';
import { prisma } from '../config/prisma';
import { requireUser } from '../middleware/jwt';
import { getBunnyStreamEmbedUrl } from '../modules/bunny-stream/bunny-stream.service';

export async function courseVideosRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/videos/:id
   * Get video details (requires enrollment or preview)
   */
  app.get('/:id', {
    preHandler: requireUser,
    schema: {
      description: 'Get video details with embed URL',
      tags: ['Videos'],
      summary: 'Get Video',
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
    const userId = BigInt((request as any).user.user_id);
    const userRole = (request as any).user.role || 'STUDENT';

    const video = await prisma.course_videos.findUnique({
      where: { id },
      include: {
        module: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!video) {
      return reply.status(404).send({ error: 'Video not found' });
    }

    // Check enrollment if video is not a preview and user is not admin (SUPER_ADMIN or SUB_ADMIN)
    if (!video.is_preview && userRole !== 'SUPER_ADMIN' && userRole !== 'SUB_ADMIN') {
      // Check for direct course purchase
      const directPurchase = await prisma.purchases.findFirst({
        where: {
          user_id: userId,
          course_id: video.module.course.id,
          purchase_type: 'COURSE_PURCHASE',
          status: 'completed',
        },
      });

      // If no direct purchase, check for package purchase
      if (!directPurchase) {
        // Get course to check package_id
        const course = await prisma.courses.findUnique({
          where: { id: video.module.course.id },
          select: { package_id: true },
        });

        if (course?.package_id) {
          const packagePurchase = await prisma.purchases.findFirst({
            where: {
              user_id: userId,
              package_id: course.package_id,
              purchase_type: 'DIRECT_PACKAGE',
              status: 'completed',
            },
          });

          if (!packagePurchase) {
            return reply
              .status(403)
              .send({ error: 'You must purchase this course to access this video' });
          }
        } else {
          return reply
            .status(403)
            .send({ error: 'You must purchase this course to access this video' });
        }
      }
    }

    // Generate Bunny Stream signed embed URL
    let embedUrl = video.video_url;
    
    // Only generate embed URL if videoUrl exists and is not already a full URL
    if (video.video_url && typeof video.video_url === 'string' && !video.video_url.startsWith('http')) {
      try {
        embedUrl = getBunnyStreamEmbedUrl(video.video_url, {
          autoplay: false,
          muted: false,
          controls: true,
          responsive: true,
          token: true, // Enable token authentication
          expiresIn: 3600, // 1 hour expiry
        });
        console.log(`✅ Generated Bunny Stream embed URL for video ${video.id}`);
      } catch (error: any) {
        console.error(`❌ Error generating Bunny Stream URL for video ${video.id}:`, error.message);
        // Keep original videoUrl as fallback
        embedUrl = video.video_url;
      }
    }

    return reply.send({
      video: {
        ...video,
        video_url: embedUrl, // Signed embed URL
        embedUrl: embedUrl, // Explicit embed URL field
      },
    });
  });
}



