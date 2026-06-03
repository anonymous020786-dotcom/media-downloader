'use client'
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#0a0e1a', color: '#f1f5f9', margin: 0,
                     minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 12 }}>Application error</h1>
          <p style={{ color: '#9ca3af', marginBottom: 24, lineHeight: 1.6 }}>
            A critical error occurred. Please reload the page.
          </p>
          <button onClick={reset}
            style={{ background: '#6366f1', color: '#fff', border: 0, borderRadius: 12, padding: '10px 20px',
                     fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
