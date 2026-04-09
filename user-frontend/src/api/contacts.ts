import { apiClient } from './client'
import type { Contact, AddContactRequest, UpdateContactRequest } from '@/types'

interface FriendItemDTO {
  user_id: number
  username: string
  account: string
  online_status: string
}

interface FriendsResponseDTO {
  items: FriendItemDTO[]
}

function mapFriendToContact(item: FriendItemDTO): Contact {
  return {
    user_id: item.user_id,
    username: item.username,
    account: item.account,
    status: (item.online_status === 'online' ? 'online' : 'offline') as Contact['status'],
    created_at: new Date().toISOString(),
  }
}

export const contactsApi = {
  getContacts: async (): Promise<Contact[]> => {
    const response = await apiClient.get<FriendsResponseDTO>('/chat/friends')
    const items = response.data?.items ?? (Array.isArray(response.data) ? response.data : [])
    return items.map(mapFriendToContact)
  },

  addContact: async (data: AddContactRequest): Promise<Contact> => {
    const response = await apiClient.post<FriendItemDTO>('/chat/friends', {
      account_or_user_id: data.account,
    })
    return mapFriendToContact(response.data)
  },

  updateContact: async (userId: number, data: UpdateContactRequest): Promise<Contact> => {
    const response = await apiClient.put<FriendItemDTO>(`/chat/friends/${userId}`, data)
    return mapFriendToContact(response.data)
  },

  deleteContact: async (userId: number): Promise<void> => {
    await apiClient.delete(`/chat/friends/${userId}`)
  },

  searchUsers: async (keyword: string): Promise<Contact[]> => {
    const response = await apiClient.get<FriendsResponseDTO>('/chat/users/search', {
      params: { keyword },
    })
    const items = response.data?.items ?? (Array.isArray(response.data) ? response.data : [])
    return items.map(mapFriendToContact)
  },
}
