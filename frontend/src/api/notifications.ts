import client from "./client"
import type {
  NotificationItem,
  NotificationSummary,
  NotificationFilters,
  NotificationListResponse,
} from "../types/notification"

export async function getNotificationSummary(limit = 10): Promise<NotificationSummary> {
  const { data } = await client.get<NotificationSummary>("/notifications/summary", {
    params: { limit },
  })
  return data
}

export async function getNotifications(
  filters?: NotificationFilters
): Promise<NotificationListResponse> {
  const { data } = await client.get<NotificationListResponse>("/notifications", {
    params: filters,
  })
  return data
}

export async function markNotificationRead(id: string): Promise<boolean> {
  const { data } = await client.post<{ success: boolean }>(`/notifications/${id}/read`)
  return data.success
}

export async function markAllNotificationsRead(): Promise<boolean> {
  const { data } = await client.post<{ success: boolean }>("/notifications/read-all")
  return data.success
}

export async function deleteNotification(id: string): Promise<boolean> {
  const { data } = await client.delete<{ success: boolean }>(`/notifications/${id}`)
  return data.success
}

export async function clearNotifications(): Promise<boolean> {
  const { data } = await client.delete<{ success: boolean }>("/notifications")
  return data.success
}

export async function triggerTestNotification(
  payload?: Partial<NotificationItem>
): Promise<NotificationItem> {
  const { data } = await client.post<NotificationItem>("/notifications/test", payload || {})
  return data
}
