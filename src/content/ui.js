// In-page UI (Shadow DOM), kad svetainės CSS nesugadintų mūsų kortelių ir atvirkščiai.

const STYLES = `
:host { all: initial; }
* { box-sizing: border-box; }
.card {
  position: fixed; top: 16px; right: 16px; z-index: 2147483647; width: 320px;
  font-family: 'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #eef0f8;
  background: #0e1120; border: 1px solid #282d48; border-radius: 14px;
  box-shadow: 0 18px 50px rgba(0,0,0,.45), 0 0 0 1px rgba(0,0,0,.2);
  animation: kv-in .18s ease-out; overflow: hidden; line-height: 1.4;
}
@keyframes kv-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
.head { display: flex; align-items: center; gap: 10px; padding: 12px 12px 12px 14px; border-bottom: 1px solid #1f2338; }
.logo { width: 26px; height: 26px; border-radius: 7px; display: grid; place-items: center; color: #fff;
  background: linear-gradient(135deg, #7b68ee, #a59cff); flex-shrink: 0; }
.brand { font-weight: 700; font-size: 13.5px; flex: 1; }
.x { width: 26px; height: 26px; border: none; background: transparent; color: #8b90ae; border-radius: 6px; cursor: pointer; display: grid; place-items: center; }
.x:hover { background: #1d2138; color: #eef0f8; }
.body { padding: 14px; }
.title { font-size: 15px; font-weight: 700; margin: 0 0 4px; }
.sub { color: #8b90ae; font-size: 12.5px; margin: 0 0 12px; }
.cred { background: #161a2c; border: 1px solid #282d48; border-radius: 10px; padding: 10px 12px; display: grid; gap: 6px; margin-bottom: 14px; }
.cred div { display: flex; justify-content: space-between; gap: 10px; }
.cred span:first-child { color: #8b90ae; }
.cred span:last-child { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 190px; }
.actions { display: flex; gap: 8px; }
.btn { height: 36px; border-radius: 9px; border: 1px solid transparent; font: inherit; font-weight: 600; font-size: 13px; cursor: pointer; padding: 0 14px; }
.btn-primary { background: #6c5ce7; color: #fff; flex: 1; }
.btn-primary:hover { background: #7a6bf0; }
.btn-ghost { background: transparent; color: #eef0f8; border-color: #343a5c; }
.btn-ghost:hover { background: #161a2c; }
.list { display: grid; gap: 4px; margin: 0 -4px; }
.item { display: flex; align-items: center; gap: 11px; padding: 8px; border-radius: 10px; cursor: pointer; border: none; background: transparent; color: inherit; font: inherit; text-align: left; width: 100%; }
.item:hover { background: #1f2440; }
.av { width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center; font-weight: 700; color: #fff; font-size: 14px; flex-shrink: 0; }
.meta { flex: 1; min-width: 0; }
.meta b { display: block; font-size: 13.5px; }
.meta small { display: block; color: #8b90ae; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fill { color: #9d8ff9; font-weight: 600; font-size: 12px; }
`;

const SHIELD =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>';
const X =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

const COLORS = { github: '#24292f', google: '#ea4335', facebook: '#1877f2', netflix: '#e50914', linkedin: '#0a66c2' };
const PALETTE = ['#6c5ce7', '#0ea5e9', '#14b8a6', '#f97316', '#ec4899', '#8b5cf6', '#22c55e', '#eab308'];
function avatarColor(title = '') {
  const key = title.trim().toLowerCase().split(/\s+/)[0];
  if (COLORS[key]) return COLORS[key];
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Mažas DOM kūrimo pagalbininkas – tekstas visada per textContent (jokio XSS iš svetainės duomenų). */
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v; // tik mūsų statinės SVG ikonos
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null) el.append(c);
  return el;
}

let host = null;

export function isOurNode(node) {
  return host && (node === host || host.contains(node));
}

export function closeCard() {
  host?.remove();
  host = null;
}

function mount(card) {
  closeCard();
  host = document.createElement('keyvault-ui');
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.append(h('style', {}, STYLES), card);
  document.documentElement.append(host);
}

function header(onClose) {
  return h(
    'div',
    { class: 'head' },
    h('div', { class: 'logo', html: SHIELD }),
    h('div', { class: 'brand' }, 'KeyVault'),
    h('button', { class: 'x', title: 'Uždaryti', html: X, onClick: onClose }),
  );
}

/** Pasiūlymas išsaugoti / atnaujinti slaptažodį po formos pateikimo. */
export function showSavePrompt(info, { onSave, onDismiss }) {
  const isUpdate = info.action === 'update';
  const dismiss = () => { closeCard(); onDismiss(); };
  mount(
    h(
      'div',
      { class: 'card', role: 'dialog' },
      header(dismiss),
      h(
        'div',
        { class: 'body' },
        h('p', { class: 'title' }, isUpdate ? 'Atnaujinti slaptažodį?' : 'Išsaugoti slaptažodį?'),
        h('p', { class: 'sub' }, isUpdate ? `Slaptažodis svetainei ${info.host} pasikeitė` : `KeyVault gali išsaugoti prisijungimą svetainei ${info.host}`),
        h(
          'div',
          { class: 'cred' },
          h('div', {}, h('span', {}, 'Vartotojas'), h('span', {}, info.username || '—')),
          h('div', {}, h('span', {}, 'Slaptažodis'), h('span', {}, '•'.repeat(Math.min(info.passwordLength, 14)))),
        ),
        h(
          'div',
          { class: 'actions' },
          h('button', { class: 'btn btn-ghost', onClick: dismiss }, 'Ne dabar'),
          h('button', { class: 'btn btn-primary', onClick: () => { closeCard(); onSave(); } }, isUpdate ? 'Atnaujinti' : 'Išsaugoti'),
        ),
      ),
    ),
  );
}

/** Rasti išsaugoti prisijungimai šiai svetainei – paspaudus įterpiami į formą. */
export function showAutofill(matches, { onPick }) {
  mount(
    h(
      'div',
      { class: 'card', role: 'dialog' },
      header(closeCard),
      h(
        'div',
        { class: 'body' },
        h('p', { class: 'title' }, 'Prisijungti su KeyVault'),
        h('p', { class: 'sub' }, matches.length === 1 ? 'Rastas išsaugotas prisijungimas šiai svetainei' : `Rasti ${matches.length} išsaugoti prisijungimai šiai svetainei`),
        h(
          'div',
          { class: 'list' },
          matches.map((m) =>
            h(
              'button',
              { class: 'item', onClick: () => onPick(m) },
              h('div', { class: 'av', style: `background:${avatarColor(m.title)}` }, (m.title || '?').charAt(0).toUpperCase()),
              h('div', { class: 'meta' }, h('b', {}, m.title), h('small', {}, m.username || '—')),
              h('span', { class: 'fill' }, 'Įterpti'),
            ),
          ),
        ),
      ),
    ),
  );
}

/** Saugykla užrakinta, bet puslapyje yra prisijungimo forma. */
export function showLocked({ onUnlock }) {
  mount(
    h(
      'div',
      { class: 'card', role: 'dialog' },
      header(closeCard),
      h(
        'div',
        { class: 'body' },
        h('p', { class: 'title' }, 'KeyVault užrakintas'),
        h('p', { class: 'sub' }, 'Atrakinkite saugyklą, kad galėtumėte automatiškai užpildyti prisijungimą.'),
        h(
          'div',
          { class: 'actions' },
          h('button', { class: 'btn btn-ghost', onClick: closeCard }, 'Ne dabar'),
          h('button', { class: 'btn btn-primary', onClick: () => { closeCard(); onUnlock(); } }, 'Atrakinti'),
        ),
      ),
    ),
  );
}
