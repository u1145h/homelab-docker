import {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";

import type { ReactNode } from "react";
import type { StatusResponse } from "../types/status";

import { getStatus } from "../api/status";

interface StatusContextType {
    status: StatusResponse | null;
    loading: boolean;
    error: string | null;
    lastUpdated: Date | null;
    refresh: () => Promise<void>;
}

const StatusContext = createContext<StatusContextType | null>(null);

export function StatusProvider({
    children,
}: {
    children: ReactNode;
}) {
    const [status, setStatus] = useState<StatusResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    async function refresh(): Promise<void> {
        try {
            const data = await getStatus();

            setStatus(data);
            setLastUpdated(new Date());
            setError(null);
        } catch (err) {
            console.error(err);
            setError("Unable to fetch server status.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        refresh();

        const interval = window.setInterval(refresh, 3000);

        return () => window.clearInterval(interval);
    }, []);

    return (
        <StatusContext.Provider
            value={{
                status,
                loading,
                error,
                lastUpdated,
                refresh,
            }}
        >
            {children}
        </StatusContext.Provider>
    );
}

export function useStatusContext(): StatusContextType {
    const context = useContext(StatusContext);

    if (!context) {
        throw new Error(
            "useStatusContext must be used within StatusProvider."
        );
    }

    return context;
}
