'use client';

import { useState, useEffect } from 'react';
import CourseCard from '../components/CourseCard';
import LightRays from '../components/LightRays';
import LogoLoop from '../components/LogoLoop';
import ScrambledText from '../components/ScrambledText';
import { FiTarget, FiCheckCircle, FiClock } from 'react-icons/fi';
import { coursesAPI } from '../lib/api';
import { getCourseThumbnail } from '../lib/courseThumbnails';

// Courses that should remain in backend but be hidden from public UI
const HIDDEN_COURSE_SLUGS = new Set(['cyber-security', 'artificial-intelligence']);

export default function HomePage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch all published courses from API
      const data = await coursesAPI.getAll({});
      const allCourses = data.courses || [];
      // UI-only filter: hide specific high-value courses from home section
      const visibleCourses = allCourses.filter(
        (course) => !HIDDEN_COURSE_SLUGS.has(course.slug)
      );
      // Take first 6 visible courses for home page display
      setCourses(visibleCourses.slice(0, 6));
    } catch (err) {
      console.error('Error fetching courses:', err);
      setError(err.message || 'Failed to load courses');
      // Don't show error to user, just show empty state
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };
  const statsLogos = [
    {
      node: (
        <div className="logo-loop-item-inner">
          <span className="logo-loop-icon">
            <FiTarget />
          </span>
          <div>
            <div className="logo-loop-text-title">6 online courses</div>
            <div className="logo-loop-text-subtitle">Explore a variety of fresh topics</div>
          </div>
        </div>
      )
    },
    {
      node: (
        <div className="logo-loop-item-inner">
          <span className="logo-loop-icon">
            <FiCheckCircle />
          </span>
          <div>
            <div className="logo-loop-text-title">Expert instruction</div>
            <div className="logo-loop-text-subtitle">Find the right course for you</div>
          </div>
        </div>
      )
    },
    {
      node: (
        <div className="logo-loop-item-inner">
          <span className="logo-loop-icon">
            <FiClock />
          </span>
          <div>
            <div className="logo-loop-text-title">Lifetime access</div>
            <div className="logo-loop-text-subtitle">Learn on your own schedule</div>
          </div>
        </div>
      )
    }
  ];

  return (
    <main>
      {/* Hero Section - Secure Infinite Association style */}
      <section className="hero hero-with-rays">
        <div className="hero-rays-wrapper">
          <LightRays
            raysOrigin="top-center"
            raysColor="#8b5cf6"
            raysSpeed={1.3}
            lightSpread={0.9}
            rayLength={1.4}
            followMouse={true}
            mouseInfluence={0.15}
            noiseAmount={0.08}
            distortion={0.05}
          />
        </div>

        <div className="container hero-content">
          <h1>Welcome to Secure Infinite Association</h1>
          <ScrambledText radius={120} duration={1.1} speed={0.6} scrambleChars=".:-/">
            Secure Infinite Association is India&apos;s trusted platform for high-quality,
            self-paced video courses. Study any topic, anytime and explore premium recorded courses
            at the lowest price ever.
          </ScrambledText>

          <div className="hero-actions">
            <a href="/courses" className="btn btn-primary">
              Browse all courses
            </a>
          </div>

          <div className="hero-meta">
            <span>📼 100% recorded video courses</span>
            <span>🕒 Learn at your own pace</span>
            <span>🇮🇳 Designed for Indian learners</span>
          </div>
        </div>
      </section>

      {/* Scrolling stats band under hero */}
      <section className="stats-band">
        <div className="container">
          <LogoLoop
            logos={statsLogos}
            speed={80}
            logoHeight={32}
            gap={96}
            ariaLabel="Secure Infinite Association highlights"
          />
        </div>
      </section>

      {/* Courses Section */}
      <section className="courses-section">
        <div className="container">
          <div className="section-title">
            <h2>Top Courses</h2>
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div>Loading courses...</div>
            </div>
          ) : error ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626' }}>
              <p>Failed to load courses. Please try again later.</p>
            </div>
          ) : courses.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <p>No courses available at the moment.</p>
            </div>
          ) : (
            <div className="course-grid">
              {courses.map((course, index) => {
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
                  // API returns snake_case, support both formats
                  const totalDuration = course.total_duration || course.totalDuration || 0;
                  const totalLessons = course.total_lessons || course.totalLessons || 0;
                  const hours = Math.floor(totalDuration / 3600);
                  return `${hours} hours • ${totalLessons} lessons`;
                };

                return (
                  <CourseCard
                    key={course.id || course.slug}
                    href={`/course/${course.slug}`}
                    imageLabel={course.title}
                    title={course.title}
                    description={course.short_description || course.description || ''}
                    ratingText={formatRating(course.rating, course.total_ratings)}
                    studentsText={formatStudentsText(course)}
                    price={formatPrice(course.price)}
                    category={course.category}
                    thumbnail={getCourseThumbnail(course)}
                    hoverAlign={index % 3 === 0 ? 'right' : 'left'}
                  />
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}


