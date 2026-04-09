import { useState, useEffect } from 'react'
import { Button } from '@/components/common'

interface NotificationSettingsProps {
  settings: {
    messageNotification: boolean
    soundEnabled: boolean
    desktopNotification: boolean
  }
  onUpdate: (settings: {
    messageNotification?: boolean
    soundEnabled?: boolean
    desktopNotification?: boolean
  }) => Promise<void>
}

export default function NotificationSettings({ settings, onUpdate }: NotificationSettingsProps) {
  const [messageNotification, setMessageNotification] = useState(settings.messageNotification)
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled)
  const [desktopNotification, setDesktopNotification] = useState(settings.desktopNotification)

  useEffect(() => {
    setMessageNotification(settings.messageNotification)
    setSoundEnabled(settings.soundEnabled)
    setDesktopNotification(settings.desktopNotification)
  }, [settings])

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        setDesktopNotification(true)
        onUpdate({ desktopNotification: true })
      }
    }
  }

  const handleToggle = async (key: 'messageNotification' | 'soundEnabled', value: boolean) => {
    if (key === 'messageNotification') {
      setMessageNotification(value)
    } else {
      setSoundEnabled(value)
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
      {/* Message Notification */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-100">消息通知</p>
          <p className="text-sm text-slate-400">接收新消息通知</p>
        </div>
        <Toggle
          enabled={messageNotification}
          onChange={() => handleToggle('messageNotification', !messageNotification)}
        />
      </div>

      {/* Sound */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-100">消息提示音</p>
          <p className="text-sm text-slate-400">收到消息时播放提示音</p>
        </div>
        <Toggle
          enabled={soundEnabled}
          onChange={() => handleToggle('soundEnabled', !soundEnabled)}
        />
      </div>

      {/* Desktop Notification */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-100">桌面通知</p>
          <p className="text-sm text-slate-400">在桌面显示通知弹窗</p>
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
  )
}
