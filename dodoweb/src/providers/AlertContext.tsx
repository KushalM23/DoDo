import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

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
        <div className="overlay-layer" role="presentation">
          <div className="modal-backdrop" onClick={handleDismiss} />
          <div className="alert-card" role="dialog" aria-modal="true" aria-label={config.title}>
            <div className="alert-body">
              <h3 className="alert-title">{config.title}</h3>
              {config.message ? <p className="alert-message">{config.message}</p> : null}
            </div>
            <div className={`alert-actions ${buttons.length === 1 ? 'single' : ''}`}>
              {buttons.map((button, index) => (
                <button
                  key={`${button.text}-${index}`}
                  className={`alert-button ${button.style ?? 'default'}`}
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
