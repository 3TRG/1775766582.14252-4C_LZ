import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input } from '@/components/common'
import { useAuth } from '@/hooks'

export default function ForgotPassword() {
  const { forgotPassword, isLoading } = useAuth()

  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const result = await forgotPassword(phone)

    if (result.success) {
      setSuccess(true)
    } else {
      setError(result.error || '发送失败')
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="quantum-card p-8 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-100 mb-2">重置链接已发送</h2>
            <p className="text-slate-400 mb-6">
              如果该手机号已注册，您将收到密码重置短信
            </p>
            <Link to="/login">
              <Button className="w-full">返回登录</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-xl mb-4">
            <span className="text-3xl font-bold text-white">Q</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">忘记密码</h1>
          <p className="text-slate-400 mt-2">输入手机号以重置密码</p>
        </div>

        {/* Forgot password form */}
        <div className="quantum-card p-8">
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <Input
                label="手机号"
                type="tel"
                placeholder="请输入注册时使用的手机号"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />

              {/* Error message */}
              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}

              {/* Submit button */}
              <Button
                type="submit"
                className="w-full"
                isLoading={isLoading}
                disabled={!phone}
              >
                发送重置链接
              </Button>
            </div>
          </form>

          {/* Link to login */}
          <div className="mt-6 text-center text-sm">
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300">
              返回登录
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
