export type MeetingStatus = 'scheduled' | 'ongoing' | 'ended'

export interface Meeting {
  id: string
  title: string
  description?: string
  creator_id: number
  status: MeetingStatus
  start_time: string
  end_time?: string
  participant_count: number
  max_participants: number
  meeting_url: string
  created_at: string
}

export interface MeetingDetail extends Meeting {
  participants: MeetingParticipant[]
}

export interface MeetingParticipant {
  user_id: number
  username: string
  avatar?: string
  joined_at: string
  left_at?: string
}

export interface CreateMeetingRequest {
  title: string
  description?: string
  start_time: string
  max_participants?: number
}

export interface JoinMeetingResponse {
  meeting_url: string
  token: string
}
