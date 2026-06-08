'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { notFound } from 'next/navigation';
import Breadcrumbs from '../../../components/Breadcrumbs';
import { coursesAPI, ratingsAPI } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useCart } from '../../../contexts/CartContext';
import Link from 'next/link';

export default function CoursePage({ params }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { addToCart, isInCart } = useCart();
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    fetchCourseData();
  }, [params.slug]);

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch course details
      const courseData = await coursesAPI.getBySlug(params.slug);
      setCourse(courseData.course);
      setIsEnrolled(courseData.course.isEnrolled || false);

      // Fetch ratings
      try {
        const ratingsData = await ratingsAPI.getByCourse(courseData.course.id);
        setRatings(ratingsData.ratings || []);
      } catch (err) {
        console.error('Error fetching ratings:', err);
      }

      // Fetch modules if enrolled
      if (courseData.course.isEnrolled) {
        try {
          const modulesData = await coursesAPI.getModules(params.slug);
          setModules(modulesData.modules || []);
        } catch (err) {
          console.error('Error fetching modules:', err);
        }
      }
    } catch (err) {
      // Handle 404 specifically
      if (err.message && (err.message.includes('404') || err.message.includes('not found'))) {
        setError('Course not found');
      } else {
        setError(err.message || 'Failed to load course');
      }
      console.error('Error fetching course:', err);
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

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')} hours`;
    }
    return `${minutes} minutes`;
  };

  const formatVideoDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getLanguageLabel = (lang) => {
    const map = { HINDI: 'Hindi', ENGLISH: 'English', BILINGUAL: 'Hindi & English' };
    return map[lang] || lang;
  };

  const getLevelLabel = (level) => {
    const map = {
      BASIC: 'Basic',
      BEGINNER: 'Beginner',
      INTERMEDIATE: 'Intermediate',
      ADVANCED: 'Advanced',
      EXPERT: 'Expert',
      PROFESSIONAL: 'Professional',
    };
    return map[level] || level;
  };

  if (loading) {
    return (
      <main>
        <div style={{ padding: '40px', textAlign: 'center' }}>Loading course...</div>
      </main>
    );
  }

  if (error || !course) {
    return (
      <main>
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Courses', href: '/courses' },
            { label: 'Course Not Found' }
          ]}
        />
        <div style={{ 
          padding: '60px 20px', 
          textAlign: 'center',
          minHeight: '50vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>📚</div>
          <h1 style={{ fontSize: '32px', fontWeight: '700', color: 'var(--gray-900)', marginBottom: '12px' }}>
            Course Not Found
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--gray-600)', marginBottom: '32px', maxWidth: '500px' }}>
            {error || 'The course you are looking for does not exist or has been removed.'}
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link 
              href="/courses"
              style={{
                padding: '12px 24px',
                backgroundColor: 'var(--primary)',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--primary-dark)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--primary)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Browse All Courses
            </Link>
            <Link 
              href="/"
              style={{
                padding: '12px 24px',
                backgroundColor: 'white',
                color: 'var(--gray-700)',
                textDecoration: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                border: '2px solid var(--gray-300)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.color = 'var(--primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--gray-300)';
                e.currentTarget.style.color = 'var(--gray-700)';
              }}
            >
              Go Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (isInCart(course.id)) {
      router.push('/cart');
      return;
    }
    setAddingToCart(true);
    try {
      console.log('Adding course to cart:', course.id);
      const result = await addToCart(course.id);
      console.log('Add to cart result:', result);
      if (result.success) {
        // Use toast instead of alert
        const { toast } = await import('react-hot-toast');
        toast.success('Course added to cart!');
        // Wait a bit for cart to update, then redirect
        setTimeout(() => {
          router.push('/cart');
        }, 500);
      } else {
        const { toast } = await import('react-hot-toast');
        toast.error(result.error || 'Failed to add to cart');
      }
    } catch (err) {
      console.error('Add to cart error:', err);
      const { toast } = await import('react-hot-toast');
      toast.error(err.message || 'Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleBuyNow = () => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    router.push(`/checkout?course=${course.id}`);
  };

  const handleGoToCourse = () => {
    router.push(`/course/${params.slug}/videos`);
  };

  return (
    <main>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: course.title }
        ]}
      />

      {/* Course Hero Section */}
      <section className="course-hero">
        <div className="container">
          <div className="course-hero-content">
            <div className="course-header">
              <h1 className="course-title">{course.title}</h1>
              <p className="course-subtitle">{course.shortDescription || course.longDescription || ''}</p>

              <div className="course-stats">
                <div className="rating-large">
                  <span className="stars-large">★★★★★</span>
                  <span>
                    <strong>{Number(course.rating || 0).toFixed(1)}</strong> ({course.totalRatings || 0} ratings)
                  </span>
                </div>
                <span className="stat-item">👥 {course.totalStudents || 0} students enrolled</span>
                <span className="badge">{getLanguageLabel(course.language)}</span>
                <span className="badge badge-success">{getLevelLabel(course.level)}</span>
              </div>

              {/* What you'll learn - static for now */}
              <div className="learning-grid learning-grid-hero">
                <div className="learning-item">
                  <span className="learning-icon">✓</span>
                  <div>
                    <strong>Comprehensive Content:</strong> Learn from structured modules with real-world examples.
                  </div>
                </div>
                <div className="learning-item">
                  <span className="learning-icon">✓</span>
                  <div>
                    <strong>Expert Instruction:</strong> Get insights from industry professionals.
                  </div>
                </div>
                <div className="learning-item">
                  <span className="learning-icon">✓</span>
                  <div>
                    <strong>Practical Application:</strong> Apply concepts through hands-on exercises.
                  </div>
                </div>
                <div className="learning-item">
                  <span className="learning-icon">✓</span>
                  <div>
                    <strong>Lifetime Access:</strong> Learn at your own pace with unlimited access.
                  </div>
                </div>
              </div>
            </div>

            {/* Buy Box */}
            <div className="buy-box">
              <div className="buy-box-image">
                {course.title}
                <div className="play-overlay">
                  <div className="play-icon" />
                </div>
              </div>
              <div className="buy-box-content">
                <div className="price-section">
                  <div className="current-price">{formatPrice(course.price)}</div>
                  {course.originalPrice && course.originalPrice > course.price && (
                  <div>
                      <span className="original-price">{formatPrice(course.originalPrice)}</span>
                      <span className="discount-badge">
                        {Math.round(((course.originalPrice - course.price) / course.originalPrice) * 100)}% OFF
                      </span>
                  </div>
                  )}
                </div>

                <div className="action-buttons">
                  {isEnrolled ? (
                    <button onClick={handleGoToCourse} className="btn btn-primary">
                      Go to Course
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleAddToCart}
                        className="btn btn-primary"
                        disabled={addingToCart || isInCart(course.id)}
                      >
                        {addingToCart
                          ? 'Adding...'
                          : isInCart(course.id)
                          ? 'In Cart'
                          : 'Add to Cart'}
                      </button>
                      <button onClick={handleBuyNow} className="btn btn-secondary">
                    Buy Now
                      </button>
                    </>
                  )}
                </div>

                <div className="course-includes">
                  <h4>This course includes:</h4>
                  <ul className="includes-list">
                    <li>
                      <span className="check-icon">✓</span> {formatDuration(course.totalDuration || 0)} of video content
                    </li>
                    <li>
                      <span className="check-icon">✓</span> {course.totalLessons || 0} lessons
                    </li>
                    <li>
                      <span className="check-icon">✓</span> Lifetime access
                    </li>
                    <li>
                      <span className="check-icon">✓</span> Access on mobile and TV
                    </li>
                    <li>
                      <span className="check-icon">✓</span> Certificate of completion
                    </li>
                    <li>
                      <span className="check-icon">✓</span> 30-day money-back guarantee
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="course-main">
        <div className="container">
          {/* Course Curriculum */}
          {modules.length > 0 ? (
          <div className="content-section">
            <h2 className="section-title">Course Curriculum</h2>
            <div className="accordion">
                {modules.map((module, moduleIndex) => (
                  <div key={module.id} className="accordion-item" id={`section${moduleIndex + 1}`}>
                    <a href={`#section${moduleIndex + 1}`} className="accordion-header">
                  <div>
                        <div className="accordion-title">{module.title}</div>
                    <div
                      style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--gray-500)',
                        marginTop: 'var(--space-1)'
                      }}
                    >
                          {module.videos?.length || 0} lessons
                    </div>
                  </div>
                  <span className="accordion-icon">▼</span>
                </a>
                <div className="accordion-content">
                  <ul className="lesson-list">
                        {module.videos?.map((video) => (
                          <li key={video.id} className="lesson-item">
                      <div className="lesson-info">
                        <span>📹</span>
                              <span>{video.title}</span>
                      </div>
                            <span className="lesson-duration">
                              {formatVideoDuration(video.durationSeconds || 0)}
                            </span>
                    </li>
                        ))}
                  </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
          <div className="content-section">
              <h2 className="section-title">Course Curriculum</h2>
              <p style={{ color: 'var(--gray-600)' }}>
                {isEnrolled
                  ? 'No modules available yet.'
                  : 'Enroll in this course to access the curriculum.'}
              </p>
          </div>
          )}

          {/* Description */}
          <div className="content-section">
            <h2 className="section-title">Description</h2>
            <div style={{ color: 'var(--gray-600)', lineHeight: 1.8 }}>
              <p style={{ marginBottom: 'var(--space-4)' }}>
                {course.longDescription || course.shortDescription || 'No description available.'}
              </p>
            </div>
          </div>

          {/* Student feedback */}
          <div className="content-section">
            <h2 className="section-title">Student feedback</h2>
            <div className="student-feedback">
              <div className="feedback-summary">
                <div className="feedback-score">{Number(course.rating || 0).toFixed(1)}</div>
                <div className="feedback-stars">
                  <span className="stars-large">★★★★★</span>
                  <div className="feedback-average-label">Average rating</div>
                </div>
              </div>
              <div className="feedback-bars">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = ratings.filter((r) => r.rating === stars).length;
                  const percent = ratings.length > 0 ? (count / ratings.length) * 100 : 0;
                  return (
                  <div key={stars} className="feedback-row">
                      <span className="feedback-row-stars">{'★'.repeat(stars)}</span>
                    <div className="feedback-bar">
                        <div
                          className="feedback-bar-fill"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="feedback-row-percent">{Math.round(percent)}%</span>
                    </div>
                  );
                })}
            </div>
          </div>

            {/* Reviews list */}
            {ratings.length > 0 && (
              <div style={{ marginTop: '32px' }}>
                <h3 style={{ 
                  marginBottom: '24px', 
                  fontSize: '22px',
                  fontWeight: '700',
                  color: 'var(--gray-900)',
                  paddingBottom: '12px',
                  borderBottom: '2px solid var(--gray-200)'
                }}>
                  Student Reviews
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {ratings.slice(0, 10).map((rating) => (
                    <div
                      key={rating.id}
                      className="review-card"
                      style={{
                        padding: '24px',
                        background: 'white',
                        borderRadius: '12px',
                        border: '1px solid var(--gray-200)',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--primary)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.15)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--gray-200)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        marginBottom: '12px',
                        gap: '12px'
                      }}>
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: '700',
                          fontSize: '18px',
                          flexShrink: 0
                        }}>
                          {(rating.user?.name || 'A')[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px',
                            marginBottom: '4px'
                          }}>
                            <span style={{ 
                              color: '#fbbf24',
                              fontSize: '16px',
                              letterSpacing: '1px'
                            }}>
                              {'★'.repeat(rating.rating)}{'☆'.repeat(5 - rating.rating)}
                            </span>
                          </div>
                          <strong style={{ 
                            color: 'var(--gray-900)',
                            fontSize: '16px'
                          }}>
                            {rating.user?.name || 'Anonymous'}
                          </strong>
                        </div>
                        {rating.createdAt && (
                          <span style={{ 
                            fontSize: '12px',
                            color: 'var(--gray-500)',
                            flexShrink: 0
                          }}>
                            {new Date(rating.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {rating.review && (
                        <p style={{ 
                          color: 'var(--gray-700)', 
                          margin: 0,
                          lineHeight: '1.6',
                          fontSize: '15px'
                        }}>
                          {rating.review}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Rating Form - if enrolled */}
          {isEnrolled && isAuthenticated && (
            <div className="content-section">
              <h2 className="section-title">Rate this course</h2>
              <RatingForm courseId={course.id} onSuccess={fetchCourseData} />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

// Rating Form Component
function RatingForm({ courseId, onSuccess }) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const { ratingsAPI } = await import('../../../lib/api');
      await ratingsAPI.submit({ courseId, rating, review: review || undefined });
      setSuccess(true);
      setRating(0);
      setReview('');
      if (onSuccess) onSuccess();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rating-form" style={{ maxWidth: '600px' }}>
      {error && (
        <div className="rating-form-error" style={{ 
          padding: '12px 16px', 
          marginBottom: '16px', 
          backgroundColor: '#fee2e2', 
          color: '#dc2626', 
          borderRadius: '8px',
          border: '1px solid #fecaca',
          fontSize: '14px'
        }}>
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div className="rating-form-success" style={{ 
          padding: '12px 16px', 
          marginBottom: '16px', 
          backgroundColor: '#d1fae5', 
          color: '#059669', 
          borderRadius: '8px',
          border: '1px solid #a7f3d0',
          fontSize: '14px'
        }}>
          ✅ Rating submitted successfully!
        </div>
      )}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', fontSize: '16px', color: 'var(--gray-800)' }}>
          Your Rating *
        </label>
        <div className="star-rating-container" style={{ 
          display: 'flex', 
          gap: '4px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setRating(star);
                setError('');
              }}
              onMouseEnter={(e) => {
                if (rating === 0) {
                  e.currentTarget.style.transform = 'scale(1.2)';
                }
              }}
              onMouseLeave={(e) => {
                if (rating === 0) {
                  e.currentTarget.style.transform = 'scale(1)';
                }
              }}
              className="star-button"
              style={{
                fontSize: '32px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: star <= rating ? '#fbbf24' : '#d1d5db',
                padding: '8px',
                transition: 'all 0.2s ease',
                lineHeight: 1,
                position: 'relative',
                zIndex: 1,
                WebkitTapHighlightColor: 'transparent',
                outline: 'none'
              }}
              aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
            >
              ★
            </button>
          ))}
          {rating > 0 && (
            <span style={{ 
              marginLeft: '12px', 
              fontSize: '14px', 
              color: 'var(--gray-600)',
              fontWeight: '500'
            }}>
              {rating === 1 ? 'Poor' : rating === 2 ? 'Fair' : rating === 3 ? 'Good' : rating === 4 ? 'Very Good' : 'Excellent'}
            </span>
          )}
        </div>
      </div>
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="review-text" style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '16px', color: 'var(--gray-800)' }}>
          Your Review (Optional)
        </label>
        <textarea
          id="review-text"
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="Share your experience with this course..."
          rows={5}
          style={{
            width: '100%',
            padding: '12px',
            border: '2px solid var(--gray-300)',
            borderRadius: '8px',
            fontSize: '14px',
            fontFamily: 'inherit',
            resize: 'vertical',
            transition: 'border-color 0.2s',
            outline: 'none'
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--gray-300)';
          }}
        />
        <div style={{ 
          marginTop: '4px', 
          fontSize: '12px', 
          color: 'var(--gray-500)' 
        }}>
          {review.length} characters
        </div>
      </div>
      <button
        type="submit"
        disabled={submitting || rating === 0}
        className="rating-submit-btn"
        style={{
          padding: '14px 28px',
          backgroundColor: rating === 0 ? 'var(--gray-400)' : 'var(--primary)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: '600',
          cursor: submitting || rating === 0 ? 'not-allowed' : 'pointer',
          opacity: submitting || rating === 0 ? 0.6 : 1,
          transition: 'all 0.2s ease',
          boxShadow: rating === 0 ? 'none' : '0 4px 12px rgba(99, 102, 241, 0.3)',
          outline: 'none'
        }}
        onMouseEnter={(e) => {
          if (!submitting && rating > 0) {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)';
          }
        }}
        onMouseLeave={(e) => {
          if (!submitting && rating > 0) {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
          }
        }}
      >
        {submitting ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid white', borderTop: 'none', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
            Submitting...
          </span>
        ) : (
          'Submit Rating'
        )}
      </button>
    </form>
  );
}
