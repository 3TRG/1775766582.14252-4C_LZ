import { create } from 'zustand'
import type { Contact } from '@/types'

interface ContactsState {
  contacts: Contact[]
  isLoading: boolean
  searchResults: Contact[]
  isSearching: boolean

  // Actions
  setContacts: (contacts: Contact[]) => void
  addContact: (contact: Contact) => void
  updateContact: (userId: number, updates: Partial<Contact>) => void
  removeContact: (userId: number) => void
  updateContactStatus: (userId: number, status: 'online' | 'offline') => void
  setSearchResults: (results: Contact[]) => void
  setLoading: (loading: boolean) => void
  setSearching: (searching: boolean) => void

  // Computed
  getOnlineContacts: () => Contact[]
  getContactById: (userId: number) => Contact | undefined
}

export const useContactsStore = create<ContactsState>((set, get) => ({
  contacts: [],
  isLoading: false,
  searchResults: [],
  isSearching: false,

  setContacts: (contacts) => set({ contacts }),

  addContact: (contact) =>
    set((state) => ({
      contacts: [...state.contacts, contact],
    })),

  updateContact: (userId, updates) =>
    set((state) => ({
      contacts: state.contacts.map((c) =>
        c.user_id === userId ? { ...c, ...updates } : c
      ),
    })),

  removeContact: (userId) =>
    set((state) => ({
      contacts: state.contacts.filter((c) => c.user_id !== userId),
    })),

  updateContactStatus: (userId, status) =>
    set((state) => ({
      contacts: state.contacts.map((c) =>
        c.user_id === userId ? { ...c, status } : c
      ),
    })),

  setSearchResults: (results) => set({ searchResults: results }),

  setLoading: (loading) => set({ isLoading: loading }),

  setSearching: (searching) => set({ isSearching: searching }),

  getOnlineContacts: () => {
    const state = get()
    return state.contacts.filter((c) => c.status === 'online')
  },

  getContactById: (userId) => {
    const state = get()
    return state.contacts.find((c) => c.user_id === userId)
  },
}))
