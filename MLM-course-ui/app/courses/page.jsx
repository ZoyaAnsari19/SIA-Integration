'use client';

import { useState, useEffect } from 'react';
import Breadcrumbs from '../../components/Breadcrumbs';
import CourseCard from '../../components/CourseCard';
import { coursesAPI } from '../../lib/api';
import { getCourseThumbnail } from '../../lib/courseThumbnails';

// Courses that should exist in backend but be hidden from UI listing
const HIDDEN_COURSE_SLUGS = new Set(['cyber-security', 'artificial-intelligence']);

export default function AllCoursesPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    category: '',
    level: '',
    language: '',
    search: '',
  });

  useEffect(() => {
    fetchCourses();
  }, [filters]);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (filters.category) params.category = filters.category;
      if (filters.level) params.level = filters.level;
      if (filters.language) params.language = filters.language;
      if (filters.search) params.search = filters.search;

      const data = await coursesAPI.getAll(params);
      setCourses(data.courses || []);
    } catch (err) {
      setError(err.message || 'Failed to load courses');
      console.error('Error fetching courses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
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
    const langMap = {
      HINDI: 'Hindi',
      ENGLISH: 'English',
      BILINGUAL: 'Hindi & English',
    };
    const levelMap = {
      BASIC: 'Basic',
      BEGINNER: 'Beginner',
      INTERMEDIATE: 'Intermediate',
      ADVANCED: 'Advanced',
      EXPERT: 'Expert',
      PROFESSIONAL: 'Professional',
    };
    // API returns total_duration (snake_case), support both
    const totalDuration = course.total_duration || course.totalDuration || 0;
    const hours = Math.floor(totalDuration / 3600);
    return `${langMap[course.language] || course.language} • ${hours} hours • ${levelMap[course.level] || course.level}`;
  };

  // Apply UI-only filtering (do not show some high-value courses)
  const visibleCourses = courses.filter((course) => !HIDDEN_COURSE_SLUGS.has(course.slug));

  return (
    <main className="all-courses-page">
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Courses' }
        ]}
      />

      <section className="all-courses-hero">
        <div className="container">
          <div className="all-courses-header">
            <div className="all-courses-header-content">
              <div>
                <h1 className="all-courses-title">
                  <span className="title-icon">📚</span>
                  Top Courses
                </h1>
                <p className="all-courses-subtitle">Explore a variety of fresh topics, expert instruction and lifetime access.</p>
              </div>
              <div className="all-courses-stats">
                <div className="all-course-stat-card">
                  <div className="stat-icon-wrapper">
                    <span className="stat-icon">📖</span>
                  </div>
                  <div className="stat-content">
                    <span className="stat-value">{loading ? '...' : visibleCourses.length}</span>
                    <span className="stat-label">Courses</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Filters row */}
          <div className="all-courses-filters-enhanced">
            <div className="filter-group-enhanced">
              <label className="filter-label">
                <span className="filter-icon">🔍</span>
                Search
              </label>
              <input
                type="text"
                className="filter-input"
                placeholder="Search courses..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />
            </div>
            <div className="filter-group-enhanced">
              <label className="filter-label">
                <span className="filter-icon">📁</span>
                Category
              </label>
              <select
                className="filter-select"
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
              >
                <option value="">All Categories</option>
                <option value="Investment">Investment</option>
              </select>
            </div>
            <div className="filter-group-enhanced">
              <label className="filter-label">
                <span className="filter-icon">📊</span>
                Level
              </label>
              <select
                className="filter-select"
                value={filters.level}
                onChange={(e) => handleFilterChange('level', e.target.value)}
              >
                <option value="">All Levels</option>
                <option value="BASIC">Basic</option>
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
                <option value="EXPERT">Expert</option>
                <option value="PROFESSIONAL">Professional</option>
              </select>
            </div>
            <div className="filter-group-enhanced">
              <label className="filter-label">
                <span className="filter-icon">🌐</span>
                Language
              </label>
              <select
                className="filter-select"
                value={filters.language}
                onChange={(e) => handleFilterChange('language', e.target.value)}
              >
                <option value="">All Languages</option>
                <option value="ENGLISH">English</option>
                <option value="HINDI">Hindi</option>
                <option value="BILINGUAL">Bilingual</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Courses list as cards */}
      <section className="all-courses-list-section">
        <div className="container">
          {loading ? (
            <div className="courses-loading" style={{ 
              padding: '80px 20px', 
              textAlign: 'center' 
            }}>
              <div style={{ 
                fontSize: '48px', 
                marginBottom: '16px',
                animation: 'pulse 2s infinite'
              }}>📚</div>
              <p style={{ 
                fontSize: '18px', 
                color: 'var(--gray-600)',
                fontWeight: '500'
              }}>Loading courses...</p>
            </div>
          ) : error ? (
            <div className="courses-error" style={{ 
              padding: '60px 20px', 
              textAlign: 'center',
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
            }}>
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>⚠️</div>
              <h3 style={{ 
                fontSize: '24px', 
                fontWeight: '700', 
                color: 'var(--gray-900)',
                marginBottom: '12px'
              }}>Oops! Something went wrong</h3>
              <p style={{ 
                color: '#dc2626', 
                fontSize: '16px'
              }}>{error}</p>
            </div>
          ) : visibleCourses.length === 0 ? (
            <div className="courses-empty" style={{ 
              padding: '80px 20px', 
              textAlign: 'center',
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
            }}>
              <div style={{ fontSize: '80px', marginBottom: '24px', opacity: 0.6 }}>📚</div>
              <h2 style={{ 
                fontSize: '28px', 
                fontWeight: '700', 
                color: 'var(--gray-900)',
                marginBottom: '12px'
              }}>No Courses Found</h2>
              <p style={{ 
                fontSize: '16px', 
                color: 'var(--gray-600)',
                maxWidth: '500px',
                margin: '0 auto'
              }}>Try adjusting your filters to find more courses.</p>
            </div>
          ) : (
          <div className="course-grid">
            {visibleCourses.map((course, index) => (
              <CourseCard
                  key={course.id || course.slug}
                href={`/course/${course.slug}`}
                  imageLabel={course.title}
                title={course.title}
                  description={course.shortDescription || course.description || ''}
                  ratingText={formatRating(course.rating, course.total_ratings || course.totalRatings)}
                  studentsText={formatStudentsText(course)}
                  price={formatPrice(course.price)}
                  category={course.category}
                  thumbnail={getCourseThumbnail(course)}
                hoverAlign={index % 3 === 0 ? 'right' : 'left'}
              />
            ))}
          </div>
          )}
        </div>
      </section>
    </main>
  );
}


