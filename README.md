# Regex Playground

Regex Playground is a fast, friendly place to write and test JavaScript regular expressions.

- **Live highlighting**: every match in the test text is highlighted as you type, and each capturing group is
  underlined in its own colour (innermost group wins when groups nest). Zero-length matches show as a thin marker.
- **Match list** with positions and every group, numbered and named; groups that did not take part are marked.
  Click a match to select it in the text.
- **Flags** as toggles: `g`, `i`, `m`, `s`, `u`, `v` (`u` and `v` exclude each other) and `y`.
- **Replace preview** with `$1`, `$<name>`, `$&`, `` $` ``, `$'` and `$$`, following the ECMAScript rules exactly;
  replaced parts are highlighted in the result.
- **Explain**: a plain-English description of every token, indented by group depth; the pattern itself is
  syntax-coloured, and hovering an explanation highlights its token.
- **Cheat sheet**: characters, anchors, quantifiers, groups, lookaround and replacement tokens; click one to insert it.
- **Examples**: ISO date (the start page), e-mail address, URL, hex colour, 24-hour time, IPv4, repeated words, Markdown
  links, trailing whitespace and a catastrophic backtracking demo.
- **Errors** from the engine are shown in plain view under the pattern.
- **Safe matching**: patterns run in a Web Worker. If a match takes longer than 1.5 seconds (catastrophic backtracking,
  such as `^(a+)+$` on a long run of `a` followed by `!`), the worker is terminated and the page explains why.
- **Share**: the URL hash always holds the pattern, flags, test text and replacement; the Share button copies the link.
- Light and dark themes, keyboard friendly (`/` focuses the pattern), works from 360 px wide.

Matching uses the browser's own `RegExp` engine, so the results are exactly what your JavaScript code will get.
Nothing is sent anywhere; only the theme choice is stored (localStorage).

## Run it

```sh
npm ci
npm run dev      # local development server
npm test         # unit tests (Vitest)
npm run build    # type-check and build to dist/
npm run preview  # serve dist/
```

Node 22 or newer.

## Code map

- `src/explain.ts`: tokenizer and plain-English explanations.
- `src/matcher.ts`: matching with JavaScript semantics (all matches with `g`, the first one without), group positions
  from the `d` flag, and the replacement expansion (`GetSubstitution` from the ECMAScript specification).
- `src/highlight.ts`: splits the text into match and group segments for the highlight layer.
- `src/match.worker.ts`: the Web Worker; `src/main.ts` terminates it after the timeout.
- `src/share.ts`: URL hash format (base64url JSON).
- `tests/`: the explainer, matching, replacement (checked against `String.prototype.replace`), highlighting and sharing.

## Sources and licences

- Replacement rules: ECMAScript 2025 Language Specification, GetSubstitution.
- Fonts: Geist and Geist Mono, bundled through `@fontsource-variable` packages, SIL Open Font License 1.1.
- Icons: shapes adapted from Lucide (ISC licence).
- Example texts were written for this app and use reserved example domains and private or documentation IP addresses.

## Licence

MIT, see [LICENSE](LICENSE).
