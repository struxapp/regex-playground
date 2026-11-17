import { describe, expect, it } from 'vitest';
import { explain } from '../src/explain';
import { DEFAULT_PRESET, PRESETS } from '../src/presets';

const kinds = (pattern: string, flags = '') => explain(pattern, flags).tokens.map((t) => `${t.kind}:${t.text}`);
const describe1 = (pattern: string, flags = '') => explain(pattern, flags).tokens.map((t) => t.description);

describe('explain: tokens', () => {
  it('splits the ISO date pattern into meaningful tokens with group numbers and names', () => {
    const { tokens, groups } = explain(DEFAULT_PRESET.pattern, 'g');
    expect(groups).toEqual([
      { number: 1, name: 'year' },
      { number: 2, name: 'month' },
      { number: 3, name: 'day' },
    ]);
    expect(tokens[0]).toMatchObject({ kind: 'boundary', text: '\\b', description: 'A word boundary' });
    expect(tokens[1]).toMatchObject({ kind: 'group-open', text: '(?<year>', description: 'Start capturing group #1, named “year”' });
    expect(tokens[2]).toMatchObject({ kind: 'class', text: '\\d', depth: 1 });
    expect(tokens[3]).toMatchObject({ kind: 'quantifier', text: '{4}', description: 'Repeat the previous item exactly 4 times' });
    expect(tokens[4]).toMatchObject({ kind: 'group-close', description: 'End of group “year” (#1)', depth: 0 });
    // Every character of the pattern is covered exactly once, in order.
    expect(tokens.map((t) => t.text).join('')).toBe(DEFAULT_PRESET.pattern);
  });

  it('covers every preset pattern completely', () => {
    for (const preset of PRESETS) {
      const { tokens } = explain(preset.pattern, preset.flags);
      expect(tokens.map((t) => t.text).join('')).toBe(preset.pattern);
      tokens.forEach((t, i) => i > 0 && expect(t.start).toBe(tokens[i - 1].end));
    }
  });

  it('merges plain characters but splits off the character a quantifier applies to', () => {
    expect(kinds('abc+')).toEqual(['literal:ab', 'literal:c', 'quantifier:+']);
    expect(describe1('cat')).toEqual(['Match the text “cat”']);
  });

  it('describes quantifiers, greedy and lazy', () => {
    expect(describe1('a*')[1]).toBe('Repeat the previous item zero or more times, as many as possible');
    expect(describe1('a+?')[1]).toBe('Repeat the previous item one or more times, as few as possible (lazy)');
    expect(describe1('a?')[1]).toBe('Repeat the previous item optionally (zero or one time), as many as possible');
    expect(describe1('a{2,}')[1]).toBe('Repeat the previous item at least twice, as many as possible');
    expect(describe1('a{2,5}')[1]).toBe('Repeat the previous item between 2 and 5 times, as many as possible');
    expect(kinds('a{x}')).toEqual(['literal:a{x}']);
  });

  it('describes character sets with ranges, escapes and negation', () => {
    expect(describe1('[a-z0-9_]')).toEqual(['One character from: “a” to “z”, “0” to “9”, “_”']);
    expect(describe1('[^\\s,]')).toEqual(['Any one character except a whitespace character (space, tab, line break…), “,”']);
    expect(describe1('[-.]')).toEqual(['One character from: “-”, “.”']);
    expect(kinds('[\\]]x')).toEqual(['set:[\\]]', 'literal:x']);
  });

  it('describes anchors and the dot according to the flags', () => {
    expect(describe1('^.$')).toEqual(['Start of the text', 'Any character except a line break', 'End of the text']);
    expect(describe1('^.$', 'ms')).toEqual(['Start of a line', 'Any character, including line breaks', 'End of a line']);
  });

  it('describes groups, lookarounds, alternation and backreferences', () => {
    const tokens = explain('(?:x|y)(?=z)(?<!w)(a)\\1\\k<n>(?<n>b)').tokens;
    expect(tokens.map((t) => t.kind)).toEqual([
      'group-open',
      'literal',
      'alternation',
      'literal',
      'group-close',
      'lookaround',
      'literal',
      'group-close',
      'lookaround',
      'literal',
      'group-close',
      'group-open',
      'literal',
      'group-close',
      'backreference',
      'backreference',
      'group-open',
      'literal',
      'group-close',
    ]);
    expect(tokens[0].description).toMatch(/non-capturing/);
    expect(tokens[5].description).toMatch(/^Start a lookahead/);
    expect(tokens[8].description).toMatch(/^Start a negative lookbehind/);
    expect(tokens[14].description).toBe('Match the same text that group 1 matched');
    expect(tokens[15].description).toBe('Match the same text that the group “n” matched');
  });

  it('describes escapes: hex, unicode, control characters and Unicode properties', () => {
    expect(describe1('\\x41')).toEqual(['Match “A” (hex 41)']);
    expect(describe1('\\u00e9')).toEqual(['Match “é” (U+00E9)']);
    expect(describe1('\\u{1F600}', 'u')).toEqual(['Match “😀” (code point U+1F600)']);
    expect(describe1('\\t\\n')).toEqual(['Match a tab', 'Match a line feed (new line)']);
    expect(describe1('\\p{Script=Greek}', 'u')).toEqual(['Match a character with the Unicode property Script “Greek”']);
    expect(describe1('\\.')).toEqual(['Match the character “.” (escaped)']);
  });

  it('reports group modifiers and unmatched parentheses', () => {
    expect(describe1('(?i:a)')[0]).toBe('Start a group that turns on ignore case inside it');
    expect(describe1(')')[0]).toBe('A closing parenthesis without a matching opening one');
  });

  it('nests depth inside groups', () => {
    const depths = explain('(a(b)c)').tokens.map((t) => t.depth);
    expect(depths).toEqual([0, 1, 1, 2, 1, 1, 0]);
  });
});
