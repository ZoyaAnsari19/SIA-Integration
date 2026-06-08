"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

interface TextTypeProps {
  text: string[];
  typingSpeed?: number; // ms per character
  pauseDuration?: number; // ms between words
  showCursor?: boolean;
  cursorCharacter?: string;
  className?: string;
}

export default function TextType({
  text,
  typingSpeed = 75,
  pauseDuration = 1500,
  showCursor = true,
  cursorCharacter = "|",
  className,
}: TextTypeProps) {
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const cursorRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let isKilled = false;

    const typeSequence = async () => {
      while (!isKilled) {
        for (const phrase of text) {
          if (isKilled) return;
          await typeText(phrase);
          await delay(pauseDuration);
          await eraseText();
        }
      }
    };

    const typeText = async (phrase: string) => {
      const target = containerRef.current;
      if (!target) return;
      target.textContent = "";
      for (let i = 0; i < phrase.length; i++) {
        if (isKilled) return;
        target.textContent = phrase.slice(0, i + 1);
        await delay(typingSpeed);
      }
    };

    const eraseText = async () => {
      const target = containerRef.current;
      if (!target) return;
      const current = target.textContent ?? "";
      for (let i = current.length; i >= 0; i--) {
        if (isKilled) return;
        target.textContent = current.slice(0, i - 1);
        await delay(Math.max(typingSpeed * 0.6, 20));
      }
    };

    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

    // Cursor blink
    if (showCursor && cursorRef.current) {
      gsap.to(cursorRef.current, {
        opacity: 0,
        repeat: -1,
        yoyo: true,
        duration: 0.6,
        ease: "power1.inOut",
      });
    }

    typeSequence();

    return () => {
      isKilled = true;
      gsap.killTweensOf(cursorRef.current);
    };
  }, [text, typingSpeed, pauseDuration, showCursor]);

  return (
    <span className={className}>
      <span ref={containerRef} />
      {showCursor && (
        <span ref={cursorRef} className='ml-1'>
          {cursorCharacter}
        </span>
      )}
    </span>
  );
}
