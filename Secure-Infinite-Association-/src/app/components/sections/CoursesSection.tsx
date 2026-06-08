"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  Star,
  TrendingUp,
  Clock,
  Users,
  Zap,
  Shield,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function CoursesSection() {
  // Refs for scrollable containers
  const latestCoursesRef = useRef<HTMLDivElement>(null);

  // Consistent number formatting to prevent hydration errors
  const formatNumber = (num: number) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Scroll functions - improved for mobile
  const scrollLeft = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref.current) {
      // Get the actual width of the container for more accurate scrolling
      const containerWidth = ref.current.offsetWidth;
      const scrollAmount = containerWidth * 0.8; // Scroll 80% of container width
      ref.current.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    }
  };

  const scrollRight = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref.current) {
      // Get the actual width of the container for more accurate scrolling
      const containerWidth = ref.current.offsetWidth;
      const scrollAmount = containerWidth * 0.8; // Scroll 80% of container width
      ref.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  // Latest courses data (newest releases) - 6 courses as per screenshot
  const latestCourses = [
    {
      id: 6,
      title: "English Speaking",
      category: "Investment",
      instructor: "Secure Academy",
      duration: "10 hours",
      price: 7500,
      originalPrice: 7500,
      rating: 3.0,
      students: 1500,
      level: "Beginner",
      image: "/courses image thubnails/ENGLISH SPEAKING MASTERY PROGRAM.png",
      description:
        "Unlock the secrets of successful investment strategies and build your financial foundation.",
      isLatest: true,
      badge: "New Release",
    },
    {
      id: 5,
      title: "Digital Marketing",
      category: "Investment",
      instructor: "Secure Academy",
      duration: "20 hours",
      price: 1500,
      originalPrice: 1500,
      rating: 3.0,
      students: 500,
      level: "Professional",
      image: "/courses image thubnails/digitak marketing.png",
      description:
        "Secure Academy, Secure your future with comprehensive professional investment training.",
      isLatest: true,
      badge: "New Release",
    },
    {
      id: 4,
      title: "Share Market Learning",
      category: "Investment",
      instructor: "Secure Academy",
      duration: "15 hours",
      price: 30000,
      originalPrice: 30000,
      rating: 3.0,
      students: 600,
      level: "Expert",
      image: "/courses image thubnails/SHARE MARKET LEARNING TRADE LIKE A PRO.png",
      description:
        "Secure Academy, Secure your future with expert-level investment training and mentorship.",
      isLatest: true,
      badge: "New Release",
    },
    {
      id: 7,
      title: "Graphic Designing and video editing",
      category: "Investment",
      instructor: "Secure Academy",
      duration: "12 hours",
      price: 50000,
      originalPrice: 50000,
      rating: 5.0,
      students: 900,
      level: "Advanced",
      image: "/courses image thubnails/Graphics desing.png",
      description:
        "Secure Academy, Secure your future with advanced investment strategies and techniques.",
      isLatest: true,
      badge: "New Release",
    },
    {
      id: 2,
      title: "Personality Development + Financial Planing",
      category: "Investment",
      instructor: "Secure Academy",
      duration: "12 hours",
      price: 100000,
      originalPrice: 100000,
      rating: 3.0,
      students: 800,
      level: "Intermediate",
      image: "/courses image thubnails/PERSONALITY DEVELOPMENT.png",
      description:
        "This course offers detailed insights into advanced investment techniques and market analysis.",
      isLatest: true,
      badge: "New Release",
    },
    {
      id: 1,
      title: "Artificial Intelligence",
      category: "Investment",
      instructor: "Secure Academy",
      duration: "8 hours",
      price: 300000,
      originalPrice: 300000,
      rating: 3.0,
      students: 1200,
      level: "Basic",
      image: "/courses image thubnails/ARTIFICIAL INTELLIGENCE.png",
      description:
        "Unlock the secrets of successful investment strategies and build your financial foundation.",
      isLatest: true,
      badge: "New Release",
    },
    {
      id: 8,
      title: "Cyber Security",
      category: "Investment",
      instructor: "Secure Academy",
      duration: "16 hours",
      price: 500000,
      originalPrice: 500000,
      rating: 3.0,
      students: 700,
      level: "Expert",
      image: "/courses image thubnails/CYBER SECURITY.png",
      description:
        "Secure Academy, Secure your future with expert-level cyber security training and protection strategies.",
      isLatest: true,
      badge: "New Release",
    },
  ];

  // Modern Course Card Component
  const CourseCard = ({
    course,
  }: {
    course: {
      id: number;
      title: string;
      category: string;
      instructor: string;
      duration: string;
      price: number;
      originalPrice: number;
      rating: number;
      students: number;
      level: string;
      image: string;
      description: string;
      badge: string;
    };
  }) => {
    // Generate course URL based on course title
    const getCourseUrl = (courseTitle: string, courseId: number) => {
      const titleLower = courseTitle.toLowerCase();
      
      // Special cases for courses with specific URLs
      const courseUrlMap: { [key: string]: string } = {
        "digital marketing": "https://app.secureinfiniteassociation.com/course/digital-marketing",
        "english speaking": "https://app.secureinfiniteassociation.com/course/english-speaking",
        "share market learning": "https://app.secureinfiniteassociation.com/course/share-market-learning",
        "graphic designing and video editing": "https://app.secureinfiniteassociation.com/course/graphic-designing-video-editing",
        "financial market course": "https://app.secureinfiniteassociation.com/course/financial-market-course",
        "basic investment course": "https://app.secureinfiniteassociation.com/course/basic-investment-course",
      };
      
      // Check if course has a specific URL mapping
      if (courseUrlMap[titleLower]) {
        return courseUrlMap[titleLower];
      }
      
      // Default URL for other courses
      return "https://app.secureinfiniteassociation.com/courses";
    };

    const courseUrl = getCourseUrl(course.title, course.id);

    return (
      <Link
        href={courseUrl}
        target='_blank'
        rel='noopener noreferrer'
        className='block'>
        <div className='group relative bg-gradient-to-br from-white/10 to-white/5 dark:from-gray-800/50 dark:to-gray-900/50 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 rounded-2xl overflow-hidden hover:scale-105 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/20 flex flex-col h-full cursor-pointer'>
          {/* Animated Background */}
          <div className='absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500' />

          {/* Badge */}
          <div className='absolute top-3 left-3 z-10'>
            <span
              className={`px-2 py-1 rounded-full text-xs font-bold backdrop-blur-sm ${
                course.badge === "Most Popular"
                  ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-white"
                  : course.badge === "Highest Rated"
                  ? "bg-gradient-to-r from-green-400 to-emerald-500 text-white"
                  : course.badge === "Best Seller"
                  ? "bg-gradient-to-r from-purple-400 to-pink-500 text-white"
                  : course.badge === "New Release"
                  ? "bg-gradient-to-r from-blue-400 to-cyan-500 text-white"
                  : course.badge === "Just Added"
                  ? "bg-gradient-to-r from-indigo-400 to-purple-500 text-white"
                  : course.badge === "Trending"
                  ? "bg-gradient-to-r from-red-400 to-pink-500 text-white"
                  : course.badge === "Premium"
                  ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-white"
                  : course.badge === "Elite"
                  ? "bg-gradient-to-r from-gray-600 to-gray-800 text-white"
                  : "bg-gradient-to-r from-teal-400 to-blue-500 text-white"
              }`}>
              {course.badge}
            </span>
          </div>

          {/* Price */}
          <div className='absolute top-3 right-3 z-10'>
            <div className='bg-gradient-to-r from-blue-600 to-purple-600 text-white px-2 py-1 rounded-full text-xs sm:text-sm font-bold backdrop-blur-sm'>
              ₹{formatNumber(course.price)}
            </div>
          </div>

          {/* Course Image/Icon */}
          <div className='h-32 sm:h-40 md:h-48 relative overflow-hidden flex items-center justify-center'>
            <img
              src={course.image}
              alt={course.title}
              className='max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-110'
            />
            <div className='absolute inset-0 bg-gradient-to-t from-black/50 to-transparent' />
          </div>

          {/* Content */}
          <div className='p-3 sm:p-4 md:p-6 relative z-10 flex flex-col flex-grow'>
            {/* Level Badge */}
            <div className='flex flex-wrap gap-2 mb-3'>
              <span className='inline-block bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-600 dark:text-blue-400 text-xs px-2 py-1 rounded-full font-medium'>
                {course.category}
              </span>
              <span className='inline-block bg-gradient-to-r from-gray-500/20 to-gray-600/20 text-gray-600 dark:text-gray-400 text-xs px-2 py-1 rounded-full font-medium'>
                {course.level}
              </span>
            </div>

            {/* Title */}
            <h3 className='text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2'>
              {course.title}
            </h3>

            {/* Instructor */}
            <p className='text-gray-600 dark:text-gray-400 text-xs sm:text-sm mb-3 flex items-center'>
              <Shield className='w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-blue-500 flex-shrink-0' />
              {course.instructor}
            </p>

            {/* Description */}
            <p className='text-gray-700 dark:text-gray-300 text-xs sm:text-sm mb-4 line-clamp-2 flex-grow'>
              {course.description}
            </p>

            {/* Stats */}
            <div className='flex justify-between text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-4'>
              <span className='flex items-center'>
                <Clock className='w-3 h-3 sm:w-4 sm:h-4 mr-1' />
                {course.duration}
              </span>
              <span className='flex items-center'>
                <Users className='w-3 h-3 sm:w-4 sm:h-4 mr-1' />
                {formatNumber(course.students)}
              </span>
            </div>

            {/* Rating and CTA */}
            <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mt-auto'>
              <div className='flex items-center'>
                <div className='flex items-center'>
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3 h-3 sm:w-4 sm:h-4 ${
                        i < Math.floor(course.rating)
                          ? "text-yellow-400 fill-current"
                          : "text-gray-300 dark:text-gray-600"
                      }`}
                    />
                  ))}
                </div>
                <span className='font-bold text-gray-900 dark:text-white ml-1 sm:ml-2 text-xs sm:text-sm'>
                  {course.rating}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Redirect to the course URL (same tab)
                  window.location.href = courseUrl;
                }}
                className='w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-3 sm:px-4 py-2 rounded-lg font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg text-center text-xs sm:text-sm'>
                View Details
              </button>
            </div>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <section className='py-20 bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-gray-900 dark:via-blue-900/20 dark:to-purple-900/20 relative overflow-hidden'>
      {/* Background Effects */}
      <div className='absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.1),transparent_50%)]' />
      <div className='absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(147,51,234,0.1),transparent_50%)]' />

      <div className='container mx-auto px-4 relative z-10'>
        {/* Latest Courses Section */}
        <div>
          <div className='text-center mb-12'>
            <div className='inline-flex items-center gap-2 bg-gradient-to-r from-green-600 to-teal-600 text-white px-4 py-2 rounded-full text-sm font-bold mb-4'>
              <Zap className='w-4 h-4' />
              NEW RELEASES
            </div>
            <h2 className='text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-900 via-green-900 to-teal-900 dark:from-white dark:via-green-100 dark:to-teal-100 bg-clip-text text-transparent mb-4'>
              Top 7 Latest Courses
            </h2>
            <p className='text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto'>
              Explore our newest courses with cutting-edge content and
              innovative learning approaches.
            </p>
          </div>

          <div className='relative'>
            {/* Left Arrow - improved for mobile */}
            <button
              onClick={() => scrollLeft(latestCoursesRef)}
              className='absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-gradient-to-r from-green-600/90 to-teal-600/90 hover:from-green-700 hover:to-teal-700 text-white p-3 sm:p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110 backdrop-blur-sm'
              aria-label='Scroll left'>
              <ChevronLeft size={8} className='sm:w-2 sm:h-2' />
            </button>

            {/* Right Arrow - improved for mobile */}
            <button
              onClick={() => scrollRight(latestCoursesRef)}
              className='absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-gradient-to-r from-green-600/90 to-teal-600/90 hover:from-green-700 hover:to-teal-700 text-white p-3 sm:p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110 backdrop-blur-sm'
              aria-label='Scroll right'>
              <ChevronRight size={8} className='sm:w-2 sm:h-2' />
            </button>

            <div
              ref={latestCoursesRef}
              className='flex gap-4 sm:gap-6 overflow-x-auto pb-4 scrollbar-hide px-8 sm:px-12'
              // Add touch handling for mobile
              onTouchMove={(e) => {
                // Prevent default to ensure smooth scrolling on touch devices
                e.stopPropagation();
              }}>
              {latestCourses.map((course) => (
                <div
                  key={course.id}
                  className='flex-shrink-0 w-64 sm:w-72 md:w-80'>
                  <CourseCard course={course} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
