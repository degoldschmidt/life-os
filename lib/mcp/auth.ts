/** Constant-time check of an `Authorization: Bearer <token>` header against an env secret. */
export function bearerMatches(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 16 || !header) return false;
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const token = m[1].trim();
  if (token.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}
