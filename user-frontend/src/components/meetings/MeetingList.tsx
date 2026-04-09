import { Avatar } from '@/components/common'
import type { Meeting } from '@/types'

interface MeetingListProps {
  meetings: Meeting[]
  onJoin: (meeting: Meeting) => void
  selectedId?: string
}

export default function MeetingList({ meetings, onJoin, selectedId }: MeetingListProps) {
  const getStatusBadge = (status: Meeting['status']) => {
    const styles = {
      scheduled: 'bg-blue-500/20 text-blue-400',
      ongoing: 'bg-green-500/20 text-green-400',
      ended: 'bg-slate-500/20 text-slate-400',
    }
    const labels = {
      scheduled: '已安排',
      ongoing: '进行中',
      ended: '已结束',
    }
    return (
      <span className={`px-2 py-0.5 rounded text-xs ${styles[status]}`}>
        {labels[status]}
      </span>
    )
  }

  return (
    <div className="space-y-3">
      {meetings.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <svg className="w-12 h-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">暂无会议</p>
        </div>
      ) : (
        meetings.map((meeting) => (
          <div
            key={meeting.id}
            className={`quantum-card p-4 hover:border-indigo-500/50 transition-colors cursor-pointer ${
              selectedId === meeting.id ? 'border-indigo-500/50' : ''
            }`}
            onClick={() => meeting.status !== 'ended' && onJoin(meeting)}
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-medium text-slate-100">{meeting.title}</h3>
              {getStatusBadge(meeting.status)}
            </div>
            <div className="text-sm text-slate-400 space-y-1">
              <p>开始时间: {new Date(meeting.start_time).toLocaleString('zh-CN')}</p>
              <p>参与人数: {meeting.participant_count}</p>
            </div>
            {meeting.status !== 'ended' && (
              <button className="mt-3 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors">
                {meeting.status === 'ongoing' ? '加入会议' : '进入会议室'}
              </button>
            )}
          </div>
        ))
      )}
    </div>
  )
}
