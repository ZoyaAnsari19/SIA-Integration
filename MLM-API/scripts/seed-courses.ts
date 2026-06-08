import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🎬 Seeding courses, modules, and videos...');

  try {
    // ============================================
    // COURSE 1: Share Market Learning
    // ============================================
    console.log('\n📚 Creating Share Market Learning course...');
    
    let shareMarketCourse = await prisma.courses.findFirst({
      where: { slug: 'share-market-learning' },
    });

    if (!shareMarketCourse) {
      shareMarketCourse = await prisma.courses.create({
        data: {
          slug: 'share-market-learning',
          title: 'Share Market Learning',
          short_description: "Secure Infinite Association's expert-level programme on equity, derivatives and market psychology with live case studies.",
          long_description: `Complete Share Market Mastery Course
          
This comprehensive course covers:
- Stock Market Fundamentals
- Technical Analysis
- Fundamental Analysis
- Options & Derivatives Trading
- Risk Management
- Portfolio Building
- Live Trading Sessions
- Market Psychology

Perfect for beginners to advanced traders looking to master the stock market.`,
          price: 50000,
          original_price: 75000,
          language: 'HINDI',
          level: 'EXPERT',
          category: 'Investment',
          package_id: 1, // Link to package ID 1
          total_lessons: 6,
          total_duration: 18000, // 5 hours
          is_published: true,
        },
      });
      console.log(`✅ Created course: ${shareMarketCourse.title}`);
    } else {
      console.log(`⏭️  Course already exists: ${shareMarketCourse.title}`);
    }

    // Create module for Share Market course
    let shareMarketModule = await prisma.course_modules.findFirst({
      where: { course_id: shareMarketCourse.id },
    });

    if (!shareMarketModule) {
      shareMarketModule = await prisma.course_modules.create({
        data: {
          course_id: shareMarketCourse.id,
          title: 'Introduction to Share Market',
          description: 'Basic concepts and fundamentals of stock market trading',
          order_index: 1,
        },
      });
      console.log(`✅ Created module: ${shareMarketModule.title}`);
    }

    // Create videos for Share Market module
    const shareMarketVideos = [
      { title: 'What is Stock Market?', duration: 1800, isPreview: true },
      { title: 'Understanding Stock Exchanges', duration: 2400, isPreview: false },
      { title: 'Types of Stocks & Securities', duration: 3000, isPreview: false },
      { title: 'How to Open Demat Account', duration: 1500, isPreview: false },
      { title: 'Reading Stock Charts', duration: 3600, isPreview: false },
      { title: 'Your First Trade', duration: 2700, isPreview: false },
    ];

    for (let i = 0; i < shareMarketVideos.length; i++) {
      const videoData = shareMarketVideos[i];
      const existingVideo = await prisma.course_videos.findFirst({
        where: {
          module_id: shareMarketModule.id,
          title: videoData.title,
        },
      });

      if (!existingVideo) {
        await prisma.course_videos.create({
          data: {
            module_id: shareMarketModule.id,
            title: videoData.title,
            description: `Learn about ${videoData.title.toLowerCase()}`,
            video_url: `sample-video-${i + 1}`, // Placeholder - replace with actual Bunny video IDs
            video_provider: 'BUNNY',
            duration_seconds: videoData.duration,
            order_index: i + 1,
            is_preview: videoData.isPreview,
            is_published: true,
          },
        });
        console.log(`  ✅ Created video: ${videoData.title}`);
      }
    }

    // ============================================
    // COURSE 2: Digital Marketing Mastery
    // ============================================
    console.log('\n📚 Creating Digital Marketing course...');

    let digitalMarketingCourse = await prisma.courses.findFirst({
      where: { slug: 'digital-marketing' },
    });

    if (!digitalMarketingCourse) {
      digitalMarketingCourse = await prisma.courses.create({
        data: {
          slug: 'digital-marketing',
          title: 'Digital Marketing Mastery',
          short_description: 'Complete digital marketing course covering SEO, Social Media, Content Marketing, and Paid Advertising.',
          long_description: `Master Digital Marketing from Zero to Hero

This course includes:
- Search Engine Optimization (SEO)
- Social Media Marketing (Facebook, Instagram, LinkedIn)
- Content Marketing Strategy
- Google Ads & Facebook Ads
- Email Marketing
- Analytics & Reporting
- Influencer Marketing
- Affiliate Marketing

Start your digital marketing career today!`,
          price: 25000,
          original_price: 40000,
          language: 'BILINGUAL',
          level: 'BEGINNER',
          category: 'Marketing',
          package_id: 2, // Link to package ID 2
          total_lessons: 9,
          total_duration: 27000, // 7.5 hours
          is_published: true,
        },
      });
      console.log(`✅ Created course: ${digitalMarketingCourse.title}`);
    } else {
      console.log(`⏭️  Course already exists: ${digitalMarketingCourse.title}`);
    }

    // Create modules for Digital Marketing course
    const dmModules = [
      { title: 'Introduction to Digital Marketing', description: 'Learn the basics of digital marketing', order: 1 },
      { title: 'Social Media Marketing', description: 'Master social media strategies', order: 2 },
      { title: 'Content Marketing', description: 'Create engaging content that converts', order: 3 },
    ];

    for (const moduleData of dmModules) {
      let module = await prisma.course_modules.findFirst({
        where: {
          course_id: digitalMarketingCourse.id,
          title: moduleData.title,
        },
      });

      if (!module) {
        module = await prisma.course_modules.create({
          data: {
            course_id: digitalMarketingCourse.id,
            title: moduleData.title,
            description: moduleData.description,
            order_index: moduleData.order,
          },
        });
        console.log(`✅ Created module: ${module.title}`);
      }

      // Add videos to each module
      const videosForModule = [
        { title: `${moduleData.title} - Overview`, duration: 1800, isPreview: moduleData.order === 1 },
        { title: `${moduleData.title} - Best Practices`, duration: 2400, isPreview: false },
        { title: `${moduleData.title} - Case Studies`, duration: 3000, isPreview: false },
      ];

      for (let i = 0; i < videosForModule.length; i++) {
        const videoData = videosForModule[i];
        const existingVideo = await prisma.course_videos.findFirst({
          where: {
            module_id: module.id,
            title: videoData.title,
          },
        });

        if (!existingVideo) {
          await prisma.course_videos.create({
            data: {
              module_id: module.id,
              title: videoData.title,
              description: `Learn about ${videoData.title.toLowerCase()}`,
              video_url: `dm-video-${moduleData.order}-${i + 1}`,
              video_provider: 'BUNNY',
              duration_seconds: videoData.duration,
              order_index: i + 1,
              is_preview: videoData.isPreview,
              is_published: true,
            },
          });
          console.log(`  ✅ Created video: ${videoData.title}`);
        }
      }
    }

    // ============================================
    // COURSE 3: Crypto & Blockchain Fundamentals
    // ============================================
    console.log('\n📚 Creating Crypto & Blockchain course...');

    let cryptoCourse = await prisma.courses.findFirst({
      where: { slug: 'crypto-blockchain' },
    });

    if (!cryptoCourse) {
      cryptoCourse = await prisma.courses.create({
        data: {
          slug: 'crypto-blockchain',
          title: 'Crypto & Blockchain Fundamentals',
          short_description: 'Understand cryptocurrency, blockchain technology, and how to invest wisely in digital assets.',
          long_description: `Complete Cryptocurrency & Blockchain Course

Topics covered:
- What is Blockchain Technology?
- Understanding Bitcoin & Ethereum
- Altcoins & Tokens
- Crypto Wallets & Security
- Trading Strategies
- DeFi (Decentralized Finance)
- NFTs Explained
- Future of Crypto

Start your crypto journey with confidence!`,
          price: 35000,
          original_price: 50000,
          language: 'HINDI',
          level: 'INTERMEDIATE',
          category: 'Cryptocurrency',
          package_id: 3, // Link to package ID 3
          total_lessons: 8,
          total_duration: 24000, // 6.67 hours
          is_published: true,
        },
      });
      console.log(`✅ Created course: ${cryptoCourse.title}`);
    } else {
      console.log(`⏭️  Course already exists: ${cryptoCourse.title}`);
    }

    // Create module for Crypto course
    let cryptoModule = await prisma.course_modules.findFirst({
      where: { course_id: cryptoCourse.id },
    });

    if (!cryptoModule) {
      cryptoModule = await prisma.course_modules.create({
        data: {
          course_id: cryptoCourse.id,
          title: 'Blockchain & Crypto Basics',
          description: 'Understanding the fundamentals of blockchain and cryptocurrency',
          order_index: 1,
        },
      });
      console.log(`✅ Created module: ${cryptoModule.title}`);
    }

    const cryptoVideos = [
      { title: 'What is Blockchain?', duration: 2400, isPreview: true },
      { title: 'Bitcoin Explained', duration: 3000, isPreview: false },
      { title: 'Ethereum & Smart Contracts', duration: 3600, isPreview: false },
      { title: 'Setting Up Your First Wallet', duration: 1800, isPreview: false },
      { title: 'Buying Your First Crypto', duration: 2400, isPreview: false },
      { title: 'Crypto Trading Basics', duration: 3000, isPreview: false },
      { title: 'Security Best Practices', duration: 2100, isPreview: false },
      { title: 'DeFi & Future Trends', duration: 2700, isPreview: false },
    ];

    for (let i = 0; i < cryptoVideos.length; i++) {
      const videoData = cryptoVideos[i];
      const existingVideo = await prisma.course_videos.findFirst({
        where: {
          module_id: cryptoModule.id,
          title: videoData.title,
        },
      });

      if (!existingVideo) {
        await prisma.course_videos.create({
          data: {
            module_id: cryptoModule.id,
            title: videoData.title,
            description: `Learn about ${videoData.title.toLowerCase()}`,
            video_url: `crypto-video-${i + 1}`,
            video_provider: 'BUNNY',
            duration_seconds: videoData.duration,
            order_index: i + 1,
            is_preview: videoData.isPreview,
            is_published: true,
          },
        });
        console.log(`  ✅ Created video: ${videoData.title}`);
      }
    }

    // ============================================
    // Summary
    // ============================================
    const totalCourses = await prisma.courses.count({ where: { is_published: true } });
    const totalModules = await prisma.course_modules.count();
    const totalVideos = await prisma.course_videos.count({ where: { is_published: true } });

    console.log('\n✅ Seeding completed!');
    console.log('📊 Summary:');
    console.log(`   - Total Courses: ${totalCourses}`);
    console.log(`   - Total Modules: ${totalModules}`);
    console.log(`   - Total Videos: ${totalVideos}`);
    console.log('\n📋 Courses created:');
    console.log('   1. Share Market Learning (₹50,000) → Package ID 1');
    console.log('   2. Digital Marketing Mastery (₹25,000) → Package ID 2');
    console.log('   3. Crypto & Blockchain Fundamentals (₹35,000) → Package ID 3');

  } catch (error) {
    console.error('❌ Error seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

