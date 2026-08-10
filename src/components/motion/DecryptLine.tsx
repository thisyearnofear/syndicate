"use client";

/**
 * DECRYPT LINE — the privacy model, demonstrated: ciphered copy that reveals
 * only around your cursor ("computes hidden; reveal is local").
 *
 * Mechanics:
 *   - Each character renders as a cipher glyph until the cursor comes within
 *     REVEAL_RADIUS of it; inside the radius, the real character shows.
 *   - Leaving the radius re-ciphers the character (selective reveal).
 *   - prefers-reduced-motion and touch devices get the plain text.
 *
 * Perf: character rects are measured once (mount + resize); pointermove work
 * is O(chars) distance math inside a single rAF per frame.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const REVEAL_RADIUS = 110;
const GLYPHS = '0123456789abcdef#$%&*+·≡∮ΞΔ◊'.split('');

// Deterministic-ish glyph per char index so SSR and client agree at least
// until hydration swaps in interactivity; spaces never cipher.
const glyphFor = (index: number, salt: number): string =>
  GLYPHS[(index * 7 + salt * 13) % GLYPHS.length];

interface DecryptLineProps {
  text: string;
  className?: string;
}

export function DecryptLine({ text, className = "" }: DecryptLineProps) {
  const containerRef = useRef<HTMLParagraphElement | null>(null);
  const rectRef = useRef<{ x: number; y: number }[]>([]);
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(new Set());
  const [locked, setLocked] = useState(false); // reduced motion / fine-pointer absent
  const rafRef = useRef(0);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (reduced || coarse) {
      const all = new Set<number>();
      let index = 0;
      for (const ch of text) {
        if (ch !== ' ') all.add(index);
        index += 1;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time settle into final state for non-interactive visitors
      setLocked(true);
      setRevealed(all);
    }
  }, [text]);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const spans = el.querySelectorAll<HTMLSpanElement>('[data-cipher-index]');
    const rects: { x: number; y: number }[] = [];
    spans.forEach((span) => {
      const r = span.getBoundingClientRect();
      rects.push({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    });
    rectRef.current = rects;
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const onMove = useCallback(
    (clientX: number, clientY: number) => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const rects = rectRef.current;
        if (!rects.length) return;
        const next = new Set<number>();
        for (let i = 0; i < rects.length; i++) {
          const dx = rects[i].x - clientX;
          const dy = rects[i].y - clientY;
          if (dx * dx + dy * dy < REVEAL_RADIUS * REVEAL_RADIUS) next.add(i);
        }
        setRevealed(next);
      });
    },
    [],
  );

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <p
      ref={containerRef}
      className={className}
      onPointerMove={(e) => {
        if (!locked) onMove(e.clientX, e.clientY);
      }}
      onPointerLeave={() => {
        if (!locked) setRevealed(new Set());
      }}
    >
      {text.split('').map((ch, i) =>
        ch === ' ' ? (
          ' '
        ) : revealed.has(i) ? (
          <span key={i} data-cipher-index={i} className="decrypt-revealed">
            {ch}
          </span>
        ) : (
          <span key={i} data-cipher-index={i} className="decrypt-cipher font-mono">
            {glyphFor(i, text.length)}
          </span>
        ),
      )}
    </p>
  );
}
