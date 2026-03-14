import { useState } from 'react'

export default function SignInPage({ onGoToRegister, onSignIn }) {
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm]                 = useState({ email: '', password: '' })
  const [errors, setErrors]             = useState({})

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = {}
    if (!form.email.includes('@')) errs.email    = 'Enter a valid email.'
    if (!form.password)            errs.password = 'Password is required.'
    if (Object.keys(errs).length) { setErrors(errs); return }

    // Check against localStorage
    try {
      const saved = JSON.parse(localStorage.getItem('user') || 'null')
      if (saved && saved.email === form.email && saved.password === form.password) {
        onSignIn({ name: saved.name, email: saved.email })
      } else {
        setErrors({ general: 'Incorrect email or password.' })
      }
    } catch {
      setErrors({ general: 'Something went wrong. Please try again.' })
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-4 bg-[#f5f7f8] font-sans">

      {/* Background blobs */}
      <div className="fixed top-0 left-0 -z-10 h-full w-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[100px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-[480px] space-y-6 bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-slate-200">

        {/* Header */}
        <div className="flex flex-col items-center text-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-app-accent rounded-xl flex items-center justify-center text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Smart Notes</h2>
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Welcome back</h2>
            <p className="text-slate-500">Sign in to your Smart Notes account</p>
          </div>
        </div>

        {/* Google SSO */}
        <button
          type="button"
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200
                     bg-white px-4 py-3 text-slate-700 font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-slate-400 font-medium tracking-wider">Or continue with email</span>
          </div>
        </div>

        {/* General error */}
        {errors.general && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {errors.general}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-900">Email Address</label>
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="name@company.com"
              className={`w-full rounded-xl border bg-white px-4 py-3.5 text-sm text-slate-900
                placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all
                ${errors.email ? 'border-red-400' : 'border-slate-200 focus:border-app-accent'}`}
            />
            {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-900">Password</label>
              <button type="button" className="text-sm font-semibold text-app-accent hover:text-app-accent-h transition-colors cursor-pointer">
                Forgot Password?
              </button>
            </div>
            <div className={`relative flex items-center rounded-xl border bg-white transition-all
              focus-within:ring-2 focus-within:ring-blue-500/20
              ${errors.password ? 'border-red-400' : 'border-slate-200 focus-within:border-app-accent'}`}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={set('password')}
                placeholder="••••••••"
                className="flex-1 bg-transparent px-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none rounded-xl"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 p-1 text-slate-400 hover:text-app-accent transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showPassword
                    ? <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></>
                    : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                  }
                </svg>
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full rounded-xl bg-app-accent px-4 py-4 text-white font-bold text-base
                       hover:bg-app-accent-h shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98] cursor-pointer"
          >
            Sign In
          </button>
        </form>

        {/* Register link */}
        <div className="text-center pt-1">
          <p className="text-slate-500 text-sm">
            Don't have an account?{' '}
            <button onClick={onGoToRegister} className="font-bold text-app-accent hover:underline underline-offset-4 cursor-pointer">
              Create an account
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
