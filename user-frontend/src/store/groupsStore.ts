import { create } from 'zustand'
import type { Group, GroupDetail, GroupMember } from '@/types'

interface GroupsState {
  groups: Group[]
  currentGroup: GroupDetail | null
  isLoading: boolean

  // Actions
  setGroups: (groups: Group[]) => void
  addGroup: (group: Group) => void
  updateGroup: (groupId: number, updates: Partial<Group>) => void
  removeGroup: (groupId: number) => void
  setCurrentGroup: (group: GroupDetail | null) => void
  addGroupMember: (groupId: number, member: GroupMember) => void
  removeGroupMember: (groupId: number, userId: number) => void
  setLoading: (loading: boolean) => void

  // Computed
  getGroupById: (groupId: number) => Group | undefined
}

export const useGroupsStore = create<GroupsState>((set, get) => ({
  groups: [],
  currentGroup: null,
  isLoading: false,

  setGroups: (groups) => set({ groups }),

  addGroup: (group) =>
    set((state) => ({
      groups: [group, ...state.groups],
    })),

  updateGroup: (groupId, updates) =>
    set((state) => ({
      groups: state.groups.map((g) =>
        g.group_id === groupId ? { ...g, ...updates } : g
      ),
    })),

  removeGroup: (groupId) =>
    set((state) => ({
      groups: state.groups.filter((g) => g.group_id !== groupId),
    })),

  setCurrentGroup: (group) => set({ currentGroup: group }),

  addGroupMember: (groupId, member) =>
    set((state) => {
      if (state.currentGroup?.group_id === groupId) {
        return {
          currentGroup: {
            ...state.currentGroup,
            members: [...state.currentGroup.members, member],
            member_count: state.currentGroup.member_count + 1,
          },
        }
      }
      return state
    }),

  removeGroupMember: (groupId, userId) =>
    set((state) => {
      if (state.currentGroup?.group_id === groupId) {
        return {
          currentGroup: {
            ...state.currentGroup,
            members: state.currentGroup.members.filter((m) => m.user_id !== userId),
            member_count: state.currentGroup.member_count - 1,
          },
        }
      }
      return state
    }),

  setLoading: (loading) => set({ isLoading: loading }),

  getGroupById: (groupId) => {
    const state = get()
    return state.groups.find((g) => g.group_id === groupId)
  },
}))
