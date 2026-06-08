"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import HeroSection from "@/app/components/sections/HeroSection";
import HeroSectionMobile from "@/app/components/sections/HeroSectionMobile";
import AboutSection from "@/app/components/sections/AboutSection";
import CoursesSection from "@/app/components/sections/CoursesSection";
import AffiliateSection from "@/app/components/sections/AffiliateSection";
import ContactSection from "@/app/components/sections/ContactSection";
import CtaSection from "@/app/components/sections/CtaSection";
import TestimonialsSection from "@/app/components/TestimonialsSection";
import TeamSection from "@/app/components/sections/TeamSection";
// import LogoLoop from "@/components/LogoLoop";
import SplashCursor from "@/components/SplashCursor";
import {
  SiReact,
  SiNextdotjs,
  SiTypescript,
  SiTailwindcss,
} from "react-icons/si";
import {
  FaAngleLeft,
  FaArrowDown,
  FaArrowLeft,
  FaArrowRight,
  FaBaby,
  FaBook,
  FaBookDead,
  FaBookOpen,
  FaGripLinesVertical,
  FaLaptopCode,
  FaLaptopMedical,
  FaLine,
  FaStar,
  FaStarAndCrescent,
  FaTasks,
} from "react-icons/fa";
import {
  Fa0,
  FaAnglesDown,
  FaAnglesLeft,
  FaAnglesUp,
  FaBookBookmark,
  FaComputer,
  FaPenClip,
} from "react-icons/fa6";
import { Book, Dot } from "lucide-react";

export default function Home() {
  // Refs for section scrolling
  const homeRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);
  const coursesRef = useRef<HTMLDivElement>(null);
  const affiliateRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLDivElement>(null);

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  };

  const techLogos = [
    {
      node: <div className='w-0.5 h-0.5 mb-7 bg-white'></div>,
    },
    {
      node: (
        <img
          src='/images/teamMember/RahulSir.png'
          alt='Circular Image'
          className='w-10 h-10 rounded-full object-cover'
        />
      ),
    },
    {
      node: <div className='w-0.5 h-0.5 mb-7 bg-white'></div>,
    },
    {
      node: (
        <img
          src='/images/teamMember/Shankkar.jpg'
          alt='Circular Image'
          className='w-10 h-10 rounded-full object-cover'
        />
      ),
    },
    {
      node: <div className='w-0.5 h-0.5 mb-7 bg-white'></div>,
    },
    {
      node: (
        <img
          src='/images/teamMember/Rajesh.png'
          alt='Circular Image'
          className='w-10 h-10 rounded-full object-cover'
        />
      ),
    },
    {
      node: <div className='w-0.5 h-0.5 mb-7 bg-white'></div>,
    },
    {
      node: (
        <img
          src='/images/teamMember/SnehalLata.png'
          alt='Circular Image'
          className='w-10 h-10 rounded-full object-cover'
        />
      ),
    },
    {
      node: <div className='w-0.5 h-0.5 mb-7  bg-white'></div>,
    },
    {
      node: (
        <img
          src='/images/teamMember/chanda.png'
          alt='Circular Image'
          className='w-10 h-10 rounded-full object-cover'
        />
      ),
    },
    {
      node: <div className='w-0.5 h-0.5 mb-7 bg-white'></div>,
    },
    {
      node: (
        <img
          src='/images/teamMember/sunil.png'
          alt='Circular Image'
          className='w-10 h-8 rounded-full object-cover'
        />
      ),
    },
  ];

  return (
    <div className='min-h-screen'>
      {/* Hero Section - Responsive Implementation */}
      <div ref={homeRef} id='home'>
        {/* Show HeroSectionMobile on small screens (hidden on md and up) */}
        <div className='md:hidden'>
          <HeroSectionMobile
            scrollToCourses={() => scrollToSection(coursesRef)}
            scrollToAffiliate={() => scrollToSection(affiliateRef)}
          />
        </div>

        {/* Show the original HeroSection on md screens and larger (hidden by default) */}
        <div className='hidden md:block'>
          <HeroSection
            scrollToCourses={() => scrollToSection(coursesRef)}
            scrollToAffiliate={() => scrollToSection(affiliateRef)}
          />
        </div>
      </div>

      {/* Technology Logos Loop */}
      {/* <div className='py-8 md:py-12 bg-gradient-to-r dark:from-gray-900 dark:to-gray-900'>
        <div
          style={{
            height: "120px",
            position: "relative",
            overflow: "hidden",
          }}>
          <LogoLoop
            logos={techLogos}
            speed={100}
            direction='right'
            logoHeight={38}
            gap={100}
            pauseOnHover
            scaleOnHover
            ariaLabel='Technology partners'
          />
        </div>
      </div> */}

      {/* Sections with SplashCursor effect - wrapped in a relative container */}
      <div className='relative z-0'>
        <SplashCursor
          SIM_RESOLUTION={64}
          DYE_RESOLUTION={512}
          SPLAT_FORCE={3000}
          DENSITY_DISSIPATION={2.5}
          VELOCITY_DISSIPATION={1.5}
        />

        {/* About Section */}
        <div ref={aboutRef} id='about'>
          <AboutSection />
        </div>

        {/* Courses Section */}
        <div ref={coursesRef} id='courses'>
          <CoursesSection />
        </div>

        {/* Affiliate Section */}
        <div ref={affiliateRef} id='affiliate'>
          <AffiliateSection />
        </div>

        {/* Testimonials Section */}
        <TestimonialsSection />

        {/* Team Section */}
        <TeamSection />

        {/* Contact Section */}
        <div ref={contactRef} id='contact'>
          <ContactSection />
        </div>

        {/* CTA Section */}
        <CtaSection />
      </div>
    </div>
  );
}
