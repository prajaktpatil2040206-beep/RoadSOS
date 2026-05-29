export default function LoadingSpinner({ size = 32, text }: { size?: number; text?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        border: `3px solid rgba(239,68,68,0.2)`,
        borderTopColor: '#ef4444',
        animation: 'spin 0.7s linear infinite',
      }} />
      {text && <p style={{ color: 'var(--text-2)', fontSize: '0.85rem' }}>{text}</p>}
    </div>
  );
}
