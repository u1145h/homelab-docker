import client from './client'

export interface PowerActionResponse {
  success: boolean
  message: string
}

export async function rebootServer(password: string): Promise<PowerActionResponse> {
  const { data } = await client.post<PowerActionResponse>('/system/reboot', { password })
  return data
}
