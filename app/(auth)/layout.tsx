/**
 * Shared shell for the four auth screens — "10 Auth" in
 * docs/design-system-state.json: "Centred 460px card."
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--mc-space-lg)',
        background: 'var(--mc-bg-page)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: 'var(--mc-bg-surface)',
          border: '1px solid var(--mc-border-default)',
          borderRadius: 'var(--mc-radius-md)',
          padding: 'var(--mc-space-xl)',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </div>
    </main>
  );
}
