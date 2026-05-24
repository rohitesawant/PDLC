import { useEffect } from 'react';

type Props = {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  /** Max width Tailwind utility, e.g. 'max-w-3xl'. */
  maxWidth?: string;
};

export function Modal({ title, children, onClose, maxWidth = 'max-w-3xl' }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative min-h-full flex items-start justify-center p-4 sm:p-8">
        <div className={`relative bg-white rounded-2xl shadow-xl w-full ${maxWidth} my-8 overflow-hidden`}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-ink-200">
            <h2 className="text-base font-semibold text-ink-900 truncate pr-4">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-800 inline-flex items-center justify-center"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
