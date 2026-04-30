// frontend/components/StepBreadcrumb.tsx

'use client';

interface StepBreadcrumbProps {
  step: number;
  total: number;
}

export default function StepBreadcrumb({ step, total }: StepBreadcrumbProps) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>
        Step {step}
      </p>
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className="h-1 w-4 rounded-full"
            style={{
              background: i + 1 <= step ? 'var(--color-accent)' : 'var(--color-bg-elevated)',
              opacity: i + 1 === step ? 1 : 0.4
            }}
          />
        ))}
      </div>
    </div>
  );
}
