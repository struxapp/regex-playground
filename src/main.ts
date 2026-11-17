import './style.css';
import { CHEAT_SHEET, FLAGS } from './cheatsheet';
import { explain, type Token } from './explain';
import { segmentText } from './highlight';
import { icons, logo } from './icons';
import type { MatchRequest } from './match.worker';
import { compile, runMatch, type MatchError, type MatchResult } from './matcher';
import { DEFAULT_PRESET, PRESETS } from './presets';
import { decodeShare, encodeShare } from './share';
import { initTheme, type Theme } from './theme';

const TIMEOUT_MS = 1500;
const GROUP_COLOURS = 6;

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
};

const els = {
  preset: $<HTMLSelectElement>('preset'),
  share: $<HTMLButtonElement>('share'),
  theme: $<HTMLButtonElement>('theme'),
  pattern: $<HTMLInputElement>('pattern'),
  patternBackdrop: $<HTMLDivElement>('pattern-backdrop'),
  flagsText: $<HTMLSpanElement>('flags-text'),
  flags: $<HTMLDivElement>('flags'),
  error: $<HTMLParagraphElement>('pattern-error'),
  text: $<HTMLTextAreaElement>('text'),
  highlights: $<HTMLDivElement>('highlights'),
  legend: $<HTMLDivElement>('legend'),
  status: $<HTMLSpanElement>('status'),
  replacement: $<HTMLInputElement>('replacement'),
  output: $<HTMLPreElement>('output'),
  copyOutput: $<HTMLButtonElement>('copy-output'),
  matchCount: $<HTMLSpanElement>('match-count'),
  matchList: $<HTMLOListElement>('match-list'),
  explainList: $<HTMLOListElement>('explain-list'),
  cheat: $<HTMLDivElement>('cheat'),
  toast: $<HTMLDivElement>('toast'),
};

for (const slot of document.querySelectorAll<HTMLElement>('[data-icon]')) {
  slot.outerHTML = icons[slot.dataset.icon as keyof typeof icons] ?? '';
}
$('brand-mark').innerHTML = logo;

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Shows invisible characters in match values so empty strings and spaces are visible. */
const visible = (text: string): string =>
  escapeHtml(text).replace(/\n/g, '<span class="ws">↵</span>').replace(/\t/g, '<span class="ws">⇥</span>');

let toastTimer = 0;
function toast(message: string): void {
  els.toast.textContent = message;
  els.toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => els.toast.classList.remove('is-visible'), 1800);
}

async function copyText(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${label} copied`);
  } catch {
    toast('Copying is blocked here: select the text and copy it');
  }
}

/* ---------- state ---------- */

const state = {
  pattern: DEFAULT_PRESET.pattern,
  flags: DEFAULT_PRESET.flags,
  text: DEFAULT_PRESET.text,
  replacement: DEFAULT_PRESET.replacement,
};

let tokens: Token[] = [];

/* ---------- presets ---------- */

els.preset.innerHTML = [
  '<option value="" disabled>Examples</option>',
  ...PRESETS.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`),
  '<option value="custom" hidden>Your pattern</option>',
].join('');

function syncPresetSelect(): void {
  const match = PRESETS.find(
    (p) => p.pattern === state.pattern && p.flags === state.flags && p.text === state.text && p.replacement === state.replacement,
  );
  els.preset.value = match ? match.id : 'custom';
}

els.preset.addEventListener('change', () => {
  const preset = PRESETS.find((p) => p.id === els.preset.value);
  if (!preset) return;
  state.pattern = preset.pattern;
  state.flags = preset.flags;
  state.text = preset.text;
  state.replacement = preset.replacement;
  loadInputs();
  update();
});

/* ---------- flags ---------- */

els.flags.innerHTML = FLAGS.map(
  (f) =>
    `<button type="button" class="flag" data-flag="${f.flag}" aria-pressed="false" title="${escapeHtml(f.description)}"><span class="flag-letter mono">${f.flag}</span><span class="flag-name">${f.name}</span></button>`,
).join('');

function renderFlags(): void {
  for (const b of els.flags.querySelectorAll<HTMLButtonElement>('[data-flag]')) {
    b.setAttribute('aria-pressed', String(state.flags.includes(b.dataset.flag ?? '')));
  }
  els.flagsText.textContent = state.flags;
}

els.flags.addEventListener('click', (event) => {
  const b = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-flag]');
  if (!b) return;
  const flag = b.dataset.flag ?? '';
  const set = new Set(state.flags.split(''));
  if (set.has(flag)) set.delete(flag);
  else {
    set.add(flag);
    if (flag === 'u') set.delete('v');
    if (flag === 'v') set.delete('u');
  }
  // Keep the canonical order the engine reports (dgimsuvy).
  state.flags = 'dgimsuvy'
    .split('')
    .filter((f) => set.has(f))
    .join('');
  renderFlags();
  update();
});

/* ---------- pattern overlay and explanation ---------- */

function renderPattern(): void {
  const result = explain(state.pattern, state.flags);
  tokens = result.tokens;
  els.patternBackdrop.innerHTML =
    tokens.map((t, i) => `<span class="tok k-${t.kind}" data-token="${i}">${escapeHtml(t.text)}</span>`).join('') + ' ';
  syncPatternScroll();
  els.explainList.innerHTML =
    tokens.length === 0
      ? '<li class="empty-note">Type a pattern to see what each part means.</li>'
      : tokens
          .map(
            (t, i) =>
              `<li class="explain-item" data-token="${i}" style="--depth:${t.depth}"><code class="tok-chip k-${t.kind} mono">${escapeHtml(t.text)}</code><span class="explain-text">${escapeHtml(t.description)}</span></li>`,
          )
          .join('');
}

function syncPatternScroll(): void {
  els.patternBackdrop.scrollLeft = els.pattern.scrollLeft;
}

function highlightToken(index: number | null): void {
  for (const el of els.patternBackdrop.querySelectorAll('.tok.is-active')) el.classList.remove('is-active');
  if (index !== null) els.patternBackdrop.querySelector(`[data-token="${index}"]`)?.classList.add('is-active');
}

els.explainList.addEventListener('mouseover', (event) => {
  const item = (event.target as HTMLElement).closest<HTMLElement>('[data-token]');
  highlightToken(item ? Number(item.dataset.token) : null);
});
els.explainList.addEventListener('mouseleave', () => highlightToken(null));

for (const type of ['input', 'scroll', 'keyup', 'click', 'select', 'focus']) {
  els.pattern.addEventListener(type, () => window.requestAnimationFrame(syncPatternScroll));
}

/* ---------- matching in a worker ---------- */

type WorkerReply = { id: number; result: MatchResult | MatchError };

let worker: Worker | null = null;
let workerAvailable = true;
let busy = false;
let requestId = 0;
let timeoutTimer = 0;

function createWorker(): Worker | null {
  try {
    const w = new Worker(new URL('./match.worker.ts', import.meta.url), { type: 'module' });
    w.addEventListener('message', (event: MessageEvent<WorkerReply>) => {
      if (event.data.id !== requestId) return;
      busy = false;
      window.clearTimeout(timeoutTimer);
      showResult(event.data.result);
    });
    w.addEventListener('error', () => {
      busy = false;
      window.clearTimeout(timeoutTimer);
    });
    return w;
  } catch {
    workerAvailable = false;
    return null;
  }
}

function runInWorker(request: Omit<MatchRequest, 'id'>): void {
  requestId += 1;
  const id = requestId;
  if (busy && worker) {
    // A previous pattern is still running: stop it rather than queue behind it.
    worker.terminate();
    worker = null;
  }
  if (!worker && workerAvailable) worker = createWorker();
  if (!worker) {
    showResult(runMatch(request.pattern, request.flags, request.text, request.replacement));
    return;
  }
  busy = true;
  setStatus('running', 'Matching…');
  worker.postMessage({ id, ...request } satisfies MatchRequest);
  window.clearTimeout(timeoutTimer);
  timeoutTimer = window.setTimeout(() => {
    if (id !== requestId || !busy) return;
    worker?.terminate();
    worker = null;
    busy = false;
    showTimeout();
  }, TIMEOUT_MS);
}

/* ---------- rendering results ---------- */

function setStatus(kind: 'ok' | 'none' | 'error' | 'timeout' | 'running', text: string): void {
  els.status.className = `status status-${kind}`;
  els.status.textContent = text;
}

function renderHighlights(result: MatchResult | null): void {
  const text = state.text;
  if (!result || result.matches.length === 0) {
    els.highlights.innerHTML = `${escapeHtml(text)} `;
    return;
  }
  const html = segmentText(text, result.matches)
    .map((s) => {
      if (s.empty) return `<mark class="hl hl-empty m${s.match % 2}"></mark>`;
      if (s.match < 0) return escapeHtml(s.text);
      const group = s.group > 0 ? ` g g${((s.group - 1) % GROUP_COLOURS) + 1}` : '';
      return `<mark class="hl m${s.match % 2}${group}">${escapeHtml(s.text)}</mark>`;
    })
    .join('');
  els.highlights.innerHTML = `${html} `;
  syncTextScroll();
}

function renderLegend(result: MatchResult | null): void {
  if (!result || result.groups.length === 0) {
    els.legend.innerHTML = '';
    return;
  }
  els.legend.innerHTML = result.groups
    .slice(0, 12)
    .map(
      (g) =>
        `<span class="legend-item"><span class="gdot g${((g.number - 1) % GROUP_COLOURS) + 1}"></span>${g.name ? escapeHtml(g.name) : `group ${g.number}`}</span>`,
    )
    .join('');
}

const MAX_LISTED = 300;

function renderMatches(result: MatchResult | null): void {
  els.matchCount.textContent = result ? String(result.total) + (result.truncated ? '+' : '') : '0';
  if (!result) {
    els.matchList.innerHTML = '';
    return;
  }
  if (result.matches.length === 0) {
    els.matchList.innerHTML = `<li class="empty-note">No match in the test text.${state.flags.includes('g') ? '' : ' Without the g flag only the first match is found.'}</li>`;
    return;
  }
  const items = result.matches.slice(0, MAX_LISTED).map((m, i) => {
    const groups = m.groups.length
      ? `<table class="groups"><tbody>${m.groups
          .map(
            (g) =>
              `<tr><th scope="row"><span class="gdot g${((g.number - 1) % GROUP_COLOURS) + 1}"></span>${g.number}</th><td class="gname">${g.name ? escapeHtml(g.name) : ''}</td><td>${
                g.value === undefined ? '<span class="undef">did not take part</span>' : `<code class="mono">${visible(g.value) || '<span class="ws">empty</span>'}</code>`
              }</td></tr>`,
          )
          .join('')}</tbody></table>`
      : '';
    return `<li class="match"><button type="button" class="match-head" data-start="${m.index}" data-end="${m.end}" aria-label="Match ${i + 1} at ${m.index} to ${m.end}, select it in the text"><span class="match-num m${i % 2}">${i + 1}</span><code class="match-text mono">${visible(m.text) || '<span class="ws">empty match</span>'}</code><span class="match-pos mono">${m.index}–${m.end}</span></button>${groups}</li>`;
  });
  const more =
    result.total > MAX_LISTED ? `<li class="empty-note">Showing the first ${MAX_LISTED} of ${result.total}${result.truncated ? '+' : ''} matches.</li>` : '';
  els.matchList.innerHTML = items.join('') + more;
}

els.matchList.addEventListener('click', (event) => {
  const head = (event.target as HTMLElement).closest<HTMLButtonElement>('.match-head');
  if (!head) return;
  els.text.focus();
  els.text.setSelectionRange(Number(head.dataset.start), Number(head.dataset.end));
});

function renderOutput(result: MatchResult | null): void {
  if (!result || result.replaced === null) {
    els.output.textContent = state.text;
    return;
  }
  if (result.replaceParts) {
    els.output.innerHTML = result.replaceParts
      .map((p) => (p.replaced ? `<mark class="rep">${escapeHtml(p.text)}</mark>` : escapeHtml(p.text)))
      .join('');
  } else {
    els.output.textContent = result.replaced;
  }
}

function showResult(result: MatchResult | MatchError): void {
  if (!result.ok) {
    showError(result.error);
    return;
  }
  hideError();
  const groupText = result.groups.length ? ` · ${result.groups.length} group${result.groups.length === 1 ? '' : 's'}` : '';
  const time = result.elapsedMs < 1 ? '<1 ms' : `${Math.round(result.elapsedMs)} ms`;
  if (result.total === 0) setStatus('none', `No match${groupText} · ${time}`);
  else setStatus('ok', `${result.total}${result.truncated ? '+' : ''} match${result.total === 1 ? '' : 'es'}${groupText} · ${time}`);
  renderHighlights(result);
  renderLegend(result);
  renderMatches(result);
  renderOutput(result);
}

function showError(message: string): void {
  els.error.hidden = false;
  els.error.innerHTML = `${icons.alert}<span>${escapeHtml(message)}</span>`;
  els.pattern.setAttribute('aria-invalid', 'true');
  setStatus('error', 'Pattern error');
  renderHighlights(null);
  renderLegend(null);
  renderMatches(null);
  renderOutput(null);
}

function showTimeout(): void {
  els.error.hidden = false;
  els.error.innerHTML = `${icons.clock}<span>Stopped after ${TIMEOUT_MS / 1000} s: this pattern backtracks too much on this text (catastrophic backtracking). Nested repetition like <code>(a+)+</code> tries exponentially many ways to match; make the repetition unambiguous, for example <code>a+</code>.</span>`;
  els.pattern.removeAttribute('aria-invalid');
  setStatus('timeout', 'Stopped: too slow');
  renderHighlights(null);
  renderLegend(null);
  renderMatches(null);
  els.matchList.innerHTML = '<li class="empty-note">Matching was stopped before it finished, so there are no results.</li>';
  renderOutput(null);
}

function hideError(): void {
  els.error.hidden = true;
  els.error.textContent = '';
  els.pattern.removeAttribute('aria-invalid');
}

/* ---------- update loop ---------- */

let updateTimer = 0;

function update(immediate = false): void {
  renderPattern();
  syncPresetSelect();
  scheduleHash();
  window.clearTimeout(updateTimer);
  const go = (): void => {
    const compiled = compile(state.pattern, state.flags);
    if (!(compiled instanceof RegExp)) {
      requestId += 1; // ignore any reply still in flight
      showError(compiled.error);
      return;
    }
    // The built-in examples are known to be fast: match them at once so the first paint is complete.
    const preset = PRESETS.find((p) => p.id === els.preset.value);
    if (immediate && preset && preset.id !== 'backtracking') {
      showResult(runMatch(state.pattern, state.flags, state.text, state.replacement));
      return;
    }
    runInWorker({
      pattern: state.pattern,
      flags: state.flags,
      text: state.text,
      replacement: state.replacement,
    });
  };
  if (immediate) go();
  else updateTimer = window.setTimeout(go, 90);
}

/** The textarea grows with its content, so it never scrolls apart from its highlight layer. */
function autosize(): void {
  els.text.style.height = 'auto';
  els.text.style.height = `${els.text.scrollHeight + 2}px`;
}

function loadInputs(): void {
  els.pattern.value = state.pattern;
  els.text.value = state.text;
  els.replacement.value = state.replacement;
  autosize();
  renderFlags();
}

els.pattern.addEventListener('input', () => {
  state.pattern = els.pattern.value;
  update();
});
els.text.addEventListener('input', () => {
  state.text = els.text.value;
  // Keep the backdrop text in step while the worker runs.
  els.highlights.textContent = `${state.text} `;
  autosize();
  update();
});
els.replacement.addEventListener('input', () => {
  state.replacement = els.replacement.value;
  update();
});

function syncTextScroll(): void {
  els.highlights.scrollTop = els.text.scrollTop;
  els.highlights.scrollLeft = els.text.scrollLeft;
}
els.text.addEventListener('scroll', syncTextScroll);
let lastWidth = 0;
new ResizeObserver(() => {
  const width = els.text.clientWidth;
  if (width !== lastWidth) {
    lastWidth = width;
    autosize();
  }
  syncTextScroll();
}).observe(els.text);

els.copyOutput.addEventListener('click', () => void copyText(els.output.textContent ?? '', 'Result'));

/* ---------- tabs ---------- */

const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
function selectTab(tab: HTMLButtonElement, focus = false): void {
  for (const t of tabs) {
    const active = t === tab;
    t.setAttribute('aria-selected', String(active));
    t.tabIndex = active ? 0 : -1;
    const panel = document.getElementById(t.getAttribute('aria-controls') ?? '');
    if (panel) panel.hidden = !active;
  }
  if (focus) tab.focus();
}
for (const tab of tabs) {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', (event) => {
    const i = tabs.indexOf(tab);
    let next = -1;
    if (event.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    if (next >= 0) {
      event.preventDefault();
      selectTab(tabs[next], true);
    }
  });
}

/* ---------- cheat sheet ---------- */

els.cheat.innerHTML = CHEAT_SHEET.map(
  (section) =>
    `<section class="cheat-section"><h3 class="cheat-title">${escapeHtml(section.title)}</h3><ul class="cheat-list">${section.items
      .map(
        ([token, meaning]) =>
          `<li><button type="button" class="cheat-item" data-insert="${escapeHtml(token)}" data-target="${section.title === 'Replacement' ? 'replacement' : 'pattern'}"><code class="mono">${escapeHtml(token)}</code><span>${escapeHtml(meaning)}</span></button></li>`,
      )
      .join('')}</ul></section>`,
).join('');

els.cheat.addEventListener('click', (event) => {
  const item = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-insert]');
  if (!item) return;
  const input = item.dataset.target === 'replacement' ? els.replacement : els.pattern;
  // Multi-token rows ("\D \W \S") insert their first token.
  const token = (item.dataset.insert ?? '').split(' ')[0];
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.setRangeText(token, start, end, 'end');
  input.focus();
  input.dispatchEvent(new Event('input'));
});

/* ---------- share via URL hash ---------- */

let hashTimer = 0;
let lastHash = '';

function writeHash(): void {
  const hash = encodeShare(state);
  if (hash === lastHash) return;
  lastHash = hash;
  try {
    window.history.replaceState(null, '', `#${hash}`);
  } catch {
    // History may be unavailable in some embedded views; the Share button still copies a link.
  }
}

function scheduleHash(): void {
  window.clearTimeout(hashTimer);
  hashTimer = window.setTimeout(writeHash, 400);
}

function loadFromHash(): boolean {
  const shared = decodeShare(window.location.hash);
  if (!shared) return false;
  Object.assign(state, shared);
  lastHash = window.location.hash.replace(/^#/, '');
  return true;
}

window.addEventListener('hashchange', () => {
  if (window.location.hash.replace(/^#/, '') === lastHash) return;
  if (loadFromHash()) {
    loadInputs();
    update(true);
  }
});

els.share.addEventListener('click', () => {
  writeHash();
  const url = `${window.location.origin}${window.location.pathname}#${encodeShare(state)}`;
  void copyText(url, url.length > 8000 ? 'Long link' : 'Share link');
});

/* ---------- theme, shortcuts, start ---------- */

const toggleTheme = initTheme((theme: Theme) => {
  els.theme.innerHTML = theme === 'dark' ? icons.sun : icons.moon;
  els.theme.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = theme === 'dark' ? '#0e1117' : '#f5f6f8';
  }
});
els.theme.addEventListener('click', toggleTheme);

document.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement;
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
  if (event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    els.pattern.focus();
    els.pattern.select();
  }
});

loadFromHash();
loadInputs();
update(true);
