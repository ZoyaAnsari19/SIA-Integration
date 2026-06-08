'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Breadcrumbs from '../../components/Breadcrumbs';
import CourseCard from '../../components/CourseCard';
import { coursesAPI } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import Link from 'next/link';
import toast from 'react-hot-toast';

function MyCoursesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasRedirected = useRef(false);
  const hasFetched = useRef(false);

  useEffect(() => {
    // CRITICAL: Wait for auth check to complete - don't do anything while loading
    if (authLoading) {
      return;
    }
    
    // Auth check is complete - now decide what to do
    if (!isAuthenticated) {
      // Not authenticated - redirect to login (only once)
      if (!hasRedirected.current) {
        hasRedirected.current = true;
        router.replace('/login');
      }
      return;
    }
    
    // User is authenticated - fetch courses (only once)
    if (isAuthenticated && !hasFetched.current) {
      hasFetched.current = true;
      fetchMyCourses();
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (searchParams.get('payment') === 'success') {
      toast.success('🎉 Course purchased successfully! Start learning now.', {
        duration: 5000,
        icon: '✅',
      });
      // Clean URL
      router.replace('/my-courses', { scroll: false });
    }
  }, [searchParams, router]);

  const fetchMyCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await coursesAPI.getMyCourses();
      setCourses(data.courses || []);
    } catch (err) {
      setError(err.message || 'Failed to load your courses');
      console.error('Error fetching my courses:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    if (typeof price === 'number') {
      return `₹${price.toLocaleString('en-IN')}`;
    }
    return price || 'Free';
  };

  const formatRating = (rating, totalRatings) => {
    if (!rating || rating === 0) return '0.0 (0 ratings)';
    return `${Number(rating).toFixed(1)} (${totalRatings || 0} ratings)`;
  };

  const formatStudentsText = (course) => {
    // API returns total_duration and total_lessons (snake_case), support both
    const totalDuration = course.total_duration || course.totalDuration || 0;
    const totalLessons = course.total_lessons || course.totalLessons || 0;
    const hours = Math.floor(totalDuration / 3600);
    return `${hours} hours • ${totalLessons} lessons`;
  };

  // CRITICAL: Show loading state while checking auth - don't render anything else
  if (authLoading) {
    return (
      <main>
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'My Courses' }
          ]}
        />
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div>Loading...</div>
        </div>
      </main>
    );
  }

  // If not authenticated after loading completes, show redirect message
  // (The actual redirect happens in useEffect)
  if (!isAuthenticated) {
    return (
      <main>
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'My Courses' }
          ]}
        />
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div>Redirecting to login...</div>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main>
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'My Courses' }
          ]}
        />
        <div style={{ padding: '40px', textAlign: 'center' }}>Loading your courses...</div>
      </main>
    );
  }

  // API returns snake_case, support both formats
  const totalHours = courses.reduce((sum, course) => {
    const totalDuration = course.total_duration || course.totalDuration || 0;
    return sum + Math.floor(totalDuration / 3600);
  }, 0);
  const totalLessons = courses.reduce((sum, course) => {
    return sum + (course.total_lessons || course.totalLessons || 0);
  }, 0);

  return (
    <main className="my-courses-page">
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'My Courses' }
        ]}
      />

      <section className="my-courses-hero">
        <div className="container">
          <div className="my-courses-header">
            <div className="my-courses-header-content">
              <div className="my-courses-title-wrapper">
                <h1 className="my-courses-title">
                  <span className="title-icon">📚</span>
                  My Courses
                </h1>
                <p className="my-courses-subtitle">Continue your learning journey and unlock new skills</p>
              </div>
              <div className="my-courses-stats">
                <div className="my-course-stat-card">
                  <div className="stat-icon-wrapper">
                    <span className="stat-icon">📖</span>
                  </div>
                  <div className="stat-content">
                    <span className="stat-value">{courses.length}</span>
                    <span className="stat-label">Courses</span>
                  </div>
                </div>
                <div className="my-course-stat-card">
                  <div className="stat-icon-wrapper">
                    <span className="stat-icon">⏱️</span>
                  </div>
                  <div className="stat-content">
                    <span className="stat-value">{totalHours}</span>
                    <span className="stat-label">Hours</span>
                  </div>
                </div>
                <div className="my-course-stat-card">
                  <div className="stat-icon-wrapper">
                    <span className="stat-icon">🎯</span>
                  </div>
                  <div className="stat-content">
                    <span className="stat-value">{totalLessons}</span>
                    <span className="stat-label">Lessons</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="my-courses-list-section">
        <div className="container">
          {error ? (
            <div className="my-courses-error">
              <div className="error-icon">⚠️</div>
              <h3>Oops! Something went wrong</h3>
              <p>{error}</p>
              <button 
                onClick={fetchMyCourses}
                className="error-retry-btn"
              >
                Try Again
              </button>
            </div>
          ) : courses.length === 0 ? (
            <div className="my-courses-empty">
              <div className="empty-icon">📚</div>
              <h2>No Courses Yet</h2>
              <p>You haven't enrolled in any courses yet. Start your learning journey today!</p>
              <Link href="/courses" className="empty-browse-btn">
                <span>Browse Courses</span>
                <span>→</span>
              </Link>
            </div>
          ) : (
            <div className="my-courses-grid">
              {courses.map((course, index) => {
                // API returns snake_case, support both formats
                const totalDuration = course.total_duration || course.totalDuration || 0;
                const totalLessons = course.total_lessons || course.totalLessons || 0;
                const hours = Math.floor(totalDuration / 3600);
                const lessons = totalLessons;
                return (
                  <div key={course.id} className="my-course-card-wrapper">
                    <div className="my-course-card">
                      <div className="my-course-card-header">
                        <div className="course-header-gradient">
                          <h3 className="course-card-title">{course.title}</h3>
                          <div className="enrolled-badge">
                            <span className="badge-icon">✓</span>
                            <span>Enrolled</span>
                          </div>
                        </div>
                      </div>
                      <div className="my-course-card-body">
                        <p className="my-course-description">
                          {course.shortDescription || 'Continue learning and master new skills with this comprehensive course.'}
                        </p>
                        
                        <div className="my-course-meta">
                          <div className="my-course-rating">
                            <div className="stars-container">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <span 
                                  key={star} 
                                  className={`star ${course.rating && star <= Math.round(course.rating) ? 'filled' : ''}`}
                                >
                                  ★
                                </span>
                              ))}
                            </div>
                            <span className="rating-text">
                              {formatRating(course.rating, course.total_ratings || course.totalRatings)}
                            </span>
                          </div>
                          <div className="my-course-details">
                            <span className="detail-item">
                              <span className="detail-icon">⏱️</span>
                              {hours} {hours === 1 ? 'hour' : 'hours'}
                            </span>
                            <span className="detail-item">
                              <span className="detail-icon">📹</span>
                              {lessons} {lessons === 1 ? 'lesson' : 'lessons'}
                            </span>
                          </div>
                        </div>

                        <div className="my-course-actions">
                          <Link 
                            href={`/course/${course.slug}`}
                            className="my-course-btn secondary"
                            onClick={(e) => {
                              if (!course.slug) {
                                e.preventDefault();
                                console.error('Course slug is missing:', course);
                                alert('Course slug is missing. Please contact support.');
                              }
                            }}
                          >
                            <span>View Details</span>
                          </Link>
                          <Link 
                            href={`/course/${course.slug}/videos`}
                            className="my-course-btn primary"
                          >
                            <span className="btn-icon">▶</span>
                            <span>Continue Learning</span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default function MyCoursesPage() {
  return (
    <Suspense fallback={
      <main>
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'My Courses' }
          ]}
        />
        <div style={{ padding: '40px', textAlign: 'center' }}>Loading your courses...</div>
      </main>
    }>
      <MyCoursesContent />
    </Suspense>
  );
}

