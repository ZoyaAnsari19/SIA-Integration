"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, MapPin, Trophy, Target, User } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useAppSelector } from "@/redux/hooks";

type Rank = {
  id: string;
  name: string;
  level: number;
  icon: string;
  color: string;
};

interface RankJourneyProps {
  ranks: Rank[];
  currentRankId: string;
}

export function RankJourney({ ranks, currentRankId }: RankJourneyProps) {
  const currentRankIndex = ranks.findIndex((r) => r.id === currentRankId);
  const user = useAppSelector((state) => state.auth.user);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);

  // Get profile photo from localStorage (user-specific) or use default
  useEffect(() => {
    if (typeof window !== "undefined" && user?.id) {
      const storedPhoto = localStorage.getItem(`profilePhoto_${user.id}`);
      if (storedPhoto) {
        setProfilePhoto(storedPhoto);
        return;
      }
    }
    // Default profile photo
    setProfilePhoto(
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&h=200&fit=crop&crop=faces",
    );
  }, [user?.id]);

  const getRankStatus = (index: number) => {
    if (index < currentRankIndex) return "completed";
    if (index === currentRankIndex) return "current";
    return "upcoming";
  };

  // Generate zigzag path coordinates
  const getPathCoordinates = () => {
    const points = [];
    // Increased total width for more spacing between levels
    const totalWidth = ranks.length * 30; // Each level gets ~30 units of space
    const segments = ranks.length;

    for (let i = 0; i < segments; i++) {
      const x = i * 30; // Fixed spacing of 30 units per level
      const y = 50 + (i % 2 === 0 ? -15 : 15); // Zigzag pattern
      points.push({ x, y });
    }
    return points;
  };

  const pathPoints = getPathCoordinates();

  // Generate SVG path string
  const getPathString = () => {
    if (pathPoints.length < 2) return "";

    let path = `M ${pathPoints[0].x} ${pathPoints[0].y}`;

    for (let i = 1; i < pathPoints.length; i++) {
      const prev = pathPoints[i - 1];
      const curr = pathPoints[i];
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2;

      // Create smooth curve
      path += ` Q ${midX} ${prev.y} ${midX} ${midY} T ${curr.x} ${curr.y}`;
    }

    // Extend path beyond last point to ensure it reaches the last rank center
    if (pathPoints.length > 0) {
      const lastPoint = pathPoints[pathPoints.length - 1];
      const viewBoxWidth = ranks.length * 30;
      // Extend path to the end of viewBox to reach last rank
      const extension = viewBoxWidth - lastPoint.x;
      if (extension > 0) {
        path += ` L ${viewBoxWidth} ${lastPoint.y}`;
      }
    }

    return path;
  };

  useEffect(() => {
    // Apply desktop transforms on mount/resize
    const applyDesktopTransforms = () => {
      if (typeof window !== "undefined" && window.innerWidth >= 768) {
        const rankElements = document.querySelectorAll(
          "[data-desktop-transform]",
        );
        rankElements.forEach((el) => {
          const transform = el.getAttribute("data-desktop-transform");
          if (transform) {
            (el as HTMLElement).style.transform = transform;
          }
        });
      } else {
        const rankElements = document.querySelectorAll(
          "[data-desktop-transform]",
        );
        rankElements.forEach((el) => {
          (el as HTMLElement).style.transform = "translateY(0)";
        });
      }
    };

    applyDesktopTransforms();
    window.addEventListener("resize", applyDesktopTransforms);
    return () => window.removeEventListener("resize", applyDesktopTransforms);
  }, []);

  return (
    <div className="relative w-full py-4 md:py-8 overflow-x-auto overflow-y-visible scroll-smooth">
      {/* Sky Background with Clouds */}
      <div 
        className="absolute inset-0 bg-gradient-to-b from-sky-100 to-blue-50 rounded-lg -z-10"
        style={{
          width: `${ranks.length * 340}px`,
          minWidth: "100%"
        }}
      >
        {/* Cloud decorations - hidden on mobile */}
        <div className="hidden md:block absolute top-4 left-8 w-16 h-8 bg-white/60 rounded-full blur-sm"></div>
        <div className="hidden md:block absolute top-6 left-12 w-12 h-6 bg-white/60 rounded-full blur-sm"></div>
        <div className="hidden md:block absolute top-8 right-16 w-20 h-10 bg-white/60 rounded-full blur-sm"></div>
        <div className="hidden md:block absolute top-10 right-20 w-14 h-7 bg-white/60 rounded-full blur-sm"></div>
      </div>

      {/* SVG Container for Road and Path - Desktop */}
      <svg
        className="hidden md:block absolute top-0 left-0 h-full z-0 pointer-events-none"
        style={{ 
          height: "300px", 
          overflow: "visible",
          width: `${ranks.length * 340}px`, // Match the actual content width (280px + 60px margin per rank)
          minWidth: "100%"
        }}
        viewBox={`0 0 ${ranks.length * 30} 100`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="roadGradient" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#4b5563" />
            <stop
              offset={`${((currentRankIndex + 1) / ranks.length) * 100}%`}
              stopColor="#4b5563"
            />
            <stop
              offset={`${((currentRankIndex + 1) / ranks.length) * 100}%`}
              stopColor="#9ca3af"
            />
            <stop offset="100%" stopColor="#9ca3af" />
          </linearGradient>
          <linearGradient
            id="progressGradient"
            x1="0%"
            y1="50%"
            x2="100%"
            y2="50%"
          >
            <stop offset="0%" stopColor="#10b981" />
            <stop
              offset={`${((currentRankIndex + 1) / ranks.length) * 100}%`}
              stopColor="#3b82f6"
            />
            <stop
              offset={`${((currentRankIndex + 1) / ranks.length) * 100}%`}
              stopColor="transparent"
            />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>

        {/* Road Shadow */}
        <path
          d={getPathString()}
          fill="none"
          stroke="#1f2937"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.3"
          transform="translate(0, 2)"
        />

        {/* Main Road Path */}
        <path
          d={getPathString()}
          fill="none"
          stroke="url(#roadGradient)"
          strokeWidth="4"
          strokeLinecap="round"
          className="transition-all duration-500"
        />

        {/* Progress Highlight */}
        <path
          d={getPathString()}
          fill="none"
          stroke="url(#progressGradient)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${((currentRankIndex + 1) / ranks.length) * 1000} 1000`}
          className="transition-all duration-500"
        />
      </svg>

      {/* SVG Container for Road and Path - Mobile Vertical */}
      <div className="md:hidden absolute top-0 left-0 w-full h-full z-0 pointer-events-none">
        <svg
          className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient
              id="roadGradientMobile"
              x1="50%"
              y1="0%"
              x2="50%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#4b5563" />
              <stop
                offset={`${((currentRankIndex + 1) / ranks.length) * 100}%`}
                stopColor="#4b5563"
              />
              <stop
                offset={`${((currentRankIndex + 1) / ranks.length) * 100}%`}
                stopColor="#9ca3af"
              />
              <stop offset="100%" stopColor="#9ca3af" />
            </linearGradient>
            <linearGradient
              id="progressGradientMobile"
              x1="50%"
              y1="0%"
              x2="50%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#10b981" />
              <stop
                offset={`${((currentRankIndex + 1) / ranks.length) * 100}%`}
                stopColor="#3b82f6"
              />
              <stop
                offset={`${((currentRankIndex + 1) / ranks.length) * 100}%`}
                stopColor="transparent"
              />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>

          {/* Road Shadow Mobile */}
          <path
            d={(() => {
              const segments = ranks.length - 1;
              let path = `M 50 5`;

              for (let i = 0; i < segments; i++) {
                const y1 = 5 + (i * 90) / segments;
                const y2 = 5 + ((i + 1) * 90) / segments;
                const x1 = 50 + (i % 2 === 0 ? -12 : 12);
                const x2 = 50 + ((i + 1) % 2 === 0 ? -12 : 12);
                const midY = (y1 + y2) / 2;

                path += ` Q ${x1} ${midY} ${x2} ${y2}`;
              }

              return path;
            })()}
            fill="none"
            stroke="#1f2937"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.2"
          />

          {/* Mobile Vertical Path - Main Road */}
          <path
            d={(() => {
              const segments = ranks.length - 1;
              let path = `M 50 5`;

              for (let i = 0; i < segments; i++) {
                const y1 = 5 + (i * 90) / segments;
                const y2 = 5 + ((i + 1) * 90) / segments;
                const x1 = 50 + (i % 2 === 0 ? -12 : 12);
                const x2 = 50 + ((i + 1) % 2 === 0 ? -12 : 12);
                const midY = (y1 + y2) / 2;

                path += ` Q ${x1} ${midY} ${x2} ${y2}`;
              }

              return path;
            })()}
            fill="none"
            stroke="url(#roadGradientMobile)"
            strokeWidth="5"
            strokeLinecap="round"
            className="transition-all duration-500"
          />

          {/* Progress Highlight Mobile */}
          <path
            d={(() => {
              const segments = ranks.length - 1;
              let path = `M 50 5`;

              for (let i = 0; i < segments; i++) {
                const y1 = 5 + (i * 90) / segments;
                const y2 = 5 + ((i + 1) * 90) / segments;
                const x1 = 50 + (i % 2 === 0 ? -12 : 12);
                const x2 = 50 + ((i + 1) % 2 === 0 ? -12 : 12);
                const midY = (y1 + y2) / 2;

                path += ` Q ${x1} ${midY} ${x2} ${y2}`;
              }

              return path;
            })()}
            fill="none"
            stroke="url(#progressGradientMobile)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${((currentRankIndex + 1) / ranks.length) * 1000} 1000`}
            className="transition-all duration-500"
          />
        </svg>
      </div>

      {/* Ranks - Positioned along zigzag path */}
      <div
        className="relative flex md:flex-row flex-col md:justify-start md:items-center items-start md:items-center gap-6 md:gap-0 z-10"
        style={{
          minHeight: "300px",
          paddingLeft: "20px",
          paddingRight: "20px",
          width: "max-content", // Allow content to determine width
          minWidth: "100%",
        }}
      >
        {ranks.map((rank, index) => {
          const status = getRankStatus(index);
          const isCompleted = status === "completed";
          const isCurrent = status === "current";
          const isUpcoming = status === "upcoming";
          const isLast = index === ranks.length - 1;

          // Calculate position based on path
          const point = pathPoints[index];
          const verticalOffset = (point.y - 50) * 3; // Scale for visual spacing

          // Mobile: calculate position for vertical path alignment
          const mobileYPosition = (index / (ranks.length - 1)) * 100;
          const isEvenIndex = index % 2 === 0;
          const mobileXOffset = isEvenIndex ? -12 : 12;

          return (
            <div
              key={rank.id}
              className="flex md:flex-col flex-row items-center gap-4 md:gap-0 w-full md:w-auto relative"
              style={{
                transform: `translateY(0)`,
                transition: "transform 0.3s ease",
                minWidth: "280px", // Fixed minimum width for each rank to create spacing
                flexShrink: 0, // Prevent shrinking
                marginRight: "60px", // Add spacing between ranks
              }}
              data-desktop-transform={`translateY(${verticalOffset}px)`}
            >
              {/* Location Pin Icon */}
              <div className="relative z-20 flex-shrink-0">
                {/* Pin Shadow - hidden on mobile */}
                <div className="hidden md:block absolute top-2 left-1/2 -translate-x-1/2 w-8 h-4 bg-black/20 rounded-full blur-sm"></div>

                {/* Pin Body - Background Layer */}
                <div
                  className={`relative w-14 h-14 md:w-14 md:h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 border-2 overflow-hidden z-10 ${
                    isLast && !isCompleted
                      ? "bg-yellow-400 border-yellow-500 ring-4 ring-yellow-200 scale-110 md:scale-125"
                      : isCompleted
                        ? "bg-blue-500 border-blue-600 ring-4 ring-blue-200 scale-105 md:scale-110"
                        : isCurrent
                          ? "bg-blue-500 border-blue-600 ring-4 ring-blue-200 scale-105 md:scale-110 animate-pulse"
                          : "bg-blue-300 border-blue-400 ring-2 ring-blue-100"
                  }`}
                >
                  {isCurrent && profilePhoto && !photoError ? (
                    // Show user profile picture for current rank
                    <img
                      src={profilePhoto}
                      alt={user?.name || "User"}
                      className="w-full h-full object-cover rounded-full"
                      onError={() => setPhotoError(true)}
                    />
                  ) : isLast && !isCompleted ? (
                    <Target className="w-6 h-6 md:w-7 md:h-7 text-yellow-800" />
                  ) : rank.icon.startsWith("/") || rank.icon.startsWith("http") ? (
                    <img
                      src={rank.icon}
                      alt={rank.name}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        // Fallback to emoji if image fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = document.createElement('div');
                        fallback.className = 'text-2xl md:text-3xl';
                        fallback.textContent = '🏆';
                        target.parentElement?.appendChild(fallback);
                      }}
                    />
                  ) : (
                    <div className="text-2xl md:text-3xl">{rank.icon}</div>
                  )}
                </div>

                {/* Current Rank Badge on Profile Picture - Upper Layer */}
                {isCurrent && profilePhoto && !photoError && (
                  <div className="absolute -top-1 -right-1 z-40">
                    {/* Small Silver Badge - Notification Style */}
                    <div className="relative bg-gradient-to-br from-zinc-200 via-zinc-300 to-zinc-400 rounded-full border-2 border-white shadow-lg flex items-center justify-center w-5 h-5 md:w-6 md:h-6">
                      {/* Silver medal icon - small */}
                      <div className="text-[10px] md:text-xs leading-none">
                        🥈
                      </div>
                    </div>
                  </div>
                )}

                {/* Pin Point - Small marker connecting to road - hidden on mobile */}
                <div
                  className={`hidden md:block absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-3 ${
                    isLast && !isCompleted
                      ? "bg-yellow-400"
                      : isCompleted || isCurrent
                        ? "bg-blue-500"
                        : "bg-blue-300"
                  } rounded-full`}
                ></div>

                {/* Mobile: Connection line to path */}
                <div
                  className={`md:hidden absolute top-1/2 left-1/2 -translate-x-1/2 w-1 h-6 ${
                    isLast && !isCompleted
                      ? "bg-yellow-400"
                      : isCompleted || isCurrent
                        ? "bg-blue-500"
                        : "bg-blue-300"
                  } rounded-full`}
                  style={{
                    transform: `translate(-50%, ${isEvenIndex ? "-100%" : "100%"})`,
                    top: isEvenIndex ? "-24px" : "auto",
                    bottom: isEvenIndex ? "auto" : "-24px",
                  }}
                ></div>

                {/* Sparkle Effects */}
                {(isCurrent || (isLast && !isCompleted)) && (
                  <>
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 md:w-3 md:h-3 bg-yellow-300 rounded-full animate-ping"></div>
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 md:w-2 md:h-2 bg-white rounded-full"></div>
                    <div className="absolute top-1 -left-2 w-2 h-2 md:w-2 md:h-2 bg-white rounded-full opacity-80"></div>
                    <div className="absolute -bottom-1 left-1 w-2 h-2 md:w-2 md:h-2 bg-white rounded-full opacity-60"></div>
                  </>
                )}
              </div>

              {/* Rank Info */}
              <div className="md:mt-6 md:text-center text-left flex-1 min-w-0">
                <div
                  className={`text-sm md:text-base font-bold mb-0.5 md:mb-1 inline-block px-2 py-1 rounded-md bg-white/80 dark:bg-black/40 backdrop-blur-sm ${
                    isCompleted
                      ? "text-emerald-700 dark:text-emerald-400"
                      : isCurrent
                        ? "text-blue-700 dark:text-blue-400"
                        : isLast
                          ? "text-zinc-700 dark:text-zinc-300"
                          : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {rank.name}
                </div>
                <div className="text-xs text-zinc-500 mb-1 md:mb-0">
                  Level {rank.level}
                </div>
                <div className="flex gap-1.5 md:gap-2 mt-1 md:mt-2 flex-wrap">
                  {isCurrent && (
                    <Badge
                      tone="blue"
                      soft={false}
                      className="text-[10px] md:text-xs px-1.5 py-0.5"
                    >
                      Current
                    </Badge>
                  )}
                  {isCompleted && (
                    <Badge
                      tone="green"
                      soft={false}
                      className="text-[10px] md:text-xs px-1.5 py-0.5"
                    >
                      ✓ Done
                    </Badge>
                  )}
                  {isLast && !isCompleted && (
                    <Badge
                      tone="amber"
                      soft={false}
                      className="text-[10px] md:text-xs px-2 py-1 font-semibold"
                    >
                      Goal
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress Indicator */}
      <div className="mt-6 md:mt-8 text-center relative z-10 px-2">
        <div className="inline-flex flex-wrap items-center justify-center gap-1.5 md:gap-2 bg-gradient-to-r from-blue-50 to-emerald-50 px-3 md:px-4 py-2 md:py-2.5 rounded-full shadow-sm border border-blue-100">
          <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-600 flex-shrink-0" />
          <span className="text-xs md:text-sm font-semibold text-blue-600">
            Progress: {currentRankIndex + 1} of {ranks.length} Ranks Completed
          </span>
          <span className="text-[10px] md:text-xs text-zinc-500">
            ({Math.round(((currentRankIndex + 1) / ranks.length) * 100)}%)
          </span>
        </div>
      </div>
    </div>
  );
}
