'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Breadcrumbs from '../../../../components/Breadcrumbs';
import VideoPlayer from '../../../../components/VideoPlayer';
import { coursesAPI, videosAPI } from '../../../../lib/api';
import { useAuth } from '../../../../contexts/AuthContext';

export default function CourseVideosPage({ params }) {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasRedirected = useRef(false);
  const hasFetched = useRef(false);

  useEffect(() => {
    // Wait for auth check to complete
    if (authLoading) {
      return;
    }
    
    // Auth check complete - now check authentication
    if (!isAuthenticated && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace('/login');
      return;
    }
    
    // User is authenticated, fetch course data (only once)
    if (isAuthenticated && !hasFetched.current) {
      hasFetched.current = true;
      fetchCourseData();
    }
  }, [params.slug, isAuthenticated, authLoading, router]);

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch course details
      const courseData = await coursesAPI.getBySlug(params.slug);
      setCourse(courseData.course);

      if (!courseData.course.isEnrolled) {
        setError('You must purchase this course to access videos');
        return;
      }

      // Fetch modules
      const modulesData = await coursesAPI.getModules(params.slug);
      const modulesList = modulesData.modules || [];
      console.log('Modules fetched:', modulesList);
      setModules(modulesList);

      // Select first video if available
      if (modulesList.length > 0 && modulesList[0].videos?.length > 0) {
        const firstVideo = modulesList[0].videos[0];
        console.log('Selecting first video:', firstVideo);
        await selectVideo(firstVideo.id);
      } else {
        console.warn('No videos found in modules');
      }
    } catch (err) {
      setError(err.message || 'Failed to load course videos');
      console.error('Error fetching course videos:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectVideo = async (videoId) => {
    try {
      console.log('Selecting video:', videoId);
      const videoData = await videosAPI.getById(videoId);
      console.log('Video data received:', videoData);
      const video = videoData.video;
      // Ensure embedUrl is set
      if (!video.embedUrl && video.videoUrl) {
        video.embedUrl = video.videoUrl;
      }
      setSelectedVideo(video);
    } catch (err) {
      console.error('Error fetching video:', err);
      alert('Failed to load video: ' + (err.message || 'Unknown error'));
    }
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <main>
        <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>
      </main>
    );
  }

  // If not authenticated after loading, redirect (will happen in useEffect)
  if (!isAuthenticated) {
    return (
      <main>
        <div style={{ padding: '40px', textAlign: 'center' }}>Redirecting to login...</div>
      </main>
    );
  }

  if (loading) {
    return (
      <main>
        <div style={{ padding: '40px', textAlign: 'center' }}>Loading course videos...</div>
      </main>
    );
  }

  if (error || !course) {
    return (
      <main>
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: course?.title || 'Course', href: `/course/${params.slug}` },
            { label: 'Videos' }
          ]}
        />
        <div style={{ padding: '40px', textAlign: 'center', color: '#c33' }}>
          {error || 'Course not found'}
        </div>
      </main>
    );
  }

  return (
    <main>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: course.title, href: `/course/${params.slug}` },
          { label: 'Videos' }
        ]}
      />

      <section className="course-videos-section">
        <div className="container">
          {/* Course Header */}
          <div className="course-videos-header">
            <div className="course-videos-header-content">
              <h1 className="course-videos-title">{course.title}</h1>
              <p className="course-videos-subtitle">Continue your learning journey</p>
            </div>
            <div className="course-videos-stats">
              <div className="stat-item">
                <span className="stat-icon">📚</span>
                <span className="stat-value">{modules.reduce((sum, m) => sum + (m.videos?.length || 0), 0)}</span>
                <span className="stat-label">Videos</span>
              </div>
              <div className="stat-item">
                <span className="stat-icon">📖</span>
                <span className="stat-value">{modules.length}</span>
                <span className="stat-label">Modules</span>
              </div>
            </div>
          </div>

          <div className="course-videos-layout">
            {/* Video Player */}
            <div className="course-videos-player">
              <div className="video-player-container">
                {selectedVideo ? (
                  <VideoPlayer
                    embedUrl={selectedVideo.embedUrl || selectedVideo.videoUrl}
                    title={selectedVideo.title}
                    className="enhanced-video-player"
                  />
                ) : (
                  <div className="video-placeholder">
                    <div className="video-placeholder-icon">▶</div>
                    <p>Select a video to start watching</p>
                  </div>
                )}
              </div>

              {selectedVideo && (
                <div className="video-info-card">
                  <div className="video-info-header">
                    <h2 className="video-info-title">{selectedVideo.title}</h2>
                    {selectedVideo.isPreview && (
                      <span className="video-preview-badge">Preview</span>
                    )}
                  </div>
                  {selectedVideo.description && (
                    <p className="video-info-description">{selectedVideo.description}</p>
                  )}
                  <div className="video-info-meta">
                    <span className="video-meta-item">
                      <span className="meta-icon">⏱️</span>
                      {formatDuration(selectedVideo.durationSeconds || 0)}
                    </span>
                    <span className="video-meta-item">
                      <span className="meta-icon">📹</span>
                      Video Lesson
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Course Modules Sidebar */}
            <div className="course-videos-sidebar">
              <div className="sidebar-header">
                <h3 className="sidebar-title">
                  <span className="sidebar-icon">📋</span>
                  Course Content
                </h3>
                <div className="progress-indicator">
                  <span className="progress-text">0% Complete</span>
                </div>
              </div>
              <div className="course-videos-list">
                {modules.map((module, moduleIndex) => (
                  <div key={module.id} className="module-card">
                    <div className="module-header">
                      <div className="module-number">{moduleIndex + 1}</div>
                      <div className="module-info">
                        <h4 className="module-title">{module.title}</h4>
                        {module.description && (
                          <p className="module-description">{module.description}</p>
                        )}
                        <span className="module-video-count">
                          {module.videos?.length || 0} {module.videos?.length === 1 ? 'video' : 'videos'}
                        </span>
                      </div>
                    </div>
                    {module.videos && module.videos.length > 0 && (
                      <div className="module-videos">
                        {module.videos.map((video, videoIndex) => (
                          <button
                            key={video.id}
                            onClick={() => selectVideo(video.id)}
                            className={`video-item ${selectedVideo?.id === video.id ? 'active' : ''}`}
                          >
                            <div className="video-item-left">
                              <div className="video-item-number">{videoIndex + 1}</div>
                              <div className="video-item-content">
                                <span className="video-item-title">{video.title}</span>
                                {video.isPreview && (
                                  <span className="video-item-badge">Free</span>
                                )}
                              </div>
                            </div>
                            <div className="video-item-right">
                              <span className="video-item-duration">
                                {formatDuration(video.durationSeconds || 0)}
                              </span>
                              {selectedVideo?.id === video.id && (
                                <span className="video-item-playing">▶</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

