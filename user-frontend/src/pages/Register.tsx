import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input } from '@/components/common'
import { useAuth } from '@/hooks'

export default function Register() {
  const { register, isLoading } = useAuth()

  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [agreed, setAgreed] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    if (password.length < 6) {
      setError('密码长度至少6位')
      return
    }

    if (!agreed) {
      setError('请同意用户协议和隐私政策')
      return
    }

    const result = await register({
      username,
      account: phone,
      password,
      email: email || undefined,
    })

    if (!result.success) {
      setError(result.error || '注册失败')
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-xl mb-4">
            <span className="text-3xl font-bold text-white">Q</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">注册账号</h1>
          <p className="text-slate-400 mt-2">创建您的量子安全通讯账号</p>
        </div>

        {/* Register form */}
        <div className="quantum-card p-8">
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <Input
                label="用户名"
                type="text"
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />

              <Input
                label="手机号"
                type="tel"
                placeholder="请输入手机号"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />

              <Input
                label="邮箱 (选填)"
                type="email"
                placeholder="请输入邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <Input
                label="密码"
                type="password"
                placeholder="请输入密码 (至少6位)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <Input
                label="确认密码"
                type="password"
                placeholder="请再次输入密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
                disabled={!username || !phone || !password || !confirmPassword}
              >
                注册
              </Button>
            </div>
          </form>

          {/* Link to login */}
          <div className="mt-6 text-center text-sm">
            <span className="text-slate-400">已有账号? </span>
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300">
              立即登录
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
