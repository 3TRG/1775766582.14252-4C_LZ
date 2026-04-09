import { create } from 'zustand'
import type { Meeting, MeetingDetail } from '@/types'

interface MeetingsState {
  meetings: Meeting[]
  currentMeeting: MeetingDetail | null
  isLoading: boolean

  // Actions
  setMeetings: (meetings: Meeting[]) => void
  addMeeting: (meeting: Meeting) => void
  updateMeeting: (meetingId: string, updates: Partial<Meeting>) => void
  removeMeeting: (meetingId: string) => void
  setCurrentMeeting: (meeting: MeetingDetail | null) => void
  setLoading: (loading: boolean) => void

  // Computed
  getActiveMeetings: () => Meeting[]
  getUpcomingMeetings: () => Meeting[]
}

export const useMeetingsStore = create<MeetingsState>((set, get) => ({
  meetings: [],
  currentMeeting: null,
  isLoading: false,

  setMeetings: (meetings) => set({ meetings }),

  addMeeting: (meeting) =>
    set((state) => ({
      meetings: [meeting, ...state.meetings],
    })),

  updateMeeting: (meetingId, updates) =>
    set((state) => ({
      meetings: state.meetings.map((m) =>
        m.id === meetingId ? { ...m, ...updates } : m
      ),
    })),

  removeMeeting: (meetingId) =>
    set((state) => ({
      meetings: state.meetings.filter((m) => m.id !== meetingId),
    })),

  setCurrentMeeting: (meeting) => set({ currentMeeting: meeting }),

  setLoading: (loading) => set({ isLoading: loading }),

  getActiveMeetings: () => {
    const state = get()
    return state.meetings.filter((m) => m.status === 'ongoing')
  },

  getUpcomingMeetings: () => {
    const state = get()
    return state.meetings.filter((m) => m.status === 'scheduled')
  },
}))
