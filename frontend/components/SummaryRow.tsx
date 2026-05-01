import React from 'react';

interface SummaryRowProps {
  label: string;
  value: string | number;
  strong?: boolean;
  tone?: 'success' | 'amber' | 'danger';
}

export default function SummaryRow({ label, value, strong, tone }: SummaryRowProps) {
  const color =
    tone === 'danger'
      ? 'var(--color-danger)'
      : tone === 'amber'
        ? 'var(--color-amber)'
        : tone === 'success'
          ? 'var(--color-success)'
          : undefined;

  const textSecondaryColor = 'var(--color-text-secondary)';
  const textPrimaryColor = 'var(--color-text-primary)';
  const borderColor = 'var(--color-border)';

  return (
    <div
      className={`flex items-center justify-between text-sm ${
        strong ? 'mt-4 border-t pt-4 font-bold' : ''
      }`}
      style={
        strong
          ? { borderColor, color: textPrimaryColor }
          : { color: textSecondaryColor }
      }
    >
      <span>{label}</span>
      <span
        className={`tabular-nums ${tone ? 'font-mono' : ''}`}
        style={color ? { color } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
