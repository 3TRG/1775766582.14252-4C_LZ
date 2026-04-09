import { useState } from 'react'
import { Modal, Input, Button } from '@/components/common'

interface CreateGroupModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string, description?: string) => void
}

export default function CreateGroupModal({ isOpen, onClose, onCreate }: CreateGroupModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = () => {
    if (!name.trim()) return

    onCreate(name.trim(), description.trim() || undefined)

    // Reset form
    setName('')
    setDescription('')
    onClose()
  }

  const handleClose = () => {
    setName('')
    setDescription('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="创建群组">
      <div className="space-y-4">
        <Input
          label="群组名称"
          placeholder="请输入群组名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            群组描述 (选填)
          </label>
          <textarea
            placeholder="请输入群组描述"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        <div className="flex justify-end space-x-2 pt-2">
          <Button variant="secondary" onClick={handleClose}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            创建
          </Button>
        </div>
      </div>
    </Modal>
  )
}
