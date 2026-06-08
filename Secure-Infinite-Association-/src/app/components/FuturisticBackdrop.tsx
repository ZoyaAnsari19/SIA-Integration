"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useAnimationControls } from "motion/react";

interface FuturisticBackdropProps {
  iconCount?: number;
}

const iconPool = [
  "💡",
  "⚙️",
  "📊",
  "🔗",
  "🔒",
  "📈",
  "🧠",
  "🌐",
  "🛰️",
  "📱",
];

export default function FuturisticBackdrop({ iconCount = 18 }: FuturisticBackdropProps) {
  const [isClient, setIsClient] = useState(false);
  const controls = useAnimationControls();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    controls.start((i) => ({
      y: [0, -30, 0],
      x: [0, i % 2 === 0 ? 15 : -15, 0],
      opacity: [0.3, 1, 0.3],
      scale: [0.9, 1.05, 0.9],
      transition: {
        duration: 6 + (i % 5),
        repeat: Infinity,
        ease: "easeInOut",
        delay: (i % 10) * 0.2,
      },
    }));
  }, [controls]);

  const icons = useMemo(() => {
    return new Array(iconCount).fill(0).map((_, i) => ({
      id: i,
      char: iconPool[i % iconPool.length],
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 18 + Math.round(Math.random() * 10),
    }));
  }, [iconCount]);

  if (!isClient) {
    return <div className="absolute inset-0 pointer-events-none" />;
  }

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* radial glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-400/10 via-blue-500/5 to-transparent blur-3xl" />
      {icons.map((ic, i) => (
        <motion.span
          key={ic.id}
          custom={i}
          animate={controls}
          style={{
            left: `${ic.left}%`,
            top: `${ic.top}%`,
            fontSize: ic.size,
          }}
          className="absolute text-cyan-300/70 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)] select-none"
        >
          {ic.char}
        </motion.span>
      ))}
    </div>
  );
}


