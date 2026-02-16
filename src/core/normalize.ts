export function normalizeInput(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
