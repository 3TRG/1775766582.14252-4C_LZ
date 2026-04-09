interface AvatarProps {
  src?: string
  alt?: string
  name?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  status?: 'online' | 'offline'
  className?: string
}

export default function Avatar({ src, alt, name, size = 'md', status, className = '' }: AvatarProps) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  }

  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-slate-500',
  }

  const getInitials = (name?: string) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className={`relative inline-flex ${className}`}>
      {src ? (
        <img
          src={src}
          alt={alt || name}
          className={`${sizes[size]} rounded-full object-cover`}
        />
      ) : (
        <div
          className={`${sizes[size]} rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium`}
        >
          {getInitials(name)}
        </div>
      )}
      {status && (
        <span
          className={`absolute bottom-0 right-0 w-3 h-3 ${statusColors[status]} border-2 border-slate-800 rounded-full`}
        />
      )}
    </div>
  )
}
