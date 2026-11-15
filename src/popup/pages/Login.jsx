import { useState } from 'react';
import { call } from '../../lib/messages.js';
import { passwordStrength } from '../../lib/strength.js';
import { useToast } from '../components/Toast.jsx';
import { Check, Eye, EyeOff, Lock, Mail, ShieldCheck } from '../components/Icons.jsx';

function PasswordInput({ value, onChange, placeholder, autoFocus, error }) {
  const [show, setShow] = useState(false);
  return (
    <div className={`input-wrap ${error ? 'error' : ''}`}>
      <Lock />
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      <button type="button" className="icon-btn ghost" onClick={() => setShow((s) => !s)} title={show ? 'Slėpti' : 'Rodyti'}>
        {show ? <EyeOff size={19} /> : <Eye size={19} />}
      </button>
    </div>
  );
}

export default function Login({ lastEmail = '', hasDraft, onAuthed }) {
  const toast = useToast();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState(lastEmail);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [remember, setRemember] = useState(true);
  const [seedDemo, setSeedDemo] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';
  const strength = passwordStrength(password);

  const switchMode = (m) => {
    setMode(m);
    setError('');
    setPassword('');
    setConfirm('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) return setError('Užpildykite visus laukus');
    if (isRegister && password !== confirm) return setError('Slaptažodžiai nesutampa');
    setBusy(true);
    try {
      const s = isRegister
        ? await call('auth:register', { email, password, seedDemo })
        : await call('auth:login', { email, password, rememberEmail: remember });
      await onAuthed(s);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form className="screen auth scroll" onSubmit={submit} noValidate style={isRegister ? { paddingTop: 26, paddingBottom: 24 } : undefined}>
      <div className="auth-head">
        <div className="logo lg" style={isRegister ? { width: 52, height: 52, borderRadius: 15 } : undefined}>
          <ShieldCheck size={isRegister ? 26 : 30} sw={2} />
        </div>
        <h1 style={isRegister ? { marginTop: 16 } : undefined}>{isRegister ? 'Sukurkite saugyklą' : 'Sveiki sugrįžę'}</h1>
        <p>
          {hasDraft && !isRegister
            ? 'Atrakinkite saugyklą, kad išsaugotumėte aptiktą prisijungimą'
            : isRegister
              ? 'Pagrindinis slaptažodis šifruos visus jūsų duomenis'
              : 'Įveskite pagrindinį slaptažodį, kad atrakintumėte saugyklą'}
        </p>
      </div>

      <div className="segmented" role="tablist">
        <button type="button" className={!isRegister ? 'active' : ''} onClick={() => switchMode('login')}>Prisijungti</button>
        <button type="button" className={isRegister ? 'active' : ''} onClick={() => switchMode('register')}>Registruotis</button>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="field">
        <label className="label">El. paštas</label>
        <div className="input-wrap">
          <Mail />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jonas@pavyzdys.lt" autoFocus={!email} />
        </div>
      </div>

      <div className="field">
        <label className="label">Pagrindinis slaptažodis</label>
        <PasswordInput value={password} onChange={setPassword} placeholder={isRegister ? 'Bent 8 simboliai' : '••••••••••••'} autoFocus={!!email} />
        {isRegister && password && (
          <>
            <div className="strength">
              {[1, 2, 3, 4].map((i) => <span key={i} style={{ background: i <= strength.score ? strength.color : undefined }} />)}
            </div>
            <div className="strength-row" style={{ color: strength.color }}>{strength.label}</div>
          </>
        )}
      </div>

      {isRegister && (
        <div className="field">
          <label className="label">Pakartokite slaptažodį</label>
          <PasswordInput value={confirm} onChange={setConfirm} placeholder="••••••••••••" error={confirm && confirm !== password} />
        </div>
      )}

      <div className="auth-row">
        {isRegister ? (
          <label className="checkbox">
            <input type="checkbox" checked={seedDemo} onChange={(e) => setSeedDemo(e.target.checked)} />
            <span className="box">{seedDemo && <Check size={11} sw={3.5} />}</span>
            Pridėti demonstracinius įrašus
          </label>
        ) : (
          <>
            <label className="checkbox">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span className="box">{remember && <Check size={11} sw={3.5} />}</span>
              Atsiminti el. paštą
            </label>
            <button
              type="button"
              className="link"
              onClick={() => toast('Pagrindinio slaptažodžio atkurti negalima – jis niekur nesaugomas', 'error')}
            >
              Pamiršote?
            </button>
          </>
        )}
      </div>

      <button className="btn btn-primary btn-block" disabled={busy}>
        {busy ? <span className="spinner" /> : <Lock size={18} />}
        {isRegister ? 'Sukurti saugyklą' : 'Atrakinti saugyklą'}
      </button>

      {!isRegister && (
        <div className="auth-foot">
          <ShieldCheck size={15} />
          Šifruojama AES-256 jūsų įrenginyje
        </div>
      )}
    </form>
  );
}
