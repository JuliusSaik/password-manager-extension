import { useEffect, useState } from 'react';
import { call } from '../../lib/messages.js';
import { passwordStrength } from '../../lib/strength.js';
import { titleFromUrl } from '../../lib/url.js';
import Avatar from '../components/Avatar.jsx';
import { useToast } from '../components/Toast.jsx';
import { ChevronLeft, Copy, Eye, EyeOff, Globe, Info, Star, Trash, User } from '../components/Icons.jsx';

const CATEGORIES = ['Darbas', 'Asmeninis', 'Socialiniai'];
const EMPTY = { title: '', url: '', username: '', password: '', category: 'Darbas', favorite: false };

/**
 * Naujas įrašas / redagavimas.
 *  - id     -> redaguojamas esamas įrašas
 *  - draft  -> prisijungimas, aptiktas puslapio formoje (content script), arba URL iš aktyvaus skirtuko
 */
export default function EntryForm({ id, draft, onDone }) {
  const toast = useToast();
  const detected = !!draft?.ts;
  const isUpdate = detected && draft.action === 'update';
  const [form, setForm] = useState(() =>
    draft && !isUpdate
      ? { ...EMPTY, title: draft.title || titleFromUrl(draft.url), url: draft.url || '', username: draft.username || '', password: draft.password || '' }
      : EMPTY,
  );
  const [loading, setLoading] = useState(!!id);
  const [show, setShow] = useState(detected);
  const [errors, setErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    call('vault:get', { id }).then((e) => {
      setForm(isUpdate ? { ...e, password: draft.password } : e);
      setLoading(false);
    });
  }, [id, isUpdate, draft]);

  const set = (k) => (ev) => {
    const v = ev.target.value;
    setForm((f) => {
      const next = { ...f, [k]: v };
      // automatiškai pasiūlom pavadinimą pagal adresą
      if (k === 'url' && (!f.title || f.title === titleFromUrl(f.url))) next.title = titleFromUrl(v);
      return next;
    });
    setErrors((e) => ({ ...e, [k]: false }));
  };

  const strength = passwordStrength(form.password);

  const save = async (ev) => {
    ev.preventDefault();
    const errs = { password: !form.password, title: !form.title.trim() && !form.url.trim() };
    setErrors(errs);
    if (errs.password || errs.title) return;
    setBusy(true);
    try {
      await call('vault:save', { ...form, id: id || undefined });
      toast(id ? 'Įrašas atnaujintas' : 'Įrašas išsaugotas');
      setTimeout(onDone, 500);
    } catch (e) {
      toast(e.message, 'error');
      setBusy(false);
    }
  };

  const remove = async () => {
    await call('vault:delete', { id });
    toast('Įrašas ištrintas');
    setTimeout(onDone, 400);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(form.password);
    toast('Slaptažodis nukopijuotas');
  };

  const heading = isUpdate ? 'Atnaujinti slaptažodį' : id ? 'Redaguoti įrašą' : 'Naujas įrašas';

  return (
    <form className="screen" onSubmit={save} noValidate>
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={onDone} title="Atgal"><ChevronLeft /></button>
        <h2>{heading}</h2>
        {id && !isUpdate && (
          <>
            <button
              type="button"
              className="icon-btn ghost"
              title={form.favorite ? 'Pašalinti iš mėgstamų' : 'Pridėti prie mėgstamų'}
              style={form.favorite ? { color: '#fbbf24' } : undefined}
              onClick={() => setForm((f) => ({ ...f, favorite: !f.favorite }))}
            >
              <Star size={18} filled={form.favorite} />
            </button>
            <button type="button" className="icon-btn ghost" title="Ištrinti" onClick={() => setConfirmDelete(true)}>
              <Trash size={18} />
            </button>
          </>
        )}
      </header>

      <div className="scroll form-body" style={{ visibility: loading ? 'hidden' : 'visible' }}>
        {detected && (
          <div className="banner">
            <Info size={16} />
            <span>
              {isUpdate
                ? <>Aptiktas naujas slaptažodis svetainėje <b>{draft.host}</b>. Išsaugokite, kad atnaujintumėte įrašą.</>
                : <>Aptiktas prisijungimas svetainėje <b>{draft.host}</b>. Patikrinkite duomenis ir išsaugokite.</>}
            </span>
          </div>
        )}

        <div className="field">
          <label className="label">Pavadinimas</label>
          <div className={`input-wrap ${errors.title ? 'error' : ''}`} style={{ paddingLeft: 12 }}>
            <Avatar title={form.title || '?'} size="sm" />
            <input value={form.title} onChange={set('title')} placeholder="pvz. GitHub" autoFocus={!id && !detected} />
          </div>
        </div>

        <div className="field">
          <label className="label">Svetainės adresas</label>
          <div className="input-wrap">
            <Globe size={19} />
            <input value={form.url} onChange={set('url')} placeholder="https://..." />
          </div>
        </div>

        <div className="field">
          <label className="label">Vartotojo vardas / el. paštas</label>
          <div className="input-wrap">
            <User size={19} />
            <input value={form.username} onChange={set('username')} placeholder="vardas@pavyzdys.lt" />
          </div>
        </div>

        <div className="field">
          <label className="label">Slaptažodis</label>
          <div className={`input-wrap ${errors.password ? 'error' : ''}`}>
            <input
              className="mono"
              type={show ? 'text' : 'password'}
              value={form.password}
              onChange={set('password')}
              placeholder="Įveskite slaptažodį"
              autoComplete="new-password"
              autoFocus={isUpdate}
            />
            <button type="button" className="icon-btn ghost" onClick={() => setShow((s) => !s)} title={show ? 'Slėpti' : 'Rodyti'}>
              {show ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
            <button type="button" className="icon-btn ghost" onClick={copy} disabled={!form.password} title="Kopijuoti" style={{ color: 'var(--accent-light)' }}>
              <Copy size={17} />
            </button>
          </div>
          <div className="strength">
            {[1, 2, 3, 4].map((i) => <span key={i} style={{ background: i <= strength.score ? strength.color : undefined }} />)}
          </div>
          <div className="strength-row">
            <span style={{ color: strength.color }}>{strength.label}</span>
          </div>
        </div>

        <div className="field">
          <label className="label">Kategorija</label>
          <div className="chips">
            {CATEGORIES.map((c) => (
              <button type="button" key={c} className={`chip ${form.category === c ? 'active' : ''}`} style={{ height: 32, padding: '0 14px', fontSize: 13 }} onClick={() => setForm((f) => ({ ...f, category: c }))}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="form-foot">
        {confirmDelete ? (
          <>
            <button type="button" className="btn btn-outline" onClick={() => setConfirmDelete(false)}>Atšaukti</button>
            <button type="button" className="btn btn-danger" style={{ flex: 1 }} onClick={remove}>
              <Trash size={17} /> Ištrinti įrašą
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-outline" onClick={onDone}>Atšaukti</button>
            <button className="btn btn-primary" disabled={busy}>{isUpdate ? 'Atnaujinti' : 'Išsaugoti'}</button>
          </>
        )}
      </div>
    </form>
  );
}
