'use client'

import Link from 'next/link'
import { useState } from 'react'
import { SiteHeader } from '@/components/SiteHeader'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SiteHeader />

      {/* Main */}
      <main className="flex-1 flex items-start justify-center px-6 pt-8 pb-20">
        <div className="w-full max-w-[440px]">
          {/* Title */}
          <h1 className="text-[clamp(2.5rem,5vw,3.5rem)] font-extrabold leading-none tracking-[-0.03em] text-center text-[#0b1220] mb-12">
            LOG IN
          </h1>

          {/* Social login */}
          <div className="grid grid-cols-2 gap-3">
            <SocialButton icon={<GoogleIcon />} label="Google" />
            <SocialButton icon={<AppleIcon />} label="Apple" />
            <SocialButton icon={<LinkedInIcon />} label="LinkedIn" />
            <SocialButton icon={<FacebookIcon />} label="Facebook" />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 my-10">
            <div className="flex-1 h-px bg-[#cad3e0]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#6e7a8f]">Or log in with e-mail</span>
            <div className="flex-1 h-px bg-[#cad3e0]" />
          </div>

          {/* Form */}
          <form
            onSubmit={e => { e.preventDefault() }}
            className="flex flex-col gap-6"
          >
            {/* Email */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#0b1220] mb-2">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="E-mail address"
                className="w-full border-b-2 border-[#0b1220] pb-3 text-sm text-[#0b1220] placeholder:text-[#cad3e0] focus:outline-none focus:border-[#0000ff] transition-colors bg-transparent"
              />
            </div>

            {/* Password */}
            <div>
              <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#0b1220] mb-2">
                <svg className="w-4 h-4 text-[#6e7a8f]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full border-b-2 border-[#0b1220] pb-3 pr-10 text-sm text-[#0b1220] placeholder:text-[#cad3e0] focus:outline-none focus:border-[#0000ff] transition-colors bg-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 bottom-3 text-[#6e7a8f] hover:text-[#0b1220] transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Forgot password */}
            <Link
              href="/signin/forgot"
              className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#0b1220] hover:text-[#0000ff] transition-colors"
            >
              Did you forget your password?
            </Link>

            {/* Submit */}
            <button
              type="submit"
              className="w-full h-14 bg-[#0000ff] text-white text-[13px] font-bold uppercase tracking-[0.16em] rounded-md hover:bg-[#0000cc] transition-colors mt-2"
            >
              Log in
            </button>
          </form>

          {/* Sign up */}
          <div className="mt-12 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#6e7a8f] mb-4">
              Don&apos;t have an account?
            </p>
            <Link
              href="/onboarding"
              className="block w-full h-14 bg-[#0000ff] text-white text-[13px] font-bold uppercase tracking-[0.16em] rounded-md hover:bg-[#0000cc] transition-colors flex items-center justify-center"
            >
              Create new account
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

// ── Social button ───────────────────────────

function SocialButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      className="flex items-center justify-center gap-3 h-14 border-2 border-[#0b1220] rounded-md text-[12px] font-bold uppercase tracking-[0.08em] text-[#0b1220] hover:bg-[#0b1220] hover:text-white transition-all duration-200 group"
    >
      <span className="w-5 h-5 shrink-0">{icon}</span>
      {label}
    </button>
  )
}

// ── Icons ───────────────────────────────────

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-full h-full">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" className="group-hover:fill-white transition-colors" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" className="group-hover:fill-white transition-colors" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" className="group-hover:fill-white transition-colors" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" className="group-hover:fill-white transition-colors" />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}
