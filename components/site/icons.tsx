/**
 * Header/announcement-bar icons (search, account, bag, dismiss, menu).
 *
 * These are hand-authored stand-ins, not the actual exported Figma assets.
 * This environment's network egress blocks www.figma.com from every tool
 * that could fetch them (curl, WebFetch, download_assets all hit the same
 * "Host not in allowlist" / EGRESS_BLOCKED wall the rest of this session's
 * Supabase work did) -- not a shortcut taken for convenience. Swap these
 * for the real exports (see get_design_context on node 10:2 / 15:32,
 * file 9SzUlTWGVKOCkAULkbqOsr) the moment they can actually be downloaded.
 */

const stroke = 'currentColor';

export function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="8.5" cy="8.5" r="6" stroke={stroke} strokeWidth="1.4" />
      <path d="M13.3 13.3L17.5 17.5" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function AccountIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="6.5" r="3.25" stroke={stroke} strokeWidth="1.4" />
      <path
        d="M3.5 17c0-3.31 2.91-5.5 6.5-5.5s6.5 2.19 6.5 5.5"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BagIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M5.5 7.5h9l.7 9.2a1 1 0 0 1-1 1.08H5.8a1 1 0 0 1-1-1.08l.7-9.2Z"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M7.5 7.5V6a2.5 2.5 0 0 1 5 0v1.5" stroke={stroke} strokeWidth="1.4" />
    </svg>
  );
}

export function DismissIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 2L14 14M14 2L2 14" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M2 6h16M2 10h16M2 14h16" stroke={stroke} strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}
