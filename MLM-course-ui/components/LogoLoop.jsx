'use client';

import React from 'react';

/**
 * Very lightweight logo loop / marquee for horizontal scrolling.
 * We only implement what we need for the home page band.
 */

export default function LogoLoop({
  logos,
  speed = 40, // higher = faster
  logoHeight = 32,
  gap = 64,
  ariaLabel = 'Logos'
}) {
  if (!logos?.length) return null;

  // Duplicate logos for seamless loop
  const loopItems = [...logos, ...logos];

  // Map speed (px/sec-ish) to animation duration in seconds
  const durationSeconds = Math.max(10, 200 / speed);

  return (
    <div
      className="logo-loop-root"
      role="region"
      aria-label={ariaLabel}
      style={{
        '--logo-loop-gap': `${gap}px`,
        '--logo-loop-duration': `${durationSeconds}s`,
        '--logo-loop-height': `${logoHeight}px`
      }}
    >
      <div className="logo-loop-track">
        {loopItems.map((item, idx) => (
          <div key={idx} className="logo-loop-item">
            {item.node}
          </div>
        ))}
      </div>
    </div>
  );
}


