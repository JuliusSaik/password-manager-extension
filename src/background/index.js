// Background service worker – veikia kaip vietinis "API serveris".
// Popup ir content script'as bendrauja su juo per chrome.runtime.sendMessage.
import * as api from './vault-service.js';

async function openExtensionPopup() {
  // Chrome 127+: atidaro tikrą plėtinio popup'ą. Jei nepavyksta – atskiras langas.
  try {
    if (chrome.action.openPopup) {
      await chrome.action.openPopup();
      return 'popup';
    }
  } catch {
    /* fallback žemiau */
  }
  await chrome.windows.create({
    url: chrome.runtime.getURL('index.html?window=1'),
    type: 'popup',
    width: 376,
    height: 660,
    focused: true,
  });
  return 'window';
}

const handlers = {
  // autentifikacija
  'auth:status': () => api.status(),
  'auth:register': (p) => api.register(p),
  'auth:login': (p) => api.login(p),
  'auth:lock': () => api.lock(),
  'auth:reset': () => api.deleteAccount(),
  // saugykla
  'vault:list': () => api.listEntries(),
  'vault:get': (p) => api.getEntry(p.id),
  'vault:save': (p) => api.saveEntry(p),
  'vault:delete': (p) => api.deleteEntry(p.id),
  'vault:favorite': (p) => api.toggleFavorite(p.id),
  'vault:takeDraft': () => api.takeDraft(),
  // nustatymai
  'settings:get': () => api.getSettings(),
  'settings:update': (p) => api.updateSettings(p),
  // content script
  'autofill:query': (p, sender) => api.autofillQuery(sender.tab?.url || p.url),
  'autofill:credentials': (p, sender) => api.autofillCredentials(p.id, sender.tab?.url || p.url),
  'capture:submit': (p, sender) => api.captureSubmit(sender.tab.id, p),
  'capture:pending': (_p, sender) => api.getPending(sender.tab.id),
  'capture:dismiss': (_p, sender) => api.dismissPending(sender.tab.id),
  'capture:accept': async (_p, sender) => {
    await api.acceptPending(sender.tab.id);
    return { opened: await openExtensionPopup() };
  },
  'ui:openPopup': async () => ({ opened: await openExtensionPopup() }),
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handler = handlers[msg?.type];
  if (!handler) return false;
  Promise.resolve()
    .then(() => handler(msg.payload || {}, sender))
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
  return true; // atsakysime asinchroniškai
});

chrome.tabs.onRemoved.addListener((tabId) => {
  api.clearTab(tabId);
});

// Session storage pagal nutylėjimą prieinamas tik patikimiems kontekstams (ne content script'ams).
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.session.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' });
});
