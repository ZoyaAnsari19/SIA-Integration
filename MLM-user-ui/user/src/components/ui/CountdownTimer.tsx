"use client";

import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { Card } from "./Card";

type CountdownTimerProps = {
  targetDate: Date | number; // Date or milliseconds
  onComplete?: () => void;
  showIcon?: boolean;
  className?: string;
  textClassName?: string;
  label?: string;
  format?: "full" | "compact";
};

export function CountdownTimer({
  targetDate,
  onComplete,
  showIcon = true,
  className = "",
  textClassName = "",
  label = "Time Remaining",
  format = "full",
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const target =
      typeof targetDate === "number" ? targetDate : targetDate.getTime();

    const updateTimer = () => {
      const now = Date.now();
      const difference = target - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setIsComplete(true);
        if (onComplete) onComplete();
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
      setIsComplete(false);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [targetDate, onComplete]);

  if (isComplete) {
    return (
      <div className={`text-center ${className}`}>
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg p-4 text-center">
          <div className="text-2xl mb-2">🎉</div>
          <p className="text-white font-bold text-lg mb-1">Time's Up!</p>
          <p className="text-emerald-50 text-sm">Countdown Complete</p>
        </div>
      </div>
    );
  }

  if (format === "compact") {
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`}>
        {showIcon && <Clock className="w-4 h-4 text-[var(--text-muted)]" />}
        <span className={textClassName || "text-[var(--text-muted)]"}>
          {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m{" "}
          {timeLeft.seconds}s
        </span>
      </div>
    );
  }

  return (
    <Card
      className={`p-4 border border-emerald-500/30 transition-colors duration-200 ${className}`}
    >
      <div className="flex items-center gap-1 mb-1.5">
        {showIcon && <Clock className="w-3 h-3 text-emerald-600" />}
        <span className="text-[11px] font-semibold text-emerald-400">
          {label}
        </span>
      </div>
      <div className="bg-[var(--card-bg)] rounded-lg p-2 border border-emerald-500/30 transition-colors duration-200">
        <div className="grid grid-cols-4 gap-1">
          <div className="text-center">
            <div className="text-base font-black text-emerald-600">
              {timeLeft.days}
            </div>
            <div className="text-[9px] text-[var(--text-muted)] uppercase">
              Days
            </div>
          </div>
          <div className="text-center">
            <div className="text-base font-black text-emerald-600">
              {String(timeLeft.hours).padStart(2, "0")}
            </div>
            <div className="text-[9px] text-[var(--text-muted)] uppercase">
              Hrs
            </div>
          </div>
          <div className="text-center">
            <div className="text-base font-black text-emerald-600">
              {String(timeLeft.minutes).padStart(2, "0")}
            </div>
            <div className="text-[9px] text-[var(--text-muted)] uppercase">
              Mins
            </div>
          </div>
          <div className="text-center">
            <div className="text-base font-black text-emerald-600">
              {String(timeLeft.seconds).padStart(2, "0")}
            </div>
            <div className="text-[9px] text-[var(--text-muted)] uppercase">
              Secs
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default CountdownTimer;
