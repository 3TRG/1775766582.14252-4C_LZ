import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button, Input } from '@/components/common'
import { useAuth } from '@/hooks'

export default function Login() {
  const location = useLocation()
  const { login, isLoading } = useAuth()

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [agreed, setAgreed] = useState(false)

  const message = location.state?.message

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!agreed) {
      setError('请同意用户协议和隐私政策')
      return
    }

    const result = await login({ account: phone, password })
    if (!result.success) {
      setError(result.error || '登录失败')
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-xl mb-4">
            <span className="text-3xl font-bold text-white">Q</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Quantum Chat</h1>
          <p className="text-slate-400 mt-2">量子安全即时通讯</p>
        </div>

        {/* Success message */}
        {message && (
          <div className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
            {message}
          </div>
        )}

        {/* Login form */}
        <div className="quantum-card p-8">
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <Input
                label="手机号"
                type="tel"
                placeholder="请输入手机号"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />

              <Input
                label="密码"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              {/* User agreement */}
              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="agreement"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="agreement" className="ml-2 text-sm text-slate-400">
                  我已阅读并同意{' '}
                  <a href="#" className="text-indigo-400 hover:text-indigo-300">
                    用户协议
                  </a>{' '}
                  和{' '}
                  <a href="#" className="text-indigo-400 hover:text-indigo-300">
                    隐私政策
                  </a>
                </label>
              </div>

              {/* Error message */}
              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}

              {/* Submit button */}
              <Button
                type="submit"
                className="w-full"
                isLoading={isLoading}
                disabled={!phone || !password}
              >
                登录
              </Button>
            </div>
          </form>

          {/* Links */}
          <div className="mt-6 flex items-center justify-between text-sm">
            <Link to="/forgot-password" className="text-indigo-400 hover:text-indigo-300">
              忘记密码?
            </Link>
            <Link to="/register" className="text-indigo-400 hover:text-indigo-300">
              没有账号? 立即注册
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
