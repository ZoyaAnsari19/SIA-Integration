"use client";

import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";

type OtpCountdownProps = {
  seconds: number;
  onExpire?: () => void;
  className?: string;
};

export function OtpCountdown({
  seconds,
  onExpire,
  className = "",
}: OtpCountdownProps) {
  const [timeLeft, setTimeLeft] = useState(seconds);

  useEffect(() => {
    if (timeLeft <= 0) {
      onExpire?.();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onExpire?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onExpire]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className={`flex items-center gap-1.5 text-sm ${className}`}>
      <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
      <span className="text-[var(--text-muted)]">
        Expires in <span className="font-semibold text-[var(--text-strong)]">{formatTime(timeLeft)}</span>
      </span>
    </div>
  );
}

