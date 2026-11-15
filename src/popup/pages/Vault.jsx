import { useEffect, useMemo, useState } from 'react';
import { call } from '../../lib/messages.js';
import { hostOf, urlMatches } from '../../lib/url.js';
import { IS_WINDOW } from '../App.jsx';
import { fillTab, getActiveWebTab } from '../tabs.js';
import Avatar from '../components/Avatar.jsx';
import BottomNav from '../components/BottomNav.jsx';
import { useToast } from '../components/Toast.jsx';
import { Copy, Lock, Plus, Search, ShieldCheck, Star, User } from '../components/Icons.jsx';

const FILTERS = [
  { id: 'all', label: 'Visi' },
  { id: 'fav', label: 'Mėgstami' },
  { id: 'Darbas', label: 'Darbas' },
  { id: 'Socialiniai', label: 'Socialiniai' },
  { id: 'Asmeninis', label: 'Asmeninis' },
];

export default function Vault({ go, onLocked }) {
  const toast = useToast();
  const [entries, setEntries] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState(null);

  useEffect(() => {
    call('vault:list')
      .then(setEntries)
      .catch(async (e) => {
        if (e.message === 'LOCKED') onLocked(await call('auth:status'));
      });
    getActiveWebTab().then(setTab).catch(() => {});
  }, [onLocked]);

  const filtered = useMemo(() => {
    if (!entries) return [];
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter === 'fav' && !e.favorite) return false;
      if (filter !== 'all' && filter !== 'fav' && e.category !== filter) return false;
      if (!q) return true;
      return [e.title, e.username, hostOf(e.url)].some((s) => s?.toLowerCase().includes(q));
    });
  }, [entries, query, filter]);

  const forSite = tab ? filtered.filter((e) => urlMatches(e.url, tab.url)) : [];
  const rest = filtered.filter((e) => !forSite.includes(e));

  const copyPassword = async (e, ev) => {
    ev.stopPropagation();
    try {
      const full = await call('vault:get', { id: e.id });
      await navigator.clipboard.writeText(full.password);
      toast('Slaptažodis nukopijuotas');
    } catch {
      toast('Nepavyko nukopijuoti', 'error');
    }
  };

  const fillIntoPage = async (e, ev) => {
    ev.stopPropagation();
    try {
      const full = await call('vault:get', { id: e.id });
      const res = await fillTab(tab.id, { username: full.username, password: full.password });
      if (!res?.filled) throw new Error();
      toast('Prisijungimas įterptas');
      if (!IS_WINDOW) setTimeout(() => window.close(), 700);
    } catch {
      toast('Puslapyje nerasta prisijungimo formos', 'error');
    }
  };

  const lock = async () => onLocked(await call('auth:lock'));

  const Row = ({ e, current }) => (
    <div className={`entry ${current ? 'current' : ''}`} onClick={() => go('entry', { id: e.id })}>
      <Avatar title={e.title} />
      <div className="entry-body">
        <div className="entry-title">
          {e.title}
          {e.favorite && <Star size={12} filled />}
        </div>
        <div className="entry-sub">{e.username || hostOf(e.url)}</div>
      </div>
      <div className="entry-actions">
        {current && (
          <button className="icon-btn sm" title="Įterpti į puslapį" onClick={(ev) => fillIntoPage(e, ev)}>
            <User size={17} />
          </button>
        )}
        <button className="icon-btn sm" title="Kopijuoti slaptažodį" onClick={(ev) => copyPassword(e, ev)}>
          <Copy size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="screen">
      <header className="topbar">
        <div className="logo"><ShieldCheck size={17} /></div>
        <h2>KeyVault</h2>
        <button className="icon-btn" onClick={lock} title="Užrakinti saugyklą"><Lock size={17} /></button>
      </header>

      <div className="vault-tools">
        <div className="input-wrap search">
          <Search size={19} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ieškoti slaptažodžių..." autoFocus />
        </div>
        <div className="chips-scroll">
          <div className="chips">
            {FILTERS.map((f) => (
              <button key={f.id} className={`chip ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
                {f.label}
                {f.id === 'all' && entries ? ` (${entries.length})` : ''}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="scroll" style={{ paddingBottom: 70 }}>
        {entries && entries.length === 0 && (
          <div className="empty">
            <strong>Saugykla tuščia</strong>
            Paspauskite „+“, kad pridėtumėte pirmą slaptažodį, arba prisijunkite prie svetainės – KeyVault pasiūlys jį išsaugoti.
          </div>
        )}
        {entries && entries.length > 0 && filtered.length === 0 && (
          <div className="empty"><strong>Nieko nerasta</strong>Pabandykite kitą paieškos frazę ar filtrą.</div>
        )}

        {forSite.length > 0 && (
          <>
            <div className="section-label">Šiai svetainei</div>
            {forSite.map((e) => <Row key={e.id} e={e} current />)}
          </>
        )}
        {rest.length > 0 && (
          <>
            <div className="section-label">Visi įrašai</div>
            {rest.map((e) => <Row key={e.id} e={e} />)}
          </>
        )}
      </div>

      <button className="fab" title="Naujas įrašas" onClick={() => go('entry', { draft: tab ? { url: `https://${hostOf(tab.url)}`, prefillFromTab: true } : null })}>
        <Plus />
      </button>
      <BottomNav active="vault" go={go} />
    </div>
  );
}
