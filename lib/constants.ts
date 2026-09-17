// Reserved id for the single real, OAuth-connected Gmail account, kept well
// clear of the mock accounts (ids 1-12) and mock emails (ids 1-10) in
// lib/mock-data.ts so the two data sources can be merged safely.
export const REAL_GMAIL_ACCOUNT_ID = 1000;

/** Stay under Vercel’s ~4.5MB serverless body limit (FUNCTION_PAYLOAD_TOO_LARGE). */
export const GROK_ATTACH_MAX_FILE_BYTES = 2_000_000;
export const GROK_ATTACH_MAX_TOTAL_BYTES = 3_000_000;
export const GROK_ASK_MAX_BODY_BYTES = 4_000_000;
export const GROK_ATTACH_TOO_LARGE =
  "This file is too large for Cloud Chrome upload (max 2 MB per file, 3 MB total). Try a smaller PDF.";

export function grokAttachSizeError(question: string, files: { size: number }[]): string | null {
  if (files.some((f) => f.size > GROK_ATTACH_MAX_FILE_BYTES)) return GROK_ATTACH_TOO_LARGE;
  const qBytes = new TextEncoder().encode(question || "").length;
  const total = files.reduce((n, f) => n + (Number(f.size) || 0), 0) + qBytes;
  if (total > GROK_ATTACH_MAX_TOTAL_BYTES) return GROK_ATTACH_TOO_LARGE;
  return null;
}
