export interface CheatSection {
  title: string;
  items: [token: string, meaning: string][];
}

export const CHEAT_SHEET: CheatSection[] = [
  {
    title: 'Characters',
    items: [
      ['.', 'Any character except a line break'],
      ['\\d', 'Digit 0–9'],
      ['\\w', 'Letter, digit or underscore'],
      ['\\s', 'Whitespace'],
      ['\\D \\W \\S', 'Not a digit, word character, whitespace'],
      ['[abc]', 'One of a, b or c'],
      ['[^abc]', 'Any character except a, b or c'],
      ['[a-z]', 'A character from a to z'],
      ['\\p{L}', 'Any letter (needs u or v)'],
      ['\\.', 'A literal dot (escape . * + ? ^ $ ( ) [ ] { } | \\ /)'],
    ],
  },
  {
    title: 'Anchors and boundaries',
    items: [
      ['^', 'Start of the text (or line with m)'],
      ['$', 'End of the text (or line with m)'],
      ['\\b', 'Word boundary'],
      ['\\B', 'Not a word boundary'],
    ],
  },
  {
    title: 'Quantifiers',
    items: [
      ['*', 'Zero or more'],
      ['+', 'One or more'],
      ['?', 'Zero or one'],
      ['{3}', 'Exactly 3'],
      ['{2,}', '2 or more'],
      ['{2,5}', 'Between 2 and 5'],
      ['*? +? ??', 'Lazy: as few as possible'],
    ],
  },
  {
    title: 'Groups and lookaround',
    items: [
      ['(abc)', 'Capturing group'],
      ['(?<name>abc)', 'Named capturing group'],
      ['(?:abc)', 'Group without capturing'],
      ['a|b', 'a or b'],
      ['\\1', 'Same text as group 1'],
      ['\\k<name>', 'Same text as the named group'],
      ['(?=abc)', 'Followed by abc'],
      ['(?!abc)', 'Not followed by abc'],
      ['(?<=abc)', 'Preceded by abc'],
      ['(?<!abc)', 'Not preceded by abc'],
    ],
  },
  {
    title: 'Replacement',
    items: [
      ['$1', 'Text of group 1'],
      ['$<name>', 'Text of a named group'],
      ['$&', 'The whole match'],
      ['$`', 'Text before the match'],
      ["$'", 'Text after the match'],
      ['$$', 'A literal dollar sign'],
    ],
  },
];

export const FLAGS: { flag: string; name: string; description: string }[] = [
  { flag: 'g', name: 'global', description: 'Find every match, not only the first' },
  { flag: 'i', name: 'ignore case', description: 'Upper and lower case match each other' },
  { flag: 'm', name: 'multiline', description: '^ and $ match at the start and end of each line' },
  { flag: 's', name: 'dot all', description: '. also matches line breaks' },
  { flag: 'u', name: 'unicode', description: 'Full Unicode: code points, \\u{…} and \\p{…}' },
  { flag: 'v', name: 'unicode sets', description: 'Unicode with set operations; replaces u' },
  { flag: 'y', name: 'sticky', description: 'Each match must start where the last one ended' },
];
