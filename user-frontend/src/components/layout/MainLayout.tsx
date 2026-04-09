import { Component, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useRealtime } from '@/hooks'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class LayoutErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex items-center justify-center bg-slate-900 text-slate-300 p-8">
          <div className="text-center max-w-md">
            <h2 className="text-xl font-semibold mb-2">页面渲染出错</h2>
            <p className="text-sm text-slate-400 mb-4">{this.state.error?.message}</p>
            <button
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              重试
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function MainLayout() {
  // Initialize real-time updates
  useRealtime()

  return (
    <div className="h-screen bg-slate-900 flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-hidden">
          <LayoutErrorBoundary>
            <Outlet />
          </LayoutErrorBoundary>
        </main>
      </div>
    </div>
  )
}
