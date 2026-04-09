interface TypingIndicatorProps {
  usernames: string[]
}

export default function TypingIndicator({ usernames }: TypingIndicatorProps) {
  if (usernames.length === 0) return null

  const text =
    usernames.length === 1
      ? `${usernames[0]} 正在输入`
      : usernames.length === 2
        ? `${usernames[0]} 和 ${usernames[1]} 正在输入`
        : `${usernames.length} 人正在输入`

  return (
    <div className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-slate-400">
      <span>{text}</span>
      <div className="flex items-center gap-0.5">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  )
}
