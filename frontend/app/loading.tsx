// frontend/app/loading.tsx

export default function Loading() {
  return (
    <div className="min-h-dvh px-5 py-8">
      {/* Header skeleton */}
      <div className="flex items-center gap-3 animate-fade-up">
        <div className="skeleton h-10 w-10 rounded-xl" />
        <div className="skeleton h-4 w-20 rounded-md" />
      </div>

      {/* Hero skeleton */}
      <div className="mt-8 animate-fade-up" style={{ animationDelay: '100ms' }}>
        <div className="skeleton h-10 w-3/4 rounded-lg" />
        <div className="skeleton mt-3 h-10 w-1/2 rounded-lg" />
        <div className="skeleton mt-4 h-5 w-full rounded-md" />
      </div>

      {/* Card skeletons */}
      <div className="mt-8 space-y-4 animate-fade-up" style={{ animationDelay: '200ms' }}>
        <div className="skeleton h-40 rounded-2xl" />
        <div className="skeleton h-14 rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          <div className="skeleton h-28 rounded-xl" />
          <div className="skeleton h-28 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
