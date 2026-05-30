export function normalizeUsername(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/\s+/g, '');
}
