import crypto from 'crypto';

interface BunnyStreamOptions {
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  responsive?: boolean;
  token?: boolean;
  expiresIn?: number;
}

/**
 * Generate Bunny Stream embed URL with optional token authentication
 * @param videoId - Bunny Stream video ID
 * @param options - Optional parameters
 * @returns Embed URL
 */
export function getBunnyStreamEmbedUrl(videoId: string, options: BunnyStreamOptions = {}): string {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  
  if (!libraryId) {
    throw new Error('BUNNY_STREAM_LIBRARY_ID not configured');
  }
  
  if (!videoId) {
    throw new Error('Video ID is required');
  }

  // Base embed URL
  let embedUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`;
  
  // Optional parameters
  const params = new URLSearchParams();
  
  if (options.autoplay) params.append('autoplay', 'true');
  if (options.muted) params.append('muted', 'true');
  if (options.loop) params.append('loop', 'true');
  if (options.controls !== undefined) params.append('controls', options.controls ? 'true' : 'false');
  if (options.responsive) params.append('responsive', 'true');
  
  // Token authentication (if enabled)
  if (options.token !== false) {
    const token = generateBunnyStreamToken(videoId, options.expiresIn || 3600);
    if (token) {
      params.append('token', token);
    }
  }
  
  const queryString = params.toString();
  return queryString ? `${embedUrl}?${queryString}` : embedUrl;
}

/**
 * Generate Bunny Stream token for signed URLs
 * @param videoId - Video ID
 * @param expiresIn - Expiry in seconds (default: 1 hour)
 * @returns Token string or null if not configured
 */
function generateBunnyStreamToken(videoId: string, expiresIn: number = 3600): string | null {
  const tokenKey = process.env.BUNNY_STREAM_TOKEN_KEY;
  if (!tokenKey) {
    // If token key not set, return null (no token)
    return null;
  }
  
  const expires = Math.floor(Date.now() / 1000) + expiresIn;
  
  // Bunny Stream token format: hash(videoId + expires + tokenKey).expires
  const hash = crypto
    .createHash('sha256')
    .update(`${videoId}${expires}${tokenKey}`)
    .digest('hex');
  
  return `${hash}.${expires}`;
}

/**
 * Fetch videos from Bunny Stream API
 * @param page - Page number (default: 1)
 * @param itemsPerPage - Items per page (default: 100)
 * @returns Array of videos
 */
export async function fetchBunnyStreamVideos(page: number = 1, itemsPerPage: number = 100): Promise<any[]> {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  const apiKey = process.env.BUNNY_STREAM_API_KEY;
  
  if (!libraryId) {
    throw new Error('BUNNY_STREAM_LIBRARY_ID not configured');
  }
  
  if (!apiKey) {
    throw new Error('BUNNY_STREAM_API_KEY not configured');
  }

  const url = `https://video.bunnycdn.com/library/${libraryId}/videos?page=${page}&itemsPerPage=${itemsPerPage}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'AccessKey': apiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Bunny Stream API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('Error fetching Bunny Stream videos:', error);
    throw error;
  }
}



