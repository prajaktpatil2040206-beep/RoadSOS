export default function LoadingSpinner({ size = 32, text }: { size?: number; text?: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 12, padding: 40,
    }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        border: `3px solid #E2E8F0`,
        borderTopColor: '#4F46E5',
        animation: 'ct-spin 0.7s linear infinite',
      }} />
      {text && <p style={{ color: '#64748B', fontSize: '0.85rem', fontWeight: 500 }}>{text}</p>}
    </div>
  );
}
