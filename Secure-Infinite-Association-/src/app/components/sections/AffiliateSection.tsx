"use client";

import Link from "next/link";
import {
  Users,
  TrendingUp,
  IndianRupee,
  Shield,
  FileText,
  Share2,
  BarChart3,
  Wallet,
  Clock,
  ChevronRight,
} from "lucide-react";
import MarketingCarousel from "@/app/components/sections/MarketingCarousel";

export default function AffiliateSection() {
  const commissionTiers = [
    {
      level: "Bronze",
      commission: "10%",
      sales: "0-50 sales",
      benefits: [
        "10% commission on all sales",
        "Monthly payout reports",
        "Basic promotional materials",
      ],
    },
    {
      level: "Silver",
      commission: "15%",
      sales: "51-200 sales",
      benefits: [
        "15% commission on all sales",
        "Priority support",
        "Advanced promotional materials",
        "Early access to new courses",
      ],
    },
    {
      level: "Gold",
      commission: "20%",
      sales: "201+ sales",
      benefits: [
        "20% commission on all sales",
        "Dedicated account manager",
        "Custom promotional campaigns",
        "Exclusive bonuses",
      ],
    },
  ];

  const howItWorksSteps = [
    {
      step: 1,
      title: "Sign Up",
      description: "Create your free affiliate account in minutes",
      icon: <FileText className='w-6 h-6' />,
    },
    {
      step: 2,
      title: "Get Your Link",
      description: "Receive your unique referral link for our courses",
      icon: <Share2 className='w-6 h-6' />,
    },
    {
      step: 3,
      title: "Promote",
      description: "Share your link on social media, blogs, or email",
      icon: <BarChart3 className='w-6 h-6' />,
    },
    {
      step: 4,
      title: "Earn",
      description: "Get paid commissions for every sale you generate",
      icon: <IndianRupee className='w-6 h-6' />,
    },
  ];

  return (
    <section className='py-16 bg-white dark:bg-gray-900'>
      <div className='container mx-auto px-4'>
        <div className='mb-12 text-center'>
          <h2 className='text-4xl font-bold text-gray-900 dark:text-white mb-4'>
            Affiliate Program
          </h2>
          <p className='text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto'>
            Earn commissions by promoting our courses. Join our affiliate
            program and start earning with every sale you generate. No
            investment required, fully transparent payouts.
          </p>
        </div>
        <MarketingCarousel />

        {/* Hero Section */}
        <div className='bg-gradient-to-r from-gray-900 via-blue-900 to-gray-900 rounded-2xl text-white p-6 md:p-8 mb-12'>
          <div className=' items-center'>
            {/* Content - Right Side */}
            <div className='w-full text-center lg:text-center'>
              <h3 className='text-3xl md:text-4xl font-bold mb-4'>
                Earn Up to 20% Commission on Every Sale
              </h3>
              <p className='text-lg md:text-xl mb-6 text-blue-100'>
                Join thousands of affiliates earning passive income by promoting
                our high-quality courses.
              </p>
              <div className='flex flex-col sm:flex-row justify-center lg:justify-center gap-4'>
                <Link
                  href='https://app.secureinfiniteassociation.com/register'
                  className='bg-white text-blue-600 hover:bg-gray-100 font-bold py-3 px-8 rounded-lg text-lg transition-all duration-300 flex items-center justify-center'>
                  Join Now
                  <ChevronRight className='ml-2 w-5 h-5' />
                </Link>
                <button className='bg-transparent border-2 border-white hover:bg-white/10 font-bold py-3 px-8 rounded-lg text-lg transition-all duration-300'>
                  Learn More
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Commission Tiers */}
        <div className='mb-16'>
          <h3 className='text-3xl font-bold text-center text-gray-900 dark:text-white mb-12'>
            Commission Tiers
          </h3>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
            {commissionTiers.map((tier, index) => (
              <div
                key={tier.level}
                className={`bg-gray-50 dark:bg-gray-800 rounded-xl shadow-lg p-6 border-t-4 ${
                  index === 0
                    ? "border-blue-500"
                    : index === 1
                    ? "border-purple-500"
                    : "border-yellow-500"
                }`}>
                <div className='text-center mb-6'>
                  <h4 className='text-2xl font-bold text-gray-900 dark:text-white mb-2'>
                    {tier.level}
                  </h4>
                  <div className='text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2'>
                    {tier.commission}
                  </div>
                  <p className='text-gray-600 dark:text-gray-400'>
                    {tier.sales}
                  </p>
                </div>
                <ul className='space-y-3 mb-6'>
                  {tier.benefits.map((benefit, i) => (
                    <li key={i} className='flex items-start'>
                      <div className='w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0'>
                        ✓
                      </div>
                      <span className='text-gray-700 dark:text-gray-300'>
                        {benefit}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href='https://app.secureinfiniteassociation.com/register'
                  className={`block text-center font-bold py-2 px-4 rounded-lg transition-colors ${
                    index === 0
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : index === 1
                      ? "bg-purple-600 hover:bg-purple-700 text-white"
                      : "bg-yellow-500 hover:bg-yellow-600 text-gray-900"
                  }`}>
                  Join {tier.level} Tier
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className='mb-16'>
          <h3 className='text-3xl font-bold text-center text-gray-900 dark:text-white mb-12'>
            How It Works
          </h3>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8'>
            {howItWorksSteps.map((step) => (
              <div
                key={step.step}
                className='bg-gray-50 dark:bg-gray-800 rounded-xl shadow-md p-6 text-center'>
                <div className='w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4'>
                  {step.icon}
                </div>
                <div className='text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2'>
                  0{step.step}
                </div>
                <h4 className='text-xl font-bold text-gray-900 dark:text-white mb-2'>
                  {step.title}
                </h4>
                <p className='text-gray-600 dark:text-gray-400'>
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Benefits Section */}
        <div className='bg-gray-50 dark:bg-gray-800 rounded-2xl shadow-lg p-8 mb-16'>
          <h3 className='text-3xl font-bold text-center text-gray-900 dark:text-white mb-12'>
            Why Join Our Affiliate Program?
          </h3>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
            <div className='text-center'>
              <div className='w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4'>
                <TrendingUp className='w-8 h-8 text-blue-600 dark:text-blue-400' />
              </div>
              <h4 className='text-xl font-bold text-gray-900 dark:text-white mb-2'>
                High Commission Rates
              </h4>
              <p className='text-gray-600 dark:text-gray-400'>
                Earn up to 20% commission on every sale with our tiered
                commission structure.
              </p>
            </div>

            <div className='text-center'>
              <div className='w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4'>
                <Shield className='w-8 h-8 text-blue-600 dark:text-blue-400' />
              </div>
              <h4 className='text-xl font-bold text-gray-900 dark:text-white mb-2'>
                Fully Compliant
              </h4>
              <p className='text-gray-600 dark:text-gray-400'>
                Transparent, legal payouts with proper documentation and KYC
                verification.
              </p>
            </div>

            <div className='text-center'>
              <div className='w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4'>
                <Users className='w-8 h-8 text-blue-600 dark:text-blue-400' />
              </div>
              <h4 className='text-xl font-bold text-gray-900 dark:text-white mb-2'>
                Quality Products
              </h4>
              <p className='text-gray-600 dark:text-gray-400'>
                Promote high-quality courses with real value that customers love
                and recommend.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
