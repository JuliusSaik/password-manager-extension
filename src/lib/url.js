// URL pagalbinės funkcijos, naudojamos tiek background, tiek content script'e.

/** Normalizuoja adresą iki host'o be "www." (pvz. "https://www.github.com/login" -> "github.com"). */
export function hostOf(url) {
  if (!url) return '';
  try {
    const withProto = /^[a-z]+:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withProto).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

/** Grubus "registrable domain" – paskutinės dvi host'o dalys (accounts.google.com -> google.com). */
export function baseDomain(host) {
  if (!host) return '';
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host === 'localhost') return host;
  const parts = host.split('.');
  return parts.slice(-2).join('.');
}

/** Ar išsaugotas įrašo adresas tinka puslapiui. */
export function urlMatches(entryUrl, pageUrl) {
  const a = hostOf(entryUrl);
  const b = hostOf(pageUrl);
  if (!a || !b) return false;
  return a === b || baseDomain(a) === baseDomain(b);
}

const KNOWN_NAMES = { github: 'GitHub', linkedin: 'LinkedIn', youtube: 'YouTube', paypal: 'PayPal', gitlab: 'GitLab', localhost: 'Localhost' };

/** Pavadinimas iš adreso: "https://www.github.com/login" -> "GitHub". */
export function titleFromUrl(url) {
  const host = hostOf(url);
  if (!host) return '';
  const name = baseDomain(host).split('.')[0];
  return KNOWN_NAMES[name] || name.charAt(0).toUpperCase() + name.slice(1);
}
