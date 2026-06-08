'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import NotificationDropdown from './NotificationDropdown';
import logo from '../secure-infinite-association.png';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { user, isAuthenticated, logout, loading } = useAuth();
  const { cartCount } = useCart();
  
  // CRITICAL: Only show user info when loading is complete AND user is authenticated
  // This prevents showing user info during the auth check phase
  const showUserInfo = !loading && isAuthenticated && !!user;

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    logout();
  };

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <div className="navbar-left">
          <a href="https://www.secureinfiniteassociation.com/" className="navbar-logo">
            <Image
              src={logo}
              alt="Secure Infinite Association logo"
              className="navbar-logo-img"
              width={40}
              height={40}
              priority
            />
            <span className="navbar-logo-text">Secure Infinite Association</span>
          </a>

          <nav className="navbar-links desktop-only">
            <Link href="/courses">All Courses</Link>
            {showUserInfo && <Link href="/my-courses">My Courses</Link>}
            {showUserInfo && <Link href="/dashboard">Dashboard</Link>}
            <Link href="/about">About</Link>
            <Link href="/faq">FAQ</Link>
            <Link href="/contact">Contact</Link>
          </nav>
        </div>

        <div className="navbar-right desktop-only">
          {showUserInfo && (
            <>
              <Link href="/cart" className="navbar-cart-link" style={{ position: 'relative', marginRight: '16px' }}>
                <span style={{ fontSize: '20px' }}>🛒</span>
                {cartCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '-8px',
                      backgroundColor: '#c33',
                      color: 'white',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 'bold',
                    }}
                  >
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </Link>
              <div style={{ marginRight: '16px' }}>
                <NotificationDropdown />
              </div>
            </>
          )}
          {loading ? (
            <span>Loading...</span>
          ) : showUserInfo ? (
            <>
              <span className="navbar-user-name" style={{ marginRight: '16px', color: 'var(--gray-600)', fontWeight: '500' }}>
                {user?.name ? (user.name.split(' ')[0] || user.name) : (user?.email?.split('@')[0] || 'User')}
              </span>
              <button onClick={handleLogout} className="navbar-btn ghost">
                Logout
              </button>
            </>
          ) : (
            <>
          <Link href="/login" className="navbar-btn ghost">
            Log in
          </Link>
          <Link href="/register" className="navbar-btn primary">
            Sign up
          </Link>
            </>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          className="navbar-menu-toggle mobile-only"
          aria-label="Toggle navigation"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {/* Mobile sidebar / overlay */}
      <div className={`mobile-nav-overlay ${isOpen ? 'open' : ''}`} onClick={() => setIsOpen(false)} />
      <div className={`mobile-nav-panel ${isOpen ? 'open' : ''}`}>
        <nav className="mobile-nav-links">
          <Link href="/courses">All Courses</Link>
          {showUserInfo && <Link href="/my-courses">My Courses</Link>}
          {showUserInfo && <Link href="/dashboard">Dashboard</Link>}
          {showUserInfo && (
            <Link href="/cart" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🛒</span>
              <span>Cart</span>
              {cartCount > 0 && (
                <span
                  style={{
                    backgroundColor: '#c33',
                    color: 'white',
                    borderRadius: '12px',
                    padding: '2px 8px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                >
                  {cartCount}
                </span>
              )}
            </Link>
          )}
          <Link href="/about">About</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <div className="mobile-nav-actions">
          {loading ? (
            <span>Loading...</span>
          ) : showUserInfo ? (
            <>
              <span style={{ marginBottom: '8px', color: 'var(--gray-600)', fontWeight: '500' }}>
                {user?.name ? (user.name.split(' ')[0] || user.name) : (user?.email?.split('@')[0] || 'User')}
              </span>
              <button onClick={handleLogout} className="navbar-btn ghost">
                Logout
              </button>
            </>
          ) : (
            <>
          <Link href="/login" className="navbar-btn ghost">
            Log in
          </Link>
          <Link href="/register" className="navbar-btn primary">
            Sign up
          </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

