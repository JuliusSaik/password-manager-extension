import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertCircle, Check } from './Icons.jsx';

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef();
  const show = useCallback((text, type = 'success') => {
    clearTimeout(timer.current);
    setToast({ text, type, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), 2200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <div key={toast.key} className={`toast ${toast.type}`} role="status">
          {toast.type === 'error' ? <AlertCircle size={17} /> : <Check size={17} />}
          {toast.text}
        </div>
      )}
    </ToastCtx.Provider>
  );
}
