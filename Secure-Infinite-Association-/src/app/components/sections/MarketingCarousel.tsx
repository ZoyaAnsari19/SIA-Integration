"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const images = [
  "/images/Marketing loop/32.png",
  "/images/Marketing loop/33.png",
  "/images/Marketing loop/34.png",
  "/images/Marketing loop/35.png",
  "/images/Marketing loop/36.png",
  "/images/Marketing loop/37.png",
  "/images/Marketing loop/38.png",
  "/images/Marketing loop/39.png",
  "/images/Marketing loop/40.png",
];

export default function MarketingCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto-advance slides
  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? images.length - 1 : prevIndex - 1
    );
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  // Pause auto-play on hover
  const handleMouseEnter = () => {
    setIsAutoPlaying(false);
  };

  const handleMouseLeave = () => {
    setIsAutoPlaying(true);
  };

  return (
    <section className='py-8'>
      <div className='container mx-auto px-0'>
        <div
          className='relative max-w-6xl mx-auto rounded-2xl overflow-hidden shadow-xl bg-gradient-to-br from-white/80 to-white/50 dark:from-gray-800/50 dark:to-gray-900/50 backdrop-blur-xl border border-white/50 dark:border-gray-700/50'
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}>
          {/* Main carousel container */}
          <div className='relative h-[300px] md:h-[500px] overflow-hidden'>
            {/* Slides */}
            <div
              className='flex transition-transform duration-500 ease-in-out h-full'
              style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
              {images.map((image, index) => (
                <div
                  key={index}
                  className='w-full flex-shrink-0 flex items-center justify-center p-4 md:p-8'>
                  <img
                    src={image}
                    alt={`Marketing campaign ${index + 1}`}
                    className='relative z-10 max-h-full max-w-full object-contain rounded-lg shadow-lg hover:scale-105 transition-transform duration-300'
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Navigation arrows */}
          <button
            onClick={goToPrevious}
            className='absolute left-4 top-1/2 -translate-y-1/2 bg-white/30 dark:bg-gray-800/50 backdrop-blur-sm rounded-full p-2 md:p-3 shadow-lg hover:bg-white/50 dark:hover:bg-gray-700/50 transition-all duration-300 z-10'
            aria-label='Previous image'>
            <ChevronLeft className='w-6 h-6 text-gray-800 dark:text-white' />
          </button>

          <button
            onClick={goToNext}
            className='absolute right-4 top-1/2 -translate-y-1/2 bg-white/30 dark:bg-gray-800/50 backdrop-blur-sm rounded-full p-2 md:p-3 shadow-lg hover:bg-white/50 dark:hover:bg-gray-700/50 transition-all duration-300 z-10'
            aria-label='Next image'>
            <ChevronRight className='w-6 h-6 text-gray-800 dark:text-white' />
          </button>

          {/* Dots indicator */}
          <div className='absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2'>
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? "bg-blue-600 dark:bg-blue-400 w-6"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
