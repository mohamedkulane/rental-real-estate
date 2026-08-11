export function sessionToken(response: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const value = response.headers['set-cookie'];
  const header = Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
  const match = /(?:^|;\s*)rerms_session=([^;]+)/.exec(header);
  if (!match?.[1]) throw new Error('Login response did not set the HttpOnly session cookie.');
  return decodeURIComponent(match[1]);
}
