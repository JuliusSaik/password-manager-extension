// Kriptografija naudojant WebCrypto API.
// Pagrindinis slaptažodis -> PBKDF2 (SHA-256) -> 256 bitų AES-GCM raktas.
// Raktas niekada nesaugomas chrome.storage.local – tik atmintyje (chrome.storage.session).

const enc = new TextEncoder();
const dec = new TextDecoder();

export const PBKDF2_ITERATIONS = 600_000;

export function toBase64(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}

export function fromBase64(b64) {
  const s = atob(b64);
  const arr = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
  return arr;
}

export function randomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

/** Išveda neapdorotus rakto baitus iš slaptažodžio ir druskos. */
export async function deriveKeyBytes(password, salt, iterations = PBKDF2_ITERATIONS) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    256,
  );
  return new Uint8Array(bits);
}

/**
 * Išveda autentifikacijos paslaptį, atskirtą nuo AES saugyklos rakto.
 * Serveris gauna tik šią reikšmę, o ne saugyklos šifravimo raktą.
 */
export async function deriveAuthSecret(password, salt, iterations = PBKDF2_ITERATIONS) {
  const context = enc.encode('keyvault-auth-v1');
  const authSalt = new Uint8Array(salt.length + context.length);
  authSalt.set(salt);
  authSalt.set(context, salt.length);
  return toBase64(await deriveKeyBytes(password, authSalt, iterations));
}

export function importAesKey(rawBytes) {
  return crypto.subtle.importKey('raw', rawBytes, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptJSON(key, value) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(value)),
  );
  return { iv: toBase64(iv), ct: toBase64(ct) };
}

/** Meta klaidą, jei raktas neteisingas (AES-GCM autentifikacija nepavyksta). */
export async function decryptJSON(key, payload) {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(payload.iv) },
    key,
    fromBase64(payload.ct),
  );
  return JSON.parse(dec.decode(pt));
}
