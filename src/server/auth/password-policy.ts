/** Matches supabase/config.toml: at least 10 characters with letters and digits. */
export function passwordProblem(password: string): string | null {
  if (password.length < 10) return "Use at least 10 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Use both letters and numbers.";
  if (password.length > 72) return "Use at most 72 characters.";
  return null;
}
