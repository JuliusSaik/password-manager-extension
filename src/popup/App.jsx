import { useCallback, useEffect, useState } from 'react';
import { call } from '../lib/messages.js';
import Login from './pages/Login.jsx';
import Vault from './pages/Vault.jsx';
import EntryForm from './pages/EntryForm.jsx';
import SettingsPage from './pages/Settings.jsx';

export const IS_WINDOW = new URLSearchParams(location.search).has('window');

/**
 * Paprastas maršrutizavimas būsenoje:
 *   login | vault | entry (naujas / redagavimas / iš aptiktos formos) | settings
 */
export default function App() {
  const [auth, setAuth] = useState(null);
  const [route, setRoute] = useState({ name: 'loading' });

  // Po atrakinimo: jei turime aptiktą (dar neišsaugotą) prisijungimą – iškart rodom formą.
  const enterVault = useCallback(async () => {
    const draft = await call('vault:takeDraft');
    if (draft) setRoute({ name: 'entry', draft, id: draft.action === 'update' ? draft.entryId : null });
    else setRoute({ name: 'vault' });
  }, []);

  useEffect(() => {
    call('auth:status').then(async (s) => {
      setAuth(s);
      if (s.unlocked) await enterVault();
      else setRoute({ name: 'login' });
    });
  }, [enterVault]);

  const onAuthed = async (s) => {
    setAuth(s);
    await enterVault();
  };

  const onLocked = (s) => {
    setAuth(s);
    setRoute({ name: 'login' });
  };

  const go = (name, params = {}) => setRoute({ name, ...params });

  switch (route.name) {
    case 'loading':
      return <div className="center-fill" />;
    case 'login':
      return <Login lastEmail={auth?.lastEmail} hasDraft={auth?.hasDraft} onAuthed={onAuthed} />;
    case 'entry':
      return (
        <EntryForm
          key={route.id || 'new'}
          id={route.id}
          draft={route.draft}
          onDone={() => (IS_WINDOW && route.draft?.ts ? window.close() : go('vault'))}
        />
      );
    case 'settings':
      return <SettingsPage email={auth?.email} go={go} onLocked={onLocked} />;
    default:
      return <Vault go={go} onLocked={onLocked} />;
  }
}
