import { fetchBunnyStreamVideos } from '../src/modules/bunny-stream/bunny-stream.service.js';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('🎬 Fetching videos from Bunny Stream...\n');

  try {
    const videos = await fetchBunnyStreamVideos(1, 50);
    
    if (!videos || videos.length === 0) {
      console.log('⚠️  No videos found in Bunny Stream');
      return;
    }

    console.log(`✅ Found ${videos.length} videos in Bunny Stream\n`);
    console.log('📹 Video List:\n');
    
    videos.slice(0, 20).forEach((video, index) => {
      const videoId = video.guid || video.videoId || String(video.id);
      const title = video.title || `Video ${index + 1}`;
      const duration = video.length || 0;
      const durationMin = Math.floor(duration / 60);
      
      console.log(`${index + 1}. ${title}`);
      console.log(`   ID: ${videoId}`);
      console.log(`   Duration: ${durationMin} min (${duration} sec)`);
      console.log('');
    });

    console.log('\n📋 First 10 Video IDs (for seeding):');
    const videoIds = videos.slice(0, 10).map(v => v.guid || v.videoId || String(v.id));
    console.log(JSON.stringify(videoIds, null, 2));

  } catch (error: any) {
    console.error('❌ Error fetching videos:', error.message);
    if (error.message.includes('BUNNY_STREAM_API_KEY')) {
      console.error('\n💡 Make sure BUNNY_STREAM_API_KEY is set in .env');
    }
    if (error.message.includes('BUNNY_STREAM_LIBRARY_ID')) {
      console.error('\n💡 Make sure BUNNY_STREAM_LIBRARY_ID is set in .env');
    }
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });

