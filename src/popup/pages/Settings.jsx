import { useEffect, useState } from 'react';
import { call } from '../../lib/messages.js';
import Avatar from '../components/Avatar.jsx';
import BottomNav from '../components/BottomNav.jsx';
import { Lock, ShieldCheck, Trash } from '../components/Icons.jsx';

function Toggle({ on, onChange }) {
  return <button type="button" className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} aria-pressed={on} />;
}

export default function SettingsPage({ email, go, onLocked }) {
  const [settings, setSettings] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    call('settings:get').then(setSettings);
  }, []);

  const update = async (patch) => setSettings(await call('settings:update', patch));
  const lock = async () => onLocked(await call('auth:lock'));
  const reset = async () => onLocked(await call('auth:reset'));

  return (
    <div className="screen">
      <header className="topbar">
        <div className="logo"><ShieldCheck size={17} /></div>
        <h2>Nustatymai</h2>
      </header>

      <div className="scroll settings">
        <div className="card">
          <div className="card-row">
            <Avatar title={email || '?'} />
            <div className="grow">
              <div className="t" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</div>
              <div className="d">Saugykla atrakinta</div>
            </div>
            <button className="icon-btn" onClick={lock} title="Užrakinti"><Lock size={17} /></button>
          </div>
        </div>

        {settings && (
          <div className="card">
            <div className="card-row">
              <div className="grow">
                <div className="t">Siūlyti išsaugoti slaptažodžius</div>
                <div className="d">Aptikus prisijungimo formą parodomas pasiūlymas</div>
              </div>
              <Toggle on={settings.offerToSave} onChange={(v) => update({ offerToSave: v })} />
            </div>
            <div className="card-row">
              <div className="grow">
                <div className="t">Automatinis užpildymas</div>
                <div className="d">Rodyti išsaugotus prisijungimus tinkamose svetainėse</div>
              </div>
              <Toggle on={settings.offerAutofill} onChange={(v) => update({ offerAutofill: v })} />
            </div>
            <div className="card-row">
              <div className="grow">
                <div className="t">Atsiminti el. paštą</div>
                <div className="d">Užpildyti el. paštą prisijungimo lange</div>
              </div>
              <Toggle on={settings.rememberEmail} onChange={(v) => update({ rememberEmail: v, lastEmail: v ? email : '' })} />
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-row">
            <div className="grow">
              <div className="t">Ištrinti paskyrą</div>
              <div className="d">Visi šios paskyros įrašai bus negrįžtamai pašalinti iš įrenginio</div>
            </div>
          </div>
          <div className="card-row" style={{ gap: 8 }}>
            {confirmReset ? (
              <>
                <button className="btn btn-outline" style={{ height: 36, fontSize: 13, flex: 1 }} onClick={() => setConfirmReset(false)}>Atšaukti</button>
                <button className="btn btn-danger" style={{ height: 36, fontSize: 13, flex: 1 }} onClick={reset}><Trash size={15} />Taip, ištrinti</button>
              </>
            ) : (
              <button className="btn btn-danger btn-block" style={{ height: 36, fontSize: 13 }} onClick={() => setConfirmReset(true)}>
                <Trash size={15} />Ištrinti paskyrą ir duomenis
              </button>
            )}
          </div>
        </div>

        <p style={{ fontSize: 11.5, color: 'var(--faint)', textAlign: 'center', lineHeight: 1.6, margin: '6px 10px 70px' }}>
          KeyVault v0.1.0 · MVP<br />
          Duomenys saugomi tik šiame įrenginyje ir šifruojami AES-256-GCM.
        </p>
      </div>
      <BottomNav active="settings" go={go} />
    </div>
  );
}
