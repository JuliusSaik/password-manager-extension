// Pagalbinės funkcijos darbui su aktyviu naršyklės skirtuku.

/** Grąžina aktyvų http(s) skirtuką (veikia ir kai popup atidarytas atskirame lange). */
export async function getActiveWebTab() {
  const isWeb = (t) => t && /^https?:/.test(t.url || '');
  const [cur] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (isWeb(cur)) return cur;
  const tabs = await chrome.tabs.query({ active: true, windowType: 'normal' });
  return tabs.find(isWeb) || null;
}

export async function fillTab(tabId, credentials) {
  return chrome.tabs.sendMessage(tabId, { type: 'kv:fill', ...credentials });
}
