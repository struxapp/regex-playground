export interface Preset {
  id: string;
  name: string;
  pattern: string;
  flags: string;
  text: string;
  replacement: string;
}

export const PRESETS: Preset[] = [
  {
    id: 'iso-date',
    name: 'ISO date',
    pattern: String.raw`\b(?<year>\d{4})-(?<month>0[1-9]|1[0-2])-(?<day>0[1-9]|[12]\d|3[01])\b`,
    flags: 'g',
    replacement: '$<day>/$<month>/$<year>',
    text: [
      'Release notes',
      '2026-03-14  First public beta, with offline mode.',
      '2026-04-02  Faster sync on slow networks (reported on 2026-03-29).',
      '2026-13-01  Not a date: there is no thirteenth month.',
      'Next review on 2026-06-30, planning call on 2026-07-01 at 09:30.',
      'Version 2026.05.11 uses dots, so it does not match.',
    ].join('\n'),
  },
  {
    id: 'email',
    name: 'E-mail address (simple)',
    pattern: String.raw`[\w.+-]+@[\w-]+(?:\.[\w-]+)+`,
    flags: 'gi',
    replacement: '<$&>',
    text: [
      'Write to support@example.com or sales.team+eu@example.org.',
      'Old addresses: ada@mail.example.net, grace_h@example.co.uk',
      'Not addresses: @handle, name@, user@localhost',
    ].join('\n'),
  },
  {
    id: 'url',
    name: 'URL (http and https)',
    pattern: String.raw`https?:\/\/(?:www\.)?[\w-]+(?:\.[\w-]+)+(?:\/[^\s)]*)?`,
    flags: 'gi',
    replacement: '[link]($&)',
    text: [
      'Docs live at https://example.com/docs/getting-started and the API at',
      'http://api.example.org/v2/items?page=2&sort=asc (see also https://www.example.net).',
      'ftp://files.example.com is not http, and example.com alone has no scheme.',
    ].join('\n'),
  },
  {
    id: 'hex-colour',
    name: 'Hex colour',
    pattern: String.raw`#(?:[0-9a-f]{3}){1,2}\b`,
    flags: 'gi',
    replacement: 'var(--c, $&)',
    text: [
      ':root {',
      '  --ink: #1F2441;',
      '  --accent: #e86e5c;',
      '  --paper: #fff;',
      '  --broken: #12345;',
      '  --also-broken: #ggg;',
      '}',
    ].join('\n'),
  },
  {
    id: 'time',
    name: 'Time, 24-hour',
    pattern: String.raw`\b([01]\d|2[0-3]):([0-5]\d)\b`,
    flags: 'g',
    replacement: '$1h$2',
    text: 'Doors open 08:45, talks 09:30–12:00, lunch 12:15. 24:00 and 7:5 are not valid here.',
  },
  {
    id: 'ipv4',
    name: 'IPv4 address',
    pattern: String.raw`\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b`,
    flags: 'g',
    replacement: 'x.x.x.x',
    text: 'Gateway 192.168.0.1, servers 192.0.2.10 and 203.0.113.42. Not valid: 256.1.1.1 and 10.0.0.',
  },
  {
    id: 'repeated-words',
    name: 'Repeated words',
    pattern: String.raw`\b(\w+)\s+\1\b`,
    flags: 'gi',
    replacement: '$1',
    text: 'It was the the best of times. Paris in the\nthe spring. This is is fine, but this this is not.',
  },
  {
    id: 'markdown-links',
    name: 'Markdown links',
    pattern: String.raw`\[([^\]]+)\]\(([^)\s]+)\)`,
    flags: 'g',
    replacement: '<a href="$2">$1</a>',
    text: 'Read the [guide](https://example.com/guide) and the [FAQ](/faq#billing). [Not a link] (spaced).',
  },
  {
    id: 'trailing-space',
    name: 'Trailing whitespace',
    pattern: String.raw`[ \t]+$`,
    flags: 'gm',
    replacement: '',
    text: 'first line   \nsecond line\t\nthird line\nfourth line  ',
  },
  {
    id: 'backtracking',
    name: 'Catastrophic backtracking (demo)',
    pattern: String.raw`^(a+)+$`,
    flags: '',
    replacement: '',
    text: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!',
  },
];

export const DEFAULT_PRESET = PRESETS[0];
