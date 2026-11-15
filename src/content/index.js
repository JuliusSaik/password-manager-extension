// KeyVault content script:
//  1) aptinka prisijungimo formos pateikimą -> siūlo išsaugoti slaptažodį
//  2) aptinka slaptažodžio laukus -> siūlo įterpti išsaugotus prisijungimus (pagal URL)
import { closeCard, isOurNode, showAutofill, showLocked, showSavePrompt } from './ui.js';

const send = (type, payload) =>
  chrome.runtime
    .sendMessage({ type, payload })
    .then((res) => (res?.ok ? res.data : Promise.reject(new Error(res?.error))))
    .catch((e) => {
      // Plėtinys perkrautas / išjungtas – tyliai ignoruojam
      if (!String(e?.message).includes('Extension context invalidated')) console.debug('[KeyVault]', e?.message);
      return null;
    });

// ── Laukų paieška ────────────────────────────────────────────────────────────
const isVisible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length)) && getComputedStyle(el).visibility !== 'hidden';

const passwordFields = (root = document) =>
  [...root.querySelectorAll('input[type="password"]')].filter((el) => isVisible(el) && !el.disabled);

const USERNAME_HINT = /user|email|e-mail|login|account|name|vartotoj|pastas|paštas|phone|tel/i;

function usernameCandidates(scope, pw) {
  return [...scope.querySelectorAll('input')].filter(
    (i) =>
      isVisible(i) &&
      !i.disabled &&
      ['text', 'email', 'tel', ''].includes((i.getAttribute('type') || '').toLowerCase()) &&
      // tik laukai, esantys prieš slaptažodžio lauką
      i.compareDocumentPosition(pw) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

function findUsernameField(pw) {
  let candidates = usernameCandidates(pw.form || document, pw);
  if (!candidates.length && pw.form) candidates = usernameCandidates(document, pw);
  if (!candidates.length) return null;
  const byAutocomplete = candidates.find((i) => /username|email/.test(i.autocomplete || ''));
  if (byAutocomplete) return byAutocomplete;
  const byHint = [...candidates]
    .reverse()
    .find((i) => USERNAME_HINT.test(`${i.name} ${i.id} ${i.placeholder} ${i.getAttribute('aria-label') || ''}`));
  return byHint || candidates[candidates.length - 1];
}

/** React/Vue ir pan. reikalauja "native" setter'io + įvykių, kad pastebėtų pakeitimą. */
function setValue(input, value) {
  if (!input) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  input.focus();
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.blur();
}

function fillCredentials({ username, password }) {
  const pw = passwordFields()[0];
  if (!pw) return false;
  const user = findUsernameField(pw);
  if (user && username) setValue(user, username);
  setValue(pw, password);
  lastFilled = { username, password };
  return true;
}

// ── 1) Formos pateikimo aptikimas ───────────────────────────────────────────
let lastCapture = { key: '', at: 0 };
let lastFilled = null;

async function capture(pw) {
  if (!pw?.value) return;
  const userField = findUsernameField(pw);
  const data = { url: location.href, username: userField?.value?.trim() || '', password: pw.value };
  const key = `${data.username}\u0000${data.password}`;
  if (key === lastCapture.key && Date.now() - lastCapture.at < 2000) return;
  lastCapture = { key, at: Date.now() };

  const res = await send('capture:submit', data);
  if (res && res.action !== 'none') {
    // Jei puslapis nepersikrauna (SPA) – rodom iškart; jei persikrauna – parodys naujas puslapis.
    setTimeout(() => presentSavePrompt(res), 500);
  }
}

function presentSavePrompt(info) {
  showSavePrompt(info, {
    onSave: () => send('capture:accept'),
    onDismiss: () => send('capture:dismiss'),
  });
}

function passwordNear(el) {
  const scope = el.form || el.closest('form');
  const fields = passwordFields(scope || document).filter((f) => f.value);
  return fields[0] || null;
}

document.addEventListener(
  'submit',
  (e) => {
    const pw = passwordFields(e.target).find((f) => f.value);
    if (pw) capture(pw);
  },
  true,
);

document.addEventListener(
  'click',
  (e) => {
    if (isOurNode(e.target)) return;
    const btn = e.target.closest?.('button, input[type="submit"], input[type="button"], [role="button"]');
    if (!btn) return;
    const pw = passwordNear(btn);
    if (pw) capture(pw);
  },
  true,
);

document.addEventListener(
  'keydown',
  (e) => {
    if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement)) return;
    const pw = passwordNear(e.target);
    if (pw) capture(pw);
  },
  true,
);

// ── 2) Automatinis užpildymas pagal URL ──────────────────────────────────────
let autofillCheckedFor = null;

async function checkAutofill() {
  if (autofillCheckedFor === location.href) return;
  if (!passwordFields().length) return;
  autofillCheckedFor = location.href;

  const res = await send('autofill:query', { url: location.href });
  if (!res || !res.enabled) return;
  if (res.locked) {
    showLocked({ onUnlock: () => send('ui:openPopup') });
    return;
  }
  if (!res.matches.length) return;
  showAutofill(res.matches, {
    onPick: async (m) => {
      const creds = await send('autofill:credentials', { id: m.id, url: location.href });
      if (creds) fillCredentials(creds);
      closeCard();
    },
  });
}

// Užklausos iš popup lango ("Įterpti į puslapį")
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'kv:fill') {
    const filled = fillCredentials(msg);
    if (filled) closeCard();
    sendResponse({ filled });
  }
});

// ── Paleidimas ───────────────────────────────────────────────────────────────
async function init() {
  const pending = await send('capture:pending');
  if (pending) {
    presentSavePrompt(pending);
  } else {
    checkAutofill();
  }

  // SPA ir vėliau atsirandančios formos
  let t;
  new MutationObserver(() => {
    clearTimeout(t);
    t = setTimeout(() => {
      if (!document.querySelector('keyvault-ui')) checkAutofill();
    }, 600);
  }).observe(document.documentElement, { childList: true, subtree: true });
}

init();
