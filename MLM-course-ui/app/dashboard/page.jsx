'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardAPI } from '../../lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DashboardPage() {
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
      });
    } catch {
      return dateString;
    }
  };

  return (
    <main style={{ padding: '40px 20px', minHeight: '60vh' }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>
            Dashboard
          </h1>
          <p style={{ color: '#666', fontSize: '16px' }}>
            Stay updated with the latest announcements and notices
          </p>
        </div>

        {/* Notices Section */}
        <section style={{ marginBottom: '40px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '24px'
          }}>
            <h2 style={{ fontSize: '24px', fontWeight: '600' }}>Announcements</h2>
            <Link 
              href="/notifications" 
              style={{ 
                color: '#8b5cf6', 
                textDecoration: 'none',
                fontWeight: '500',
                fontSize: '14px'
              }}
            >
              View All →
            </Link>
          </div>

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
              <p style={{ color: '#666' }}>No announcements at the moment.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {notices.map((notice) => (
                <div
                  key={notice.id}
                  style={{
                    padding: '20px',
                    backgroundColor: '#fff',
                    borderRadius: '8px',
                    border: '1px solid #e5e5e5',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  }}
                >
                  <div style={{ marginBottom: '12px' }}>
                    <h3 style={{ 
                      fontSize: '18px', 
                      fontWeight: '600', 
                      marginBottom: '8px',
                      color: '#1a1a1a'
                    }}>
                      {notice.title}
                    </h3>
                    <p style={{ 
                      fontSize: '12px', 
                      color: '#999',
                      marginBottom: '12px'
                    }}>
                      {formatDate(notice.created_at)}
                    </p>
                  </div>
                  <p style={{ 
                    fontSize: '15px', 
                    color: '#333',
                    lineHeight: '1.6',
                    marginBottom: notice.link ? '12px' : '0'
                  }}>
                    {notice.content}
                  </p>
                  {notice.link && (
                    <div style={{ marginTop: '12px' }}>
                      <a
                        href={notice.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-block',
                          padding: '8px 16px',
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
                        Learn More →
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

