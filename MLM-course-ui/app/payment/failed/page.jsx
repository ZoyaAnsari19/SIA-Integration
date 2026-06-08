'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Breadcrumbs from '../../../components/Breadcrumbs';

function PaymentFailedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const merchantTxnNo = searchParams.get('merchantTxnNo');
  const error = searchParams.get('error');

  const handleRetry = () => {
    // Go back to checkout or cart
    router.push('/checkout');
  };

  return (
    <main style={{ minHeight: '100vh', padding: '40px 20px' }}>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Payment Failed' }
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
        <div style={{ fontSize: '64px', marginBottom: '24px' }}>❌</div>
        <h1 style={{
          fontSize: '32px',
          fontWeight: '700',
          color: '#ef4444',
          marginBottom: '16px'
        }}>
          Payment Failed
        </h1>
        <p style={{
          fontSize: '18px',
          color: '#6b7280',
          marginBottom: '24px',
          lineHeight: '1.6'
        }}>
          {error ? decodeURIComponent(error) : 'Your payment could not be processed. Please try again.'}
        </p>

        {(merchantTxnNo || error) && (
          <div style={{
            padding: '20px',
            backgroundColor: '#fef2f2',
            borderRadius: '8px',
            marginBottom: '32px',
            textAlign: 'left',
            border: '1px solid #fecaca'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#991b1b'
            }}>
              Transaction Details
            </h3>
            {merchantTxnNo && (
              <p style={{ marginBottom: '8px', color: '#7f1d1d' }}>
                <strong>Merchant Txn No:</strong> {merchantTxnNo}
              </p>
            )}
            {error && (
              <p style={{ color: '#7f1d1d' }}>
                <strong>Error:</strong> {decodeURIComponent(error)}
              </p>
            )}
          </div>
        )}

        <div style={{
          padding: '20px',
          backgroundColor: '#fffbeb',
          borderRadius: '8px',
          marginBottom: '32px',
          border: '1px solid #fde68a'
        }}>
          <p style={{
            fontSize: '14px',
            color: '#92400e',
            marginBottom: '8px',
            fontWeight: '600'
          }}>
            What to do next?
          </p>
          <ul style={{
            textAlign: 'left',
            color: '#78350f',
            fontSize: '14px',
            lineHeight: '1.8',
            paddingLeft: '20px'
          }}>
            <li>Check your payment method and try again</li>
            <li>Ensure you have sufficient balance</li>
            <li>Contact your bank if the issue persists</li>
            <li>Reach out to support if you need assistance</li>
          </ul>
        </div>

        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleRetry}
            style={{
              padding: '12px 24px',
              backgroundColor: '#8b5cf6',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#7c3aed'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#8b5cf6'}
          >
            Try Again
          </button>
          <Link
            href="/contact"
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
            Contact Support
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function PaymentFailedPage() {
  return (
    <Suspense fallback={
      <main style={{ minHeight: '100vh', padding: '40px', textAlign: 'center' }}>
        <div>Loading...</div>
      </main>
    }>
      <PaymentFailedContent />
    </Suspense>
  );
}
