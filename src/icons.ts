const paths: Record<string, string> = {
  disc: '<rect x="4" y="9" width="16" height="6" rx="3"/><path d="M7 12h10"/>',
  move: '<path d="M5 12h14M5 12l3-3M5 12l3 3M19 12l-3-3M19 12l-3 3"/>',
  undo: '<path d="M4 7v5h5"/><path d="M4.5 12A8 8 0 1 1 4 15"/>',
  reset: '<path d="M4 4v6h6"/><path d="M5.5 10A8 8 0 1 1 4 15"/>',
  play: '<path d="M8 5v14l11-7Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
  steps: '<path d="M8 4h8M7 9h10M6 14h12M5 19h14"/>',
  spark: '<path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8Z"/>',
  chevronLeft: '<path d="m15 5-7 7 7 7"/>',
  chevronRight: '<path d="m9 5 7 7-7 7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  one: '<path d="M9 18h6M12 6h1v12"/>',
  two: '<path d="M8 18h8M8 15c4-3 6-4.8 6-7a3 3 0 0 0-6-.5"/>',
  three: '<path d="M8 8a3 3 0 1 1 4 2.8A3.2 3.2 0 1 1 8 16"/>',
  flower: '<path d="M12 21v-8m0 5 5-2M12 6c-5-8-10 2-4 4-8 4 0 10 4 4 4 6 12 0 4-4 6-2 1-12-4-4Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 8v.1M12 11v6"/>',
};

export function icon(name: string, className = ''): string {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.spark}</svg>`;
}
