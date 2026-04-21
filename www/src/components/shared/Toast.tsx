import { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertCircle,
  info: Info,
};

const colorMap = {
  success: 'border-green-500 bg-green-900/80 text-green-100',
  error: 'border-red-500 bg-red-900/80 text-red-100',
  warning: 'border-yellow-500 bg-yellow-900/80 text-yellow-100',
  info: 'border-app-accent bg-app-bg text-app-text',
};

const iconColorMap = {
  success: 'text-green-400',
  error: 'text-red-400',
  warning: 'text-yellow-400',
  info: 'text-app-accent',
};

export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        const Icon = iconMap[toast.type] || Info;
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-lg border shadow-lg min-w-[280px] max-w-[400px] animate-slide-in ${colorMap[toast.type] || colorMap.info}`}
          >
            <Icon className={`w-4 h-4 flex-shrink-0 ${iconColorMap[toast.type] || iconColorMap.info}`} />
            <span className="text-xs font-medium flex-1">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
