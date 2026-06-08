"use client";

import React from "react";
import { Check, X } from "lucide-react";

type PasswordStrengthProps = {
  password: string;
  className?: string;
};

type StrengthLevel = "weak" | "fair" | "good" | "strong";

export function PasswordStrength({
  password,
  className = "",
}: PasswordStrengthProps) {
  const getPasswordStrength = (pwd: string): {
    level: StrengthLevel;
    score: number;
    checks: {
      length: boolean;
      uppercase: boolean;
      lowercase: boolean;
      number: boolean;
      special: boolean;
    };
  } => {
    const checks = {
      length: pwd.length >= 8,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      number: /\d/.test(pwd),
      special: /[^a-zA-Z\d]/.test(pwd),
    };

    const score = Object.values(checks).filter(Boolean).length;
    let level: StrengthLevel = "weak";
    if (score >= 4) level = "strong";
    else if (score >= 3) level = "good";
    else if (score >= 2) level = "fair";

    return { level, score, checks };
  };

  const { level, checks } = getPasswordStrength(password);

  if (!password) return null;

  const getStrengthColor = () => {
    switch (level) {
      case "weak":
        return "bg-red-500";
      case "fair":
        return "bg-amber-500";
      case "good":
        return "bg-blue-500";
      case "strong":
        return "bg-emerald-500";
    }
  };

  const getStrengthText = () => {
    switch (level) {
      case "weak":
        return "Weak";
      case "fair":
        return "Fair";
      case "good":
        return "Good";
      case "strong":
        return "Strong";
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-[var(--sidebar-hover)] rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${getStrengthColor()}`}
            style={{
              width: `${(Object.values(checks).filter(Boolean).length / 5) * 100}%`,
            }}
          />
        </div>
        <span
          className={`text-xs font-medium ${
            level === "weak"
              ? "text-red-600"
              : level === "fair"
                ? "text-amber-600"
                : level === "good"
                  ? "text-blue-600"
                  : "text-emerald-600"
          }`}
        >
          {getStrengthText()}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        <div className="flex items-center gap-1.5">
          {checks.length ? (
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <X className="w-3.5 h-3.5 text-red-600" />
          )}
          <span className="text-[var(--text-muted)]">8+ characters</span>
        </div>
        <div className="flex items-center gap-1.5">
          {checks.uppercase ? (
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <X className="w-3.5 h-3.5 text-red-600" />
          )}
          <span className="text-[var(--text-muted)]">Uppercase</span>
        </div>
        <div className="flex items-center gap-1.5">
          {checks.lowercase ? (
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <X className="w-3.5 h-3.5 text-red-600" />
          )}
          <span className="text-[var(--text-muted)]">Lowercase</span>
        </div>
        <div className="flex items-center gap-1.5">
          {checks.number ? (
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <X className="w-3.5 h-3.5 text-red-600" />
          )}
          <span className="text-[var(--text-muted)]">Number</span>
        </div>
        <div className="flex items-center gap-1.5 col-span-2">
          {checks.special ? (
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <X className="w-3.5 h-3.5 text-red-600" />
          )}
          <span className="text-[var(--text-muted)]">Special character</span>
        </div>
      </div>
    </div>
  );
}

