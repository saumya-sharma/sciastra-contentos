'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Lume] Unhandled error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0d0d0b', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '32px' }}>
            <span style={{ color: '#e8a020', fontSize: '28px', lineHeight: 1 }}>●</span>
            <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '28px', color: '#ffffff', fontWeight: 400, letterSpacing: '-0.02em' }}>Lume</span>
          </div>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>⚡</div>
          <p style={{ fontSize: '18px', color: '#94a3b8', marginBottom: '8px' }}>Something went wrong</p>
          <p style={{ fontSize: '14px', color: '#475569', maxWidth: '360px', margin: '0 auto 40px' }}>
            An unexpected error occurred. Our team has been notified.
            {error.digest && (
              <span style={{ display: 'block', marginTop: '8px', fontSize: '11px', color: '#334155', fontFamily: 'monospace' }}>
                ref: {error.digest}
              </span>
            )}
          </p>
          <button
            onClick={reset}
            style={{
              padding: '10px 24px',
              background: '#e8a020',
              color: '#0d0d0b',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '0.01em',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
