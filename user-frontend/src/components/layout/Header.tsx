import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks'

const pageTitles: Record<string, string> = {
  '/chat': '聊天',
  '/contacts': '通讯录',
  '/groups': '群组',
  '/meetings': '会议',
  '/favorites': '收藏',
  '/files': '文件',
  '/settings': '设置',
}

export default function Header() {
  const location = useLocation()
  const { user, logout } = useAuth()

  const title = pageTitles[location.pathname] || 'Quantum Chat'

  return (
    <header className="h-16 bg-slate-800/50 border-b border-slate-700/50 flex items-center justify-between px-6">
      <h1 className="text-xl font-semibold text-slate-100">{title}</h1>

      <div className="flex items-center space-x-4">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="搜索..."
            className="w-64 px-4 py-2 pl-10 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* User Menu */}
        <div className="flex items-center space-x-3">
          <span className="text-slate-300">{user?.username}</span>
          <button
            onClick={logout}
            className="text-slate-400 hover:text-slate-200 transition-colors"
            title="退出登录"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}
