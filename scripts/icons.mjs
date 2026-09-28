// Génère l'icône Komorebi (SVG sources + PNG pour @capacitor/assets et Android).
// Usage : node scripts/icons.mjs
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import sharp from 'sharp';

const OUT = 'assets';
mkdirSync(OUT, { recursive: true });

const C = {
  deep: '#14323a',
  water: '#2a6a6c',
  waterLight: '#6fb0a8',
  washi: '#f5efe3',
  koi: '#e2583e',
  gold: '#e9b872',
  leaf: '#3d6a34',
  leafRed: '#c4452c',
  night: '#1d2a44',
};

/** Feuille d'érable du Japon (7 lobes) centrée en (0,0), rayon r. */
function maple(r) {
  const pts = [];
  const lobes = 7;
  for (let i = 0; i <= lobes * 2; i++) {
    const a = -Math.PI / 2 + ((i / (lobes * 2)) * Math.PI * 2 - Math.PI) * 0.86;
    const k = Math.abs(i - lobes) / lobes;
    const rr = i % 2 === 0 ? r * (1 - k * 0.42) : r * 0.4 * (1 - k * 0.3);
    pts.push(`${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr + r * 0.1).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z M-2,${r * 0.1} L2,${r * 0.1} L1.5,${r * 0.95} L-1.5,${r * 0.95} Z`;
}

/** Koï (kohaku) vu du dessus, tête à droite, centré en (0,0). */
function koi(color = true) {
  const body =
    'M235,0 C230,-50 170,-82 80,-84 C-10,-84 -110,-48 -190,-13 L-190,13 C-110,48 -10,84 80,84 C170,82 230,50 235,0 Z';
  const tail =
    'M-182,-10 C-230,-26 -272,-92 -312,-112 C-288,-44 -288,44 -312,112 C-272,92 -230,26 -182,10 Z';
  const finL = 'M120,-66 C104,-138 50,-170 12,-162 C44,-128 70,-92 88,-70 Z';
  const finR = 'M120,66 C104,138 50,170 12,162 C44,128 70,92 88,70 Z';
  const pelL = 'M-40,-62 C-60,-104 -92,-118 -112,-110 C-90,-92 -72,-74 -60,-58 Z';
  const pelR = 'M-40,62 C-60,104 -92,118 -112,110 C-90,92 -72,74 -60,58 Z';
  if (!color) {
    return `<g fill="#fff"><path d="${tail}" opacity=".85"/><path d="${finL}"/><path d="${finR}"/><path d="${pelL}"/><path d="${pelR}"/><path d="${body}"/></g>`;
  }
  return `
  <defs>
    <clipPath id="body"><path d="${body}"/></clipPath>
    <linearGradient id="shade" x1="0" y1="-84" x2="0" y2="84" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#000" stop-opacity=".28"/>
      <stop offset=".45" stop-color="#fff" stop-opacity=".12"/>
      <stop offset="1" stop-color="#000" stop-opacity=".3"/>
    </linearGradient>
  </defs>
  <g>
    <path d="${tail}" fill="${C.washi}" opacity=".75"/>
    <g fill="${C.washi}" opacity=".85"><path d="${finL}"/><path d="${finR}"/><path d="${pelL}"/><path d="${pelR}"/></g>
    <path d="${body}" fill="${C.washi}"/>
    <g clip-path="url(#body)" fill="${C.koi}">
      <path d="M200,-20 C190,-70 120,-80 95,-40 C80,-10 110,40 150,30 C185,22 205,10 200,-20 Z"/>
      <path d="M40,-90 C-10,-60 -30,-20 -10,20 C10,55 60,70 70,30 C78,0 60,-30 70,-60 C75,-80 60,-95 40,-90 Z"/>
      <path d="M-100,-30 C-130,-10 -140,20 -120,40 C-100,55 -80,30 -85,5 C-88,-12 -80,-35 -100,-30 Z"/>
    </g>
    <path d="${body}" fill="url(#shade)"/>
    <circle cx="205" cy="-30" r="6" fill="#1a1a1a"/>
    <circle cx="205" cy="30" r="6" fill="#1a1a1a"/>
  </g>`;
}

function rays(opacity = 1) {
  const beams = [
    [-0.12, 0.09, 0.5],
    [0.06, 0.07, 0.36],
    [0.22, 0.1, 0.28],
  ];
  return beams
    .map(([a, w, o]) => {
      const x0 = 80;
      const y0 = -120;
      const ang = Math.PI / 4 + a;
      const len = 1500;
      const p1 = [x0 + Math.cos(ang - w) * len, y0 + Math.sin(ang - w) * len];
      const p2 = [x0 + Math.cos(ang + w) * len, y0 + Math.sin(ang + w) * len];
      return `<path d="M${x0},${y0} L${p1[0].toFixed(0)},${p1[1].toFixed(0)} L${p2[0].toFixed(0)},${p2[1].toFixed(0)} Z" fill="url(#ray)" opacity="${(o * opacity).toFixed(2)}"/>`;
    })
    .join('');
}

function ripples(cx, cy) {
  return [150, 230, 310, 380]
    .map(
      (r, i) =>
        `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.92}" fill="none" stroke="#fff" stroke-opacity="${0.16 - i * 0.03}" stroke-width="${5 - i}"/>`,
    )
    .join('');
}

const defs = `
  <defs>
    <radialGradient id="water" cx=".42" cy=".38" r=".75">
      <stop offset="0" stop-color="${C.waterLight}"/>
      <stop offset=".55" stop-color="${C.water}"/>
      <stop offset="1" stop-color="${C.deep}"/>
    </radialGradient>
    <linearGradient id="ray" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.gold}" stop-opacity=".9"/>
      <stop offset=".6" stop-color="${C.gold}" stop-opacity=".25"/>
      <stop offset="1" stop-color="${C.gold}" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="bg" cx=".5" cy=".45" r=".7">
      <stop offset="0" stop-color="#2d5d5a"/>
      <stop offset="1" stop-color="${C.night}"/>
    </radialGradient>
  </defs>`;

const leaves = `
  <g transform="translate(250,210) rotate(-25)"><path d="${maple(120)}" fill="${C.leaf}"/></g>
  <g transform="translate(150,330) rotate(35)"><path d="${maple(88)}" fill="${C.leafRed}"/></g>
  <g transform="translate(360,140) rotate(10)"><path d="${maple(70)}" fill="#5d8a3c"/></g>`;

const koiGroup = `<g transform="translate(540,560) rotate(-38) scale(1.05)">${koi(true)}</g>`;

// Icône complète (non adaptative, Play Store, favicon)
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${defs}
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <circle cx="512" cy="530" r="420" fill="url(#water)"/>
  ${ripples(540, 560)}
  <g clip-path="url(#pondClip)">${koiGroup}</g>
  <clipPath id="pondClip"><circle cx="512" cy="530" r="420"/></clipPath>
  ${rays(0.9)}
  ${leaves}
</svg>`;

// Adaptatif : fond (eau) et premier plan (koï, feuilles, rayons) dans la zone sûre (66 %)
const background = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${defs}
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <circle cx="512" cy="512" r="470" fill="url(#water)"/>
  ${ripples(512, 520)}
</svg>`;
const foreground = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${defs}
  <g transform="translate(512,512) scale(0.62) translate(-512,-512)">
    ${koiGroup}
    ${rays(0.75)}
    ${leaves}
  </g>
</svg>`;
// Monochrome (icônes thématiques Android 13+)
const mono = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <g transform="translate(512,512) scale(0.6) translate(-512,-512)">
    <circle cx="512" cy="530" r="420" fill="none" stroke="#fff" stroke-width="34"/>
    <g transform="translate(540,560) rotate(-38) scale(1.05)">${koi(false)}</g>
    <g transform="translate(250,210) rotate(-25)"><path d="${maple(110)}" fill="#fff"/></g>
  </g>
</svg>`;

function splash(dark) {
  const bg = dark ? C.night : '#f5efe3';
  const fg = dark ? '#f5efe3' : '#2b3a3a';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732" width="2732" height="2732">${defs}
  <rect width="2732" height="2732" fill="${bg}"/>
  <g transform="translate(1366,1250) scale(0.5) translate(-512,-530)">
    <circle cx="512" cy="530" r="420" fill="url(#water)"/>
    ${ripples(540, 560)}
    ${koiGroup}
  </g>
  <text x="1366" y="1620" text-anchor="middle" font-family="sans-serif" font-size="96" letter-spacing="40" fill="${fg}">KOMOREBI</text>
</svg>`;
}

const files = {
  'icon.svg': full,
  'icon-background.svg': background,
  'icon-foreground.svg': foreground,
  'icon-monochrome.svg': mono,
  'splash.svg': splash(false),
  'splash-dark.svg': splash(true),
};
for (const [name, svg] of Object.entries(files)) writeFileSync(`${OUT}/${name}`, svg);

const png = async (svg, out, size) => sharp(Buffer.from(svg)).resize(size, size).png().toFile(out);
await png(full, `${OUT}/icon-only.png`, 1024);
await png(background, `${OUT}/icon-background.png`, 1024);
await png(foreground, `${OUT}/icon-foreground.png`, 1024);
await png(mono, `${OUT}/icon-monochrome.png`, 1024);
await png(splash(false), `${OUT}/splash.png`, 2732);
await png(splash(true), `${OUT}/splash-dark.png`, 2732);
writeFileSync('public/icon.svg', full);
await png(full, 'public/icon-192.png', 192);
await png(full, 'public/icon-512.png', 512);

// Monochrome dans les mipmaps Android (si le projet natif existe)
const dens = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
if (existsSync('android/app/src/main/res')) {
  for (const [d, size] of Object.entries(dens)) {
    const dir = `android/app/src/main/res/mipmap-${d}`;
    mkdirSync(dir, { recursive: true });
    await png(mono, `${dir}/ic_launcher_monochrome.png`, size);
  }
}
// Icône adaptative : pas de retrait supplémentaire (le premier plan est déjà dans la zone sûre)
// et couche monochrome pour les icônes thématiques (Android 13+).
if (existsSync('android/app/src/main/res/mipmap-anydpi-v26')) {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />
</adaptive-icon>
`;
  writeFileSync('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml', xml);
  writeFileSync('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml', xml);
}
console.log('icônes générées dans assets/ et public/');
