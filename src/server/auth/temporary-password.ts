import { randomBytes } from "node:crypto";

/**
 * One-time password for new or reset accounts: 18 characters from a 57-symbol
 * alphabet (~105 bits) plus a fixed letter-digit tail so it always meets the
 * letters+digits policy. Users must replace it at first sign-in.
 */
export function temporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const body = Array.from(randomBytes(18), (b) => alphabet[b % alphabet.length]).join("");
  return `${body.slice(0, 6)}-${body.slice(6, 12)}-${body.slice(12)}7a`;
}
