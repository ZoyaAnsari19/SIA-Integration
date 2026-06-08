"use client";

import { useState } from "react";
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  User,
  MessageSquare,
  Send,
} from "lucide-react";

export default function ContactSection() {
  // State for contact form
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const contactInfo = [
    {
      icon: <Mail className='w-6 h-6' />,
      title: "Email Us",
      content: "secureinfiniteassociation@gmail.com",
      description: "For general inquiries and support",
    },
    {
      icon: <Phone className='w-6 h-6' />,
      title: "Call Us",
      content: "02269621972",
      description: "Available 24/7 for customer support",
    },
    {
      icon: <MapPin className='w-6 h-6' />,
      title: "Visit Us",
      content:
        "Barampuri, Nagpur Rd, Desaiganj Wadsa, Gadchiroli, Maharashtra, 441207",
      // description: "Our headquarters and main operations center",
    },
  ];

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    console.log("Form submitted:", formData);
    // Reset form
    setFormData({
      name: "",
      email: "",
      subject: "",
      message: "",
    });
    alert("Thank you for your message! We'll get back to you soon.");
  };

  const handleContactChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <section className='py-16 bg-gray-50 dark:bg-gray-900/50'>
      <div className='container mx-auto px-4'>
        <div className='mb-12 text-center'>
          <h2 className='text-4xl font-bold text-gray-900 dark:text-white mb-4'>
            Contact Us
          </h2>
          <p className='text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto'>
            Have questions or feedback? We&apos;d love to hear from you. Reach
            out to us through any of the channels below.
          </p>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-2 gap-8 items-start'>
          {/* Contact Information */}
          <div className='lg:col-span-1'>
            <div className='bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 h-full'>
              <h3 className='text-2xl font-bold text-gray-900 dark:text-white mb-6'>
                Get in Touch
              </h3>

              <div className='space-y-6'>
                {contactInfo.map((info, index) => (
                  <div key={index} className='flex items-start'>
                    <div className='w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0'>
                      {info.icon}
                    </div>
                    <div className='ml-4'>
                      <h4 className='font-bold text-gray-900 dark:text-white'>
                        {info.title}
                      </h4>
                      <p className='text-gray-900 dark:text-white font-medium'>
                        {info.content}
                      </p>
                      {/* <p className='text-gray-600 dark:text-gray-400 text-sm'>
                        {info.description}
                      </p> */}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className='lg:col-span-1'>
            <div className='bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 h-full'>
              <h3 className='text-2xl font-bold text-gray-900 dark:text-white mb-6'>
                Send us a Message
              </h3>

              <form onSubmit={handleContactSubmit} className='space-y-6'>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                  <div>
                    <label
                      htmlFor='name'
                      className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                      Full Name
                    </label>
                    <div className='relative'>
                      <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                        <User className='h-5 w-5 text-gray-400' />
                      </div>
                      <input
                        type='text'
                        id='name'
                        name='name'
                        required
                        value={formData.name}
                        onChange={handleContactChange}
                        className='block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                        placeholder='Your name'
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor='email'
                      className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                      Email Address
                    </label>
                    <div className='relative'>
                      <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                        <Mail className='h-5 w-5 text-gray-400' />
                      </div>
                      <input
                        type='email'
                        id='email'
                        name='email'
                        required
                        value={formData.email}
                        onChange={handleContactChange}
                        className='block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                        placeholder='you@example.com'
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor='subject'
                    className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                    Subject
                  </label>
                  <input
                    type='text'
                    id='subject'
                    name='subject'
                    required
                    value={formData.subject}
                    onChange={handleContactChange}
                    className='w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    placeholder='How can we help you?'
                  />
                </div>

                <div>
                  <label
                    htmlFor='message'
                    className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                    Message
                  </label>
                  <div className='relative'>
                    <div className='absolute top-3 left-3 pointer-events-none'>
                      <MessageSquare className='h-5 w-5 text-gray-400' />
                    </div>
                    <textarea
                      id='message'
                      name='message'
                      required
                      rows={5}
                      value={formData.message}
                      onChange={handleContactChange}
                      className='block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                      placeholder='Your message here...'></textarea>
                  </div>
                </div>

                <div className='flex justify-end'>
                  <button
                    type='submit'
                    className='bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center'>
                    <Send className='w-4 h-4 mr-2' />
                    Send Message
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
