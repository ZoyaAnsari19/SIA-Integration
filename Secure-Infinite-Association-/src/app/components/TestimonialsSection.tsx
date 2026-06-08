"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
  Legend,
} from "recharts";

// Define types
type Testimonial = {
  name: string;
  role: string;
  feedback: string;
};

type RadialDataItem = {
  name: string;
  value: number;
  fill: string;
};

// Dummy data
const testimonials: Testimonial[] = [
  {
    name: "Priya Sharma",
    role: "Software Engineer",
    feedback:
      "The courses helped me understand personal finance better. I've already started investing!",
  },
  {
    name: "Rahul Verma",
    role: "Marketing Manager",
    feedback:
      "Digital Marketing course transformed my career. Got a promotion within 3 months!",
  },
  {
    name: "Anjali Patel",
    role: "Freelancer",
    feedback:
      "Affiliate program helped me earn extra income while learning new skills.",
  },
  {
    name: "Amit Kumar",
    role: "Student",
    feedback:
      "The platform is user-friendly and the courses are well-structured. Highly recommended!",
  },
  {
    name: "Sneha Reddy",
    role: "Entrepreneur",
    feedback:
      "Learned so much about digital marketing that I could start my own business!",
  },
];

const radialData: RadialDataItem[] = [
  {
    name: "batch 3",
    value: 65,
    fill: "#00C9A7", // growth green (accent)
  },
  {
    name: "batch 2",
    value: 75,
    fill: "#008FF5", // A lighter blue
  },
  {
    name: "batch 1",
    value: 85,
    fill: "#004AAD", // trust blue (primary)
  },
];

// Custom legend component
const CustomLegend = () => {
  return (
    <div className='flex justify-center space-x-6 mt-4'>
      {radialData.map((item, index) => (
        <div key={index} className='flex items-center'>
          <div
            className='w-3 h-3 rounded-full mr-2'
            style={{ backgroundColor: item.fill }}
          />
          <span className='text-sm text-gray-300'>{item.name}</span>
        </div>
      ))}
    </div>
  );
};

const TestimonialsSection = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Auto slide testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className='py-16 bg-[#0b1220]'>
      <div className='container mx-auto px-4'>
        <motion.h2
          className='text-3xl md:text-4xl font-bold text-center text-white mb-16'
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}>
          What Our Learners Say
        </motion.h2>

        <div className='flex flex-col lg:flex-row gap-12 items-center'>
          {/* Left Column - Chart */}
          <motion.div
            className='w-full lg:w-1/2 flex justify-center'
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: true }}>
            <div className='w-full max-w-md'>
              <ResponsiveContainer width='100%' height={300}>
                <RadialBarChart
                  innerRadius='20%'
                  outerRadius='100%'
                  barSize={12}
                  data={radialData}
                  startAngle={180}
                  endAngle={0}>
                  <PolarAngleAxis
                    type='number'
                    domain={[0, 100]}
                    angleAxisId={0}
                    tick={false}
                  />
                  <RadialBar background dataKey='value' cornerRadius={10} />
                  <text
                    x='50%'
                    y='50%'
                    textAnchor='middle'
                    dominantBaseline='middle'
                    className='text-2xl font-bold fill-white'>
                    <tspan x='50%' dy='2em' className='text-lg fill-gray-300'>
                      Active Learners
                    </tspan>
                    <tspan
                      x='50%'
                      dy='1.5em'
                      className='text-3xl font-bold fill-white'>
                      1,200+
                    </tspan>
                  </text>
                </RadialBarChart>
              </ResponsiveContainer>
              <CustomLegend />
            </div>
          </motion.div>

          {/* Right Column - Testimonials Carousel */}
          <motion.div
            className='w-full lg:w-1/2'
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: true }}>
            <div className='relative overflow-hidden py-4'>
              <div
                ref={carouselRef}
                className='flex transition-transform duration-1000 ease-in-out'
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
                {testimonials.map((testimonial, index) => (
                  <div key={index} className='flex-shrink-0 w-full px-4'>
                    <div className='bg-gray-800/30 backdrop-blur-sm rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] border border-gray-700/50'>
                      <div className='flex items-center mb-6'>
                        <div className='w-16 h-16 rounded-full bg-gradient-to-br from-[#004AAD] to-[#00C9A7] flex items-center justify-center text-white font-bold text-xl mr-4'>
                          {testimonial.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className='text-xl font-bold text-white'>
                            {testimonial.name}
                          </h3>
                          <p className='text-gray-400'>{testimonial.role}</p>
                        </div>
                      </div>
                      <p className='text-gray-300 italic'>
                        &ldquo;{testimonial.feedback}&rdquo;
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Navigation Dots */}
              <div className='flex justify-center mt-8 space-x-2'>
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`w-3 h-3 rounded-full transition-all duration-300 ${
                      index === currentIndex
                        ? "bg-[#004AAD] w-6"
                        : "bg-gray-600"
                    }`}
                    aria-label={`Go to testimonial ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
