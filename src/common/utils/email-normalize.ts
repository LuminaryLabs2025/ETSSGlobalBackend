/** Normalize for storage and lookup (case + surrounding whitespace). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
