import { Avatar, Button } from '@/components/common'
import type { Contact } from '@/types'

interface ContactCardProps {
  contact: Contact
  onChat: () => void
  onDelete: () => void
  onEdit?: () => void
}

export default function ContactCard({ contact, onChat, onDelete, onEdit }: ContactCardProps) {
  return (
    <div className="quantum-card p-6">
      <div className="flex items-start">
        <Avatar
          name={contact.remark || contact.username}
          src={contact.avatar}
          size="xl"
          status={contact.status}
        />
        <div className="ml-6 flex-1">
          <div className="flex items-center">
            <h3 className="text-xl font-semibold text-slate-100">
              {contact.remark || contact.username}
            </h3>
            {contact.remark && (
              <span className="ml-2 text-sm text-slate-400">
                ({contact.username})
              </span>
            )}
          </div>
          <p className="text-slate-400 mt-1">{contact.account}</p>

          <div className="mt-4 space-y-2">
            {contact.phone && (
              <div className="flex items-center text-sm text-slate-400">
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {contact.phone}
              </div>
            )}
            {contact.email && (
              <div className="flex items-center text-sm text-slate-400">
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {contact.email}
              </div>
            )}
            {contact.tags && contact.tags.length > 0 && (
              <div className="flex items-center flex-wrap gap-1 mt-2">
                {contact.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-xs rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-2 mt-6 pt-4 border-t border-slate-700">
        <Button variant="secondary" onClick={onEdit}>
          编辑
        </Button>
        <Button variant="danger" onClick={onDelete}>
          删除
        </Button>
        <Button onClick={onChat}>
          发消息
        </Button>
      </div>
    </div>
  )
}
