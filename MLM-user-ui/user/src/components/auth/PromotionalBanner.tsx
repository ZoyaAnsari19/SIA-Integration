"use client";

import React from "react";
import { BookOpen, Smartphone } from "lucide-react";

export function PromotionalBanner() {
  return (
    <div className="hidden lg:flex flex-col items-center justify-center relative h-full w-full bg-gradient-to-br from-purple-900 via-purple-800 to-blue-900 overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20">
        {/* Circles */}
        <div className="absolute top-20 left-20 w-64 h-64 border-2 border-white rounded-full"></div>
        <div className="absolute top-40 right-20 w-48 h-48 border-2 border-white rounded-full"></div>
        <div className="absolute bottom-20 left-40 w-32 h-32 border-2 border-white rounded-full"></div>
        <div className="absolute top-1/2 left-1/4 w-40 h-40 border-2 border-white rounded-full"></div>

        {/* Chart-like patterns (Candlestick chart) */}
        <div className="absolute top-32 right-32 flex items-end gap-1">
          <div className="w-3 h-16 bg-white rounded-sm"></div>
          <div className="w-3 h-12 bg-white rounded-sm"></div>
          <div className="w-3 h-20 bg-white rounded-sm"></div>
          <div className="w-3 h-8 bg-white rounded-sm"></div>
          <div className="w-3 h-14 bg-white rounded-sm"></div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center px-8 py-12 text-center h-full">
        {/* Logo */}
        <div className="mb-10 w-28 h-28 rounded-full bg-white border-2 border-white/30 flex items-center justify-center shadow-lg">
          <div className="text-center px-2">
            <div className="text-zinc-900 font-bold text-[10px] leading-tight mb-0.5">
              SECURE
            </div>
            <div className="text-zinc-900 font-bold text-[10px] leading-tight mb-0.5">
              INVESTMENT
            </div>
            <div className="text-zinc-900 font-bold text-[10px] leading-tight">
              ACADEMY
            </div>
          </div>
        </div>

        {/* Main Text */}
        <h1 className="text-6xl md:text-7xl font-extrabold text-yellow-400 mb-6 drop-shadow-2xl tracking-tight">
          LEARN & EARN
        </h1>

        <p className="text-3xl md:text-4xl font-bold text-white mb-16 tracking-wide">
          JOIN NOW
        </p>

        {/* Illustrations */}
        <div className="flex items-end justify-center gap-12 mt-auto mb-12">
          {/* Book Icon */}
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 border-2 border-white rounded-full flex items-center justify-center bg-white/5 backdrop-blur-sm">
              <BookOpen className="w-12 h-12 text-white" strokeWidth={1.5} />
            </div>
          </div>

          {/* Phone Icon */}
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 border-2 border-white rounded-full flex items-center justify-center bg-white/5 backdrop-blur-sm">
              <Smartphone className="w-12 h-12 text-white" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="mt-auto pt-6">
          <p className="text-white text-sm font-medium">
            info@mysecureinvestment.com
          </p>
        </div>
      </div>
    </div>
  );
}
