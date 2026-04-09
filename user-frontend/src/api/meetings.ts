import { apiClient } from './client'
import type { Meeting, MeetingDetail, CreateMeetingRequest, JoinMeetingResponse } from '@/types'

export const meetingsApi = {
  getMeetings: async (): Promise<Meeting[]> => {
    const response = await apiClient.get<Meeting[]>('/meetings')
    return response.data
  },

  getMeetingDetail: async (meetingId: string): Promise<MeetingDetail> => {
    const response = await apiClient.get<MeetingDetail>(`/meetings/${meetingId}`)
    return response.data
  },

  createMeeting: async (data: CreateMeetingRequest): Promise<Meeting> => {
    const response = await apiClient.post<Meeting>('/meetings', data)
    return response.data
  },

  joinMeeting: async (meetingId: string): Promise<JoinMeetingResponse> => {
    const response = await apiClient.post<JoinMeetingResponse>(`/meetings/${meetingId}/join`)
    return response.data
  },

  leaveMeeting: async (meetingId: string): Promise<void> => {
    await apiClient.post(`/meetings/${meetingId}/leave`)
  },

  endMeeting: async (meetingId: string): Promise<void> => {
    await apiClient.post(`/meetings/${meetingId}/end`)
  },
}

// Default export for compatibility
export default meetingsApi
