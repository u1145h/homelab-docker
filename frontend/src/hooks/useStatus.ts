import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStatus } from "../api/status";

// Poll at 2 s — matches the backend's 3 s collection tick well enough
// while cutting HTTP traffic by 75% vs the old 500 ms interval.
const POLL_INTERVAL_MS = 2000;

/**
 * Returns the status, pausing the poll automatically when the browser tab /
 * app is hidden so we don't burn CPU on the server device for a screen nobody
 * is looking at. Resumes immediately when the tab becomes visible again.
 */
export function useStatus() {
    const [isVisible, setIsVisible] = useState(
        () => document.visibilityState === "visible"
    );

    useEffect(() => {
        const handler = () => setIsVisible(document.visibilityState === "visible");
        document.addEventListener("visibilitychange", handler);
        return () => document.removeEventListener("visibilitychange", handler);
    }, []);

    return useQuery({
        queryKey: ["status"],
        queryFn: getStatus,
        // Pause polling entirely when the tab is hidden — no wasted server CPU.
        refetchInterval: isVisible ? POLL_INTERVAL_MS : false,
        staleTime: POLL_INTERVAL_MS - 200,
        retry: 3,
        refetchOnWindowFocus: true,
    });
}
