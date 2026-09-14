/**
 * Header/announcement-bar icons (search, account, bag, dismiss) — the real
 * exported Figma assets (get_design_context on node 10:2 / 15:32, file
 * 9SzUlTWGVKOCkAULkbqOsr; each glyph's own node under it: Icon/Search
 * 15:8, Icon/Account 15:14, Icon/Bag 15:17, Dismiss 24:6), downloaded once
 * this environment's egress policy on www.figma.com actually allowed it —
 * see the CLAUDE.md/README history for the earlier stand-in-icon state.
 * Colour swatch dots (lib/shop/colour-swatch.ts) are a separate,
 * deliberate exception: Figma's "Colours" asset there is a flat mockup
 * image of one product's example colours, not a reusable component, so a
 * downloaded copy couldn't represent every real product's actual colour
 * set the way the CSS-driven dots already do.
 *
 * Each asset's own 44x44 viewBox IS the full touch target (per the
 * component description: "Every icon target is 44px") -- rendered at
 * width/height 44 to exactly fill the existing 44x44 icon buttons in
 * header.tsx/announcement-bar.tsx, not centered as a smaller glyph inside
 * them. Stroke colour is `currentColor` (the exports hardcoded #12100E /
 * #FFFDF8, matching text-primary and text-inverse respectively for their
 * one usage context) so each button's own `color` continues to drive it,
 * same as every other icon in this codebase.
 *
 * Menu is not an exported asset -- Figma builds it from three plain
 * rectangles, not a vector/image node (see design-system-state.json's
 * note on rotated-LINE glyphs) -- so it stays hand-authored here.
 */

export function SearchIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden xmlns="http://www.w3.org/2000/svg">
      <circle cx="19.5" cy="19.5" r="6.875" stroke="currentColor" strokeWidth="1.25" />
      <line x1="26.4419" y1="29.5581" x2="31.3917" y2="34.5078" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

export function AccountIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden xmlns="http://www.w3.org/2000/svg">
      <circle cx="22" cy="16.5" r="4.875" stroke="currentColor" strokeWidth="1.25" />
      <mask id="mc-icon-account-mask" fill="white">
        <path d="M12.5 33.5C12.5 32.2524 12.7457 31.0171 13.2231 29.8645C13.7006 28.7119 14.4003 27.6646 15.2825 26.7825C16.1646 25.9003 17.2119 25.2006 18.3645 24.7231C19.5171 24.2457 20.7524 24 22 24C23.2476 24 24.4829 24.2457 25.6355 24.7231C26.7881 25.2006 27.8354 25.9003 28.7175 26.7825C29.5997 27.6646 30.2994 28.7119 30.7769 29.8645C31.2543 31.0171 31.5 32.2524 31.5 33.5L22 33.5L12.5 33.5Z" />
      </mask>
      <path
        d="M12.5 33.5C12.5 32.2524 12.7457 31.0171 13.2231 29.8645C13.7006 28.7119 14.4003 27.6646 15.2825 26.7825C16.1646 25.9003 17.2119 25.2006 18.3645 24.7231C19.5171 24.2457 20.7524 24 22 24C23.2476 24 24.4829 24.2457 25.6355 24.7231C26.7881 25.2006 27.8354 25.9003 28.7175 26.7825C29.5997 27.6646 30.2994 28.7119 30.7769 29.8645C31.2543 31.0171 31.5 32.2524 31.5 33.5L22 33.5L12.5 33.5Z"
        stroke="currentColor"
        strokeWidth="2.5"
        mask="url(#mc-icon-account-mask)"
      />
    </svg>
  );
}

export function BagIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden xmlns="http://www.w3.org/2000/svg">
      <mask id="mc-icon-bag-mask-body" fill="white">
        <rect x="12.5" y="18" width="19" height="17" rx="1" />
      </mask>
      <rect x="12.5" y="18" width="19" height="17" rx="1" stroke="currentColor" strokeWidth="2.5" mask="url(#mc-icon-bag-mask-body)" />
      <mask id="mc-icon-bag-mask-handle" fill="white">
        <path d="M16.5 18C16.5 17.2777 16.6423 16.5625 16.9187 15.8952C17.1951 15.2279 17.6002 14.6216 18.1109 14.1109C18.6216 13.6002 19.228 13.1951 19.8952 12.9187C20.5625 12.6423 21.2777 12.5 22 12.5C22.7223 12.5 23.4375 12.6423 24.1048 12.9187C24.7721 13.1951 25.3784 13.6002 25.8891 14.1109C26.3998 14.6216 26.8049 15.228 27.0813 15.8952C27.3577 16.5625 27.5 17.2777 27.5 18L22 18L16.5 18Z" />
      </mask>
      <path
        d="M16.5 18C16.5 17.2777 16.6423 16.5625 16.9187 15.8952C17.1951 15.2279 17.6002 14.6216 18.1109 14.1109C18.6216 13.6002 19.228 13.1951 19.8952 12.9187C20.5625 12.6423 21.2777 12.5 22 12.5C22.7223 12.5 23.4375 12.6423 24.1048 12.9187C24.7721 13.1951 25.3784 13.6002 25.8891 14.1109C26.3998 14.6216 26.8049 15.228 27.0813 15.8952C27.3577 16.5625 27.5 17.2777 27.5 18L22 18L16.5 18Z"
        stroke="currentColor"
        strokeWidth="2.5"
        mask="url(#mc-icon-bag-mask-handle)"
      />
    </svg>
  );
}

export function DismissIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden xmlns="http://www.w3.org/2000/svg">
      <path d="M16 16L28 28M28 16L16 28" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

const stroke = 'currentColor';

export function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M2 6h16M2 10h16M2 14h16" stroke={stroke} strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}
