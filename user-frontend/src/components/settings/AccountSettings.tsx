import { useState } from 'react'
import { Button, Input, Avatar } from '@/components/common'
import type { User } from '@/types'

interface AccountSettingsProps {
  user: User
  onUpdate: (data: { username?: string; email?: string; avatar?: string }) => Promise<void>
  onLogout: () => void
}

export default function AccountSettings({ user, onUpdate, onLogout }: AccountSettingsProps) {
  const [username, setUsername] = useState(user.username)
  const [email, setEmail] = useState(user.email || '')
  const [isLoading, setIsLoading] = useState(false)

  const handleSave = async () => {
    try {
      setIsLoading(true)
      await onUpdate({
        username: username !== user.username ? username : undefined,
        email: email !== user.email ? email : undefined,
      })
    } catch (error) {
      console.error('Failed to update account:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Avatar Section */}
      <div className="flex items-center">
        <Avatar name={user.username} src={user.avatar} size="xl" />
        <div className="ml-6">
          <h3 className="text-lg font-medium text-slate-100">{user.username}</h3>
          <p className="text-sm text-slate-400">{user.account}</p>
          <button className="mt-2 text-sm text-indigo-400 hover:text-indigo-300">
            更换头像
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-md space-y-4">
        <Input
          label="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <Input
          label="手机号"
          value={user.phone || ''}
          disabled
        />

        <Input
          label="邮箱"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Input
          label="角色"
          value={user.role === 'leader' ? '领导者' : '跟随者'}
          disabled
        />

        <div className="pt-4">
          <Button onClick={handleSave} isLoading={isLoading}>
            保存更改
          </Button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="pt-6 border-t border-slate-700">
        <h4 className="font-medium text-red-400 mb-4">危险操作</h4>
        <Button variant="danger" onClick={onLogout}>
          退出登录
        </Button>
      </div>
    </div>
  )
}
