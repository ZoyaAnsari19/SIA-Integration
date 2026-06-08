#!/usr/bin/env tsx

/**
 * Seed script to add sample banners via API
 * Run with: npx tsx scripts/seed-banners.ts
 */

import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3002';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'bilal@sia.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nashik2nagpur';

const sampleBanners = [
  {
    title: 'Welcome Offer',
    image_url: 'https://picsum.photos/seed/webinar/1400/180',
    link: 'https://example.com/offer',
    display_order: 0,
    is_active: true,
  },
  {
    title: 'Special Promotion',
    image_url: 'https://picsum.photos/seed/booking/1400/180',
    link: 'https://example.com/promotion',
    display_order: 1,
    is_active: true,
  },
  {
    title: 'New Course Available',
    image_url: 'https://picsum.photos/seed/youtube/1400/180',
    link: null,
    display_order: 2,
    is_active: true,
  },
  {
    title: 'Limited Time Offer',
    image_url: 'https://picsum.photos/seed/offer/1400/180',
    link: 'https://example.com/limited-offer',
    display_order: 3,
    is_active: true,
  },
  {
    title: 'Webinar Announcement',
    image_url: 'https://picsum.photos/seed/webinar2/1400/180',
    link: null,
    display_order: 4,
    is_active: true,
  },
];

async function adminLogin(): Promise<string> {
  console.log('🔐 Logging in as admin...');
  try {
    const response = await axios.post(`${API_URL}/api/v1/auth/admin/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    
    if (!response.data.token) {
      throw new Error('Admin login failed: No token received');
    }
    
    console.log('✅ Admin logged in successfully');
    return response.data.token;
  } catch (error: any) {
    console.error('❌ Admin login failed:', error.response?.data || error.message);
    throw error;
  }
}

async function createBanner(adminToken: string, banner: typeof sampleBanners[0]): Promise<void> {
  try {
    const response = await axios.post(
      `${API_URL}/api/v1/admin/website/slider`,
      banner,
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (response.status === 201) {
      console.log(`✅ Created banner: ${banner.title}`);
    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }
  } catch (error: any) {
    if (error.response?.status === 409 || error.response?.data?.error === 'duplicate') {
      console.log(`⚠️  Banner "${banner.title}" already exists, skipping...`);
    } else {
      console.error(`❌ Error creating banner "${banner.title}":`, error.response?.data || error.message);
      throw error;
    }
  }
}

async function seedBanners() {
  try {
    console.log('🌱 Seeding banners via API...');
    console.log(`📡 API URL: ${API_URL}\n`);

    // Login as admin
    const adminToken = await adminLogin();
    console.log('');

    // Check existing banners
    try {
      const existingResponse = await axios.get(
        `${API_URL}/api/v1/admin/website/slider?is_active=true`,
        {
          headers: {
            'Authorization': `Bearer ${adminToken}`,
          },
        }
      );
      
      const existingCount = existingResponse.data.items?.length || 0;
      if (existingCount > 0) {
        console.log(`⚠️  ${existingCount} active banner(s) already exist.`);
        console.log('💡 Creating additional banners...\n');
      }
    } catch (error) {
      // Ignore check errors, continue with creation
      console.log('⚠️  Could not check existing banners, continuing...\n');
    }

    // Create banners via API
    for (const banner of sampleBanners) {
      await createBanner(adminToken, banner);
    }

    console.log(`\n✨ Successfully seeded ${sampleBanners.length} banners via API!`);
  } catch (error) {
    console.error('❌ Error seeding banners:', error);
    throw error;
  }
}

// Run the seed function
seedBanners()
  .then(() => {
    console.log('🎉 Seed completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seed failed:', error);
    process.exit(1);
  });

