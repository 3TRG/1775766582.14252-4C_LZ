export interface Group {
  group_id: number
  name: string
  avatar?: string
  description?: string
  owner_id: number
  member_count: number
  max_members: number
  created_at: string
  updated_at: string
}

export interface GroupMember {
  user_id: number
  username: string
  avatar?: string
  role: 'owner' | 'admin' | 'member'
  joined_at: string
}

export interface GroupDetail extends Group {
  members: GroupMember[]
}

export interface CreateGroupRequest {
  name: string
  description?: string
  member_ids?: number[]
}

export interface UpdateGroupRequest {
  name?: string
  description?: string
  avatar?: string
}

export interface GroupMessageRequest {
  group_id: number
  content: string
  message_type: 'text' | 'file' | 'image'
}
