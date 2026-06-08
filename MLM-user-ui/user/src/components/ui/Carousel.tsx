"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type CarouselItem = string | { image_url: string; link?: string | null };

type CarouselProps = {
  items: CarouselItem[];
  autoPlayInterval?: number;
  className?: string;
};

export function Carousel({
  items,
  autoPlayInterval = 5000,
  className = "",
}: CarouselProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

  const getMovement = useCallback(() => {
    const track = trackRef.current;
    if (!track || !track.parentElement) return 0;
    const containerWidth = track.parentElement.offsetWidth;
    if (typeof window === "undefined") return containerWidth / 4;
    if (window.innerWidth <= 768) return containerWidth; // 1 item
    if (window.innerWidth <= 1024) return containerWidth / 3; // 3 items
    return containerWidth / 4; // 4 items
  }, []);

  const getMaxIndex = useCallback(() => {
    if (typeof window === "undefined") return items.length - 4;
    if (window.innerWidth <= 768) return items.length - 1;
    if (window.innerWidth <= 1024) return items.length - 3;
    return items.length - 4;
  }, [items.length]);

  const move = useCallback(
    (dir: -1 | 1) => {
      setIndex((prev) => {
        const maxIndex = getMaxIndex();
        if (dir === 1) return prev >= maxIndex ? 0 : prev + 1;
        return prev <= 0 ? maxIndex : prev - 1;
      });
    },
    [getMaxIndex],
  );

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const movement = getMovement();
    track.style.transform = `translateX(-${index * movement}px)`;
  }, [index, getMovement]);

  // Auto-play carousel
  useEffect(() => {
    if (isHovered || autoPlayInterval === 0) {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
        autoPlayRef.current = null;
      }
      return;
    }

    autoPlayRef.current = setInterval(() => {
      move(1);
    }, autoPlayInterval);

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [isHovered, move, autoPlayInterval]);

  useEffect(() => {
    const onResize = () => {
      const track = trackRef.current;
      if (!track) return;
      // reset
      setIndex(0);
      track.style.transition = "none";
      track.style.transform = `translateX(0px)`;
      setTimeout(() => {
        track.style.transition = "transform 0.4s ease-in-out";
      }, 50);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const getVisibleCount = () => {
    if (typeof window === "undefined") return 3;
    if (window.innerWidth <= 768) return 0;
    if (window.innerWidth <= 1024) return 2;
    return 3;
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        ref={trackRef}
        className="flex transition-transform duration-500 ease-in-out"
        style={{ transform: "translateX(0)" }}
      >
        {items.map((item, i) => {
          const imageUrl = typeof item === 'string' ? item : item.image_url;
          const link = typeof item === 'string' ? null : item.link;
          const content = (
            <div className="relative overflow-hidden rounded-xl">
              <img
                src={imageUrl}
                alt={`Banner ${i + 1}`}
                className="w-full h-[180px] object-cover brightness-95 group-hover:brightness-105 group-hover:scale-105 transition-all duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>
          );
          return (
            <div
              key={i}
              className="min-w-full md:min-w-1/3 lg:min-w-1/4 pr-[15px] box-border cursor-pointer group"
            >
              {link ? (
                <a href={link} target="_blank" rel="noopener noreferrer" className="block">
                  {content}
                </a>
              ) : (
                content
              )}
            </div>
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-y-1/2 -translate-y-1/2 left-0 right-0 flex justify-between px-2">
        <button
          onClick={() => move(-1)}
          className="pointer-events-auto rounded-full bg-blue-600/90 backdrop-blur-sm text-white p-4 shadow-lg hover:bg-blue-600 hover:scale-110 transition-all duration-300 opacity-0 group-hover:opacity-100 flex items-center justify-center"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-6 h-8" />
        </button>
        <button
          onClick={() => move(1)}
          className="pointer-events-auto rounded-full bg-blue-600/90 backdrop-blur-sm text-white p-4 shadow-lg hover:bg-blue-600 hover:scale-110 transition-all duration-300 opacity-0 group-hover:opacity-100 flex items-center justify-center"
          aria-label="Next slide"
        >
          <ChevronRight className="w-6 h-8" />
        </button>
      </div>
      {/* Dot Indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none">
        {items.map((_, i) => {
          const maxIndex = getMaxIndex();
          const visibleCount = getVisibleCount();
          const isActive = i >= index && i <= index + visibleCount;
          return (
            <button
              key={i}
              onClick={() => setIndex(Math.min(i, maxIndex))}
              className={`pointer-events-auto h-2 rounded-full transition-all duration-300 ${
                isActive ? "w-8 bg-white" : "w-2 bg-white/50 hover:bg-white/75"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          );
        })}
      </div>
    </div>
  );
}

export default Carousel;
