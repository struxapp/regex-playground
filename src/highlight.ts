import type { MatchInfo } from './matcher';

export interface Segment {
  text: string;
  /** Index into the matches array, or -1 outside any match. */
  match: number;
  /** Innermost capturing group covering this text (0 = none). */
  group: number;
  /** A zero-length match marker (text is empty). */
  empty?: boolean;
}

/**
 * Splits the text into runs that share the same match and innermost group, ready to render as marks.
 * Zero-length matches become empty marker segments at their position.
 */
export function segmentText(text: string, matches: readonly MatchInfo[]): Segment[] {
  const segments: Segment[] = [];
  let pos = 0;
  const plain = (to: number): void => {
    if (to > pos) segments.push({ text: text.slice(pos, to), match: -1, group: 0 });
    pos = Math.max(pos, to);
  };

  matches.forEach((m, mi) => {
    if (m.index < pos) return; // never overlap (cannot happen with JavaScript's matcher, but stay safe)
    plain(m.index);
    if (m.end === m.index) {
      segments.push({ text: '', match: mi, group: 0, empty: true });
      return;
    }
    const spans = m.groups
      .filter((g) => g.start !== undefined && g.end !== undefined && (g.end as number) > (g.start as number))
      .map((g) => ({ number: g.number, start: Math.max(m.index, g.start as number), end: Math.min(m.end, g.end as number) }))
      .filter((g) => g.end > g.start);
    const cuts = new Set<number>([m.index, m.end]);
    for (const g of spans) {
      cuts.add(g.start);
      cuts.add(g.end);
    }
    const points = [...cuts].sort((a, b) => a - b);
    for (let k = 0; k < points.length - 1; k += 1) {
      const a = points[k];
      const b = points[k + 1];
      let best = 0;
      let bestSize = Infinity;
      for (const g of spans) {
        if (g.start <= a && b <= g.end) {
          const size = g.end - g.start;
          if (size < bestSize || (size === bestSize && g.number > best)) {
            best = g.number;
            bestSize = size;
          }
        }
      }
      const last = segments[segments.length - 1];
      if (last && last.match === mi && last.group === best && !last.empty) last.text += text.slice(a, b);
      else segments.push({ text: text.slice(a, b), match: mi, group: best });
    }
    pos = m.end;
  });
  plain(text.length);
  return segments;
}
