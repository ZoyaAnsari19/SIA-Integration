"use client";

import { useState } from "react";

export default function CtaSection() {
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle email submission
    console.log("Email submitted:", email);
    setEmail("");
  };

  return (
    <section className='py-16 bg-gray-50 dark:bg-gray-900/50'>
      <div className='container mx-auto px-4'>
        <div className='max-w-3xl mx-auto text-center bg-white dark:bg-gray-800 rounded-2xl p-8 md:p-12 shadow-lg'>
          <h2 className='text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4'>
            Ready to Start Learning?
          </h2>
          <p className='text-lg text-gray-600 dark:text-gray-300 mb-8'>
            Join thousands of learners and start your journey today.
          </p>
          <form
            onSubmit={handleSubmit}
            className='flex flex-col sm:flex-row gap-4 max-w-xl mx-auto'>
            <input
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder='Enter your email'
              className='flex-grow px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
              required
            />
            <button
              type='submit'
              className='bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors whitespace-nowrap'>
              Get Started
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
