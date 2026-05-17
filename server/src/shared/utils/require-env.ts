export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required — set it in .env`);
  return value;
}
