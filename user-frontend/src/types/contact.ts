export interface Contact {
  user_id: number
  username: string
  account: string
  avatar?: string
  phone?: string
  email?: string
  status: 'online' | 'offline'
  remark?: string  // alias/nickname
  tags?: string[]  // group tags
  created_at: string
}

export interface ContactGroup {
  id: string
  name: string
  contacts: Contact[]
}

export interface AddContactRequest {
  account: string
  remark?: string
  tags?: string[]
}

export interface UpdateContactRequest {
  remark?: string
  tags?: string[]
}
