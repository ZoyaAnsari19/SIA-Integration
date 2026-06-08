'use client';

import { useState } from 'react';

export default function VideoPlayer({ embedUrl, title, className = '' }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Detect direct video file URLs (mp4/mov/webm etc.) vs. Bunny iframe URLs.
  const isDirectVideoFile =
    typeof embedUrl === 'string' &&
    /^https?:\/\//.test(embedUrl) &&
    /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(embedUrl);

  if (!embedUrl) {
    return (
      <div
        className={`video-player-error ${className}`}
        style={{
          width: '100%',
          aspectRatio: '16/9',
          backgroundColor: '#000',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <p style={{ fontSize: '18px', fontWeight: '500' }}>No video URL provided</p>
      </div>
    );
  }

  return (
    <div
      className={`enhanced-video-wrapper ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        paddingBottom: '56.25%', // 16:9 aspect ratio
        height: 0,
        overflow: 'hidden',
        backgroundColor: '#000',
        borderRadius: '16px'
      }}
    >
      {loading && (
        <div
          className="video-loading-overlay"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            backgroundColor: '#000',
            zIndex: 10,
            borderRadius: '16px'
          }}
        >
          <div className="video-loading-spinner" style={{
            width: '50px',
            height: '50px',
            border: '4px solid rgba(255, 255, 255, 0.3)',
            borderTop: '4px solid #fff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '16px'
          }}></div>
          <p style={{ fontSize: '16px', fontWeight: '500' }}>Loading video...</p>
        </div>
      )}
      {error && (
        <div
          className="video-error-overlay"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            backgroundColor: '#000',
            padding: '20px',
            zIndex: 10,
            borderRadius: '16px'
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <p style={{ fontSize: '16px', fontWeight: '500', textAlign: 'center' }}>
            Error loading video: {error}
          </p>
        </div>
      )}
      {isDirectVideoFile ? (
        <video
          src={embedUrl}
          controls
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: '16px',
            backgroundColor: '#000'
          }}
          title={title || 'Video player'}
          onLoadedData={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError('Failed to load video');
          }}
        />
      ) : (
        <iframe
          src={embedUrl}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: '16px'
          }}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen
          title={title || 'Video player'}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError('Failed to load video');
          }}
        />
      )}
    </div>
  );
}

