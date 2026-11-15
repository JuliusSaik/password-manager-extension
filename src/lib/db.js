// Plonas sluoksnis virš chrome.storage – tai mūsų "duomenų bazės" mock'as.
// local   – išlieka tarp naršyklės paleidimų (vartotojai, užšifruota saugykla, nustatymai)
// session – tik atmintyje, išvaloma uždarius naršyklę (atrakinimo raktas, laikini duomenys)

export const KEYS = {
  users: 'kv:users',
  vault: (email) => `kv:vault:${email}`,
  settings: 'kv:settings',
  session: 'kv:session',
  pending: 'kv:pending',
  draft: 'kv:draft',
};

export const DEFAULT_SETTINGS = {
  rememberEmail: true,
  lastEmail: '',
  offerToSave: true,
  offerAutofill: true,
};

export async function localGet(key, fallback = null) {
  const res = await chrome.storage.local.get(key);
  return res[key] ?? fallback;
}

export function localSet(key, value) {
  return chrome.storage.local.set({ [key]: value });
}

export function localRemove(key) {
  return chrome.storage.local.remove(key);
}

export async function sessionGet(key, fallback = null) {
  const res = await chrome.storage.session.get(key);
  return res[key] ?? fallback;
}

export function sessionSet(key, value) {
  return chrome.storage.session.set({ [key]: value });
}

export function sessionRemove(key) {
  return chrome.storage.session.remove(key);
}
