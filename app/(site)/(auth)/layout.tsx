/**
 * Shared shell for the four auth screens — Figma "Auth wrap" / "Auth card"
 * (e.g. node 95:2645 / 95:2646, file 9SzUlTWGVKOCkAULkbqOsr): a plain
 * 460px-wide column directly on the page background, not a bordered card —
 * the borders live on the inputs and buttons, not a container around them.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '56px var(--mc-gutter-desktop) 72px',
        background: 'var(--mc-bg-page)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {children}
      </div>
    </main>
  );
}
