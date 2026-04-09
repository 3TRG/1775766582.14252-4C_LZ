import { Avatar, Button } from '@/components/common'
import type { MeetingDetail } from '@/types'

interface MeetingCardProps {
  meeting: MeetingDetail
  currentUserId: number
  onJoin: () => void
  onLeave: () => void
  onEnd?: () => void
}

export default function MeetingCard({
  meeting,
  currentUserId,
  onJoin,
  onLeave,
  onEnd,
}: MeetingCardProps) {
  const isCreator = meeting.creator_id === currentUserId
  const isEnded = meeting.status === 'ended'

  return (
    <div className="quantum-card p-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-100">{meeting.title}</h3>
          {meeting.description && (
            <p className="text-slate-400 mt-1">{meeting.description}</p>
          )}
        </div>
        <span
          className={`px-3 py-1 rounded-full text-sm ${
            meeting.status === 'ongoing'
              ? 'bg-green-500/20 text-green-400'
              : meeting.status === 'scheduled'
              ? 'bg-blue-500/20 text-blue-400'
              : 'bg-slate-500/20 text-slate-400'
          }`}
        >
          {meeting.status === 'ongoing' ? '进行中' : meeting.status === 'scheduled' ? '已安排' : '已结束'}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-slate-400">开始时间</p>
          <p className="text-slate-100 mt-1">
            {new Date(meeting.start_time).toLocaleString('zh-CN')}
          </p>
        </div>
        <div>
          <p className="text-slate-400">参与人数</p>
          <p className="text-slate-100 mt-1">
            {meeting.participant_count} / {meeting.max_participants}
          </p>
        </div>
      </div>

      {/* Participants */}
      <div className="mt-6">
        <h4 className="text-sm font-medium text-slate-300 mb-3">参与者</h4>
        <div className="flex flex-wrap gap-2">
          {meeting.participants.map((participant) => (
            <div
              key={participant.user_id}
              className="flex items-center px-3 py-1.5 bg-slate-800/50 rounded-full"
            >
              <Avatar name={participant.username} src={participant.avatar} size="sm" />
              <span className="ml-2 text-sm text-slate-100">{participant.username}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end space-x-2 mt-6 pt-4 border-t border-slate-700">
        {isEnded ? (
          <span className="text-slate-400">会议已结束</span>
        ) : isCreator ? (
          <>
            <Button variant="danger" onClick={onEnd}>
              结束会议
            </Button>
            <Button onClick={onJoin}>进入会议</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onLeave}>
              离开会议
            </Button>
            <Button onClick={onJoin}>加入会议</Button>
          </>
        )}
      </div>
    </div>
  )
}
