// API utility for Course Management
import { getAuthToken } from './auth';

const getBaseUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  if (envUrl.endsWith('/admin')) {
    return envUrl;
  }
  if (envUrl.endsWith('/api/v1')) {
    return `${envUrl}/admin`;
  }
  return `${envUrl}/admin`;
};

const API_BASE_URL = getBaseUrl();

// Helper function to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = {
        error: 'Unknown error',
        message: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
    
    let errorMessage = errorData.error || errorData.message || 'API request failed';
    
    if (response.status === 401) {
      errorMessage = 'Unauthorized. Please login again.';
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    } else if (response.status === 404) {
      errorMessage = 'Resource not found.';
    } else if (response.status === 500) {
      errorMessage = 'Server error. Please try again later.';
    }
    
    throw new Error(errorMessage);
  }
  return response.json();
}

// Types matching backend response
export interface Course {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  long_description: string | null;
  price: number;
  original_price: number | null;
  package_id: number;
  language: string;
  level: string;
  category: string;
  thumbnail_url: string | null;
  is_published: boolean;
  total_lessons: number;
  total_duration: number;
  rating: number;
  module_count: number;
  video_count: number;
  created_at: string;
  updated_at: string;
}

export interface CourseModule {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface CourseVideo {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  video_url: string;
  video_provider: string;
  duration_seconds: number;
  order_index: number;
  is_preview: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface CourseWithModules extends Course {
  modules: Array<{
    id: string;
    title: string;
    videos: Array<{
      id: string;
      title: string;
      description: string | null;
      video_url: string;
      duration_seconds: number;
      order_index: number;
      is_preview: boolean;
      is_published: boolean;
    }>;
  }>;
}

export interface CoursesListResponse {
  courses: Course[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CourseDetailResponse {
  course: CourseWithModules;
}

// Get all courses - GET /api/v1/admin/courses
export async function getCourses(params?: {
  page?: number;
  limit?: number;
  search?: string;
  is_published?: boolean;
}): Promise<CoursesListResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.search) queryParams.append('search', params.search);
  if (params?.is_published !== undefined) {
    queryParams.append('is_published', params.is_published ? 'true' : 'false');
  }

  // Construct URL: /api/v1/admin/courses
  // Ensure correct endpoint: /api/v1/admin/courses
  const url = `${API_BASE_URL}/courses${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  
  console.log('🔗 Course Module API Call:');
  console.log('  URL:', url);
  console.log('  Method: GET');
  console.log('  Token present:', !!token);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  console.log('📡 Response:', response.status, response.statusText);

  // Use handleResponse for consistent error handling
  try {
    const data = await handleResponse<CoursesListResponse>(response);
    console.log('✅ Courses fetched successfully:', {
      count: data.courses?.length || 0,
      total: data.pagination?.total || 0,
    });
    return data;
  } catch (error: any) {
    console.error('❌ Error in getCourses:', error);
    // Re-throw with more context
    if (error.message.includes('404') || error.message.includes('NotFound')) {
      throw new Error(`Courses endpoint not found. Please verify backend server is running and route is registered at: ${url}`);
    }
    throw error;
  }
}

// Get course details - GET /api/v1/admin/courses/:id
export async function getCourseById(courseId: string): Promise<CourseDetailResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const url = `${API_BASE_URL}/courses/${courseId}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<CourseDetailResponse>(response);
}

// Get all videos from all courses (for Course Videos page)
export async function getAllVideos(params?: {
  page?: number;
  limit?: number;
  courseId?: string;
}): Promise<{
  videos: Array<{
    id: string;
    course_id: string;
    course_title: string;
    module_id: string;
    module_title: string;
    title: string;
    description: string | null;
    video_url: string;
    duration_seconds: number;
    order_index: number;
    is_preview: boolean;
    is_published: boolean;
    created_at: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  // If courseId is provided, fetch only that course
  if (params?.courseId) {
    try {
      const courseDetail = await getCourseById(params.courseId);
      const allVideos: Array<{
        id: string;
        course_id: string;
        course_title: string;
        module_id: string;
        module_title: string;
        title: string;
        description: string | null;
        video_url: string;
        duration_seconds: number;
        order_index: number;
        is_preview: boolean;
        is_published: boolean;
        created_at: string;
      }> = [];

      if (courseDetail.course.modules) {
        for (const module of courseDetail.course.modules) {
          if (module.videos) {
            for (const video of module.videos) {
              allVideos.push({
                id: video.id,
                course_id: courseDetail.course.id,
                course_title: courseDetail.course.title,
                module_id: module.id,
                module_title: module.title,
                title: video.title,
                description: video.description,
                video_url: video.video_url,
                duration_seconds: video.duration_seconds,
                order_index: video.order_index,
                is_preview: video.is_preview,
                is_published: video.is_published,
                created_at: courseDetail.course.created_at,
              });
            }
          }
        }
      }

      // Apply pagination
      const page = params?.page || 1;
      const limit = params?.limit || 10;
      const skip = (page - 1) * limit;
      const paginatedVideos = allVideos.slice(skip, skip + limit);

      return {
        videos: paginatedVideos,
        pagination: {
          page,
          limit,
          total: allVideos.length,
          totalPages: Math.ceil(allVideos.length / limit),
        },
      };
    } catch (error) {
      console.error('Error fetching course videos:', error);
      throw error;
    }
  }

  // Fetch all courses (limit to reasonable number for performance)
  const coursesResponse = await getCourses({
    page: 1,
    limit: 100, // Get first 100 courses
  });

  // Extract all videos from all courses
  const allVideos: Array<{
    id: string;
    course_id: string;
    course_title: string;
    module_id: string;
    module_title: string;
    title: string;
    description: string | null;
    video_url: string;
    duration_seconds: number;
    order_index: number;
    is_preview: boolean;
    is_published: boolean;
    created_at: string;
  }> = [];

  // Fetch full details for each course to get videos (in parallel for better performance)
  const courseDetailsPromises = coursesResponse.courses.map(course => 
    getCourseById(course.id).catch(err => {
      console.warn(`Failed to fetch details for course ${course.id}:`, err);
      return null;
    })
  );

  const courseDetails = await Promise.all(courseDetailsPromises);

  for (const courseDetail of courseDetails) {
    if (!courseDetail) continue;

    if (courseDetail.course.modules) {
      for (const module of courseDetail.course.modules) {
        if (module.videos) {
          for (const video of module.videos) {
            allVideos.push({
              id: video.id,
              course_id: courseDetail.course.id,
              course_title: courseDetail.course.title,
              module_id: module.id,
              module_title: module.title,
              title: video.title,
              description: video.description,
              video_url: video.video_url,
              duration_seconds: video.duration_seconds,
              order_index: video.order_index,
              is_preview: video.is_preview,
              is_published: video.is_published,
              created_at: courseDetail.course.created_at,
            });
          }
        }
      }
    }
  }

  // Apply pagination to videos
  const page = params?.page || 1;
  const limit = params?.limit || 10;
  const skip = (page - 1) * limit;
  const paginatedVideos = allVideos.slice(skip, skip + limit);

  return {
    videos: paginatedVideos,
    pagination: {
      page,
      limit,
      total: allVideos.length,
      totalPages: Math.ceil(allVideos.length / limit),
    },
  };
}

// Create course - POST /api/v1/admin/courses
export interface CreateCourseRequest {
  title: string;
  slug?: string;
  short_description?: string;
  long_description?: string;
  price: number;
  original_price?: number;
  package_id: number;
  language: 'HINDI' | 'ENGLISH' | 'BILINGUAL';
  level: 'BASIC' | 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT' | 'PROFESSIONAL';
  category: string;
  thumbnail_url?: string;
  is_published?: boolean;
}

export async function createCourse(data: CreateCourseRequest): Promise<CourseDetailResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const url = `${API_BASE_URL}/courses`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return handleResponse<CourseDetailResponse>(response);
}

// Create module - POST /api/v1/admin/courses/:courseId/modules
export interface CreateModuleRequest {
  title: string;
  description?: string;
  order_index: number;
}

export async function createModule(courseId: string, data: CreateModuleRequest): Promise<{ message: string; module: CourseModule }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const url = `${API_BASE_URL}/courses/${courseId}/modules`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return handleResponse<{ message: string; module: CourseModule }>(response);
}

// Create video - POST /api/v1/admin/courses/:courseId/modules/:moduleId/videos
export interface CreateVideoRequest {
  title: string;
  description?: string;
  video_url: string;
  video_provider?: string;
  duration_seconds: number;
  order_index: number;
  is_preview?: boolean;
  is_published?: boolean;
}

export async function createVideo(
  courseId: string,
  moduleId: string,
  data: CreateVideoRequest
): Promise<{ message: string; video: CourseVideo }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const url = `${API_BASE_URL}/courses/${courseId}/modules/${moduleId}/videos`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return handleResponse<{ message: string; video: CourseVideo }>(response);
}

// Update video - PUT /api/v1/admin/courses/:courseId/modules/:moduleId/videos/:videoId
export interface UpdateVideoRequest {
  title?: string;
  description?: string;
  video_url?: string;
  video_provider?: string;
  duration_seconds?: number;
  order_index?: number;
  is_preview?: boolean;
  is_published?: boolean;
}

export async function updateVideo(
  courseId: string,
  moduleId: string,
  videoId: string,
  data: UpdateVideoRequest
): Promise<{ message: string; video: CourseVideo }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const url = `${API_BASE_URL}/courses/${courseId}/modules/${moduleId}/videos/${videoId}`;
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return handleResponse<{ message: string; video: CourseVideo }>(response);
}

// Delete video - DELETE /api/v1/admin/courses/videos/:videoId
export async function deleteVideo(videoId: string): Promise<{ message: string }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const url = `${API_BASE_URL}/courses/videos/${videoId}`;
  // Don't send Content-Type for DELETE (no body) - Fastify returns 400 if Content-Type: application/json with empty body
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  return handleResponse<{ message: string }>(response);
}

// Upload course thumbnail - POST /api/v1/admin/courses/thumbnail/upload
export async function uploadCourseThumbnail(
  file: File
): Promise<{ thumbnail_url: string; uploaded_at: string }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/courses/thumbnail/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // Don't set Content-Type - browser will set it with boundary
    },
    body: formData,
  });

  return handleResponse<{ thumbnail_url: string; uploaded_at: string }>(response);
}

// Get presigned upload URL - POST /api/v1/admin/courses/:courseId/modules/:moduleId/videos/upload-url
export async function getVideoUploadUrl(
  courseId: string,
  moduleId: string,
  filename: string,
  fileSize: number,
  mimeType: string
): Promise<{ uploadUrl: string; cdnUrl: string; accessKey: string; expiresAt: string }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const response = await fetch(`${API_BASE_URL}/courses/${courseId}/modules/${moduleId}/videos/upload-url`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename,
      fileSize,
      mimeType,
    }),
  });

  return handleResponse<{ uploadUrl: string; cdnUrl: string; accessKey: string; expiresAt: string }>(response);
}

// Upload video directly to Bunny CDN using presigned URL (fast, with progress tracking)
// Returns both the promise and an abort function to cancel upload
export function uploadCourseVideoDirect(
  courseId: string,
  moduleId: string,
  file: File,
  onProgress?: (progress: number) => void
): { promise: Promise<{ video_url: string; uploaded_at: string }>; abort: () => void } {
  let xhr: XMLHttpRequest | null = null;
  
  const abort = () => {
    if (xhr) {
      console.log('🛑 Cancelling video upload...');
      xhr.abort();
      xhr = null;
    }
  };

  const promise = (async () => {
    try {
      // Step 1: Get presigned upload URL
      const { uploadUrl, cdnUrl, accessKey } = await getVideoUploadUrl(
        courseId,
        moduleId,
        file.name,
        file.size,
        file.type
      );

      // Step 2: Upload directly to Bunny CDN
      xhr = new XMLHttpRequest();

      return new Promise<{ video_url: string; uploaded_at: string }>((resolve, reject) => {
        // Track upload progress
        if (onProgress) {
          xhr!.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100);
              onProgress(progress);
            }
          });
        }

        xhr!.addEventListener('load', () => {
          if (xhr!.status >= 200 && xhr!.status < 300) {
            resolve({
              video_url: cdnUrl,
              uploaded_at: new Date().toISOString(),
            });
          } else {
            reject(new Error(`Upload failed: ${xhr!.status} ${xhr!.statusText}`));
          }
        });

        xhr!.addEventListener('error', () => {
          reject(new Error('Upload failed: Network error'));
        });

        xhr!.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'));
        });

        // Start upload
        xhr!.open('PUT', uploadUrl);
        xhr!.setRequestHeader('AccessKey', accessKey);
        xhr!.setRequestHeader('Content-Type', file.type);
        xhr!.send(file);
      });
    } catch (error: any) {
      throw error;
    }
  })();

  return { promise, abort };
}

// Upload video file - POST /api/v1/admin/courses/:courseId/modules/:moduleId/videos/upload
// Legacy method (slower, goes through server)
export async function uploadCourseVideo(
  courseId: string,
  moduleId: string,
  file: File
): Promise<{ video_url: string; uploaded_at: string }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/courses/${courseId}/modules/${moduleId}/videos/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // Don't set Content-Type - browser will set it with boundary
    },
    body: formData,
  });

  return handleResponse<{ video_url: string; uploaded_at: string }>(response);
}

// Update course - PUT /api/v1/admin/courses/:id
export interface UpdateCourseRequest {
  title?: string;
  slug?: string;
  short_description?: string;
  long_description?: string;
  price?: number;
  original_price?: number | null;
  package_id?: number;
  language?: 'HINDI' | 'ENGLISH' | 'BILINGUAL';
  level?: 'BASIC' | 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT' | 'PROFESSIONAL';
  category?: string;
  thumbnail_url?: string | null;
  is_published?: boolean;
}

export async function updateCourse(courseId: string, data: UpdateCourseRequest): Promise<CourseDetailResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const url = `${API_BASE_URL}/courses/${courseId}`;
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return handleResponse<CourseDetailResponse>(response);
}

// Delete course - DELETE /api/v1/admin/courses/:id
export async function deleteCourse(courseId: string): Promise<{ message: string }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication token not found. Please login.');
  }

  const url = `${API_BASE_URL}/courses/${courseId}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<{ message: string }>(response);
}

