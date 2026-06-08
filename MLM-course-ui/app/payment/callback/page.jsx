'use client';

export default function PaymentCallbackPage() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '40px'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '40px',
        backgroundColor: '#fff',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        maxWidth: '500px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '24px' }}>⏳</div>
        <h2 style={{
          fontSize: '24px',
          fontWeight: '600',
          marginBottom: '12px',
          color: '#374151'
        }}>
          Processing Payment...
        </h2>
        <p style={{
          fontSize: '16px',
          color: '#6b7280',
          lineHeight: '1.6'
        }}>
          Please wait while we verify your payment. You will be redirected shortly.
        </p>
      </div>
    </main>
  );
}
