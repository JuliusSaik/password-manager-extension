import { Key, List, Settings } from './Icons.jsx';

export default function BottomNav({ active, go }) {
  return (
    <nav className="bottom-nav">
      <button className={active === 'vault' ? 'active' : ''} onClick={() => go('vault')}>
        <List size={21} />
        Saugykla
      </button>
      <button disabled title="Slaptažodžių generatorius – kitame etape">
        <Key size={21} />
        Generatorius
        <span className="soon">Netrukus</span>
      </button>
      <button className={active === 'settings' ? 'active' : ''} onClick={() => go('settings')}>
        <Settings size={21} />
        Nustatymai
      </button>
    </nav>
  );
}
