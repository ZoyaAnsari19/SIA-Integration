"use client";

import Link from "next/link";
import { ChevronRight, Play, Star, Users } from "lucide-react";
import LiquidEther from "@/app/components/LiquidEther";
import TrueFocus from "@/app/components/TrueFocus";
import TextType from "@/app/components/TextType";
import FuturisticBackdrop from "@/app/components/FuturisticBackdrop";

export default function HeroSection({
  scrollToCourses,
  scrollToAffiliate,
}: {
  scrollToCourses: () => void;
  scrollToAffiliate: () => void;
}) {
  return (
    <section className='relative bg-gradient-to-r from-black to-blue-800 text-white pt-8 pb-12 md:pt-12 md:pb-20 overflow-hidden'>
      {/* LiquidEther Background */}
      <div className='absolute inset-0 z-0'>
        <LiquidEther
          colors={["#5227FF", "#FF9FFC", "#B19EEF"]}
          mouseForce={20}
          cursorSize={100}
          isViscous={false}
          viscous={30}
          iterationsViscous={32}
          iterationsPoisson={32}
          resolution={0.5}
          isBounce={false}
          autoDemo={true}
          autoSpeed={0.5}
          autoIntensity={2.2}
          takeoverDuration={0.25}
          autoResumeDelay={3000}
          autoRampDuration={0.6}
        />
      </div>

      {/* Overlay to maintain readability */}
      <div className='absolute inset-0 bg-black/50 z-10'></div>

      <div className='container mx-auto px- relative z-20'>
        <div className='flex flex-col lg:flex-row items-center gap-12'>
          {/* Text Content */}
          <div className='flex-1 lg:text-left'>
            <div className='mb-4'>
              <TrueFocus
                sentence='Empowering Infinite Learning'
                manualMode={false}
                blurAmount={5}
                borderColor='blue'
                animationDuration={0.6}
                pauseBetweenAnimations={0.2}
                className='text-3xl md:text-5xl lg:text-6xl font-extrabold leading-tight whitespace-nowrap'
              />
            </div>
            <div className='text-xl md:text-2xl mb-6 text-blue-100 max-w-2xl mx-auto lg:mx-0'>
              <TextType
                text={[
                  "Master new skills, earn commissions, and grow with our digital",
                  "education platform.",
                ]}
                typingSpeed={75}
                pauseDuration={1500}
                showCursor={true}
                cursorCharacter='|'
              />
            </div>

            {/* Stats/Features */}
            <div className='flex flex-wrap justify-center lg:justify-start gap-8 mb-8'>
              <div className='flex items-center'>
                <Star className='text-yellow-400 mr-2' />
                <span>4.9/5 Rating</span>
              </div>
              <div className='flex items-center'>
                <Users className='text-blue-400 mr-2' />
                <span>10K+ Students</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className='flex flex-col sm:flex-row gap-4 justify-center lg:justify-start'>
              <button
                onClick={() => {
                  window.location.href = "https://app.secureinfiniteassociation.com/courses";
                }}
                className='bg-white text-blue-600 hover:bg-gray-100 font-bold rounded-lg w-60 h-15 transition-all duration-300 flex items-center justify-center'>
                Explore Courses
                <ChevronRight className='ml-2 w-5 h-5' />
              </button>
              <button
                onClick={scrollToAffiliate}
                className='bg-transparent border-2 border-white hover:bg-white/10 font-bold w-60 h-15 rounded-lg text-lg transition-all duration-300 flex items-center justify-center'>
                Join Affiliate Program
              </button>
            </div>
          </div>

          {/* Image Content */}
          <div className='flex-1 flex justify-center items-end'>
            <div className='relative w-full max-w-8xl h-[600px] flex items-end justify-center'>
              {/* Futuristic animated icon backdrop */}
              <FuturisticBackdrop iconCount={22} />

              {/* User provided PNG (transparent background) */}
              <img
                src='/images/Heroimg.png'
                alt='Futuristic Mentor'
                className='relative z-20 w-600 max-w-4xl h-auto object-contain object-bottom translate-y-10 md:translate-y-20 drop-shadow-[0_10px_30px_rgba(59,130,246,0.35)]'
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
