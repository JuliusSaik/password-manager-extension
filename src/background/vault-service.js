// ─────────────────────────────────────────────────────────────────────────────
//  MOCK BACKEND
//  Visa "serverio" logika gyvena čia ir saugo duomenis chrome.storage.
//  Vėliau šį failą galima pakeisti tikrais API kvietimais (fetch) nekeičiant UI.
// ─────────────────────────────────────────────────────────────────────────────
import {
  PBKDF2_ITERATIONS,
  decryptJSON,
  deriveKeyBytes,
  encryptJSON,
  fromBase64,
  importAesKey,
  randomBytes,
  toBase64,
} from '../lib/crypto.js';
import {
  DEFAULT_SETTINGS,
  KEYS,
  localGet,
  localSet,
  sessionGet,
  sessionRemove,
  sessionSet,
} from '../lib/db.js';
import { hostOf, titleFromUrl, urlMatches } from '../lib/url.js';
import { DEMO_ENTRIES } from './demo-data.js';

const VERIFIER = 'keyvault-ok';
const PENDING_TTL_MS = 3 * 60 * 1000;

export class ApiError extends Error {}

const normEmail = (e) => String(e || '').trim().toLowerCase();
const uid = () => toBase64(randomBytes(9)).replace(/[+/=]/g, '');

// ── Nustatymai ───────────────────────────────────────────────────────────────
export async function getSettings() {
  return { ...DEFAULT_SETTINGS, ...(await localGet(KEYS.settings, {})) };
}

export async function updateSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await localSet(KEYS.settings, next);
  return next;
}

// ── Sesija / raktas ──────────────────────────────────────────────────────────
async function getSession() {
  return sessionGet(KEYS.session);
}

async function requireKey() {
  const s = await getSession();
  if (!s) throw new ApiError('LOCKED');
  return { email: s.email, key: await importAesKey(fromBase64(s.key)) };
}

async function readEntries() {
  const { email, key } = await requireKey();
  const blob = await localGet(KEYS.vault(email));
  return blob ? decryptJSON(key, blob) : [];
}

async function writeEntries(entries) {
  const { email, key } = await requireKey();
  await localSet(KEYS.vault(email), await encryptJSON(key, entries));
}

// ── Autentifikacija ──────────────────────────────────────────────────────────
export async function status() {
  const s = await getSession();
  const settings = await getSettings();
  return {
    unlocked: !!s,
    email: s?.email ?? null,
    lastEmail: settings.rememberEmail ? settings.lastEmail : '',
    hasDraft: !!(await sessionGet(KEYS.draft)),
  };
}

export async function register({ email, password, seedDemo }) {
  email = normEmail(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError('Neteisingas el. pašto adresas');
  if (!password || password.length < 8)
    throw new ApiError('Pagrindinis slaptažodis turi būti bent 8 simbolių');

  const users = await localGet(KEYS.users, {});
  if (users[email]) throw new ApiError('Paskyra su šiuo el. paštu jau egzistuoja');

  const salt = randomBytes(16);
  const raw = await deriveKeyBytes(password, salt);
  const key = await importAesKey(raw);
  users[email] = {
    salt: toBase64(salt),
    iterations: PBKDF2_ITERATIONS,
    verifier: await encryptJSON(key, VERIFIER),
    createdAt: Date.now(),
  };
  await localSet(KEYS.users, users);
  await sessionSet(KEYS.session, { email, key: toBase64(raw) });

  const now = Date.now();
  const entries = seedDemo
    ? DEMO_ENTRIES.map((e, i) => ({ ...e, id: uid(), createdAt: now - i * 1000, updatedAt: now - i * 1000 }))
    : [];
  await writeEntries(entries);
  await updateSettings({ lastEmail: email });
  return status();
}

export async function login({ email, password, rememberEmail }) {
  email = normEmail(email);
  const users = await localGet(KEYS.users, {});
  const user = users[email];
  if (!user) throw new ApiError('Neteisingas el. paštas arba slaptažodis');

  const raw = await deriveKeyBytes(password, fromBase64(user.salt), user.iterations);
  const key = await importAesKey(raw);
  try {
    const v = await decryptJSON(key, user.verifier);
    if (v !== VERIFIER) throw new Error();
  } catch {
    throw new ApiError('Neteisingas el. paštas arba slaptažodis');
  }
  await sessionSet(KEYS.session, { email, key: toBase64(raw) });
  await updateSettings({ rememberEmail: !!rememberEmail, lastEmail: rememberEmail ? email : '' });
  return status();
}

export async function lock() {
  await sessionRemove(KEYS.session);
  return status();
}

// ── Saugyklos CRUD ───────────────────────────────────────────────────────────
/** Sąrašas be slaptažodžių – UI juos gauna tik pareikalavus. */
export async function listEntries() {
  const entries = await readEntries();
  return entries
    .map(({ password, ...rest }) => ({ ...rest, hasPassword: !!password }))
    .sort((a, b) => a.title.localeCompare(b.title, 'lt'));
}

export async function getEntry(id) {
  const entry = (await readEntries()).find((e) => e.id === id);
  if (!entry) throw new ApiError('Įrašas nerastas');
  return entry;
}

export async function saveEntry(input) {
  const entries = await readEntries();
  const now = Date.now();
  const clean = {
    title: String(input.title || '').trim() || titleFromUrl(input.url) || 'Be pavadinimo',
    url: String(input.url || '').trim(),
    username: String(input.username || '').trim(),
    password: String(input.password || ''),
    category: input.category || 'Asmeninis',
    favorite: !!input.favorite,
  };
  if (!clean.password) throw new ApiError('Slaptažodis privalomas');

  let saved;
  const idx = input.id ? entries.findIndex((e) => e.id === input.id) : -1;
  if (idx >= 0) {
    saved = { ...entries[idx], ...clean, updatedAt: now };
    entries[idx] = saved;
  } else {
    saved = { ...clean, id: uid(), createdAt: now, updatedAt: now };
    entries.push(saved);
  }
  await writeEntries(entries);
  return saved;
}

export async function toggleFavorite(id) {
  const entries = await readEntries();
  const e = entries.find((x) => x.id === id);
  if (!e) throw new ApiError('Įrašas nerastas');
  e.favorite = !e.favorite;
  await writeEntries(entries);
  return { id, favorite: e.favorite };
}

export async function deleteEntry(id) {
  const entries = await readEntries();
  await writeEntries(entries.filter((e) => e.id !== id));
  return { ok: true };
}

// ── Automatinis užpildymas ───────────────────────────────────────────────────
export async function autofillQuery(pageUrl) {
  const settings = await getSettings();
  const s = await getSession();
  if (!s) return { locked: true, enabled: settings.offerAutofill, matches: [] };
  const entries = await readEntries();
  return {
    locked: false,
    enabled: settings.offerAutofill,
    matches: entries
      .filter((e) => urlMatches(e.url, pageUrl))
      .map((e) => ({ id: e.id, title: e.title, username: e.username, url: e.url })),
  };
}

/** Grąžina prisijungimo duomenis tik jei įrašas tinka puslapiui, kuris jų prašo. */
export async function autofillCredentials(id, pageUrl) {
  const entry = await getEntry(id);
  if (!urlMatches(entry.url, pageUrl)) throw new ApiError('Įrašas netinka šiai svetainei');
  return { username: entry.username, password: entry.password };
}

// ── Formos aptikimas / pasiūlymas išsaugoti ─────────────────────────────────
async function getPendingMap() {
  return sessionGet(KEYS.pending, {});
}

export async function captureSubmit(tabId, { url, username, password }) {
  const settings = await getSettings();
  if (!settings.offerToSave || !password) return { action: 'none' };

  let action = 'save';
  let entryId = null;
  if (await getSession()) {
    const entries = await readEntries();
    const sameSite = entries.filter((e) => urlMatches(e.url, url));
    const sameUser = sameSite.find((e) => e.username === username);
    if (sameUser && sameUser.password === password) return { action: 'none' };
    if (sameUser) {
      action = 'update';
      entryId = sameUser.id;
    }
  }

  const host = hostOf(url);
  const pending = {
    action,
    entryId,
    url: `https://${host}`,
    title: titleFromUrl(url),
    host,
    username: username || '',
    password,
    ts: Date.now(),
  };
  const map = await getPendingMap();
  map[tabId] = pending;
  await sessionSet(KEYS.pending, map);
  return publicPending(pending);
}

function publicPending(p) {
  return { action: p.action, host: p.host, title: p.title, username: p.username, passwordLength: p.password.length };
}

export async function getPending(tabId) {
  const map = await getPendingMap();
  const p = map[tabId];
  if (!p) return null;
  if (Date.now() - p.ts > PENDING_TTL_MS) {
    delete map[tabId];
    await sessionSet(KEYS.pending, map);
    return null;
  }
  return publicPending(p);
}

export async function dismissPending(tabId) {
  const map = await getPendingMap();
  delete map[tabId];
  await sessionSet(KEYS.pending, map);
  return { ok: true };
}

/** Vartotojas paspaudė "Išsaugoti" – perkeliam duomenis į juodraštį naujo įrašo puslapiui. */
export async function acceptPending(tabId) {
  const map = await getPendingMap();
  const p = map[tabId];
  if (!p) throw new ApiError('Nėra ką išsaugoti');
  delete map[tabId];
  await sessionSet(KEYS.pending, map);
  await sessionSet(KEYS.draft, p);
  return { ok: true };
}

export async function takeDraft() {
  const draft = await sessionGet(KEYS.draft);
  await sessionRemove(KEYS.draft);
  return draft;
}

export async function clearTab(tabId) {
  const map = await getPendingMap();
  if (map[tabId]) {
    delete map[tabId];
    await sessionSet(KEYS.pending, map);
  }
}
