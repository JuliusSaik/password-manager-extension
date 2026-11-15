// Spalvotas įrašo ženkliukas su pirmąja pavadinimo raide.
const BRAND = {
  github: '#24292f',
  google: '#ea4335',
  facebook: '#1877f2',
  netflix: '#e50914',
  linkedin: '#0a66c2',
  slack: '#4a154b',
  instagram: '#d62976',
  spotify: '#1db954',
  twitter: '#1d9bf0',
  x: '#111111',
  microsoft: '#0078d4',
  apple: '#3a3a3c',
  amazon: '#ff9900',
};
const PALETTE = ['#6c5ce7', '#0ea5e9', '#14b8a6', '#f97316', '#ec4899', '#8b5cf6', '#22c55e', '#eab308'];

export function avatarColor(title = '') {
  const key = title.trim().toLowerCase().split(/\s+/)[0];
  if (BRAND[key]) return BRAND[key];
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export default function Avatar({ title, size }) {
  const letter = (title || '?').trim().charAt(0).toUpperCase() || '?';
  const bg = avatarColor(title);
  const isDark = bg === '#24292f' || bg === '#111111' || bg === '#3a3a3c';
  return (
    <div
      className={`avatar ${size === 'sm' ? 'sm' : ''}`}
      style={{ background: bg, boxShadow: isDark ? 'inset 0 0 0 1px rgba(255,255,255,.06)' : undefined }}
    >
      {letter === 'F' && title?.toLowerCase().startsWith('facebook') ? 'f' : letter}
    </div>
  );
}
