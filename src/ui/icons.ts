/** Icon nét đơn (24×24, stroke = currentColor) dùng chung cho HUD và menu — không dùng emoji để giao diện đồng nhất. */
const PATHS = {
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  fast: '<path d="M4 6l7 6-7 6zM13 6l7 6-7 6z"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8-4.3-4.1 5.9-.9z"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
  moon: '<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  hammer: '<path d="M14 7l3-3 3 3-3 3M14 7L4 17l3 3 10-10"/>',
  save: '<path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6"/>',
  exit: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>',
} as const;

export type IconName = keyof typeof PATHS;

export function icon(name: IconName, size = 18): string {
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;
}
