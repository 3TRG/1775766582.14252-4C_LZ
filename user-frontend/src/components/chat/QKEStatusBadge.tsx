import type { QKEStatus } from '@/types'

interface QKEStatusBadgeProps {
  status?: QKEStatus
  size?: 'sm' | 'md'
  showLabel?: boolean
}

const STATUS_CONFIG: Record<QKEStatus, { icon: string; label: string; className: string }> = {
  active: {
    icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    label: '加密保护中',
    className: 'text-green-400 animate-pulseGlow',
  },
  negotiating: {
    icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
    label: '密钥协商中',
    className: 'text-cyan-400 animate-spin',
  },
  rotating: {
    icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
    label: '密钥轮换中',
    className: 'text-yellow-400',
  },
  failed: {
    icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    label: '加密异常',
    className: 'text-red-400',
  },
  idle: {
    icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
    label: '未加密',
    className: 'text-slate-500',
  },
}

export default function QKEStatusBadge({ status = 'idle', size = 'sm', showLabel = false }: QKEStatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5'

  return (
    <span
      className={`inline-flex items-center gap-1 ${config.className}`}
      title={config.label}
    >
      <svg
        className={iconSize}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={config.icon} />
      </svg>
      {showLabel && (
        <span className="text-xs font-medium">{config.label}</span>
      )}
    </span>
  )
}
