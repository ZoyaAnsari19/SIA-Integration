'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { dashboardAPI } from '../lib/api';

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetchNotices();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotices = async () => {
    try {
      setLoading(true);
      const data = await dashboardAPI.getNotices();
      setNotices(data.items || []);
    } catch (err) {
      console.error('Error fetching notices:', err);
      setNotices([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const unreadCount = notices.length; // All notices are considered "unread" for simplicity

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '8px',
          fontSize: '20px',
          color: '#333',
        }}
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              backgroundColor: '#c33',
              color: 'white',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 'bold',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: '0',
            marginTop: '8px',
            width: '320px',
            maxHeight: '400px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            border: '1px solid #e5e5e5',
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '16px',
              borderBottom: '1px solid #e5e5e5',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>
              Notifications
            </h3>
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              style={{
                fontSize: '12px',
                color: '#8b5cf6',
                textDecoration: 'none',
                fontWeight: '500',
              }}
            >
              View All
            </Link>
          </div>

          <div
            style={{
              overflowY: 'auto',
              maxHeight: '300px',
            }}
          >
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                Loading...
              </div>
            ) : notices.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                No notifications
              </div>
            ) : (
              notices.slice(0, 5).map((notice) => (
                <div
                  key={notice.id}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #f0f0f0',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#f9f9f9'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#fff'}
                  onClick={() => setIsOpen(false)}
                >
                  <div style={{ marginBottom: '4px' }}>
                    <h4
                      style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        margin: 0,
                        marginBottom: '4px',
                        color: '#1a1a1a',
                      }}
                    >
                      {notice.title}
                    </h4>
                    <p
                      style={{
                        fontSize: '12px',
                        color: '#999',
                        margin: 0,
                        marginBottom: '6px',
                      }}
                    >
                      {formatDate(notice.created_at)}
                    </p>
                  </div>
                  <p
                    style={{
                      fontSize: '13px',
                      color: '#666',
                      margin: 0,
                      marginBottom: notice.link ? '8px' : '0',
                      lineHeight: '1.4',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {notice.content}
                  </p>
                  {notice.link && (
                    <a
                      href={notice.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        fontSize: '12px',
                        color: '#8b5cf6',
                        textDecoration: 'none',
                        fontWeight: '500',
                        display: 'inline-block',
                        marginTop: '4px',
                      }}
                    >
                      View Link →
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

