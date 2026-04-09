import { Avatar, Button } from '@/components/common'
import type { GroupDetail } from '@/types'

interface GroupCardProps {
  group: GroupDetail
  currentUserId: number
  onChat: () => void
  onAddMember: () => void
  onLeave: () => void
  onDismiss?: () => void
}

export default function GroupCard({
  group,
  currentUserId,
  onChat,
  onAddMember,
  onLeave,
  onDismiss,
}: GroupCardProps) {
  const isOwner = group.owner_id === currentUserId

  return (
    <div className="quantum-card p-6">
      <div className="flex items-start">
        <Avatar name={group.name} src={group.avatar} size="xl" />
        <div className="ml-6 flex-1">
          <h3 className="text-xl font-semibold text-slate-100">{group.name}</h3>
          {group.description && (
            <p className="text-slate-400 mt-1">{group.description}</p>
          )}

          <div className="mt-4 flex items-center space-x-4 text-sm text-slate-400">
            <span>{group.member_count} 成员</span>
            <span>·</span>
            <span>创建于 {new Date(group.created_at).toLocaleDateString('zh-CN')}</span>
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="mt-6">
        <h4 className="text-sm font-medium text-slate-300 mb-3">群成员</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {group.members.map((member) => (
            <div
              key={member.user_id}
              className="flex items-center p-2 bg-slate-800/50 rounded-lg"
            >
              <Avatar name={member.username} src={member.avatar} size="sm" />
              <div className="ml-2 flex-1 min-w-0">
                <p className="text-sm text-slate-100 truncate">{member.username}</p>
                {member.role === 'owner' && (
                  <span className="text-xs text-indigo-400">群主</span>
                )}
                {member.role === 'admin' && (
                  <span className="text-xs text-green-400">管理员</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end space-x-2 mt-6 pt-4 border-t border-slate-700">
        {isOwner ? (
          <>
            <Button variant="secondary" onClick={onAddMember}>
              添加成员
            </Button>
            <Button variant="danger" onClick={onDismiss}>
              解散群组
            </Button>
          </>
        ) : (
          <Button variant="danger" onClick={onLeave}>
            退出群组
          </Button>
        )}
        <Button onClick={onChat}>发送消息</Button>
      </div>
    </div>
  )
}
