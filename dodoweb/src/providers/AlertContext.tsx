import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {cx, tw} from '@/lib/tw';

export type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type AlertConfig = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
};

type AlertContextValue = {
  showAlert: (title: string, message?: string, buttons?: AlertButton[]) => void;
};

const AlertContext = createContext<AlertContextValue | undefined>(undefined);

export function AlertProvider({children}: {children: React.ReactNode}) {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<AlertConfig>({title: ''});
  const queueRef = useRef<AlertConfig[]>([]);

  const showNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (!next) {
      return;
    }
    setConfig(next);
    setVisible(true);
  }, []);

  const showAlert = useCallback(
    (title: string, message?: string, buttons?: AlertButton[]) => {
      const entry: AlertConfig = {title, message, buttons};
      if (visible) {
        queueRef.current.push(entry);
      } else {
        setConfig(entry);
        setVisible(true);
      }
    },
    [visible],
  );

  const handleDismiss = useCallback(() => {
    setVisible(false);
    window.setTimeout(showNext, 180);
  }, [showNext]);

  const value = useMemo(() => ({showAlert}), [showAlert]);
  const buttons =
    config.buttons && config.buttons.length > 0
      ? config.buttons
      : [{text: 'OK', style: 'default' as const}];

  return (
    <AlertContext.Provider value={value}>
      {children}
      {visible ? (
        <div className={tw.modalOverlay} role="presentation">
          <div className={tw.modalBackdrop} onClick={handleDismiss} />
          <div className={tw.modalCard} role="dialog" aria-modal="true" aria-label={config.title}>
            <div className="grid gap-2.5">
              <h3 className={tw.h2}>{config.title}</h3>
              {config.message ? <p className={tw.muted}>{config.message}</p> : null}
            </div>
            <div className={cx('mt-5 flex gap-3', buttons.length === 1 ? 'justify-stretch' : 'justify-end')}>
              {buttons.map((button, index) => (
                <button
                  key={`${button.text}-${index}`}
                  className={cx(
                    'min-h-12 flex-1 rounded-full font-sans-bold',
                    button.style === 'cancel' && 'bg-surface-light text-text',
                    button.style === 'destructive' && 'bg-danger-light text-danger',
                    (!button.style || button.style === 'default') && 'bg-accent text-white',
                  )}
                  onClick={() => {
                    handleDismiss();
                    button.onPress?.();
                  }}>
                  {button.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </AlertContext.Provider>
  );
}

export function useAlert(): AlertContextValue {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used inside AlertProvider');
  }
  return context;
}

