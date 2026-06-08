/**
 * Course Thumbnail Mapping
 * Maps course titles/slugs to their thumbnail image paths
 * This ensures thumbnails are always displayed even if API doesn't return them
 */

const courseThumbnailMap = {
  // By slug (preferred)
  'english-speaking': '/images/coursesthubnails/ENGLISH SPEAKING MASTERY PROGRAM.png',
  'digital-marketing': '/images/coursesthubnails/digitak marketing.png',
  'share-market-learning': '/images/coursesthubnails/SHARE MARKET LEARNING TRADE LIKE A PRO.png',
  'graphic-designing-video-editing': '/images/coursesthubnails/Graphics desing.png',
  'graphics-design': '/images/coursesthubnails/Graphics desing.png',
  'personality-development-financial-planning': '/images/coursesthubnails/PERSONALITY DEVELOPMENT.png',
  'personality-development': '/images/coursesthubnails/PERSONALITY DEVELOPMENT.png',
  'artificial-intelligence': '/images/coursesthubnails/ARTIFICIAL INTELLIGENCE.png',
  'cyber-security': '/images/coursesthubnails/CYBER SECURITY.png',
  
  // By title (fallback)
  'English Speaking': '/images/coursesthubnails/ENGLISH SPEAKING MASTERY PROGRAM.png',
  'English Speaking Mastery Program': '/images/coursesthubnails/ENGLISH SPEAKING MASTERY PROGRAM.png',
  'Digital Marketing': '/images/coursesthubnails/digitak marketing.png',
  'Share Market Learning': '/images/coursesthubnails/SHARE MARKET LEARNING TRADE LIKE A PRO.png',
  'Share Market Learning Trade Like A Pro': '/images/coursesthubnails/SHARE MARKET LEARNING TRADE LIKE A PRO.png',
  'Graphic Designing & Video Editing': '/images/coursesthubnails/Graphics desing.png',
  'Graphics Design': '/images/coursesthubnails/Graphics desing.png',
  'Personality Development': '/images/coursesthubnails/PERSONALITY DEVELOPMENT.png',
  'Personality Development + Financial Planning': '/images/coursesthubnails/PERSONALITY DEVELOPMENT.png',
  'Artificial Intelligence': '/images/coursesthubnails/ARTIFICIAL INTELLIGENCE.png',
  'Cyber Security': '/images/coursesthubnails/CYBER SECURITY.png',
};

/**
 * Get thumbnail path for a course
 * @param {Object} course - Course object with slug, title, thumbnail_url, thumbnailUrl, or thumbnail
 * @returns {string|null} Thumbnail path or null if not found
 */
export function getCourseThumbnail(course) {
  // Priority 1: Use thumbnail_url from API (admin uploaded)
  if (course?.thumbnail_url) {
    return course.thumbnail_url;
  }
  // Priority 2: Use thumbnailUrl (alternative field name)
  if (course?.thumbnailUrl) {
    return course.thumbnailUrl;
  }
  // Priority 3: Use thumbnail (alternative field name)
  if (course?.thumbnail) {
    return course.thumbnail;
  }
  
  // Try to find by slug
  if (course?.slug && courseThumbnailMap[course.slug]) {
    return courseThumbnailMap[course.slug];
  }
  
  // Try to find by title (case-insensitive)
  if (course?.title) {
    const titleKey = Object.keys(courseThumbnailMap).find(
      key => key.toLowerCase() === course.title.toLowerCase()
    );
    if (titleKey) {
      return courseThumbnailMap[titleKey];
    }
    
    // Partial match for titles containing keywords
    const titleLower = course.title.toLowerCase();
    if (titleLower.includes('english') && titleLower.includes('speaking')) {
      return courseThumbnailMap['english-speaking'];
    }
    if (titleLower.includes('digital') && titleLower.includes('marketing')) {
      return courseThumbnailMap['digital-marketing'];
    }
    if (titleLower.includes('share') && titleLower.includes('market')) {
      return courseThumbnailMap['share-market-learning'];
    }
    if ((titleLower.includes('graphic') || titleLower.includes('graphics')) && titleLower.includes('design')) {
      return courseThumbnailMap['graphics-design'];
    }
    if (titleLower.includes('personality') && titleLower.includes('development')) {
      return courseThumbnailMap['personality-development'];
    }
    if (titleLower.includes('artificial') && titleLower.includes('intelligence')) {
      return courseThumbnailMap['artificial-intelligence'];
    }
    if (titleLower.includes('cyber') && titleLower.includes('security')) {
      return courseThumbnailMap['cyber-security'];
    }
  }
  
  return null;
}

export default courseThumbnailMap;

