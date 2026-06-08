"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Settings, Moon, Sun } from "lucide-react";
import { useTheme } from "@/app/contexts/ThemeContext";
import { useAuth } from "@/app/hooks/useAuth";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated, signOut } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Only show section navigation on the home page
  const isHomePage = pathname === "/";

  return (
    <div className='min-h-screen bg-transparent text-foreground'>
      {/* Header */}
      <header
        className={`fixed w-full z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-transparent backdrop-blur-sm shadow-sm"
            : "bg-transparent"
        } h-16 md:h-20`}>
        <div className='container px-4 mx-auto h-full'>
          <div className='flex items-center justify-between h-full'>
            {/* Logo */}
            <Link href='/' className='flex items-center space-x-1'>
              <div className='bg-amber-50 p-1 sm:p-2 rounded-full w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 flex items-center justify-center'>
                <img
                  src='/images/secure-infinite-association.png'
                  alt='Logo'
                  className='h-14 w-14 sm:h-8 sm:w-8 md:h-10 md:w-10 lg:h-12 lg:w-12 object-contain'
                />
              </div>
              <span className='text-white font-bold text-sm sm:text-base md:text-lg lg:text-xl mx-2 sm:mx-3 md:mx-4 hidden sm:block'>
                Secure Infinite Association
              </span>
            </Link>

            {/* Desktop Navigation */}
            {isHomePage ? (
              <nav className='hidden md:flex items-center space-x-4 lg:space-x-8'>
                <Link
                  href='/#home'
                  className='font-medium transition-colors hover:text-blue-600 text-gray-700 dark:text-gray-300 text-sm lg:text-base'>
                  Home
                </Link>
                <Link
                  href='/#about'
                  className='font-medium transition-colors hover:text-blue-600 text-gray-700 dark:text-gray-300 text-sm lg:text-base'>
                  About
                </Link>
                <Link
                  href='/#courses'
                  className='font-medium transition-colors hover:text-blue-600 text-gray-700 dark:text-gray-300 text-sm lg:text-base'>
                  Courses
                </Link>
                <Link
                  href='/#affiliate'
                  className='font-medium transition-colors hover:text-blue-600 text-gray-700 dark:text-gray-300 text-sm lg:text-base'>
                  Affiliate
                </Link>
                <Link
                  href='/#contact'
                  className='font-medium transition-colors hover:text-blue-600 text-gray-700 dark:text-gray-300 text-sm lg:text-base'>
                  Contact
                </Link>
              </nav>
            ) : null}

            {/* Auth Buttons */}
            <div className='hidden md:flex items-center space-x-2 lg:space-x-4'>
              {isAuthenticated ? (
                <div className='flex items-center space-x-4'>
                  <Link
                    href='/dashboard'
                    className='text-gray-700 dark:text-gray-300 hover:text-blue-600 font-medium'>
                    Dashboard
                  </Link>
                  <button
                    onClick={signOut}
                    className='text-gray-700 dark:text-gray-300 hover:text-blue-600 font-medium'>
                    Sign Out
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    href='https://app.secureinfiniteassociation.com/login'
                    className='text-gray-700 dark:text-gray-300 hover:text-blue-600 font-medium text-sm lg:text-base'>
                    Sign In
                  </Link>
                  <Link
                    href='https://app.secureinfiniteassociation.com/register'
                    className='bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 lg:px-4 lg:py-2 rounded-lg font-medium transition-colors text-sm lg:text-base'>
                    Register
                  </Link>
                </>
              )}
            </div>

            {/* Theme Toggle and Settings */}
            {/* Mobile Menu Toggle */}
            <div className='md:hidden flex items-center'>
              <button
                type='button'
                aria-label={isMenuOpen ? "Close menu" : "Open menu"}
                onClick={() => setIsMenuOpen((prev) => !prev)}
                className='p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500'>
                {isMenuOpen ? (
                  <X className='w-6 h-6' />
                ) : (
                  <Menu className='w-6 h-6' />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Menu Panel */}
          {isMenuOpen && (
            <div className='md:hidden fixed left-0 right-0 top-16 md:top-20 bottom-0 z-50 bg-black/20 backdrop-blur-md'>
              <div className='container mx-auto px-4 pt-4 pb-6'>
                <div className='flex flex-col space-y-3 bg-white/80 dark:bg-gray-900/70 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-lg'>
                  {isHomePage && (
                    <>
                      <Link
                        href='/#home'
                        className='text-left font-medium py-2 px-4 rounded-lg transition-colors text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
                        onClick={() => setIsMenuOpen(false)}>
                        Home
                      </Link>
                      <Link
                        href='/#about'
                        className='text-left font-medium py-2 px-4 rounded-lg transition-colors text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
                        onClick={() => setIsMenuOpen(false)}>
                        About
                      </Link>
                      <Link
                        href='/#courses'
                        className='text-left font-medium py-2 px-4 rounded-lg transition-colors text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
                        onClick={() => setIsMenuOpen(false)}>
                        Courses
                      </Link>
                      <Link
                        href='/#affiliate'
                        className='text-left font-medium py-2 px-4 rounded-lg transition-colors text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
                        onClick={() => setIsMenuOpen(false)}>
                        Affiliate
                      </Link>
                      <Link
                        href='/#contact'
                        className='text-left font-medium py-2 px-4 rounded-lg transition-colors text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
                        onClick={() => setIsMenuOpen(false)}>
                        Contact
                      </Link>
                    </>
                  )}
                  <div className='flex space-x-2 pt-2'>
                    {isAuthenticated ? (
                      <>
                        <Link
                          href='/dashboard'
                          className='flex-1 text-center py-2 px-4 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-medium'
                          onClick={() => setIsMenuOpen(false)}>
                          Dashboard
                        </Link>
                        <button
                          onClick={() => {
                            signOut();
                            setIsMenuOpen(false);
                          }}
                          className='flex-1 text-center py-2 px-4 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-medium'>
                          Sign Out
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          href='https://app.secureinfiniteassociation.com/login'
                          className='flex-1 text-center py-2 px-4 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-medium'
                          onClick={() => setIsMenuOpen(false)}>
                          Sign In
                        </Link>
                        <Link
                          href='https://app.secureinfiniteassociation.com/register'
                          className='flex-1 text-center py-2 px-4 rounded-lg bg-blue-600 text-white font-medium'
                          onClick={() => setIsMenuOpen(false)}>
                          Register
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className='pt-20'>{children}</main>

      {/* Footer */}
      <footer className='bg-gray-100 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800 mt-16'>
        <div className='container mx-auto px-4 py-12'>
          <div className='grid grid-cols-1 md:grid-cols-4 gap-8'>
            <div>
              <div className='flex items-center space-x-2 mb-4'>
                <div className='flex items-center justify-center w-15 h-8 rounded-lg bg-blue-600 text-white font-bold'>
                  {/* Using custom logo.png in footer too */}
                  <div className='bg-amber-50 p-auto rounded-full'>
                    <img
                      src='/images/secure-infinite-association.png'
                      alt='Logo'
                      className='h-9 md:h-14 w-15 object-contain '
                    />
                  </div>
                </div>
                <span className='text-15 font-bold text-gray-900 dark:text-white'>
                  Secure Infinite Association
                </span>
              </div>
              <p className='text-gray-600 dark:text-gray-400 mb-4'>
                Empowering Infinite Learning through digital education and skill
                development.
              </p>
            </div>

            <div>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-4'>
                Platform
              </h3>
              <ul className='space-y-2'>
                <li>
                  <span className='text-gray-600 dark:text-gray-400'>
                    Courses
                  </span>
                </li>
                <li>
                  <span className='text-gray-600 dark:text-gray-400'>
                    Books & Resources
                  </span>
                </li>
                <li>
                  <span className='text-gray-600 dark:text-gray-400'>
                    Affiliate Program
                  </span>
                </li>
                <li>
                  <span className='text-gray-600 dark:text-gray-400'>
                    Career Guidance
                  </span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-4'>
                Company
              </h3>
              <ul className='space-y-2'>
                <li>
                  <Link
                    href='https://app.secureinfiniteassociation.com/about'
                    className='text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors'>
                    About Us
                  </Link>
                </li>
                <li>
                  <Link
                    href='https://app.secureinfiniteassociation.com/contact'
                    className='text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors'>
                    Contact Us
                  </Link>
                </li>
                <li>
                  <Link
                    href='https://app.secureinfiniteassociation.com/terms'
                    className='text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors'>
                    Terms & Conditions
                  </Link>
                </li>
                <li>
                  <Link
                    href='https://app.secureinfiniteassociation.com/privacy'
                    className='text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors'>
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-4'>
                Legal
              </h3>
              <ul className='space-y-2'>
                <li>
                  <Link
                    href='https://app.secureinfiniteassociation.com/refund'
                    className='text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors'>
                    Refund and Cancellation
                  </Link>
                </li>
                <li>
                  <Link
                    href='https://app.secureinfiniteassociation.com/shipping'
                    className='text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors'>
                    Shipping and Delivery
                  </Link>
                </li>
                <li>
                  <span className='text-gray-600 dark:text-gray-400'>
                    KYC Documentation
                  </span>
                </li>
                <li>
                  <span className='text-gray-600 dark:text-gray-400'>
                    Compliance
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className='border-t border-gray-200 dark:border-gray-800 mt-8 pt-8 text-center text-gray-600 dark:text-gray-400'>
            <p>
              © {new Date().getFullYear()} Secure Infinite Association. All
              rights reserved.
            </p>
            <p className='mt-2 text-sm'>
              Transparent, compliant, and commission-based digital learning
              platform.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
