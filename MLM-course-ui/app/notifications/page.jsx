'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardAPI } from '../../lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NotificationsPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [notices, setNotices] = useState([]);
  const [noticesLoading, setNoticesLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }

    if (isAuthenticated) {
      fetchNotices();
    }
  }, [isAuthenticated, loading, router]);

  const fetchNotices = async () => {
    try {
      setNoticesLoading(true);
      setError(null);
      const data = await dashboardAPI.getNotices();
      setNotices(data.items || []);
    } catch (err) {
      console.error('Error fetching notices:', err);
      setError(err.message || 'Failed to load notices');
      setNotices([]);
    } finally {
      setNoticesLoading(false);
    }
  };

  if (loading) {
    return (
      <main style={{ padding: '40px', textAlign: 'center' }}>
        <div>Loading...</div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <main style={{ padding: '40px 20px', minHeight: '60vh' }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
            <Link
              href="/dashboard"
              style={{
                fontSize: '16px',
                color: '#8b5cf6',
                textDecoration: 'none',
                fontWeight: '500',
              }}
            >
              ← Back to Dashboard
            </Link>
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>
            All Notifications
          </h1>
          <p style={{ color: '#666', fontSize: '16px' }}>
            View all announcements and important notices
          </p>
        </div>

        {/* Notices Section */}
        <section>
          {noticesLoading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div>Loading notices...</div>
            </div>
          ) : error ? (
            <div style={{ 
              padding: '20px', 
              backgroundColor: '#fee', 
              borderRadius: '8px',
              color: '#c33',
              textAlign: 'center'
            }}>
              <p>{error}</p>
            </div>
          ) : notices.length === 0 ? (
            <div style={{ 
              padding: '40px', 
              textAlign: 'center',
              backgroundColor: '#f9f9f9',
              borderRadius: '8px'
            }}>
              <p style={{ color: '#666' }}>No notifications at the moment.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {notices.map((notice) => (
                <div
                  key={notice.id}
                  style={{
                    padding: '24px',
                    backgroundColor: '#fff',
                    borderRadius: '8px',
                    border: '1px solid #e5e5e5',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  }}
                >
                  <div style={{ marginBottom: '12px' }}>
                    <h3 style={{ 
                      fontSize: '20px', 
                      fontWeight: '600', 
                      marginBottom: '8px',
                      color: '#1a1a1a'
                    }}>
                      {notice.title}
                    </h3>
                    <p style={{ 
                      fontSize: '13px', 
                      color: '#999',
                      marginBottom: '16px'
                    }}>
                      {formatDate(notice.created_at)}
                    </p>
                  </div>
                  <p style={{ 
                    fontSize: '15px', 
                    color: '#333',
                    lineHeight: '1.7',
                    marginBottom: notice.link ? '16px' : '0',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {notice.content}
                  </p>
                  {notice.link && (
                    <div style={{ marginTop: '16px' }}>
                      <a
                        href={notice.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-block',
                          padding: '10px 20px',
                          backgroundColor: '#8b5cf6',
                          color: '#fff',
                          textDecoration: 'none',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontWeight: '500',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#7c3aed'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#8b5cf6'}
                      >
                        View Link →
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

