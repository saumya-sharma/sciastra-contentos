import Link from 'next/link';

export default function NotFound() {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0d0d0b', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '32px' }}>
            <span style={{ color: '#e8a020', fontSize: '28px', lineHeight: 1 }}>●</span>
            <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '28px', color: '#ffffff', fontWeight: 400, letterSpacing: '-0.02em' }}>Lume</span>
          </div>
          <div style={{ fontSize: '72px', fontWeight: 700, color: '#1e293b', lineHeight: 1, marginBottom: '16px' }}>404</div>
          <p style={{ fontSize: '18px', color: '#94a3b8', marginBottom: '8px' }}>Page not found</p>
          <p style={{ fontSize: '14px', color: '#475569', marginBottom: '40px', maxWidth: '360px', margin: '0 auto 40px' }}>
            This page doesn&apos;t exist or the link may have expired.
          </p>
          <Link
            href="/"
            style={{
              display: 'inline-block',
              padding: '10px 24px',
              background: '#e8a020',
              color: '#0d0d0b',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
              letterSpacing: '0.01em',
            }}
          >
            Back to Lume
          </Link>
        </div>
      </body>
    </html>
  );
}
