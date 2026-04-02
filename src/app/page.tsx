import Link from 'next/link'
import { ShieldCheck, ScanSearch, FileSignature } from 'lucide-react'

export default function Home() {
  return (
    <div className="flex flex-col flex-1 min-h-screen bg-white text-black">

      {/* Header */}
      <header className="flex items-center h-16 px-8 border-b-2 border-black">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 bg-black flex items-center justify-center shrink-0">
            <div className="w-3 h-3 bg-white" />
          </div>
          <span className="text-black font-bold tracking-tight text-[15px] uppercase">Frontfiles</span>
        </div>
        <nav className="ml-auto flex items-center gap-6">
          <a href="#" className="text-sm text-slate-500 hover:text-black transition-colors">About</a>
          <a href="#" className="text-sm text-slate-500 hover:text-black transition-colors">For Editors</a>
          <a href="#" className="text-sm text-slate-500 hover:text-black transition-colors">Sign in</a>
        </nav>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-8 py-28">
        <div className="max-w-3xl mx-auto text-center flex flex-col items-center gap-10">

          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 border border-blue-600">
            <div className="w-1.5 h-1.5 bg-blue-600" />
            <span className="text-xs text-blue-600 font-bold tracking-widest uppercase">Verified creator credentials</span>
          </div>

          {/* Headline */}
          <h1 className="text-6xl sm:text-7xl font-bold tracking-tighter leading-[0.95]">
            The credential vault for<br />
            <span className="text-slate-400">serious journalists.</span>
          </h1>

          {/* Body */}
          <p className="text-lg text-slate-600 leading-relaxed max-w-2xl">
            Frontfiles creates a tamper-evident record of your professional identity — your bylines,
            affiliations, press accreditations, and published work — independently verifiable at the
            point of transaction.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Link
              href="/onboarding"
              className="inline-flex h-12 items-center gap-2.5 px-8 bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors uppercase tracking-wide"
            >
              Begin creator onboarding
              <span>→</span>
            </Link>
            <a
              href="#"
              className="inline-flex h-12 items-center px-6 border-2 border-black text-black hover:bg-black hover:text-white text-sm font-bold transition-colors uppercase tracking-wide"
            >
              How it works
            </a>
          </div>

          {/* Trust band */}
          <div className="flex items-center gap-8 pt-2">
            <TrustItem icon={<ShieldCheck className="w-4 h-4 text-black" />} label="ID-verified" sub="Third-party KYC" />
            <div className="w-px h-10 bg-slate-200" />
            <TrustItem icon={<ScanSearch className="w-4 h-4 text-black" />} label="AI cross-checked" sub="Public source corroboration" />
            <div className="w-px h-10 bg-slate-200" />
            <TrustItem icon={<FileSignature className="w-4 h-4 text-black" />} label="Editorial-grade" sub="Cryptographic provenance" />
          </div>
        </div>
      </main>

      {/* Feature grid */}
      <section className="border-t-2 border-black px-8 py-20">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-0 border-2 border-black">
          <FeatureCard
            icon={<ShieldCheck className="w-6 h-6" />}
            title="Identity anchored"
            description="Every Vault is bound to a government-verified identity through a third-party KYC provider. Frontfiles holds only the verification result — raw biometric data never leaves the provider."
            borderRight
          />
          <FeatureCard
            icon={<ScanSearch className="w-6 h-6" />}
            title="Credibility corroborated"
            description="An AI-assisted credibility check cross-references your professional record against public sources — bylines, accreditations, and editorial history — for confirmation, not profiling."
            borderRight
          />
          <FeatureCard
            icon={<FileSignature className="w-6 h-6" />}
            title="Cryptographically signed"
            description="Files uploaded to your Vault receive a cryptographic signature logged in the Certification Event Log. Provenance is tamper-evident and independently verifiable."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 px-8 py-6 flex items-center justify-between">
        <span className="text-xs text-slate-400">© 2026 Frontfiles. All rights reserved.</span>
        <div className="flex items-center gap-5">
          <a href="#" className="text-xs text-slate-400 hover:text-black transition-colors">Privacy</a>
          <a href="#" className="text-xs text-slate-400 hover:text-black transition-colors">Terms</a>
          <a href="#" className="text-xs text-slate-400 hover:text-black transition-colors">Support</a>
        </div>
      </footer>
    </div>
  )
}

function TrustItem({ icon, label, sub }: { icon: React.ReactNode; label: string; sub: string }) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div className="flex flex-col items-start">
        <span className="text-sm font-bold text-black leading-tight">{label}</span>
        <span className="text-xs text-slate-500 leading-tight">{sub}</span>
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, description, borderRight }: {
  icon: React.ReactNode
  title: string
  description: string
  borderRight?: boolean
}) {
  return (
    <div className={`flex flex-col gap-5 p-7 ${borderRight ? 'sm:border-r-2 sm:border-black' : ''}`}>
      <div className="w-11 h-11 bg-blue-600 flex items-center justify-center">
        <span className="text-white">{icon}</span>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-base font-bold text-black uppercase tracking-wide">{title}</h3>
        <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}
