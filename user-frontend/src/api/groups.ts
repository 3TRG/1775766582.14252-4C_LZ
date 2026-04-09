import { apiClient } from './client'
import type { Group, GroupDetail, CreateGroupRequest, UpdateGroupRequest, GroupMessageRequest, Message } from '@/types'

export const groupsApi = {
  getGroups: async (): Promise<Group[]> => {
    const response = await apiClient.get<Group[]>('/chat/groups')
    return response.data
  },

  getGroupDetail: async (groupId: number): Promise<GroupDetail> => {
    const response = await apiClient.get<GroupDetail>(`/chat/groups/${groupId}`)
    return response.data
  },

  createGroup: async (data: CreateGroupRequest): Promise<Group> => {
    const response = await apiClient.post<Group>('/chat/groups', data)
    return response.data
  },

  updateGroup: async (groupId: number, data: UpdateGroupRequest): Promise<Group> => {
    const response = await apiClient.put<Group>(`/chat/groups/${groupId}`, data)
    return response.data
  },

  deleteGroup: async (groupId: number): Promise<void> => {
    await apiClient.delete(`/chat/groups/${groupId}`)
  },

  addMember: async (groupId: number, userId: number): Promise<void> => {
    await apiClient.post(`/chat/groups/${groupId}/members`, { user_id: userId })
  },

  removeMember: async (groupId: number, userId: number): Promise<void> => {
    await apiClient.delete(`/chat/groups/${groupId}/members/${userId}`)
  },

  leaveGroup: async (groupId: number): Promise<void> => {
    await apiClient.post(`/chat/groups/${groupId}/leave`)
  },

  sendGroupMessage: async (data: GroupMessageRequest): Promise<Message> => {
    const response = await apiClient.post<Message>('/chat/groups/messages', data)
    return response.data
  },
}
