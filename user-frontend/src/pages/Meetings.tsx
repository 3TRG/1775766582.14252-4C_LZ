import { useEffect, useState } from 'react'
import { useMeetingsStore } from '@/store'
import { meetingsApi } from '@/api/meetings'
import { Button, Modal, Input } from '@/components/common'
import type { Meeting } from '@/types'

export default function Meetings() {
  const { meetings, setMeetings, addMeeting } = useMeetingsStore()
  const [isLoading, setIsLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [meetingTitle, setMeetingTitle] = useState('')
  const [meetingTime, setMeetingTime] = useState('')

  useEffect(() => {
    loadMeetings()
  }, [])

  const loadMeetings = async () => {
    try {
      setIsLoading(true)
      const data = await meetingsApi.getMeetings()
      setMeetings(data)
    } catch (error) {
      console.error('Failed to load meetings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateMeeting = async () => {
    if (!meetingTitle.trim() || !meetingTime) return

    try {
      const meeting = await meetingsApi.createMeeting({
        title: meetingTitle,
        start_time: meetingTime,
      })
      addMeeting(meeting)
      setShowCreateModal(false)
      setMeetingTitle('')
      setMeetingTime('')
    } catch (error) {
      console.error('Failed to create meeting:', error)
    }
  }

  const handleJoinMeeting = async (meetingId: string) => {
    try {
      const result = await meetingsApi.joinMeeting(meetingId)
      // Open meeting URL in new window or redirect
      window.open(result.meeting_url, '_blank')
    } catch (error) {
      console.error('Failed to join meeting:', error)
    }
  }

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
    <div className="h-full p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-100">会议</h2>
        <Button onClick={() => setShowCreateModal(true)}>创建会议</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      ) : meetings.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <svg className="w-16 h-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p>暂无会议</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {meetings.map((meeting) => (
            <div
              key={meeting.id}
              className="quantum-card p-4 hover:border-indigo-500/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-medium text-slate-100">{meeting.title}</h3>
                {getStatusBadge(meeting.status)}
              </div>
              <div className="text-sm text-slate-400 space-y-1 mb-4">
                <p>开始时间: {new Date(meeting.start_time).toLocaleString('zh-CN')}</p>
                <p>参与人数: {meeting.participant_count}</p>
              </div>
              {meeting.status !== 'ended' && (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => handleJoinMeeting(meeting.id)}
                >
                  {meeting.status === 'ongoing' ? '加入会议' : '进入会议室'}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create meeting modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="创建会议"
      >
        <div className="space-y-4">
          <Input
            label="会议主题"
            placeholder="请输入会议主题"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
          />
          <Input
            label="开始时间"
            type="datetime-local"
            value={meetingTime}
            onChange={(e) => setMeetingTime(e.target.value)}
          />
          <div className="flex justify-end space-x-2">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              取消
            </Button>
            <Button onClick={handleCreateMeeting} disabled={!meetingTitle.trim() || !meetingTime}>
              创建
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
