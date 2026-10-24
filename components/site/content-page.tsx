import Link from 'next/link';

/**
 * The content-page shell, which the design ledger records as a real reusable
 * thing rather than a per-page layout: `content_page_shell` says it is
 * "Announcement Bar + Header + 'Page content' + Footer, with a FIXED-width
 * content column on desktop so the column centres", and names 23, 32, 33,
 * 34 and 35 as its users.
 *
 * The chrome is already the site layout's job, so this is the middle:
 * a centred column, capped at 980 (122:6529's own width), with the page
 * head the frames all draw — breadcrumb, display title, standfirst.
 *
 * Built now for 33 Delivery and Returns, and kept general because four
 * more screens in the file are drawn on it.
 */
export function ContentPage({
  breadcrumb,
  title,
  intro,
  children,
}: {
  breadcrumb: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mc-content-page" style={{ fontFamily: 'var(--mc-font-body)' }}>
      <div className="mc-content-column">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--mc-text-muted)' }}>
            <Link href="/" style={{ color: 'inherit' }}>
              Home
            </Link>{' '}
            / {breadcrumb}
          </p>
          <h1 className="mc-content-title">{title}</h1>
          {intro && (
            <p style={{ margin: 0, fontSize: 16, lineHeight: '25px', color: 'var(--mc-text-muted)' }}>
              {intro}
            </p>
          )}
        </div>
        {children}
      </div>
    </main>
  );
}

/** A section: SemiBold 20 heading over 15/24 body (122:6565). */
export function ContentSection({
  id,
  heading,
  children,
}: {
  id?: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{heading}</h2>
      {children}
    </section>
  );
}

/** Body copy at the frames' 15/24. */
export function ContentText({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: 0, fontSize: 15, lineHeight: '24px' }}>{children}</p>;
}
