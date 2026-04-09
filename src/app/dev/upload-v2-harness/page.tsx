import { DevHarness } from '@/components/upload-v2/DevHarness'

export default function DevUploadV2HarnessPage() {
  return (
    <div className="h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="border-b-2 border-black bg-white flex-shrink-0">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-red-600 bg-red-50 px-2 py-1 border border-red-200">
              DEV
            </span>
            <span className="text-sm font-bold text-black uppercase tracking-wide">
              Upload v2 Test Harness
            </span>
          </div>
          <a href="/vault/upload" className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-black transition-colors">
            Go to Upload
          </a>
        </div>
      </header>

      {/* Harness */}
      <DevHarness />
    </div>
  )
}
