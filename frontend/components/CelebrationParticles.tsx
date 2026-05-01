'use client';

import { useState } from 'react';

export default function CelebrationParticles() {
  const [particles] = useState<{ left: string; animationDelay: string; duration: string }[]>(() =>
    Array.from({ length: 20 }).map(() => ({
      left: `${Math.random() * 100}%`,
      animationDelay: `${Math.random() * 2}s`,
      duration: `${2 + Math.random() * 3}s`,
    }))
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute h-2 w-2 rounded-full"
          style={{
            background: i % 2 === 0 ? 'var(--color-accent)' : 'var(--color-amber)',
            top: '-20px',
            left: p.left,
            animation: `fall ${p.duration} linear infinite`,
            animationDelay: p.animationDelay,
            opacity: 0.6,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(600px) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
