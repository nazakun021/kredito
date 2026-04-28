import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <p className="text-6xl font-extrabold" style={{ color: 'var(--color-text-muted)' }}>
        404
      </p>
      <h1 className="mt-4 text-xl font-extrabold">Page not found</h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        The page you're looking for doesn't exist.
      </p>
      <Link
        href="/"
        className="btn-primary btn-dark mt-8 inline-flex max-w-[200px]"
      >
        <ArrowLeft size={16} />
        Go home
      </Link>
    </div>
  );
}
