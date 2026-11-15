// Paprastas slaptažodžio stiprumo įvertinimas (0–4).
export function passwordStrength(pw = '') {
  if (!pw) return { score: 0, label: '', color: 'transparent' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes >= 3) score++;
  if (classes === 4 && pw.length >= 14) score++;
  if (pw.length < 6) score = Math.min(score, 1);
  score = Math.max(1, Math.min(4, score));
  const map = {
    1: { label: 'Silpnas', color: 'var(--danger)' },
    2: { label: 'Vidutinis', color: 'var(--warning)' },
    3: { label: 'Stiprus', color: 'var(--success)' },
    4: { label: 'Labai stiprus', color: 'var(--success)' },
  };
  return { score, ...map[score] };
}
