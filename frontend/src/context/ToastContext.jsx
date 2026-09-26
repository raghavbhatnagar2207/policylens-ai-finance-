import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type, message, duration = 4500) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    const toast = { id, type, message };

    setToasts((prev) => [...prev, toast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  }, [removeToast]);

  const toast = {
    success: (msg, dur) => addToast('success', msg, dur),
    error: (msg, dur) => addToast('error', msg, dur),
    warning: (msg, dur) => addToast('warning', msg, dur),
    info: (msg, dur) => addToast('info', msg, dur),
    remove: removeToast,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '420px',
          width: 'calc(100vw - 40px)',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => {
          let bg = 'var(--surface, #FFFFFF)';
          let border = 'var(--border, #DDDCD6)';
          let textColor = 'var(--text, #20282D)';
          let icon = <Info size={17} color="var(--primary, #2F6B62)" />;

          if (t.type === 'success') {
            bg = 'var(--success-soft, #EEF6F1)';
            border = '#C8DFD1';
            icon = <CheckCircle2 size={17} color="var(--success, #3E7D5A)" />;
          } else if (t.type === 'error') {
            bg = 'var(--danger-soft, #FDF0EF)';
            border = '#E0BFBE';
            icon = <AlertCircle size={17} color="var(--danger, #B34F4A)" />;
          } else if (t.type === 'warning') {
            bg = 'var(--warning-soft, #FDF6EE)';
            border = '#F0DEC5';
            icon = <AlertTriangle size={17} color="var(--warning, #A66A2B)" />;
          }

          return (
            <div
              key={t.id}
              role="alert"
              style={{
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '11px 14px',
                background: bg,
                color: textColor,
                border: `1px solid ${border}`,
                borderRadius: '6px',
                boxShadow: 'var(--shadow-md, 0 2px 8px rgba(32, 40, 45, 0.08))',
                fontSize: '13px',
                lineHeight: '1.45',
                animation: 'toastIn 0.2s ease-out forwards',
              }}
            >
              <div style={{ flexShrink: 0, marginTop: '1px' }}>{icon}</div>
              <div style={{ flex: 1, wordBreak: 'break-word', fontWeight: 500 }}>{t.message}</div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                aria-label="Close notification"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted, #8E9399)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginLeft: '4px',
                }}
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
