/**
 * Shared between the server-side content loader and the client-side
 * Announcement Bar, which is why it is not in sections.ts — that module is
 * `server-only`, and importing it from a client component would be a build
 * error (rule 7's instinct, applied to a file that holds no secret but is
 * still server-shaped).
 */
export const THRESHOLD_TOKEN = '{threshold}';
