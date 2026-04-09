import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContactsStore } from '@/store'
import { contactsApi } from '@/api'
import { Avatar, Button, Modal, Input } from '@/components/common'
import type { Contact } from '@/types'

export default function Contacts() {
  const navigate = useNavigate()
  const { contacts, setContacts, addContact, removeContact } = useContactsStore()
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [addAccount, setAddAccount] = useState('')
  const [addRemark, setAddRemark] = useState('')

  useEffect(() => {
    loadContacts()
  }, [])

  const loadContacts = async () => {
    try {
      setIsLoading(true)
      const data = await contactsApi.getContacts()
      setContacts(data)
    } catch (error) {
      console.error('Failed to load contacts:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddContact = async () => {
    if (!addAccount.trim()) return

    try {
      const contact = await contactsApi.addContact({
        account: addAccount,
        remark: addRemark || undefined,
      })
      addContact(contact)
      setShowAddModal(false)
      setAddAccount('')
      setAddRemark('')
    } catch (error) {
      console.error('Failed to add contact:', error)
    }
  }

  const handleDeleteContact = async (userId: number) => {
    try {
      await contactsApi.deleteContact(userId)
      removeContact(userId)
    } catch (error) {
      console.error('Failed to delete contact:', error)
    }
  }

  const filteredContacts = contacts.filter(
    (c) =>
      c.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.account.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.remark?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const onlineContacts = filteredContacts.filter((c) => c.status === 'online')
  const offlineContacts = filteredContacts.filter((c) => c.status === 'offline')

  return (
    <div className="h-full flex">
      {/* Contacts list */}
      <div className="w-80 bg-slate-800/30 border-r border-slate-700/50 flex flex-col">
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-100">通讯录</h2>
            <Button size="sm" onClick={() => setShowAddModal(true)}>
              添加好友
            </Button>
          </div>
          <input
            type="text"
            placeholder="搜索联系人..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              {/* Online contacts */}
              {onlineContacts.length > 0 && (
                <div className="px-4 py-2">
                  <p className="text-xs text-slate-400 mb-2">在线 · {onlineContacts.length}</p>
                  {onlineContacts.map((contact) => (
                    <ContactItem
                      key={contact.user_id}
                      contact={contact}
                      onDelete={() => handleDeleteContact(contact.user_id)}
                      onChat={() => navigate(`/chat?user_id=${contact.user_id}`)}
                    />
                  ))}
                </div>
              )}

              {/* Offline contacts */}
              {offlineContacts.length > 0 && (
                <div className="px-4 py-2">
                  <p className="text-xs text-slate-400 mb-2">离线 · {offlineContacts.length}</p>
                  {offlineContacts.map((contact) => (
                    <ContactItem
                      key={contact.user_id}
                      contact={contact}
                      onDelete={() => handleDeleteContact(contact.user_id)}
                      onChat={() => navigate(`/chat?user_id=${contact.user_id}`)}
                    />
                  ))}
                </div>
              )}

              {filteredContacts.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  暂无联系人
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Contact detail */}
      <div className="flex-1 flex items-center justify-center text-slate-400">
        <p>选择一个联系人查看详情</p>
      </div>

      {/* Add contact modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="添加好友"
      >
        <div className="space-y-4">
          <Input
            label="账号"
            placeholder="请输入用户账号"
            value={addAccount}
            onChange={(e) => setAddAccount(e.target.value)}
          />
          <Input
            label="备注名 (选填)"
            placeholder="请输入备注名"
            value={addRemark}
            onChange={(e) => setAddRemark(e.target.value)}
          />
          <div className="flex justify-end space-x-2">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              取消
            </Button>
            <Button onClick={handleAddContact} disabled={!addAccount.trim()}>
              添加
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function ContactItem({ contact, onDelete, onChat }: { contact: Contact; onDelete: () => void; onChat: () => void }) {
  return (
    <div className="flex items-center p-2 rounded-lg hover:bg-slate-700/50 cursor-pointer group">
      <Avatar name={contact.remark || contact.username} src={contact.avatar} size="md" status={contact.status} />
      <div className="ml-3 flex-1 min-w-0">
        <p className="font-medium text-slate-100 truncate">
          {contact.remark || contact.username}
        </p>
        <p className="text-sm text-slate-400 truncate">{contact.account}</p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onChat()
        }}
        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-400 transition-opacity"
        title="发消息"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-400 transition-opacity"
        title="删除"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  )
}
