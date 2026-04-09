import { useState } from 'react'
import { Modal, Input, Button } from '@/components/common'

interface AddContactModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (account: string, remark?: string, tags?: string[]) => void
}

export default function AddContactModal({ isOpen, onClose, onAdd }: AddContactModalProps) {
  const [account, setAccount] = useState('')
  const [remark, setRemark] = useState('')
  const [tags, setTags] = useState('')

  const handleSubmit = () => {
    if (!account.trim()) return

    onAdd(
      account.trim(),
      remark.trim() || undefined,
      tags.trim() ? tags.split(',').map((t) => t.trim()) : undefined
    )

    // Reset form
    setAccount('')
    setRemark('')
    setTags('')
    onClose()
  }

  const handleClose = () => {
    setAccount('')
    setRemark('')
    setTags('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="添加好友">
      <div className="space-y-4">
        <Input
          label="用户账号"
          placeholder="请输入用户账号"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          required
        />

        <Input
          label="备注名 (选填)"
          placeholder="请输入备注名"
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
        />

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            标签 (选填)
          </label>
          <input
            type="text"
            placeholder="多个标签用逗号分隔，如：同事, 朋友"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex justify-end space-x-2 pt-2">
          <Button variant="secondary" onClick={handleClose}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!account.trim()}>
            添加
          </Button>
        </div>
      </div>
    </Modal>
  )
}
