import { useEffect } from 'react';

/**
 * Toast global de feedback.
 *
 * Uso:
 *   const [toast, setToast] = useState({ message: '', type: 'success' });
 *   <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '' })} />
 *   setToast({ message: 'Salvo!', type: 'success' });
 *
 * Types: 'success' | 'error' | 'warn' | 'info'
 */
export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className={`toast ${type}`}>
      {message}
    </div>
  );
}
