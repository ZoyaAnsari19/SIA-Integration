'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

// Get icon type based on course category or title
function getIconType(category, title = '') {
  const categoryLower = (category || '').toLowerCase();
  const titleLower = (title || '').toLowerCase();
  
  // Check for specific keywords in priority order
  
  // 1. Language/English Speaking (highest priority for language courses)
  if (titleLower.includes('english') || titleLower.includes('speaking') || 
      titleLower.includes('language') || titleLower.includes('mastering spoken')) {
    return 'language';
  }
  
  // 2. Digital Marketing
  if (titleLower.includes('digital marketing') || titleLower.includes('marketing') || 
      categoryLower.includes('marketing')) {
    return 'marketing';
  }
  
  // 3. Share Market/Stock Trading
  if (titleLower.includes('share market') || titleLower.includes('stock market') ||
      titleLower.includes('equity') || titleLower.includes('derivatives') ||
      titleLower.includes('trading') || titleLower.includes('market psychology')) {
    return 'stock';
  }
  
  // 4. Graphic Design/Video Editing
  if (titleLower.includes('graphic') || titleLower.includes('design') || 
      titleLower.includes('video edit') || titleLower.includes('video editing')) {
    return 'design';
  }
  
  // 5. Basic/Beginner courses (check level keywords)
  if (titleLower.includes('basic') || titleLower.includes('beginner') || 
      titleLower.includes('fundamental') || titleLower.includes('introduction to')) {
    return 'basic';
  }
  
  // 6. Advanced/Expert/Professional courses
  if (titleLower.includes('advanced') || titleLower.includes('expert') || 
      titleLower.includes('professional') || titleLower.includes('deep dive')) {
    return 'advanced';
  }
  
  // 7. Investment/Finance (default for investment-related)
  if (categoryLower.includes('investment') || titleLower.includes('investment') || 
      titleLower.includes('invest') || titleLower.includes('financial') ||
      titleLower.includes('finance')) {
    return 'investment';
  }
  
  // Default to investment icon
  return 'investment';
}

// Investment/Finance Icon - Enhanced bar chart with upward trend
function InvestmentIcon() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="60" r="58" fill="url(#gradient1)" opacity="0.3"/>
      <circle cx="60" cy="60" r="45" fill="url(#gradient2)"/>
      {/* Bar chart bars with better spacing */}
      <rect x="38" y="55" width="7" height="20" fill="white" opacity="0.95" rx="2"/>
      <rect x="48" y="50" width="7" height="25" fill="white" opacity="0.95" rx="2"/>
      <rect x="58" y="45" width="7" height="30" fill="white" opacity="0.95" rx="2"/>
      <rect x="68" y="38" width="7" height="37" fill="white" opacity="0.95" rx="2"/>
      {/* Upward arrow above bars */}
      <path d="M60 28 L56 36 L60 32 L64 36 Z" fill="white" opacity="0.95"/>
      {/* Trend line connecting bars */}
      <path d="M41 75 L51 70 L61 65 L71 58" stroke="white" strokeWidth="2" 
            fill="none" opacity="0.6" strokeLinecap="round" strokeDasharray="2 2"/>
      <defs>
        <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="1"/>
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="1"/>
        </linearGradient>
        <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.8"/>
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.8"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// Digital Marketing Icon - Circular with bar chart and upward arrow with dotted circle
function MarketingIcon() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="60" r="58" fill="url(#gradientMarketing1)" opacity="0.3"/>
      <circle cx="60" cy="60" r="45" fill="url(#gradientMarketing2)"/>
      {/* Dotted circular path */}
      <circle cx="60" cy="60" r="35" fill="none" stroke="white" strokeWidth="2" strokeDasharray="3 3" opacity="0.4"/>
      {/* Bar chart in center */}
      <rect x="45" y="55" width="6" height="12" fill="white" opacity="0.95" rx="2"/>
      <rect x="53" y="50" width="6" height="17" fill="white" opacity="0.95" rx="2"/>
      <rect x="61" y="45" width="6" height="22" fill="white" opacity="0.95" rx="2"/>
      <rect x="69" y="40" width="6" height="27" fill="white" opacity="0.95" rx="2"/>
      {/* Upward arrow above bars */}
      <path d="M60 30 L55 38 L60 35 L65 38 Z" fill="white" opacity="0.95"/>
      <defs>
        <linearGradient id="gradientMarketing1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="1"/>
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="1"/>
        </linearGradient>
        <linearGradient id="gradientMarketing2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.8"/>
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.8"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// Stock Market Icon - Shield with checkmark
function StockIcon() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="60" r="58" fill="url(#gradientStock1)" opacity="0.3"/>
      <circle cx="60" cy="60" r="45" fill="url(#gradientStock2)"/>
      {/* Shield shape */}
      <path d="M60 40 L45 45 L45 60 Q45 70 50 75 Q55 80 60 85 Q65 80 70 75 Q75 70 75 60 L75 45 Z" 
            fill="white" opacity="0.95"/>
      {/* Checkmark inside shield */}
      <path d="M50 60 L55 65 L70 50" stroke="url(#gradientStock3)" strokeWidth="3" 
            fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.95"/>
      <defs>
        <linearGradient id="gradientStock1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="1"/>
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="1"/>
        </linearGradient>
        <linearGradient id="gradientStock2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.8"/>
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.8"/>
        </linearGradient>
        <linearGradient id="gradientStock3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="1"/>
          <stop offset="100%" stopColor="#059669" stopOpacity="1"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// Language/English Icon - Book with bar chart and rupee
function LanguageIcon() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="60" r="58" fill="url(#gradientLang1)" opacity="0.3"/>
      <circle cx="60" cy="60" r="45" fill="url(#gradientLang2)"/>
      {/* Open Book */}
      <path d="M40 50 L40 75 L60 80 L60 55 Z" fill="white" opacity="0.95" rx="2"/>
      <path d="M60 55 L60 80 L80 75 L80 50 Z" fill="white" opacity="0.95" rx="2"/>
      {/* Book spine */}
      <line x1="60" y1="55" x2="60" y2="80" stroke="url(#gradientLang3)" strokeWidth="2" opacity="0.8"/>
      {/* Bar chart on left page */}
      <rect x="45" y="65" width="4" height="8" fill="url(#gradientLang3)" opacity="0.9" rx="1"/>
      <rect x="50" y="62" width="4" height="11" fill="url(#gradientLang3)" opacity="0.9" rx="1"/>
      <rect x="55" y="60" width="4" height="13" fill="url(#gradientLang3)" opacity="0.9" rx="1"/>
      {/* Rupee symbol on right page */}
      <path d="M68 60 L68 70 M65 62 L71 62 M68 60 L72 60 L72 62 L68 62 M68 65 L72 65" 
            stroke="url(#gradientLang3)" strokeWidth="2" fill="none" opacity="0.9" strokeLinecap="round"/>
      <defs>
        <linearGradient id="gradientLang1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="1"/>
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="1"/>
        </linearGradient>
        <linearGradient id="gradientLang2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.8"/>
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.8"/>
        </linearGradient>
        <linearGradient id="gradientLang3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#667eea" stopOpacity="1"/>
          <stop offset="100%" stopColor="#764ba2" stopOpacity="1"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// Design/Creative Icon - Calendar with checkmark and dotted circle
function DesignIcon() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="60" r="58" fill="url(#gradientDesign1)" opacity="0.3"/>
      <circle cx="60" cy="60" r="45" fill="url(#gradientDesign2)"/>
      {/* Dotted circular path */}
      <circle cx="60" cy="60" r="35" fill="none" stroke="white" strokeWidth="2" strokeDasharray="3 3" opacity="0.4"/>
      {/* Calendar */}
      <rect x="45" y="50" width="30" height="28" rx="2" fill="white" opacity="0.95"/>
      {/* Calendar header */}
      <rect x="45" y="50" width="30" height="8" rx="2" fill="url(#gradientDesign3)" opacity="0.9"/>
      {/* Calendar grid lines */}
      <line x1="50" y1="58" x2="50" y2="78" stroke="url(#gradientDesign3)" strokeWidth="1" opacity="0.3"/>
      <line x1="55" y1="58" x2="55" y2="78" stroke="url(#gradientDesign3)" strokeWidth="1" opacity="0.3"/>
      <line x1="60" y1="58" x2="60" y2="78" stroke="url(#gradientDesign3)" strokeWidth="1" opacity="0.3"/>
      <line x1="65" y1="58" x2="65" y2="78" stroke="url(#gradientDesign3)" strokeWidth="1" opacity="0.3"/>
      <line x1="70" y1="58" x2="70" y2="78" stroke="url(#gradientDesign3)" strokeWidth="1" opacity="0.3"/>
      <line x1="45" y1="63" x2="75" y2="63" stroke="url(#gradientDesign3)" strokeWidth="1" opacity="0.3"/>
      <line x1="45" y1="68" x2="75" y2="68" stroke="url(#gradientDesign3)" strokeWidth="1" opacity="0.3"/>
      {/* Checkmark */}
      <circle cx="60" cy="65" r="4" fill="url(#gradientDesign3)" opacity="0.9"/>
      <path d="M57 65 L59 67 L63 63" stroke="white" strokeWidth="2" fill="none" 
            strokeLinecap="round" strokeLinejoin="round" opacity="0.95"/>
      <defs>
        <linearGradient id="gradientDesign1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="1"/>
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="1"/>
        </linearGradient>
        <linearGradient id="gradientDesign2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.8"/>
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.8"/>
        </linearGradient>
        <linearGradient id="gradientDesign3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ec4899" stopOpacity="1"/>
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="1"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// Basic/Beginner Icon
function BasicIcon() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="60" r="58" fill="url(#gradientBasic1)" opacity="0.3"/>
      <circle cx="60" cy="60" r="45" fill="url(#gradientBasic2)"/>
      {/* Book/Guide */}
      <rect x="45" y="50" width="30" height="25" rx="2" fill="white" opacity="0.9"/>
      <line x1="60" y1="50" x2="60" y2="75" stroke="url(#gradientBasic3)" strokeWidth="2" opacity="0.6"/>
      <circle cx="55" cy="60" r="2" fill="url(#gradientBasic3)" opacity="0.8"/>
      <circle cx="65" cy="65" r="2" fill="url(#gradientBasic3)" opacity="0.8"/>
      <defs>
        <linearGradient id="gradientBasic1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="1"/>
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="1"/>
        </linearGradient>
        <linearGradient id="gradientBasic2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8"/>
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.8"/>
        </linearGradient>
        <linearGradient id="gradientBasic3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="1"/>
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="1"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// Advanced/Expert Icon
function AdvancedIcon() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="60" r="58" fill="url(#gradientAdvanced1)" opacity="0.3"/>
      <circle cx="60" cy="60" r="45" fill="url(#gradientAdvanced2)"/>
      {/* Trophy/Award */}
      <path d="M50 65 L50 75 L70 75 L70 65 L65 60 L55 60 Z" fill="white" opacity="0.9"/>
      <path d="M55 50 L55 60 L65 60 L65 50 L63 48 L57 48 Z" fill="white" opacity="0.9"/>
      <circle cx="60" cy="52" r="4" fill="url(#gradientAdvanced3)" opacity="0.9"/>
      <defs>
        <linearGradient id="gradientAdvanced1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="1"/>
          <stop offset="100%" stopColor="#dc2626" stopOpacity="1"/>
        </linearGradient>
        <linearGradient id="gradientAdvanced2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.8"/>
          <stop offset="100%" stopColor="#f87171" stopOpacity="0.8"/>
        </linearGradient>
        <linearGradient id="gradientAdvanced3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="1"/>
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="1"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// Course Thumbnail Icon Component - selects icon based on topic
function CourseThumbnailIcon({ category, title }) {
  const iconType = getIconType(category, title);
  
  switch (iconType) {
    case 'marketing':
      return <MarketingIcon />;
    case 'stock':
      return <StockIcon />;
    case 'language':
      return <LanguageIcon />;
    case 'design':
      return <DesignIcon />;
    case 'basic':
      return <BasicIcon />;
    case 'advanced':
      return <AdvancedIcon />;
    case 'investment':
    default:
      return <InvestmentIcon />;
  }
}

export default function CourseCard({
  href,
  imageLabel,
  title,
  description,
  ratingText,
  studentsText,
  price,
  category,
  thumbnail,
  hoverAlign = 'left' // 'left' | 'right'
}) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const handleImageError = () => {
    setImageError(true);
    setImageLoading(false);
  };

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  // Check if thumbnail is a valid URL or path
  const isValidThumbnail = thumbnail && !imageError && (thumbnail.startsWith('http') || thumbnail.startsWith('/'));

  return (
    <div className="course-card-wrapper">
      <Link href={href} className="course-card">
        <div className="course-image">
          {isValidThumbnail ? (
            <>
              {imageLoading && (
                <div className="course-thumbnail-icon" style={{ position: 'absolute', zIndex: 1 }}>
                  <CourseThumbnailIcon category={category} title={title} />
                </div>
              )}
              <Image
                src={thumbnail}
                alt={title}
                fill
                className="course-thumbnail-image"
                style={{ objectFit: 'cover' }}
                onError={handleImageError}
                onLoad={handleImageLoad}
                unoptimized={thumbnail?.startsWith('http')}
              />
            </>
          ) : (
            <div className="course-thumbnail-icon">
              <CourseThumbnailIcon category={category} title={title} />
            </div>
          )}
        </div>
        <div className="course-content">
          <p className="course-description">{description}</p>

          <div className="course-meta">
            <div className="rating">
              <span className="stars">★★★★★</span>
              <span className="rating-text">{ratingText}</span>
            </div>
            <span className="students">{studentsText}</span>
          </div>

          <div className="course-footer">
            <span className="course-price">{price}</span>
            <span className="view-details">View Details</span>
          </div>
        </div>
      </Link>

      {/* Hover preview panel */}
      <div
        className={`course-hover-panel${
          hoverAlign === 'right' ? ' course-hover-panel-right' : ''
        }`}
      >
        <h3 className="course-hover-title">{title}</h3>
        <p className="course-hover-subtitle">{description}</p>
        <ul className="course-hover-list">
          <li>Unlock practical concepts with step‑by‑step recorded lessons.</li>
          <li>Learn at your own pace with lifetime access on mobile and desktop.</li>
          <li>Beginner‑friendly structure with clear explanations and examples.</li>
        </ul>
      </div>
    </div>
  );
}


