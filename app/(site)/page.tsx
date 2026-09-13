/**
 * Placeholder root route. The catalogue, product, bag and account pages are
 * not built yet — see "What is not here yet" in README.md.
 */
export default function HomePage() {
  return (
    <main className="mc-page-gutter" style={{ paddingTop: 'var(--mc-space-2xl)', paddingBottom: 'var(--mc-space-2xl)', background: 'var(--mc-bg-page)' }}>
      <h1 style={{ fontFamily: 'var(--mc-font-display)' }}>Metheues Clothings</h1>
      <p style={{ fontFamily: 'var(--mc-font-body)', color: 'var(--mc-text-muted)' }}>
        The storefront is under construction.
      </p>
    </main>
  );
}
