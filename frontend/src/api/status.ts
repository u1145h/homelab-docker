import api from "./client";

import type { StatusResponse, SpeedTestResult } from "../types/status";

export async function getStatus(): Promise<StatusResponse> {
    const { data } = await api.get<StatusResponse>("/status");
    return data;
}

export async function runSpeedTest(): Promise<SpeedTestResult> {
    const { data } = await api.post<SpeedTestResult>("/network/speedtest");
    return data;
}

