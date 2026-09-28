import type { SVGProps } from 'react';

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

type P = SVGProps<SVGSVGElement>;

export const Icon = {
  feed: (p: P) => (
    <svg {...base} {...p}>
      <path d="M4 10h16l-1.5 8.5a2 2 0 0 1-2 1.5h-9a2 2 0 0 1-2-1.5Z" />
      <circle cx="9" cy="6" r="1.2" />
      <circle cx="13.5" cy="4.5" r="1.2" />
      <circle cx="15.5" cy="7.5" r="1.2" />
    </svg>
  ),
  shop: (p: P) => (
    <svg {...base} {...p}>
      <path d="M5 8h14l-1 12H6Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </svg>
  ),
  egg: (p: P) => (
    <svg {...base} {...p}>
      <path d="M12 3c3.5 0 6.5 6 6.5 10.5A6.5 6.5 0 0 1 5.5 13.5C5.5 9 8.5 3 12 3Z" />
      <path d="M9 13.5a3 3 0 0 0 3 3" />
    </svg>
  ),
  leaf: (p: P) => (
    <svg {...base} {...p}>
      <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Z" />
      <path d="M5 19 13 11" />
    </svg>
  ),
  water: (p: P) => (
    <svg {...base} {...p}>
      <path d="M12 3.5c3.5 4.2 5.5 7.2 5.5 10a5.5 5.5 0 0 1-11 0c0-2.8 2-5.8 5.5-10Z" />
      <path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" />
    </svg>
  ),
  scissors: (p: P) => (
    <svg {...base} {...p}>
      <circle cx="6" cy="17" r="2.5" />
      <circle cx="6" cy="7" r="2.5" />
      <path d="M8 8.5 20 17M8 15.5 20 7" />
    </svg>
  ),
  rake: (p: P) => (
    <svg {...base} {...p}>
      <path d="M12 3v11M5 14h14M6 14v5M9.5 14v5M14.5 14v5M18 14v5" />
    </svg>
  ),
  book: (p: P) => (
    <svg {...base} {...p}>
      <path d="M4 5.5c3-1 5.5-1 8 1 2.5-2 5-2 8-1V19c-3-1-5.5-1-8 1-2.5-2-5-2-8-1Z" />
      <path d="M12 6.5V20" />
    </svg>
  ),
  lotus: (p: P) => (
    <svg {...base} {...p}>
      <path d="M12 18c-3-2-4-5-4-8 2 1 3.5 2.5 4 4.5.5-2 2-3.5 4-4.5 0 3-1 6-4 8Z" />
      <path d="M12 18c-4 0-7-2-8.5-5 2.5-.5 4.5 0 6 1.5M12 18c4 0 7-2 8.5-5-2.5-.5-4.5 0-6 1.5" />
      <path d="M12 14.5V8c0-1.5.5-3 1-4" />
    </svg>
  ),
  gear: (p: P) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
    </svg>
  ),
  camera: (p: P) => (
    <svg {...base} {...p}>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  ),
  close: (p: P) => (
    <svg {...base} {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  petal: (p: P) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M12 21C5 16 5 8 9 3.5l3 2.5 3-2.5C19 8 19 16 12 21Z" />
    </svg>
  ),
  sun: (p: P) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </svg>
  ),
  moon: (p: P) => (
    <svg {...base} {...p}>
      <path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5Z" />
    </svg>
  ),
  cloud: (p: P) => (
    <svg {...base} {...p}>
      <path d="M7 18h10a4 4 0 0 0 .5-8A5.5 5.5 0 0 0 7 9.5 4.3 4.3 0 0 0 7 18Z" />
    </svg>
  ),
  rain: (p: P) => (
    <svg {...base} {...p}>
      <path d="M7 14h10a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 7.5 7 3.6 3.6 0 0 0 7 14Z" />
      <path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" />
    </svg>
  ),
  snow: (p: P) => (
    <svg {...base} {...p}>
      <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" />
    </svg>
  ),
  fog: (p: P) => (
    <svg {...base} {...p}>
      <path d="M4 9h16M3 13h18M5 17h14" />
    </svg>
  ),
  storm: (p: P) => (
    <svg {...base} {...p}>
      <path d="M7 13h10a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 7.5 6 3.6 3.6 0 0 0 7 13Z" />
      <path d="M12 14l-2 4h3l-2 4" />
    </svg>
  ),
  star: (p: P) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7Z" />
    </svg>
  ),
  heart: (p: P) => (
    <svg {...base} {...p}>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
    </svg>
  ),
  share: (p: P) => (
    <svg {...base} {...p}>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
    </svg>
  ),
};

export type IconName = keyof typeof Icon;
