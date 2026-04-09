import { useState, useEffect } from 'react'

interface PrivacySettingsProps {
  settings: {
    showOnlineStatus: boolean
    showReadReceipt: boolean
    allowStrangerMessages: boolean
  }
  onUpdate: (settings: {
    showOnlineStatus?: boolean
    showReadReceipt?: boolean
    allowStrangerMessages?: boolean
  }) => Promise<void>
}

export default function PrivacySettings({ settings, onUpdate }: PrivacySettingsProps) {
  const [showOnlineStatus, setShowOnlineStatus] = useState(settings.showOnlineStatus)
  const [showReadReceipt, setShowReadReceipt] = useState(settings.showReadReceipt)
  const [allowStrangerMessages, setAllowStrangerMessages] = useState(settings.allowStrangerMessages)

  useEffect(() => {
    setShowOnlineStatus(settings.showOnlineStatus)
    setShowReadReceipt(settings.showReadReceipt)
    setAllowStrangerMessages(settings.allowStrangerMessages)
  }, [settings])

  const handleToggle = (key: keyof typeof settings, value: boolean) => {
    switch (key) {
      case 'showOnlineStatus':
        setShowOnlineStatus(value)
        break
      case 'showReadReceipt':
        setShowReadReceipt(value)
        break
      case 'allowStrangerMessages':
        setAllowStrangerMessages(value)
        break
    }
    onUpdate({ [key]: value })
  }

  const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: () => void }) => (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={enabled}
        onChange={onChange}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-slate-600 peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
    </label>
  )

  return (
    <div className="max-w-md space-y-6">
      {/* Online Status */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-100">显示在线状态</p>
          <p className="text-sm text-slate-400">允许其他人看到您的在线状态</p>
        </div>
        <Toggle
          enabled={showOnlineStatus}
          onChange={() => handleToggle('showOnlineStatus', !showOnlineStatus)}
        />
      </div>

      {/* Read Receipt */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-100">已读回执</p>
          <p className="text-sm text-slate-400">发送已读回执给对方</p>
        </div>
        <Toggle
          enabled={showReadReceipt}
          onChange={() => handleToggle('showReadReceipt', !showReadReceipt)}
        />
      </div>

      {/* Stranger Messages */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-100">陌生人消息</p>
          <p className="text-sm text-slate-400">允许接收非好友发送的消息</p>
        </div>
        <Toggle
          enabled={allowStrangerMessages}
          onChange={() => handleToggle('allowStrangerMessages', !allowStrangerMessages)}
        />
      </div>

      {/* Privacy Info */}
      <div className="mt-8 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <h4 className="text-sm font-medium text-slate-100 mb-2">隐私保护说明</h4>
        <p className="text-sm text-slate-400">
          您的通讯内容使用量子密钥加密，确保消息传输的安全性。
          即使是服务器管理员也无法查看您的消息内容。
        </p>
      </div>
    </div>
  )
}
