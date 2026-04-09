interface QKENegotiationOverlayProps {
  currentStep: number
  totalSteps: number
  stepLabel: string
}

const PROTOCOL_STEPS = [
  { label: '参与者检测', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { label: '协议选择', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { label: '量子态制备', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { label: '量子测量与筛选', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { label: 'QBER 计算', icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z' },
  { label: '密钥协商完成', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
]

export default function QKENegotiationOverlay({
  currentStep,
  totalSteps,
  stepLabel,
}: QKENegotiationOverlayProps) {
  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0

  return (
    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-20 flex items-center justify-center animate-fadeIn">
      <div className="w-96 max-w-[90%] quantum-card p-6 text-center">
        {/* Animated quantum icon */}
        <div className="relative w-20 h-20 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
          <div className="absolute inset-2 rounded-full bg-indigo-500/30 animate-pulseGlow" />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-10 h-10 text-indigo-400 animate-spin" style={{ animationDuration: '3s' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-slate-100 mb-1">量子密钥协商</h3>
        <p className="text-sm text-cyan-400 mb-4">{stepLabel}</p>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-slate-700 rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Steps */}
        <div className="flex justify-between">
          {PROTOCOL_STEPS.map((step, index) => {
            const isCompleted = index < currentStep
            const isCurrent = index === currentStep

            return (
              <div
                key={step.label}
                className="flex flex-col items-center gap-1"
                title={step.label}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isCompleted
                      ? 'bg-green-500/20 text-green-400'
                      : isCurrent
                        ? 'bg-indigo-500/30 text-indigo-400 animate-pulseGlow'
                        : 'bg-slate-700/50 text-slate-500'
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-[10px] font-mono">{index + 1}</span>
                  )}
                </div>
                <span className={`text-[10px] max-w-[48px] text-center leading-tight ${
                  isCompleted ? 'text-green-400/70' : isCurrent ? 'text-indigo-300' : 'text-slate-500'
                }`}>
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
