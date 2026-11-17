import { explain, type GroupDef } from './explain';

export interface GroupMatch {
  number: number;
  name?: string;
  value: string | undefined;
  start?: number;
  end?: number;
}

export interface MatchInfo {
  index: number;
  end: number;
  text: string;
  groups: GroupMatch[];
}

export interface ReplacePart {
  text: string;
  /** True when this part was produced by the replacement template. */
  replaced: boolean;
}

export interface MatchResult {
  ok: true;
  matches: MatchInfo[];
  /** Matches found (may exceed matches.length when the list was capped). */
  total: number;
  truncated: boolean;
  groups: GroupDef[];
  replaced: string | null;
  replaceParts: ReplacePart[] | null;
  elapsedMs: number;
}

export interface MatchError {
  ok: false;
  error: string;
}

export const MATCH_LIMIT = 5000;

/** Validates the flags and builds the RegExp; the message is the engine's own. */
export function compile(pattern: string, flags: string): RegExp | MatchError {
  try {
    return new RegExp(pattern, flags);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Expands a replacement template for one match, following ECMAScript GetSubstitution:
 * $$, $&, $`, $', $n / $nn and $<name>.
 */
export function expandReplacement(
  template: string,
  matched: string,
  position: number,
  input: string,
  captures: (string | undefined)[],
  namedCaptures: Record<string, string | undefined> | undefined,
): string {
  let result = '';
  let i = 0;
  const m = captures.length;
  while (i < template.length) {
    const ch = template[i];
    if (ch !== '$' || i + 1 >= template.length) {
      result += ch;
      i += 1;
      continue;
    }
    const next = template[i + 1];
    if (next === '$') {
      result += '$';
      i += 2;
    } else if (next === '&') {
      result += matched;
      i += 2;
    } else if (next === '`') {
      result += input.slice(0, position);
      i += 2;
    } else if (next === "'") {
      result += input.slice(Math.min(input.length, position + matched.length));
      i += 2;
    } else if (next >= '0' && next <= '9') {
      const twoDigits = template[i + 2] >= '0' && template[i + 2] <= '9';
      let digitCount = twoDigits ? 2 : 1;
      let index = Number(template.slice(i + 1, i + 1 + digitCount));
      if (digitCount === 2 && index > m) {
        digitCount = 1;
        index = Number(next);
      }
      if (index >= 1 && index <= m) {
        result += captures[index - 1] ?? '';
      } else {
        result += template.slice(i, i + 1 + digitCount);
      }
      i += 1 + digitCount;
    } else if (next === '<') {
      const gt = template.indexOf('>', i + 2);
      if (gt === -1 || namedCaptures === undefined) {
        result += '$<';
        i += 2;
      } else {
        const name = template.slice(i + 2, gt);
        result += namedCaptures[name] ?? '';
        i = gt + 1;
      }
    } else {
      result += '$';
      i += 1;
    }
  }
  return result;
}

function advance(text: string, index: number, unicode: boolean): number {
  if (!unicode || index + 1 >= text.length) return index + 1;
  const code = text.charCodeAt(index);
  return code >= 0xd800 && code <= 0xdbff ? index + 2 : index + 1;
}

/** Finds the matches with JavaScript's own semantics (only the first match without the g flag). */
export function runMatch(pattern: string, flags: string, text: string, replacement: string | null, limit = MATCH_LIMIT): MatchResult | MatchError {
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const user = compile(pattern, flags);
  if (!(user instanceof RegExp)) return user;
  const withIndices = flags.includes('d') ? flags : `${flags}d`;
  const re = compile(pattern, withIndices);
  if (!(re instanceof RegExp)) return re;

  const { groups: groupDefs } = explain(pattern, flags);
  const global = re.global;
  const unicode = re.unicode || flags.includes('v');
  const matches: MatchInfo[] = [];
  const raw: RegExpExecArray[] = [];
  let total = 0;
  re.lastIndex = 0;

  for (;;) {
    const m = re.exec(text);
    if (!m) break;
    total += 1;
    if (matches.length < limit) {
      const indices = m.indices;
      const groups: GroupMatch[] = [];
      for (let g = 1; g < m.length; g += 1) {
        const span = indices?.[g];
        groups.push({
          number: g,
          name: groupDefs[g - 1]?.name,
          value: m[g],
          start: span?.[0],
          end: span?.[1],
        });
      }
      matches.push({ index: m.index, end: m.index + m[0].length, text: m[0], groups });
      raw.push(m);
    }
    if (!global) break;
    if (m[0].length === 0) re.lastIndex = advance(text, re.lastIndex, unicode);
    if (total >= limit * 4) break;
  }

  let replaced: string | null = null;
  let replaceParts: ReplacePart[] | null = null;
  if (replacement !== null) {
    if (total > matches.length) {
      replaced = text.replace(user, replacement);
    } else {
      replaceParts = [];
      let last = 0;
      for (const m of raw) {
        if (m.index > last) replaceParts.push({ text: text.slice(last, m.index), replaced: false });
        const captures = Array.from({ length: m.length - 1 }, (_, k) => m[k + 1]);
        replaceParts.push({ text: expandReplacement(replacement, m[0], m.index, text, captures, m.groups), replaced: true });
        last = m.index + m[0].length;
      }
      if (last < text.length) replaceParts.push({ text: text.slice(last), replaced: false });
      replaced = replaceParts.map((p) => p.text).join('');
    }
  }

  const ended = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    ok: true,
    matches,
    total,
    truncated: total > matches.length,
    groups: groupDefs,
    replaced,
    replaceParts,
    elapsedMs: ended - started,
  };
}
