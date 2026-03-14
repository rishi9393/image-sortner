import { useState } from 'react'

export default function RegisterPage({ onGoToSignIn, onRegister }) {
  const [showPassword, setShowPassword] = useState(false)
  const [agreed, setAgreed]             = useState(false)
  const [form, setForm]                 = useState({ name: '', email: '', password: '' })
  const [errors, setErrors]             = useState({})

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const validate = () => {
    const e = {}
    if (!form.name.trim())        e.name     = 'Full name is required.'
    if (!form.email.includes('@')) e.email    = 'Enter a valid email.'
    if (form.password.length < 6)  e.password = 'Password must be at least 6 characters.'
    if (!agreed)                   e.terms    = 'You must agree to the Terms of Service.'
    return e
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    // Save to localStorage
    localStorage.setItem('user', JSON.stringify({ name: form.name, email: form.email, password: form.password }))
    onRegister({ name: form.name, email: form.email })
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 bg-[#f5f7f8] font-sans">

      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #3c83f6 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      </div>

      <div className="relative w-full max-w-[480px] z-10">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="bg-app-accent text-white p-2 rounded-xl">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 48 48">
              <path d="M39.5563 34.1455V13.8546C39.5563 15.708 36.8773 17.3437 32.7927 18.3189C30.2914 18.916 27.263 19.2655 24 19.2655C20.737 19.2655 17.7086 18.916 15.2073 18.3189C11.1227 17.3437 8.44365 15.708 8.44365 13.8546V34.1455C8.44365 35.9988 11.1227 37.6346 15.2073 38.6098C17.7086 39.2069 20.737 39.5564 24 39.5564C27.263 39.5564 30.2914 39.2069 32.7927 38.6098C36.8773 37.6346 39.5563 35.9988 39.5563 34.1455Z" fill="currentColor" />
            </svg>
          </div>
          <h1 className="text-[#111418] text-2xl font-bold tracking-tight">Smart Notes</h1>
        </div>

        {/* Card */}
        <div className="bg-white shadow-xl shadow-blue-500/5 rounded-2xl border border-slate-200/60 p-8 md:p-10">
          <div className="mb-8">
            <h2 className="text-[#111418] text-3xl font-black tracking-tight mb-2">Create your account</h2>
            <p className="text-slate-500 text-base">Start organizing your thoughts with Smart Notes today.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Full Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[#111418] text-sm font-semibold">Full Name</label>
              <input
                type="text"
                value={form.name}
                onChange={set('name')}
                placeholder="Enter your full name"
                className={`w-full rounded-xl border bg-white h-12 px-4 text-sm text-[#111418] placeholder:text-slate-400
                  focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all
                  ${errors.name ? 'border-red-400 focus:border-red-400' : 'border-slate-200 focus:border-app-accent'}`}
              />
              {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name}</p>}
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[#111418] text-sm font-semibold">Email Address</label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="name@example.com"
                className={`w-full rounded-xl border bg-white h-12 px-4 text-sm text-[#111418] placeholder:text-slate-400
                  focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all
                  ${errors.email ? 'border-red-400 focus:border-red-400' : 'border-slate-200 focus:border-app-accent'}`}
              />
              {errors.email && <p className="text-xs text-red-500 mt-0.5">{errors.email}</p>}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[#111418] text-sm font-semibold">Password</label>
              <div className={`relative flex items-center rounded-xl border bg-white
                transition-all focus-within:ring-2 focus-within:ring-blue-500/20
                ${errors.password ? 'border-red-400' : 'border-slate-200 focus-within:border-app-accent'}`}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  placeholder="Create a strong password"
                  className="flex-1 h-12 px-4 bg-transparent rounded-xl text-sm text-[#111418] placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="px-4 text-slate-400 hover:text-app-accent transition-colors cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {showPassword
                      ? <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></>
                      : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                    }
                  </svg>
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500 mt-0.5">{errors.password}</p>}
            </div>

            {/* Password strength indicator */}
            {form.password.length > 0 && (
              <div className="flex gap-1.5 -mt-2">
                {[1, 2, 3, 4].map(level => {
                  const strength = form.password.length >= 10 ? 4 : form.password.length >= 8 ? 3 : form.password.length >= 6 ? 2 : 1
                  return (
                    <div key={level} className={`h-1 flex-1 rounded-full transition-colors ${
                      level <= strength
                        ? strength >= 4 ? 'bg-green-500' : strength >= 3 ? 'bg-blue-500' : strength >= 2 ? 'bg-yellow-400' : 'bg-red-400'
                        : 'bg-slate-200'
                    }`} />
                  )
                })}
              </div>
            )}

            {/* Terms */}
            <div className="flex items-start gap-3 pt-1">
              <input
                type="checkbox"
                id="terms"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-slate-300 text-app-accent focus:ring-app-accent/20 cursor-pointer flex-shrink-0"
              />
              <label htmlFor="terms" className={`text-sm cursor-pointer ${errors.terms ? 'text-red-500' : 'text-slate-500'}`}>
                I agree to the{' '}
                <span className="text-app-accent hover:underline cursor-pointer font-medium">Terms of Service</span>
                {' '}and{' '}
                <span className="text-app-accent hover:underline cursor-pointer font-medium">Privacy Policy</span>
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full bg-app-accent hover:bg-app-accent-h text-white h-12 rounded-xl font-bold text-sm
                         transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <span>Create Account</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </form>

          {/* Sign in link */}
          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-slate-500 text-sm">
              Already have an account?{' '}
              <button onClick={onGoToSignIn} className="text-app-accent font-bold hover:underline cursor-pointer">
                Sign in
              </button>
            </p>
          </div>
        </div>

        {/* Social proof */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <div className="flex -space-x-2.5">
            {[
              { bg: 'bg-blue-500',    initials: 'PR' },
              { bg: 'bg-emerald-500', initials: 'AK' },
              { bg: 'bg-violet-500',  initials: 'MS' },
              { bg: 'bg-orange-400',  initials: 'JL' },
            ].map(({ bg, initials }) => (
              <div key={initials}
                className={`w-10 h-10 rounded-full ${bg} border-2 border-[#f5f7f8] flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                {initials}
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-500 max-w-[260px] text-center italic leading-relaxed">
            "The best tool for capturing fleeting ideas before they vanish."
          </p>
        </div>

        {/* Footer */}
        <footer className="mt-8 flex items-center justify-center gap-6 text-slate-400 text-xs">
          <span className="hover:text-app-accent cursor-pointer transition-colors">Privacy Policy</span>
          <span className="hover:text-app-accent cursor-pointer transition-colors">Help Center</span>
          <span className="hover:text-app-accent cursor-pointer transition-colors">Contact Support</span>
        </footer>
      </div>
    </div>
  )
}
