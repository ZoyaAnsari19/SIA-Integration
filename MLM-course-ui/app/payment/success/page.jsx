'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Breadcrumbs from '../../../components/Breadcrumbs';
import { useCart } from '../../../contexts/CartContext';

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clearCart } = useCart();

  const txnId = searchParams.get('txnId');
  const merchantTxnNo = searchParams.get('merchantTxnNo');

  useEffect(() => {
    // Clear cart on successful payment
    clearCart();
  }, [clearCart]);

  return (
    <main style={{ minHeight: '100vh', padding: '40px 20px' }}>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Payment Success' }
        ]}
      />

      <div style={{
        maxWidth: '600px',
        margin: '60px auto',
        textAlign: 'center',
        padding: '40px',
        backgroundColor: '#fff',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ fontSize: '64px', marginBottom: '24px' }}>✅</div>
        <h1 style={{
          fontSize: '32px',
          fontWeight: '700',
          color: '#10b981',
          marginBottom: '16px'
        }}>
          Payment Successful!
        </h1>
        <p style={{
          fontSize: '18px',
          color: '#6b7280',
          marginBottom: '20px',
          lineHeight: '1.6'
        }}>
          Thank you for your purchase. Your package is being activated.
        </p>

        <div style={{
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '28px',
          textAlign: 'left'
        }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#166534' }}>What to do next</p>
          <p style={{ margin: 0, color: '#15803d', lineHeight: 1.5 }}>
            Please go to <strong>Dashboard</strong> and check <strong>My Packages</strong> to see your package. Do not panic if it takes a few moments to appear.
          </p>
          <a
            href="https://dashboard.secureinfiniteassociation.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              marginTop: '12px',
              padding: '10px 20px',
              background: '#2563eb',
              color: '#fff',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '15px'
            }}
          >
            Go to Dashboard → My Packages
          </a>
        </div>

        {(txnId || merchantTxnNo) && (
          <div style={{
            padding: '20px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            marginBottom: '32px',
            textAlign: 'left'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#374151'
            }}>
              Transaction Details
            </h3>
            {txnId && (
              <p style={{ marginBottom: '8px', color: '#6b7280' }}>
                <strong>Transaction ID:</strong> {txnId}
              </p>
            )}
            {merchantTxnNo && (
              <p style={{ color: '#6b7280' }}>
                <strong>Merchant Txn No:</strong> {merchantTxnNo}
              </p>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/my-courses"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              backgroundColor: '#8b5cf6',
              color: '#fff',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '16px',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#7c3aed'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#8b5cf6'}
          >
            View My Courses
          </Link>
          <Link
            href="/courses"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              backgroundColor: '#fff',
              color: '#8b5cf6',
              border: '2px solid #8b5cf6',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '16px',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = '#8b5cf6';
              e.target.style.color = '#fff';
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = '#fff';
              e.target.style.color = '#8b5cf6';
            }}
          >
            Browse More Courses
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <main style={{ minHeight: '100vh', padding: '40px', textAlign: 'center' }}>
        <div>Loading...</div>
      </main>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
