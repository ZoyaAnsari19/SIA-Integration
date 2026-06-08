"use client";

import React from "react";
import { motion } from "framer-motion";

const teamLeader = [
  {
    id: 1,
    name: "Mr. Sheikh Bilal",
    role: "CMD & Founder",
    image: "/images/teamMember/Bilal[1].png",
    bio: "Visionary leader and founder of Secure Group,\n driving innovation and growth across \n fintech, education, and infrastructure sectors.",
  },
];
const teamManagers = [
  {
    id: 1,
    src: "/images/teamMember/RahulSir.png",
    alt: "Team Member 1",
    name: "Rahul sir",
    position: "Chief Development Officer",
  },
  {
    id: 2,
    src: "/images/teamMember/Shankkar.jpg",
    alt: "Team Member 2",
    name: "Shankkar Sir",
    position: "SIA Leader Committee President",
  },
  {
    id: 3,
    src: "/images/teamMember/Rajesh.png",
    alt: "Team Member 3",
    name: "Rajesh Sir",
    position: "SIA Leader Committee vice President",
  },
  {
    id: 4,
    src: "/images/teamMember/SnehalLata.png",
    alt: "Team Member 4",
    name: "Snehal mam",
    position: "SIA Leader Committee Secretary",
  },
  {
    id: 5,
    src: "/images/teamMember/chanda.png",
    alt: "Team Member 5",
    name: "Chanda mam",
    position: "SIA Leader Committee vice Secretary",
  },
  {
    id: 6,
    src: "/images/teamMember/atul.jpg",
    alt: "Team Member 6",
    name: "Atul sir",
    position: "SIA Leader Committee Marketing precedent",
  },
  {
    id: 7,
    src: "/images/teamMember/sunil.png",
    alt: "Team Member 6",
    name: "Sunil sir",
    position: "SIA Leader Committee Marketing vice precedent",
  },
];
const teamMembers = [
  { id: 1, src: "/images/teamMember/2.jpg", alt: "Team Member 1" },
  { id: 2, src: "/images/teamMember/3.jpg", alt: "Team Member 2" },
  { id: 3, src: "/images/teamMember/4.jpg", alt: "Team Member 3" },
  { id: 4, src: "/images/teamMember/5.jpg", alt: "Team Member 4" },
  { id: 5, src: "/images/teamMember/6.jpg", alt: "Team Member 5" },
  { id: 6, src: "/images/teamMember/7.jpg", alt: "Team Member 6" },
  { id: 7, src: "/images/teamMember/8.jpg", alt: "Team Member 1" },
  { id: 8, src: "/images/teamMember/9.jpg", alt: "Team Member 2" },
  { id: 9, src: "/images/teamMember/10.jpg", alt: "Team Member 3" },
  { id: 10, src: "/images/teamMember/11.jpg", alt: "Team Member 4" },
  { id: 11, src: "/images/teamMember/12.jpg", alt: "Team Member 5" },
  { id: 12, src: "/images/teamMember/13.jpg", alt: "Team Member 6" },
  { id: 13, src: "/images/teamMember/14.jpg", alt: "Team Member 1" },
  { id: 14, src: "/images/teamMember/15.jpg", alt: "Team Member 2" },
  { id: 15, src: "/images/teamMember/16.jpg", alt: "Team Member 3" },
  { id: 16, src: "/images/teamMember/17.jpg", alt: "Team Member 4" },
  { id: 17, src: "/images/teamMember/18.jpg", alt: "Team Member 5" },
  { id: 18, src: "/images/teamMember/19.jpg", alt: "Team Member 6" },
  { id: 19, src: "/images/teamMember/20.jpg", alt: "Team Member 6" },
  { id: 20, src: "/images/teamMember/21.jpg", alt: "Team Member 6" },
  { id: 21, src: "/images/teamMember/22.jpg", alt: "Team Member 6" },
  { id: 22, src: "/images/teamMember/23.jpg", alt: "Team Member 6" },
  // { id: 23, src: "/images/teamMember/23.jpg", alt: "Team Member 6" },
];

export default function TeamSection() {
  return (
    <section className='py-16 md:py-24 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-900'>
      <div className='container mx-auto px-4'>
        <div className='text-center mb-16'>
          <motion.h2
            className='text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4 flex items-center justify-center gap-3'
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}>
            <svg
              className='w-8 h-8 text-yellow-500'
              fill='currentColor'
              viewBox='0 0 24 24'>
              <path d='M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm2.7-2h8.6l1.1-6.4L14 10l-2-3.2L10 10l-3.4-2.4L7.7 14z' />
            </svg>
            Leadership Team
          </motion.h2>
          <motion.p
            className='text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto'
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}>
            We will update every 3 month on the basis of perfomance, because
            everyone get a chance to show their work.
          </motion.p>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-1 gap-8 max-w-120 mx-auto my-auto '>
          {teamLeader.map((member, index) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 30, x: 0 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -10 }}
              className='bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 h-full'>
              <div className='p-6'>
                <div className='flex items-center space-x-4'>
                  <div className='flex-shrink-0'>
                    <div className='w-20 h-20 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-200'>
                      <img
                        src={member.image}
                        alt={member.name}
                        className='w-27 h-27 object-cover'
                      />
                    </div>
                  </div>
                  <div className='flex-1'>
                    <h3 className='text-xl font-bold text-gray-900 dark:text-white mb-1'>
                      {member.name}
                    </h3>
                    <p className='text-blue-600 dark:text-blue-400 font-medium mb-3'>
                      {member.role}
                    </p>
                    <p className='text-gray-600 dark:text-gray-300 text-sm'>
                      {member.bio}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className='mt-16 w-full'
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}>
          {/* This is the single background div.
    It uses flexbox to center and wrap the circular images.
  */}
          <div className='flex flex-wrap justify-center items-center gap-4 sm:gap-6 md:gap-6 p-4 bg-gradient-to-r from-gray-900 via-blue-950 to-gray-900'>
            {teamManagers.map((member) => (
              // Each card now includes the image and text information
              <div
                key={member.id}
                className='flex flex-col items-center text-center'>
                <img
                  src={member.src}
                  alt={member.alt}
                  className='
            w-18 h-18    /* Base size: small */
            sm:w-20 sm:h-20  /* Medium screen size */
            md:w-24 md:h-24  /* Large screen size */
            rounded-full   /* Makes it a perfect circle */
            object-cover   /* Fills the circle without stretching */
            mb-2
          '
                />
                <h3 className='text-white text-sm font-medium'>
                  {member.name}
                </h3>
                <p className='text-gray-300 text-xs w-40'>{member.position}</p>
              </div>
            ))}
          </div>
        </motion.div>
        <motion.div
          className='w-full'
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}>
          {/* This is the single background div.
    It uses flexbox to center and wrap the circular images.
  */}
          <div className='flex flex-wrap justify-center items-center gap-4 sm:gap-6 md:gap-6 p-4 bg-gradient-to-r from-gray-900 via-blue-950 to-gray-900'>
            {teamMembers.map((member) => (
              // Each card is just the image, styled as a perfect circle.
              <img
                key={member.id}
                src={member.src}
                alt={member.alt}
                className='
          w-18 h-18    /* Base size: small */
          sm:w-20 sm:h-20  /* Medium screen size */
          md:w-24 md:h-24  /* Large screen size */
          rounded-full   /* Makes it a perfect circle */
          object-cover   /* Fills the circle without stretching */
        '
              />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
