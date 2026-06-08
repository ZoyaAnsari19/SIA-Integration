'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Breadcrumbs from '../../components/Breadcrumbs';
import EmptyCart from '../../components/EmptyCart';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import Link from 'next/link';

export default function CartPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { cartItems, loading, removeFromCart, clearCart, calculateTotal, fetchCart } = useCart();
  const hasRedirected = useRef(false);
  const hasFetched = useRef(false);

  useEffect(() => {
    // Wait for auth check to complete
    if (authLoading) {
      return;
    }
    
    // Auth check complete - now check authentication
    if (!isAuthenticated && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace('/login');
      return;
    }
    
    // User is authenticated, fetch cart (only once)
    if (isAuthenticated && !hasFetched.current) {
      hasFetched.current = true;
      fetchCart();
    }
  }, [isAuthenticated, authLoading, router, fetchCart]);

  const formatPrice = (price) => {
    if (typeof price === 'number') {
      return `₹${price.toLocaleString('en-IN')}`;
    }
    return price || 'Free';
  };

  const handleRemove = async (courseId) => {
    const result = await removeFromCart(courseId);
    if (!result.success) {
      alert(result.error || 'Failed to remove item');
    }
  };

  const handleClear = async () => {
    if (confirm('Are you sure you want to clear your cart?')) {
      const result = await clearCart();
      if (!result.success) {
        alert(result.error || 'Failed to clear cart');
      }
    }
  };

  const handleCheckout = () => {
    router.push('/checkout');
  };

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <main className="cart-page">
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Shopping cart' }
          ]}
        />
        <section className="cart-section">
          <div className="container cart-layout">
            <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>
          </div>
        </section>
      </main>
    );
  }

  // If not authenticated after loading, redirect (will happen in useEffect)
  if (!isAuthenticated) {
    return (
      <main className="cart-page">
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Shopping cart' }
          ]}
        />
        <section className="cart-section">
          <div className="container cart-layout">
            <div style={{ padding: '40px', textAlign: 'center' }}>Redirecting to login...</div>
          </div>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="cart-page">
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Shopping cart' }
          ]}
        />
        <section className="cart-section">
          <div className="container cart-layout">
            <div style={{ padding: '40px', textAlign: 'center' }}>Loading cart...</div>
          </div>
        </section>
      </main>
    );
  }

  const total = calculateTotal();

  if (cartItems.length === 0) {
    return (
      <main className="cart-page">
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Shopping cart' }
          ]}
        />
        <section className="cart-section">
          <div className="container cart-layout">
            <EmptyCart />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="cart-page">
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Shopping cart' }
        ]}
      />

      <section className="cart-section">
        <div className="container cart-layout">
          <div className="cart-main">
            <h1>Shopping cart</h1>
            <p className="cart-subtitle">{cartItems.length} {cartItems.length === 1 ? 'Course' : 'Courses'} in cart</p>

            <div style={{ marginTop: '24px' }}>
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '16px',
                    borderBottom: '1px solid var(--gray-200)',
                    gap: '16px'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <Link href={`/course/${item.course?.slug}`} style={{ textDecoration: 'none' }}>
                      <h3 style={{ margin: 0, marginBottom: '8px', color: 'var(--gray-900)' }}>
                        {item.course?.title || 'Course'}
                      </h3>
                    </Link>
                    <p style={{ margin: 0, color: 'var(--gray-600)', fontSize: '14px' }}>
                      {item.course?.shortDescription || ''}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', marginRight: '16px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                      {formatPrice(item.course?.price || 0)}
                    </div>
                    <button
                      onClick={() => handleRemove(item.course_id || item.courseId)}
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        color: '#c33',
                        background: 'none',
                        border: '1px solid #c33',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '24px' }}>
              <button
                onClick={handleClear}
                style={{
                  padding: '8px 16px',
                  color: '#c33',
                  background: 'none',
                  border: '1px solid #c33',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Clear Cart
              </button>
            </div>
          </div>

          <aside className="cart-summary">
            <p className="cart-summary-label">Total</p>
            <p className="cart-summary-total">{formatPrice(total)}</p>

            <button type="button" className="cart-checkout-btn" onClick={handleCheckout}>
              Checkout
            </button>
          </aside>
        </div>
      </section>
    </main>
  );
}
