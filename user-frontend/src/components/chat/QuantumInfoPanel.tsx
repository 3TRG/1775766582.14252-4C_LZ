import type { Conversation } from '@/types'

interface QuantumInfoPanelProps {
  conversation: Conversation
  onClose: () => void
}

export default function QuantumInfoPanel({ conversation, onClose }: QuantumInfoPanelProps) {
  const qkeStatus = conversation.qke_status || 'idle'
  const keyEpoch = conversation.current_key_epoch
  const keyFingerprint = conversation.key_fingerprint

  const statusText: Record<string, string> = {
    active: '安全加密',
    negotiating: '协商中...',
    rotating: '密钥轮换',
    failed: '安全异常',
    idle: '未建立加密',
  }

  const statusColor: Record<string, string> = {
    active: 'text-green-400',
    negotiating: 'text-cyan-400',
    rotating: 'text-yellow-400',
    failed: 'text-red-400',
    idle: 'text-slate-400',
  }

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-slate-900/95 backdrop-blur-sm border-l border-slate-700/50 z-10 flex flex-col animate-slideInRight">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">量子加密信息</h3>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Encryption Status */}
        <div className="quantum-card p-3">
          <p className="text-xs text-slate-400 mb-1">加密状态</p>
          <p className={`text-sm font-medium ${statusColor[qkeStatus]}`}>
            {statusText[qkeStatus]}
          </p>
        </div>

        {/* Key Epoch */}
        {keyEpoch != null && (
          <div className="quantum-card p-3">
            <p className="text-xs text-slate-400 mb-1">密钥纪元</p>
            <p className="text-sm font-mono text-indigo-300">Epoch #{keyEpoch}</p>
          </div>
        )}

        {/* Key Fingerprint */}
        {keyFingerprint && (
          <div className="quantum-card p-3">
            <p className="text-xs text-slate-400 mb-1">密钥指纹</p>
            <p className="text-xs font-mono text-cyan-300 break-all leading-relaxed">
              {keyFingerprint}
            </p>
          </div>
        )}

        {/* Key Derivation Chain */}
        <div className="quantum-card p-3">
          <p className="text-xs text-slate-400 mb-2">密钥派生链</p>
          <div className="space-y-2">
            {[
              { label: 'QKE 共享密钥', color: 'bg-purple-500' },
              { label: 'HKDF 密钥派生', color: 'bg-indigo-500' },
              { label: 'Epoch 密钥', color: 'bg-cyan-500' },
              { label: 'AES-256-GCM', color: 'bg-green-500' },
            ].map((step, index) => (
              <div key={step.label} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${step.color}`} />
                <span className="text-xs text-slate-300">{step.label}</span>
                {index < 3 && (
                  <svg className="w-3 h-3 text-slate-500 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Protocol Info */}
        <div className="quantum-card p-3">
          <p className="text-xs text-slate-400 mb-1">加密算法</p>
          <div className="space-y-1">
            <p className="text-xs text-slate-300">AES-256-GCM 认证加密</p>
            <p className="text-xs text-slate-300">HKDF-SHA256 密钥派生</p>
            <p className="text-xs text-slate-300">PBKDF2 密码哈希 (120k 迭代)</p>
          </div>
        </div>
      </div>
    </div>
  )
}
