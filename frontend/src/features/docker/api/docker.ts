import api from "@/api/client"
import type { ContainerSummary, ProjectSummary, ContainerDetail, ContainerLog, DockerActionResponse } from "../types"

export async function getContainers(): Promise<ContainerSummary[]> {
  const { data } = await api.get<ContainerSummary[]>("/docker/containers")
  return data
}

export async function getProjects(): Promise<ProjectSummary[]> {
  const { data } = await api.get<ProjectSummary[]>("/docker/projects")
  return data
}

export async function getContainerDetail(id: string): Promise<ContainerDetail> {
  const { data } = await api.get<ContainerDetail>(`/docker/containers/${id}`)
  return data
}

export async function getContainerLogs(id: string, tail = 50): Promise<ContainerLog[]> {
  const { data } = await api.get<ContainerLog[]>(`/docker/containers/${id}/logs`, { params: { tail } })
  return data
}

export async function startContainer(id: string): Promise<void> {
  await api.post<DockerActionResponse>(`/docker/containers/${id}/start`)
}

export async function stopContainer(id: string): Promise<void> {
  await api.post<DockerActionResponse>(`/docker/containers/${id}/stop`)
}

export async function restartContainer(id: string): Promise<void> {
  await api.post<DockerActionResponse>(`/docker/containers/${id}/restart`)
}

export async function removeContainer(id: string): Promise<void> {
  await api.delete<DockerActionResponse>(`/docker/containers/${id}`)
}
