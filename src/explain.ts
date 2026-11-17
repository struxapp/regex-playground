/**
 * A tokenizer that turns a JavaScript regular expression into plain-English explanations.
 * It is lenient: syntax errors are reported by the RegExp constructor, not here.
 */

export type TokenKind =
  | 'literal'
  | 'escape'
  | 'class'
  | 'set'
  | 'anchor'
  | 'boundary'
  | 'group-open'
  | 'group-close'
  | 'lookaround'
  | 'quantifier'
  | 'alternation'
  | 'backreference'
  | 'dot'
  | 'property';

export interface Token {
  start: number;
  end: number;
  text: string;
  kind: TokenKind;
  description: string;
  /** Nesting depth (0 = top level). */
  depth: number;
}

export interface GroupDef {
  number: number;
  name?: string;
}

export interface Explanation {
  tokens: Token[];
  groups: GroupDef[];
}

const CLASS_ESCAPES: Record<string, string> = {
  d: 'a digit (0–9)',
  D: 'any character that is not a digit',
  w: 'a word character (letter, digit or underscore)',
  W: 'any character that is not a word character',
  s: 'a whitespace character (space, tab, line break…)',
  S: 'any character that is not whitespace',
};

const CONTROL_ESCAPES: Record<string, string> = {
  n: 'a line feed (new line)',
  r: 'a carriage return',
  t: 'a tab',
  f: 'a form feed',
  v: 'a vertical tab',
};

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

function describeChar(ch: string): string {
  if (ch === ' ') return 'a space';
  const code = ch.codePointAt(0) ?? 0;
  if (code < 32 || code === 127) return `the control character U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
  return `“${ch}”`;
}

function times(n: number): string {
  return n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`;
}

/** Counts capturing groups, so backreferences like \12 can be told apart from octal escapes. */
function countCaptures(pattern: string): number {
  let count = 0;
  let inSet = false;
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === '\\') {
      i += 1;
    } else if (inSet) {
      if (ch === ']') inSet = false;
    } else if (ch === '[') {
      inSet = true;
    } else if (ch === '(') {
      if (pattern[i + 1] !== '?') count += 1;
      else if (pattern[i + 2] === '<' && pattern[i + 3] !== '=' && pattern[i + 3] !== '!') count += 1;
    }
  }
  return count;
}

interface EscapeResult {
  length: number;
  kind: TokenKind;
  /** Lower-case description, used inside sets and as a sentence. */
  phrase: string;
}

/** Reads an escape sequence starting at `i` (which points at the backslash). */
function readEscape(pattern: string, i: number, unicode: boolean, inSet: boolean, captureCount: number): EscapeResult {
  const next = pattern[i + 1];
  if (next === undefined) return { length: 1, kind: 'literal', phrase: 'a trailing backslash (incomplete escape)' };
  if (CLASS_ESCAPES[next]) return { length: 2, kind: 'class', phrase: CLASS_ESCAPES[next] };
  if (CONTROL_ESCAPES[next]) return { length: 2, kind: 'escape', phrase: CONTROL_ESCAPES[next] };
  if (next === 'b') {
    return inSet
      ? { length: 2, kind: 'escape', phrase: 'a backspace character' }
      : { length: 2, kind: 'boundary', phrase: 'a word boundary' };
  }
  if (next === 'B' && !inSet) return { length: 2, kind: 'boundary', phrase: 'a position that is not a word boundary' };
  if (next === '0' && !/[0-9]/.test(pattern[i + 2] ?? '')) return { length: 2, kind: 'escape', phrase: 'the NUL character' };
  if (next === 'x' && /^[0-9a-fA-F]{2}$/.test(pattern.slice(i + 2, i + 4))) {
    const ch = String.fromCharCode(Number.parseInt(pattern.slice(i + 2, i + 4), 16));
    return { length: 4, kind: 'escape', phrase: `${describeChar(ch)} (hex ${pattern.slice(i + 2, i + 4).toUpperCase()})` };
  }
  if (next === 'u') {
    if (pattern[i + 2] === '{' && unicode) {
      const close = pattern.indexOf('}', i + 3);
      const hex = close > 0 ? pattern.slice(i + 3, close) : '';
      if (/^[0-9a-fA-F]{1,6}$/.test(hex)) {
        const cp = Number.parseInt(hex, 16);
        const ch = cp <= 0x10ffff ? String.fromCodePoint(cp) : '?';
        return { length: close - i + 1, kind: 'escape', phrase: `${describeChar(ch)} (code point U+${hex.toUpperCase()})` };
      }
    }
    if (/^[0-9a-fA-F]{4}$/.test(pattern.slice(i + 2, i + 6))) {
      const hex = pattern.slice(i + 2, i + 6);
      return { length: 6, kind: 'escape', phrase: `${describeChar(String.fromCharCode(Number.parseInt(hex, 16)))} (U+${hex.toUpperCase()})` };
    }
  }
  if (next === 'c' && /[a-zA-Z]/.test(pattern[i + 2] ?? '')) {
    return { length: 3, kind: 'escape', phrase: `the control character Ctrl+${pattern[i + 2].toUpperCase()}` };
  }
  if ((next === 'p' || next === 'P') && unicode && pattern[i + 2] === '{') {
    const close = pattern.indexOf('}', i + 3);
    if (close > 0) {
      const body = pattern.slice(i + 3, close);
      const [name, value] = body.split('=');
      const what = value ? `${name.replace(/_/g, ' ')} “${value.replace(/_/g, ' ')}”` : `“${body.replace(/_/g, ' ')}”`;
      return {
        length: close - i + 1,
        kind: 'property',
        phrase: next === 'p' ? `a character with the Unicode property ${what}` : `a character without the Unicode property ${what}`,
      };
    }
  }
  if (!inSet && next === 'k' && pattern[i + 2] === '<') {
    const close = pattern.indexOf('>', i + 3);
    if (close > 0) {
      const name = pattern.slice(i + 3, close);
      return { length: close - i + 1, kind: 'backreference', phrase: `the same text that the group “${name}” matched` };
    }
  }
  if (!inSet && /[1-9]/.test(next)) {
    let digits = '';
    let j = i + 1;
    while (j < pattern.length && /[0-9]/.test(pattern[j])) digits += pattern[j++];
    // Use the longest prefix that names an existing group, as the engine does.
    while (digits.length > 1 && Number(digits) > captureCount) digits = digits.slice(0, -1);
    if (Number(digits) <= captureCount || unicode) {
      return { length: digits.length + 1, kind: 'backreference', phrase: `the same text that group ${digits} matched` };
    }
  }
  return { length: 2, kind: 'escape', phrase: `the character ${describeChar(next)} (escaped)` };
}

/** Reads a character set starting at `i` ("[") and returns its end and description. */
function readSet(pattern: string, i: number, unicode: boolean, vMode: boolean, captureCount: number): { end: number; description: string } {
  let j = i + 1;
  const negated = pattern[j] === '^';
  if (negated) j += 1;
  const items: string[] = [];
  let nested = 0;
  const single = (): { text: string; length: number } | null => {
    if (j >= pattern.length) return null;
    if (pattern[j] === '\\') {
      const esc = readEscape(pattern, j, unicode, true, captureCount);
      return { text: esc.phrase, length: esc.length };
    }
    const ch = String.fromCodePoint(pattern.codePointAt(j) ?? 0);
    return { text: describeChar(ch), length: ch.length };
  };
  while (j < pattern.length) {
    const ch = pattern[j];
    if (ch === ']') {
      if (nested === 0) break;
      nested -= 1;
      j += 1;
      continue;
    }
    if (vMode && ch === '[') {
      nested += 1;
      items.push('a nested set');
      j += 1;
      continue;
    }
    if (vMode && (pattern.startsWith('&&', j) || pattern.startsWith('--', j))) {
      items.push(pattern.startsWith('&&', j) ? 'intersected with' : 'minus');
      j += 2;
      continue;
    }
    const a = single();
    if (!a) break;
    j += a.length;
    if (pattern[j] === '-' && pattern[j + 1] !== undefined && pattern[j + 1] !== ']') {
      const save = j;
      j += 1;
      const b = single();
      if (b) {
        j += b.length;
        items.push(`${a.text} to ${b.text}`);
        continue;
      }
      j = save;
    }
    items.push(a.text);
  }
  const end = Math.min(j + 1, pattern.length);
  const unique = [...new Set(items)];
  const list = unique.length > 8 ? `${unique.slice(0, 8).join(', ')} and ${unique.length - 8} more` : unique.join(', ');
  const description =
    unique.length === 0
      ? negated
        ? 'Any single character (an empty negated set)'
        : 'Nothing (an empty set never matches)'
      : negated
        ? `Any one character except ${list}`
        : unique.length === 1
          ? `One character: ${list}`
          : `One character from: ${list}`;
  return { end, description };
}

function readQuantifier(pattern: string, i: number): { length: number; min: number; max: number } | null {
  const ch = pattern[i];
  if (ch === '*') return { length: 1, min: 0, max: Infinity };
  if (ch === '+') return { length: 1, min: 1, max: Infinity };
  if (ch === '?') return { length: 1, min: 0, max: 1 };
  if (ch === '{') {
    const m = /^\{(\d+)(,(\d*))?\}/.exec(pattern.slice(i));
    if (!m) return null;
    const min = Number(m[1]);
    const max = m[2] === undefined ? min : m[3] === '' ? Infinity : Number(m[3]);
    return { length: m[0].length, min, max };
  }
  return null;
}

function describeQuantifier(min: number, max: number, lazy: boolean): string {
  let range: string;
  if (min === 0 && max === Infinity) range = 'zero or more times';
  else if (min === 1 && max === Infinity) range = 'one or more times';
  else if (min === 0 && max === 1) range = 'optionally (zero or one time)';
  else if (max === Infinity) range = `at least ${times(min)}`;
  else if (min === max) range = `exactly ${times(min)}`;
  else range = `between ${min} and ${max} times`;
  const greed = min === max ? '' : lazy ? ', as few as possible (lazy)' : ', as many as possible';
  return `Repeat the previous item ${range}${greed}`;
}

const FLAG_NAMES: Record<string, string> = {
  i: 'ignore case',
  m: 'multiline',
  s: 'dot matches line breaks',
};

export function explain(pattern: string, flags = ''): Explanation {
  const unicode = flags.includes('u') || flags.includes('v');
  const vMode = flags.includes('v');
  const multiline = flags.includes('m');
  const dotAll = flags.includes('s');
  const captureCount = countCaptures(pattern);
  const tokens: Token[] = [];
  const groups: GroupDef[] = [];
  const stack: { label: string }[] = [];
  let groupNumber = 0;
  let i = 0;

  const push = (start: number, end: number, kind: TokenKind, description: string, depth = stack.length): void => {
    tokens.push({ start, end, text: pattern.slice(start, end), kind, description, depth });
  };

  while (i < pattern.length) {
    const ch = pattern[i];
    const start = i;

    if (ch === '\\') {
      const esc = readEscape(pattern, i, unicode, false, captureCount);
      const description = esc.kind === 'boundary' ? capitalize(esc.phrase) : `Match ${esc.phrase}`;
      push(start, i + esc.length, esc.kind, description);
      i += esc.length;
      continue;
    }

    if (ch === '[') {
      const set = readSet(pattern, i, unicode, vMode, captureCount);
      push(start, set.end, 'set', set.description);
      i = set.end;
      continue;
    }

    if (ch === '(') {
      let label: string;
      let length = 1;
      let kind: TokenKind = 'group-open';
      if (pattern.startsWith('(?:', i)) {
        length = 3;
        label = 'non-capturing group';
        push(start, i + length, kind, 'Start a non-capturing group (groups items without saving the match)');
      } else if (pattern.startsWith('(?=', i)) {
        length = 3;
        kind = 'lookaround';
        label = 'lookahead';
        push(start, i + length, kind, 'Start a lookahead: what follows must come next, without consuming it');
      } else if (pattern.startsWith('(?!', i)) {
        length = 3;
        kind = 'lookaround';
        label = 'negative lookahead';
        push(start, i + length, kind, 'Start a negative lookahead: what follows must not come next');
      } else if (pattern.startsWith('(?<=', i)) {
        length = 4;
        kind = 'lookaround';
        label = 'lookbehind';
        push(start, i + length, kind, 'Start a lookbehind: what follows must come just before this position');
      } else if (pattern.startsWith('(?<!', i)) {
        length = 4;
        kind = 'lookaround';
        label = 'negative lookbehind';
        push(start, i + length, kind, 'Start a negative lookbehind: what follows must not come just before this position');
      } else if (pattern.startsWith('(?<', i)) {
        const close = pattern.indexOf('>', i + 3);
        const name = close > 0 ? pattern.slice(i + 3, close) : '';
        length = close > 0 ? close - i + 1 : 3;
        groupNumber += 1;
        groups.push({ number: groupNumber, name });
        label = `group “${name}” (#${groupNumber})`;
        push(start, i + length, kind, `Start capturing group #${groupNumber}, named “${name}”`);
      } else if (pattern[i + 1] === '?') {
        const m = /^\(\?([a-z]*)(?:-([a-z]*))?:/.exec(pattern.slice(i));
        if (m) {
          length = m[0].length;
          const on = [...(m[1] ?? '')].map((f) => FLAG_NAMES[f] ?? f).join(', ');
          const off = [...(m[2] ?? '')].map((f) => FLAG_NAMES[f] ?? f).join(', ');
          label = 'modifier group';
          const parts = [on && `turns on ${on}`, off && `turns off ${off}`].filter(Boolean).join(' and ');
          push(start, i + length, kind, `Start a group that ${parts || 'changes no flags'} inside it`);
        } else {
          length = 2;
          label = 'group';
          push(start, i + length, kind, 'Start of an unrecognised group syntax');
        }
      } else {
        groupNumber += 1;
        groups.push({ number: groupNumber });
        label = `group #${groupNumber}`;
        push(start, i + length, kind, `Start capturing group #${groupNumber}`);
      }
      stack.push({ label });
      i += length;
      continue;
    }

    if (ch === ')') {
      const open = stack.pop();
      push(start, i + 1, 'group-close', open ? `End of ${open.label}` : 'A closing parenthesis without a matching opening one', stack.length);
      i += 1;
      continue;
    }

    if (ch === '|') {
      push(start, i + 1, 'alternation', 'Or: alternatively, match what follows instead');
      i += 1;
      continue;
    }

    if (ch === '^') {
      push(start, i + 1, 'anchor', multiline ? 'Start of a line' : 'Start of the text');
      i += 1;
      continue;
    }

    if (ch === '$') {
      push(start, i + 1, 'anchor', multiline ? 'End of a line' : 'End of the text');
      i += 1;
      continue;
    }

    if (ch === '.') {
      push(start, i + 1, 'dot', dotAll ? 'Any character, including line breaks' : 'Any character except a line break');
      i += 1;
      continue;
    }

    const quant = readQuantifier(pattern, i);
    if (quant) {
      const lazy = pattern[i + quant.length] === '?';
      const length = quant.length + (lazy ? 1 : 0);
      // A quantifier applies to one character only: split it off a longer literal.
      const prev = tokens[tokens.length - 1];
      if (prev && prev.kind === 'literal' && prev.text.length > 1 && prev.end === i) {
        const chars = [...prev.text];
        const last = chars.pop() as string;
        prev.text = chars.join('');
        prev.end -= last.length;
        prev.description = literalDescription(prev.text);
        tokens.push({ start: prev.end, end: i, text: last, kind: 'literal', description: literalDescription(last), depth: prev.depth });
      }
      push(start, i + length, 'quantifier', describeQuantifier(quant.min, quant.max, lazy));
      i += length;
      continue;
    }

    // Plain characters: merge runs into one literal token.
    const char = String.fromCodePoint(pattern.codePointAt(i) ?? 0);
    const prev = tokens[tokens.length - 1];
    if (prev && prev.kind === 'literal' && prev.end === i && prev.depth === stack.length) {
      prev.text += char;
      prev.end += char.length;
      prev.description = literalDescription(prev.text);
    } else {
      push(start, i + char.length, 'literal', literalDescription(char));
    }
    i += char.length;
  }

  return { tokens, groups };
}

function literalDescription(text: string): string {
  return [...text].length === 1 ? `Match the character ${describeChar(text)}` : `Match the text “${text}”`;
}
