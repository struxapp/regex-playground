// Stroke icons on a 24px grid; shapes adapted from Lucide (ISC licence).
const svg = (body: string): string =>
  `<svg class="icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const icons = {
  link: svg('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'),
  copy: svg('<rect width="13" height="13" x="9" y="9" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.3 17.7-1.4 1.4"/><path d="m19.1 4.9-1.4 1.4"/>'),
  moon: svg('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
  alert: svg('<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>'),
  clock: svg('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
  target: svg('<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M8 12h8"/>'),
};

export const logo = `<svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" focusable="false"><rect width="32" height="32" rx="8" fill="#0e1a1f"/><path d="M8 9c-2 2-2.5 4.5-2.5 7s.5 5 2.5 7" fill="none" stroke="#5eead4" stroke-width="2.4" stroke-linecap="round"/><path d="M24 9c2 2 2.5 4.5 2.5 7s-.5 5-2.5 7" fill="none" stroke="#5eead4" stroke-width="2.4" stroke-linecap="round"/><path d="M16 10v7M13 11.7l6 3.6M19 11.7l-6 3.6" stroke="#f8fafc" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="21.5" r="1.8" fill="#fbbf24"/></svg>`;
