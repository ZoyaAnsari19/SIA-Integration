"use client";

import { ChevronRight, Star, Users } from "lucide-react";
import TrueFocus from "@/app/components/TrueFocus";
import TextType from "@/app/components/TextType";

// NOTE: LiquidEther and FuturisticBackdrop have been removed for a cleaner mobile experience

export default function HeroSectionMobile({
  scrollToCourses,
  scrollToAffiliate,
}: {
  scrollToCourses: () => void;
  scrollToAffiliate: () => void;
}) {
  return (
    <section className='relative bg-gradient-to-r from-black to-blue-800 text-white pt-20 pb-16 overflow-hidden'>
      {/* Overlay to maintain readability on the gradient */}
      <div className='absolute inset-0 bg-black/50 z-10'></div>

      <div className='container mx-auto px-6 relative z-20'>
        {/* Stacked, centered layout for mobile */}
        <div className='flex flex-col items-center text-center gap-8'>
          {/* Text Content - Moved image below buttons */}
          <div className='w-full'>
            <div className='mb-4'>
              <TrueFocus
                sentence='Empowering Infinite Learning'
                manualMode={false}
                blurAmount={5}
                borderColor='blue'
                animationDuration={0.6}
                pauseBetweenAnimations={0.2}
                // Simplified text size for mobile-only component
                className='text-3xl font-extrabold leading-tight whitespace-nowrap'
              />
            </div>
            <div className='text-xl mb-6 text-blue-100 max-w-2xl mx-auto'>
              <TextType
                text={[
                  "Master new skills, earn commissions",
                  " and grow with our digital education platform.",
                ]}
                typingSpeed={75}
                pauseDuration={1500}
                showCursor={true}
                cursorCharacter='|'
              />
            </div>

            {/* Stats/Features - Centered by default */}
            <div className='flex flex-wrap justify-center gap-6 mb-8'>
              <div className='flex items-center'>
                <Star className='text-yellow-400 mr-2' />
                <span>4.9/5 Rating</span>
              </div>
              <div className='flex items-center'>
                <Users className='text-blue-400 mr-2' />
                <span>10K+ Students</span>
              </div>
            </div>

            {/* CTA Buttons - Arranged in a single row with reduced size */}
            <div className='flex flex-row gap-3 w-full max-w-sm  justify-center'>
              <button
                onClick={() => {
                  window.location.href = "https://app.secureinfiniteassociation.com/courses";
                }}
                className='bg-white text-blue-600 hover:bg-gray-100 font-bold py-2 px-2 rounded-lg text-base transition-all duration-300 flex items-center justify-center'>
                Explore Courses
                <ChevronRight className='ml-1.5 w-4 h-4' />
              </button>
              <button
                onClick={scrollToAffiliate}
                className='bg-transparent border-2 border-white hover:bg-white/10 font-bold py-2.5 px-6 rounded-lg text-base transition-all duration-300 flex items-center justify-center'>
                Join Affiliate
              </button>
            </div>
          </div>

          {/* Image Content - Moved below buttons */}
          <div className='w-full max-w-xs sm:max-w-sm mt-4'>
            {/* - Removed the fixed-height wrapper and backdrop.
              - Removed translate-y to prevent spacing issues.
            */}
            <img
              src='/sheikh-bilal.png'
              alt='Futuristic Mentor'
              className='w-full h-auto object-contain object-bottom drop-shadow-[0_10px_30px_rgba(59,130,246,0.35)]'
            />
          </div>
        </div>
      </div>
    </section>
  );
}
