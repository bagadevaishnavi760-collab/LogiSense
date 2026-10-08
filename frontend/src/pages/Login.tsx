import { useState, type FormEvent } from 'react'
import { AlertCircle, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Truck } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../services/api'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fieldError, setFieldError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setFieldError('')
    if (!identifier.trim() || !password) {
      setFieldError('Enter your email or username and password to continue.')
      return
    }
    setLoading(true)
    try {
      const user = await signIn(identifier.trim(), password)
      const requested = (location.state as { from?: string } | null)?.from
      const destination = requested && requested.startsWith(user.role === 'ADMIN' ? '/' : '/customer')
        ? requested
        : user.role === 'ADMIN' ? '/' : '/customer'
      navigate(destination, { replace: true })
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 401
        ? 'Those credentials were not recognised.'
        : cause instanceof Error ? cause.message : 'Unable to sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-dvh bg-[#071329] text-white">
      <div className="mx-auto grid min-h-dvh max-w-[1440px] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden px-12 py-12 lg:flex lg:flex-col lg:justify-between xl:px-20">
          <div className="absolute -left-32 top-24 size-[520px] rounded-full bg-blue-500/10 blur-3xl" />
          <div className="relative flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#5d8fff] to-[#244c9e] shadow-lg shadow-blue-950/40"><Truck className="size-5" /></span><span><span className="block text-lg font-semibold tracking-tight">LogiSense</span><span className="block text-xs text-blue-200/60">Logistics Intelligence</span></span></div>
          <div className="relative max-w-xl">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-blue-300">One connected workspace</p>
            <h1 className="text-5xl font-semibold leading-[1.08] tracking-[-0.04em] xl:text-6xl">Clarity for every mile of your network.</h1>
            <p className="mt-6 max-w-md text-base leading-7 text-blue-100/65">Securely access operational intelligence, shipment visibility, and delivery predictions from one role-aware experience.</p>
            <div className="mt-10 flex gap-8 text-sm text-blue-100/70"><span><strong className="block text-2xl text-white">50k</strong>fact deliveries</span><span><strong className="block text-2xl text-white">7</strong>connected dimensions</span></div>
          </div>
          <p className="relative text-xs text-blue-100/40">© 2026 LogiSense · Supply chain intelligence platform</p>
        </section>

        <section className="flex items-center justify-center bg-[#f7f9fc] px-5 py-10 text-[#17233d] sm:px-10">
          <div className="w-full max-w-[430px]">
            <div className="mb-9 lg:hidden"><span className="flex size-10 items-center justify-center rounded-xl bg-[#18315f] text-white"><Truck className="size-5" /></span><p className="mt-3 text-lg font-semibold">LogiSense</p><p className="text-xs text-[#7b879b]">Logistics Intelligence</p></div>
            <div className="mb-8"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#4775d4]">Secure workspace</p><h2 className="text-3xl font-semibold tracking-[-0.03em]">Welcome back</h2><p className="mt-2 text-sm text-[#71809a]">Sign in to continue to your LogiSense workspace.</p></div>
            <form onSubmit={submit} className="space-y-5" noValidate>
              <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.1em] text-[#53627b]">Email or username</span><span className="relative block"><Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9aa6b8]" /><input autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} className="h-11 w-full rounded-lg border border-[#dbe3f0] bg-white pl-10 pr-3 text-sm outline-none transition focus:border-[#4775d4] focus:ring-4 focus:ring-[#4775d4]/10" placeholder="you@logisense.local" /></span></label>
              <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.1em] text-[#53627b]">Password</span><span className="relative block"><LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9aa6b8]" /><input autoComplete="current-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 w-full rounded-lg border border-[#dbe3f0] bg-white px-10 text-sm outline-none transition focus:border-[#4775d4] focus:ring-4 focus:ring-[#4775d4]/10" placeholder="Enter your password" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a96a9] hover:text-[#4775d4]">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></span></label>
              {fieldError || error ? <div role="alert" className="flex items-start gap-2 rounded-lg border border-[#f3c6c6] bg-[#fff4f4] px-3 py-2.5 text-xs leading-5 text-[#b43b3b]"><AlertCircle className="mt-0.5 size-4 shrink-0" /><span>{fieldError || error}</span></div> : null}
              <button disabled={loading} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#2456ba] text-sm font-semibold text-white shadow-lg shadow-blue-900/15 transition hover:bg-[#1d489e] disabled:cursor-wait disabled:opacity-60">{loading ? <><span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />Signing in…</> : <>Sign in <ArrowRight className="size-4" /> </>}</button>
            </form>
            <div className="mt-8 flex items-center gap-2 text-xs text-[#7b879b]"><ShieldCheck className="size-4 text-[#4775d4]" />Role-based access protects each workspace.</div>
          </div>
        </section>
      </div>
    </main>
  )
}
