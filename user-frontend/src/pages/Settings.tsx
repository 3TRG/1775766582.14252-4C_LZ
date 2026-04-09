import { useState } from 'react'
import { useAuth } from '@/hooks'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api'
import { Button, Input } from '@/components/common'

export default function Settings() {
  const [activeTab, setActiveTab] = useState('account')

  const tabs = [
    { id: 'account', label: '账号设置' },
    { id: 'notification', label: '通知设置' },
    { id: 'privacy', label: '隐私设置' },
  ]

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <div className="w-64 bg-slate-800/30 border-r border-slate-700/50 p-4">
        <h2 className="text-lg font-semibold text-slate-100 mb-4">设置</h2>
        <nav className="space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-indigo-600/20 text-indigo-400'
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {activeTab === 'account' && <AccountSettings />}
        {activeTab === 'notification' && <NotificationSettings />}
        {activeTab === 'privacy' && <PrivacySettings />}
      </div>
    </div>
  )
}

function AccountSettings() {
  const { user, logout } = useAuth()
  const { setUser } = useAuthStore()
  const [username, setUsername] = useState(user?.username || '')
  const [email, setEmail] = useState(user?.email || '')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage('')
    try {
      // Update profile via API (endpoint may not exist yet, so we catch)
      await authApi.updateProfile({ username, email })
      // Refresh user data
      const updatedUser = await authApi.getCurrentUser()
      setUser(updatedUser)
      setSaveMessage('保存成功')
    } catch (_error) {
      // If API not available, update locally
      if (user) {
        setUser({ ...user, username, email })
      }
      setSaveMessage('已本地保存（服务器同步待实现）')
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveMessage(''), 3000)
    }
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-100 mb-6">账号设置</h3>

      <div className="space-y-6 max-w-md">
        <Input
          label="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <Input
          label="手机号"
          value={user?.phone || ''}
          disabled
        />

        <Input
          label="邮箱"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? '保存中...' : '保存更改'}
          </Button>
          {saveMessage && (
            <span className="text-sm text-green-400">{saveMessage}</span>
          )}
        </div>

        <div className="pt-6 border-t border-slate-700">
          <h4 className="font-medium text-slate-100 mb-4">危险操作</h4>
          <Button variant="danger" onClick={logout}>
            退出登录
          </Button>
        </div>
      </div>
    </div>
  )
}

function NotificationSettings() {
  const [messageNotification, setMessageNotification] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [desktopNotification, setDesktopNotification] = useState(false)

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      setDesktopNotification(permission === 'granted')
    }
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-100 mb-6">通知设置</h3>

      <div className="space-y-6 max-w-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-100">消息通知</p>
            <p className="text-sm text-slate-400">接收新消息通知</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={messageNotification}
              onChange={(e) => setMessageNotification(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-600 peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-100">消息提示音</p>
            <p className="text-sm text-slate-400">收到消息时播放提示音</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => setSoundEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-600 peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-100">桌面通知</p>
            <p className="text-sm text-slate-400">在桌面显示通知</p>
          </div>
          <Button
            size="sm"
            variant={desktopNotification ? 'secondary' : 'primary'}
            onClick={requestNotificationPermission}
            disabled={desktopNotification}
          >
            {desktopNotification ? '已开启' : '开启'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function PrivacySettings() {
  const [showOnlineStatus, setShowOnlineStatus] = useState(true)
  const [showReadReceipt, setShowReadReceipt] = useState(true)

  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-100 mb-6">隐私设置</h3>

      <div className="space-y-6 max-w-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-100">显示在线状态</p>
            <p className="text-sm text-slate-400">允许其他人看到您的在线状态</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlineStatus}
              onChange={(e) => setShowOnlineStatus(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-600 peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-100">已读回执</p>
            <p className="text-sm text-slate-400">发送已读回执给对方</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={showReadReceipt}
              onChange={(e) => setShowReadReceipt(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-600 peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>
      </div>
    </div>
  )
}
