import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CustomAlert, type AlertButton } from "../components/CustomAlert";

type AlertConfig = {
    title: string;
    message?: string;
    buttons?: AlertButton[];
};

type AlertContextValue = {
    showAlert: (title: string, message?: string, buttons?: AlertButton[]) => void;
};

const AlertContext = createContext<AlertContextValue | undefined>(undefined);

export function AlertProvider({ children }: { children: React.ReactNode }) {
    const [visible, setVisible] = useState(false);
    const [config, setConfig] = useState<AlertConfig>({ title: "" });
    const queueRef = useRef<AlertConfig[]>([]);

    const showNext = useCallback(() => {
        if (queueRef.current.length > 0) {
            const next = queueRef.current.shift()!;
            setConfig(next);
            setVisible(true);
        }
    }, []);

    const showAlert = useCallback(
        (title: string, message?: string, buttons?: AlertButton[]) => {
            const entry: AlertConfig = { title, message, buttons };
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
        // Show the next queued alert after a tiny delay so the modal animation finishes
        setTimeout(() => {
            showNext();
        }, 200);
    }, [showNext]);

    const value = useMemo(() => ({ showAlert }), [showAlert]);

    return (
        <AlertContext.Provider value={value}>
            {children}
            <CustomAlert
                visible={visible}
                title={config.title}
                message={config.message}
                buttons={config.buttons}
                onDismiss={handleDismiss}
            />
        </AlertContext.Provider>
    );
}

export function useAlert(): AlertContextValue {
    const ctx = useContext(AlertContext);
    if (!ctx) throw new Error("useAlert must be used inside AlertProvider");
    return ctx;
}
