"use client";

import {
  BookOpen,
  Users,
  Shield,
  TrendingUp,
  Star,
  Award,
  Heart,
  Lightbulb,
} from "lucide-react";
import CountUp from "@/app/components/CountUp";
import Orb from "@/app/components/Orb";

export default function AboutSection() {
  const values = [
    {
      icon: <BookOpen className='w-8 h-8' />,
      title: "Education First",
      description:
        "We prioritize quality education and skill development above all else.",
    },
    {
      icon: <Users className='w-8 h-8' />,
      title: "Community Focused",
      description: "Building a strong community of learners and educators.",
    },
    {
      icon: <Shield className='w-8 h-8' />,
      title: "Transparency",
      description:
        "Fully compliant with Indian laws and transparent in all our operations.",
    },
    {
      icon: <TrendingUp className='w-8 h-8' />,
      title: "Growth Oriented",
      description:
        "Helping individuals achieve personal and professional growth.",
    },
    {
      icon: <Heart className='w-8 h-8' />,
      title: "Ethical Practices",
      description:
        "Committed to ethical business practices and social responsibility.",
    },
    {
      icon: <Lightbulb className='w-8 h-8' />,
      title: "Innovation",
      description:
        "Continuously innovating to provide cutting-edge learning experiences.",
    },
    {
      icon: <Award className='w-8 h-8' />,
      title: "Quality Assurance",
      description: "Maintaining the highest standards in all our offerings.",
    },
    {
      icon: <Star className='w-8 h-8' />,
      title: "Excellence",
      description: "Striving for excellence in everything we do.",
    },
  ];

  const stats = [
    { to: 10000, suffix: "+", label: "Students", separator: "," },
    { to: 50, suffix: "+", label: "Courses" },
    { to: 200, suffix: "+", label: "Affiliates" },
    { to: 95, suffix: "%", label: "Satisfaction Rate" },
  ];

  return (
    <section className='relative py-20 bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-gray-900 dark:via-blue-900/20 dark:to-purple-900/20 overflow-hidden'>
      {/* Background Effects */}
      <div className='absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.1),transparent_50%)]' />
      <div className='absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(147,51,234,0.1),transparent_50%)]' />

      {/* Orb Background */}
      <div className='absolute inset-0 z-0 w-full'>
        <Orb
          hue={240}
          hoverIntensity={0.7}
          rotateOnHover={true}
          forceHoverState={false}
        />
      </div>

      {/* Overlay to maintain readability */}
      <div className='absolute inset-0 bg-white/70 dark:bg-gray-900/80 z-10'></div>

      <div className='container mx-auto px-4 relative z-20'>
        <div className='text-center max-w-3xl mx-auto mb-16'>
          <div className='inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-full text-sm font-bold mb-4'>
            <Star className='w-4 h-4' />
            ABOUT US
          </div>
          <h2 className='text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 dark:from-white dark:via-blue-100 dark:to-purple-100 bg-clip-text text-transparent mb-6'>
            About Secure Infinite Association
          </h2>
          <p className='text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto'>
            We empower individuals through skill development, financial
            awareness, and personal growth. Our platform offers online recorded
            courses, knowledge resources, and digital services with transparent,
            commission-based payouts compliant with Indian laws.
          </p>
        </div>

        {/* Mission & Vision */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-8 mb-20'>
          <div className='bg-gradient-to-br from-white/80 to-white/50 dark:from-gray-800/50 dark:to-gray-900/50 backdrop-blur-xl border border-white/50 dark:border-gray-700/50 rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-500 group'>
            <div className='flex items-center gap-3 mb-4'>
              <div className='w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center'>
                <Lightbulb className='w-6 h-6 text-white' />
              </div>
              <h3 className='text-2xl font-bold text-gray-900 dark:text-white'>
                Our Mission
              </h3>
            </div>
            <p className='text-gray-700 dark:text-gray-300 leading-relaxed'>
              To empower individuals through accessible digital education, skill
              development, and transparent affiliate opportunities that foster
              personal growth and financial awareness.
            </p>
          </div>

          <div className='bg-gradient-to-br from-white/80 to-white/50 dark:from-gray-800/50 dark:to-gray-900/50 backdrop-blur-xl border border-white/50 dark:border-gray-700/50 rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-500 group'>
            <div className='flex items-center gap-3 mb-4'>
              <div className='w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center'>
                <Award className='w-6 h-6 text-white' />
              </div>
              <h3 className='text-2xl font-bold text-gray-900 dark:text-white'>
                Our Vision
              </h3>
            </div>
            <p className='text-gray-700 dark:text-gray-300 leading-relaxed'>
              To become India&apos;s leading digital learning platform that
              creates infinite opportunities for learners to achieve their
              personal and professional goals through quality education and
              ethical business practices.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className='grid grid-cols-2 md:grid-cols-4 gap-6 mb-20'>
          {stats.map((stat, index) => (
            <div
              key={index}
              className='bg-gradient-to-br from-white/80 to-white/50 dark:from-gray-800/50 dark:to-gray-900/50 backdrop-blur-xl border border-white/50 dark:border-gray-700/50 rounded-2xl shadow-lg p-6 text-center hover:shadow-xl transition-all duration-300 group'>
              <div className='text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2'>
                <CountUp
                  from={0}
                  to={stat.to}
                  separator={stat.separator as string}
                  direction='up'
                  duration={1.2}
                />
                <span>{stat.suffix}</span>
              </div>
              <div className='text-gray-600 dark:text-gray-400 font-medium'>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Values */}
        <div className='mb-16'>
          <h3 className='text-4xl font-bold text-center text-gray-900 dark:text-white mb-16'>
            Our Core Values
          </h3>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6'>
            {values.map((value, index) => (
              <div
                key={index}
                className='bg-gradient-to-br from-white/80 to-white/50 dark:from-gray-800/50 dark:to-gray-900/50 backdrop-blur-xl border border-white/50 dark:border-gray-700/50 rounded-2xl shadow-lg p-6 text-center hover:shadow-xl transition-all duration-300 group hover:-translate-y-2'>
                <div className='w-16 h-16 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300'>
                  {value.icon}
                </div>
                <h4 className='text-xl font-bold text-gray-900 dark:text-white mb-2'>
                  {value.title}
                </h4>
                <p className='text-gray-600 dark:text-gray-400 text-sm'>
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
