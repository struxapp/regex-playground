export interface ShareState {
  pattern: string;
  flags: string;
  text: string;
  replacement: string;
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): string {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/** `#s=<base64url JSON>`: compact and safe for any pattern or text. */
export function encodeShare(state: ShareState): string {
  return `s=${toBase64Url(JSON.stringify([state.pattern, state.flags, state.text, state.replacement]))}`;
}

export function decodeShare(hash: string): ShareState | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const value = params.get('s');
  if (!value) return null;
  try {
    const data: unknown = JSON.parse(fromBase64Url(value));
    if (!Array.isArray(data) || data.length !== 4 || !data.every((v) => typeof v === 'string')) return null;
    const [pattern, flags, text, replacement] = data as string[];
    if (!/^[dgimsuvy]*$/.test(flags)) return null;
    return { pattern, flags, text, replacement };
  } catch {
    return null;
  }
}
