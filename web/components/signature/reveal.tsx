"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type RevealTag = "div" | "section" | "ol" | "ul" | "li" | "figure" | "article" | "aside";

export interface RevealProps extends React.HTMLAttributes<HTMLElement> {
  as?: RevealTag;
  /** "rise" fades + lifts the block; "grow" lets children with `.ks-rung` grow in (skill ladder). */
  variant?: "rise" | "grow";
  children: React.ReactNode;
}

/**
 * Reveal once on scroll (IntersectionObserver, no dependencies). The hidden state is only applied
 * by JS after mount, so content is always visible without JS, in print and to crawlers. Under
 * `prefers-reduced-motion` nothing is armed: content is simply there.
 */
export function Reveal({ as = "div", variant = "rise", className, children, ...rest }: RevealProps) {
  const ref = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === "undefined") return;
    if (!("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = el.getBoundingClientRect();
    // Already on screen at mount: a "rise" would only flash, so leave it alone.
    if (variant === "rise" && rect.top < window.innerHeight && rect.bottom > 0) return;

    el.dataset.reveal = "armed";
    let frame = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => {
            el.dataset.reveal = "shown";
          });
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [variant]);

  const Tag = as as React.ElementType;
  return (
    <Tag ref={ref} className={cn(className)} {...rest}>
      {children}
    </Tag>
  );
}
