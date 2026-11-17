import { describe, expect, it } from 'vitest';
import { segmentText } from '../src/highlight';
import { compile, expandReplacement, runMatch } from '../src/matcher';
import { DEFAULT_PRESET, PRESETS } from '../src/presets';
import { decodeShare, encodeShare } from '../src/share';

function ok(result: ReturnType<typeof runMatch>) {
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe('runMatch', () => {
  it('finds every ISO date with named groups and their positions', () => {
    const r = ok(runMatch(DEFAULT_PRESET.pattern, 'g', DEFAULT_PRESET.text, null));
    expect(r.matches.map((m) => m.text)).toEqual(['2026-03-14', '2026-04-02', '2026-03-29', '2026-06-30', '2026-07-01']);
    const first = r.matches[0];
    expect(first.groups.map((g) => [g.number, g.name, g.value])).toEqual([
      [1, 'year', '2026'],
      [2, 'month', '03'],
      [3, 'day', '14'],
    ]);
    expect(DEFAULT_PRESET.text.slice(first.groups[2].start, first.groups[2].end)).toBe('14');
  });

  it('returns only the first match without the g flag', () => {
    const r = ok(runMatch('\\d+', '', 'a1 b22 c333', null));
    expect(r.matches.map((m) => m.text)).toEqual(['1']);
    expect(r.total).toBe(1);
  });

  it('handles zero-length matches without looping forever, including surrogate pairs with u', () => {
    expect(ok(runMatch('', 'g', 'abc', null)).matches.map((m) => m.index)).toEqual([0, 1, 2, 3]);
    expect(ok(runMatch('', 'gu', '😀a', null)).matches.map((m) => m.index)).toEqual([0, 2, 3]);
    expect(ok(runMatch('\\b', 'g', 'hi there', null)).total).toBe(4);
  });

  it('reports groups that did not take part as undefined', () => {
    const r = ok(runMatch('(a)|(b)', 'g', 'ab', null));
    expect(r.matches[0].groups.map((g) => g.value)).toEqual(['a', undefined]);
    expect(r.matches[1].groups.map((g) => g.value)).toEqual([undefined, 'b']);
  });

  it('returns the engine error for invalid patterns and flags', () => {
    const bad = runMatch('(', 'g', 'x', null);
    expect(bad.ok).toBe(false);
    expect(runMatch('a', 'gg', 'x', null).ok).toBe(false);
    expect(runMatch('a', 'uv', 'x', null).ok).toBe(false);
    expect(compile('a+', 'gi')).toBeInstanceOf(RegExp);
  });

  it('caps the match list but still counts and replaces everything', () => {
    const text = 'x'.repeat(50);
    const r = ok(runMatch('x', 'g', text, 'y', 10));
    expect(r.matches).toHaveLength(10);
    expect(r.truncated).toBe(true);
    expect(r.total).toBe(40);
    expect(r.replaced).toBe('y'.repeat(50));
  });

  it('respects the sticky flag', () => {
    expect(ok(runMatch('a', 'gy', 'aab a', null)).matches.map((m) => m.index)).toEqual([0, 1]);
    expect(ok(runMatch('b', 'y', 'ab', null)).total).toBe(0);
  });
});

describe('replacement', () => {
  const cases: [string, string, string, string][] = [
    ['(\\w+) (\\w+)', 'g', 'hello world', '$2 $1'],
    ['(?<first>\\w+) (?<second>\\w+)', '', 'hello world', '$<second>, $<first>!'],
    ['o', 'g', 'foo', '[$&|$`|$\']'],
    ['(a)', 'g', 'banana', '$$1 costs $1'],
    ['(a)', 'g', 'aa', '$0 $00 $01 $2 $10 $'],
    ['(a)(b)?', 'g', 'ab a', '<$2>'],
    ['(a)', 'g', 'a', '$<name>'],
    ['(?<n>a)', 'g', 'a', '$<missing>|$<n'],
    ['(.)(.)(.)(.)(.)(.)(.)(.)(.)(.)(.)', '', 'abcdefghijk', '$11-$10-$1-$12'],
    ['x', 'g', 'axbxc', ''],
    ['', 'g', 'abc', '-'],
  ];

  it.each(cases)('matches String.prototype.replace for /%s/%s', (pattern, flags, text, template) => {
    const r = ok(runMatch(pattern, flags, text, template));
    expect(r.replaced).toBe(text.replace(new RegExp(pattern, flags), template));
  });

  it('matches native replace for every preset', () => {
    for (const p of PRESETS.filter((x) => x.id !== 'backtracking')) {
      const r = ok(runMatch(p.pattern, p.flags, p.text, p.replacement));
      expect(r.replaced).toBe(p.text.replace(new RegExp(p.pattern, p.flags), p.replacement));
    }
  });

  it('marks which parts came from the template', () => {
    const r = ok(runMatch(DEFAULT_PRESET.pattern, 'g', 'On 2026-03-14.', DEFAULT_PRESET.replacement));
    expect(r.replaceParts).toEqual([
      { text: 'On ', replaced: false },
      { text: '14/03/2026', replaced: true },
      { text: '.', replaced: false },
    ]);
  });

  it('expands templates directly', () => {
    expect(expandReplacement('$1-$<y>', 'x', 0, 'x', ['A'], { y: 'B' })).toBe('A-B');
    expect(expandReplacement('$<y>', 'x', 0, 'x', ['A'], undefined)).toBe('$<y>');
  });
});

describe('highlight segments', () => {
  it('splits a match into its innermost groups', () => {
    const text = 'Due 2026-03-14!';
    const r = ok(runMatch(DEFAULT_PRESET.pattern, 'g', text, null));
    expect(segmentText(text, r.matches)).toEqual([
      { text: 'Due ', match: -1, group: 0 },
      { text: '2026', match: 0, group: 1 },
      { text: '-', match: 0, group: 0 },
      { text: '03', match: 0, group: 2 },
      { text: '-', match: 0, group: 0 },
      { text: '14', match: 0, group: 3 },
      { text: '!', match: -1, group: 0 },
    ]);
  });

  it('picks the innermost of nested groups and keeps zero-length matches as markers', () => {
    const r = ok(runMatch('(a(b))', 'g', 'xab', null));
    expect(segmentText('xab', r.matches)).toEqual([
      { text: 'x', match: -1, group: 0 },
      { text: 'a', match: 0, group: 1 },
      { text: 'b', match: 0, group: 2 },
    ]);
    const empty = ok(runMatch('^', 'gm', 'a\nb', null));
    expect(segmentText('a\nb', empty.matches)).toEqual([
      { text: '', match: 0, group: 0, empty: true },
      { text: 'a\n', match: -1, group: 0 },
      { text: '', match: 1, group: 0, empty: true },
      { text: 'b', match: -1, group: 0 },
    ]);
  });

  it('rebuilds the original text exactly', () => {
    for (const p of PRESETS.filter((x) => x.id !== 'backtracking')) {
      const r = ok(runMatch(p.pattern, p.flags, p.text, null));
      expect(segmentText(p.text, r.matches).map((s) => s.text).join('')).toBe(p.text);
    }
  });
});

describe('share hash', () => {
  it('round-trips any text, including Unicode and symbols', () => {
    const state = { pattern: '(?<w>\\p{L}+)#&=?', flags: 'gu', text: 'Grüße, 東京 😀 & a=b#c', replacement: '$<w>' };
    const hash = encodeShare(state);
    expect(hash).toMatch(/^s=[A-Za-z0-9_-]+$/);
    expect(decodeShare(`#${hash}`)).toEqual(state);
  });

  it('rejects broken hashes', () => {
    expect(decodeShare('#s=!!!')).toBeNull();
    expect(decodeShare('#other=1')).toBeNull();
    expect(decodeShare(`#${encodeShare({ pattern: 'a', flags: 'zz', text: '', replacement: '' })}`)).toBeNull();
  });
});
