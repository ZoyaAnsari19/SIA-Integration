'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Breadcrumbs from '../../components/Breadcrumbs';
import ICICIPaymentButton from '../../components/ICICIPaymentButton';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { cartItems, calculateTotal, addToCart, removeFromCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const courseIdFromQuery = searchParams.get('course');
  const requestTypeFromQuery = searchParams.get('request_type');
  const previousPurchaseIdFromQuery = searchParams.get('previous_purchase_id');

  useEffect(() => {
    // Wait until auth state is resolved to avoid redirecting
    // logged-in users before AuthContext finishes checkAuth.
    if (authLoading) {
      return;
    }

    if (!isAuthenticated) {
      const checkoutParams = new URLSearchParams();
      if (courseIdFromQuery) checkoutParams.set('course', courseIdFromQuery);
      if (requestTypeFromQuery) checkoutParams.set('request_type', requestTypeFromQuery);
      if (previousPurchaseIdFromQuery) checkoutParams.set('previous_purchase_id', previousPurchaseIdFromQuery);
      const redirectTarget = checkoutParams.toString()
        ? `/checkout?${checkoutParams.toString()}`
        : '/checkout';
      router.push(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
      return;
    }

    const prepareCart = async () => {
      // If a specific course is provided via query and cart is empty,
      // automatically add that course to cart (used for "Buy Now" and
      // dashboard → app redirects).
      if (courseIdFromQuery && cartItems.length === 0) {
        try {
          setLoading(true);
          const result = await addToCart(courseIdFromQuery, requestTypeFromQuery);
          if (!result.success) {
            setError(result.error || 'Failed to prepare checkout. Please try again.');
          } else {
            setError(null);
          }
        } catch (err) {
          console.error('Checkout: error adding course from query:', err);
          setError(err.message || 'Failed to prepare checkout. Please try again.');
        } finally {
          setLoading(false);
        }
        return;
      }

      // No course in query or cart already has items
      setLoading(false);
      if (cartItems.length === 0) {
        setError('Your cart is empty');
      } else {
        setError(null);
      }
    };

    prepareCart();
  }, [authLoading, isAuthenticated, cartItems.length, courseIdFromQuery, requestTypeFromQuery, previousPurchaseIdFromQuery, addToCart, router]);

  const formatPrice = (price) => {
    if (typeof price === 'number') {
      return `₹${price.toLocaleString('en-IN')}`;
    }
    return price || 'Free';
  };

  if (authLoading) {
    return (
      <main className="checkout-page">
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Checkout' }
          ]}
        />
        <div style={{ padding: '40px', textAlign: 'center' }}>Checking login status...</div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  const total = calculateTotal();
  const displayCourse = cartItems.length > 0 ? cartItems[0].course : null;

  const handleRemove = async (courseId) => {
    const result = await removeFromCart(courseId);
    if (!result.success) {
      alert(result.error || 'Failed to remove course from order');
    }
  };

  if (loading) {
    return (
      <main className="checkout-page">
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Checkout' }
          ]}
        />
        <div style={{ padding: '40px', textAlign: 'center' }}>Loading checkout...</div>
      </main>
    );
  }

  if (error && cartItems.length === 0) {
    return (
      <main className="checkout-page">
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Checkout' }
          ]}
        />
        <div style={{ padding: '40px', textAlign: 'center', color: '#c33' }}>
          {error}
        </div>
      </main>
    );
  }

  return (
    <main className="checkout-page">
      <div className="checkout-progress-bar" />

      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: displayCourse?.title || 'Checkout', href: displayCourse ? `/course/${displayCourse.slug}` : '/cart' },
          { label: 'Checkout' }
        ]}
      />

      <section className="checkout-section">
        <div className="container checkout-layout">
          {/* Left: Billing details */}
          <div className="checkout-main">
            <div className="checkout-header-row">
              <h1 className="checkout-title">Complete your purchase</h1>
              <span className="checkout-step-chip">Step 2 of 2</span>
            </div>
            <p className="checkout-subtitle">
              Complete your payment securely using our payment gateway.
            </p>
            <div className="checkout-trust-row">
              <span>🔒 256-bit SSL encrypted</span>
              <span>✅ 30-day money-back guarantee</span>
              <span>⭐ Trusted by 10,000+ learners</span>
            </div>

            {error && (
              <div style={{
                padding: '12px',
                marginBottom: '16px',
                backgroundColor: '#fee',
                color: '#c33',
                borderRadius: '4px'
              }}>
                {error}
              </div>
            )}

            <div className="checkout-card">
              <h2>Payment details</h2>
              <div className="checkout-payment-badges">
                💳 Visa • Mastercard • UPI • Net Banking
              </div>
            </div>
          </div>

          {/* Right: Order summary */}
          <aside className="checkout-summary">
            <div className="checkout-summary-card">
              <h2>Order summary</h2>
              {cartItems.length > 0 ? (
                <>
                  {cartItems.map((item) => (
                    <div key={item.id} className="checkout-course">
                      <div className="checkout-course-image">{item.course?.title || 'Course'}</div>
                      <div className="checkout-course-info">
                        <p className="checkout-course-title">{item.course?.title || 'Course'}</p>
                        <p className="checkout-course-meta">Lifetime access</p>
                      </div>
                      <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                          {formatPrice(
                            typeof item.course?.price === 'number'
                              ? item.course.price
                              : (typeof item.course?.price === 'string'
                                  ? parseFloat(item.course.price) || 0
                                  : 0)
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemove(item.course_id || item.courseId || item.course?.id)}
                          style={{
                            padding: '4px 10px',
                            fontSize: '12px',
                            color: '#c33',
                            background: 'none',
                            border: '1px solid #c33',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              ) : displayCourse ? (
                <div className="checkout-course">
                  <div className="checkout-course-image">{displayCourse.title}</div>
                  <div className="checkout-course-info">
                    <p className="checkout-course-title">{displayCourse.title}</p>
                    <p className="checkout-course-meta">Lifetime access</p>
                  </div>
                </div>
              ) : null}

              <div className="checkout-price-row">
                <span>Price</span>
                {/* Use cart total only; orderData was from old flow and is not defined */}
                <span>{formatPrice(total || 0)}</span>
              </div>
              <div className="checkout-price-row">
                <span>Discount</span>
                <span className="checkout-discount">- ₹0</span>
              </div>
              <div className="checkout-price-row checkout-total">
                <span>Total</span>
                <span>{formatPrice(total || 0)}</span>
              </div>

              <ICICIPaymentButton
                courseIds={cartItems.map(item => item.course_id || item.courseId || item.course?.id)}
                amount={total}
                courseName={displayCourse?.title || cartItems[0]?.course?.title}
                requestType={requestTypeFromQuery}
                previousPurchaseId={previousPurchaseIdFromQuery}
              />
              <p className="checkout-note">
                By completing your purchase you agree to our Terms of Service and Refund Policy.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <main className="checkout-page">
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Checkout' }
          ]}
        />
        <div style={{ padding: '40px', textAlign: 'center' }}>Loading checkout...</div>
      </main>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
