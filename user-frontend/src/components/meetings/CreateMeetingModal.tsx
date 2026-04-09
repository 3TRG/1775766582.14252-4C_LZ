import { useState } from 'react'
import { Modal, Input, Button } from '@/components/common'

interface CreateMeetingModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (title: string, startTime: string, description?: string, maxParticipants?: number) => void
}

export default function CreateMeetingModal({ isOpen, onClose, onCreate }: CreateMeetingModalProps) {
  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState('')
  const [description, setDescription] = useState('')
  const [maxParticipants, setMaxParticipants] = useState('100')

  const handleSubmit = () => {
    if (!title.trim() || !startTime) return

    onCreate(
      title.trim(),
      startTime,
      description.trim() || undefined,
      maxParticipants ? parseInt(maxParticipants, 10) : undefined
    )

    // Reset form
    setTitle('')
    setStartTime('')
    setDescription('')
    setMaxParticipants('100')
    onClose()
  }

  const handleClose = () => {
    setTitle('')
    setStartTime('')
    setDescription('')
    setMaxParticipants('100')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="创建会议">
      <div className="space-y-4">
        <Input
          label="会议主题"
          placeholder="请输入会议主题"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <Input
          label="开始时间"
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          required
        />

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            会议描述 (选填)
          </label>
          <textarea
            placeholder="请输入会议描述"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        <Input
          label="最大参与人数"
          type="number"
          placeholder="100"
          value={maxParticipants}
          onChange={(e) => setMaxParticipants(e.target.value)}
          min={2}
          max={500}
        />

        <div className="flex justify-end space-x-2 pt-2">
          <Button variant="secondary" onClick={handleClose}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || !startTime}>
            创建
          </Button>
        </div>
      </div>
    </Modal>
  )
}
