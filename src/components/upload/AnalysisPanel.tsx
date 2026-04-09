'use client'

import { cn } from '@/lib/utils'
import { DECLARATION_STATE_LABELS } from '@/lib/upload/types'
import type { UploadJob } from '@/lib/upload/types'

interface AnalysisPanelProps {
  job: UploadJob
}

export function AnalysisPanel({ job }: AnalysisPanelProps) {
  const { analysisResult: result } = job

  if (job.state === 'analysing') {
    return (
      <div className="border-2 border-black">
        <div className="px-6 py-3 bg-black">
          <span className="text-sm font-bold text-white uppercase tracking-wide">Content analysis</span>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-blue-600/30 border-t-blue-600 animate-spin" />
            <span className="text-sm text-black font-bold">Analysis in progress</span>
          </div>
          <div className="flex flex-col gap-2">
            <AnalysisStep label="Content reading" status="running" />
            <AnalysisStep label="Metadata extraction" status="pending" />
            <AnalysisStep label="C2PA manifest detection" status="pending" />
            <AnalysisStep label="Corroboration" status="pending" />
            <AnalysisStep label="Validation Declaration" status="pending" />
          </div>
        </div>
      </div>
    )
  }

  if (!result) return null

  return (
    <div className={cn(
      'border-2',
      result.manifestInvalid ? 'border-dashed border-black' : 'border-black'
    )}>
      <div className="px-6 py-3 bg-black">
        <span className="text-sm font-bold text-white uppercase tracking-wide">Content analysis</span>
      </div>
      <div className="px-6 py-5 flex flex-col gap-4">
        {/* Analysis steps */}
        <div className="flex flex-col gap-2">
          <AnalysisStep label="Content reading" status={result.contentReadingComplete ? 'complete' : 'failed'} />
          <AnalysisStep label="Metadata extraction" status={result.metadataExtractionComplete ? 'complete' : 'failed'} />
          <AnalysisStep
            label="C2PA manifest"
            status={result.c2paDetected ? (result.c2paValid ? 'complete' : 'failed') : 'absent'}
            detail={
              result.c2paDetected
                ? `v${result.c2paVersion} — ${result.c2paValid ? 'Valid' : 'Invalid'}`
                : 'No manifest detected'
            }
          />
          <AnalysisStep label="Layer 1 (Ingest Verification)" status={result.layerOneComplete ? 'complete' : 'pending'} />
          <AnalysisStep label="Layer 2 (Corroboration)" status={result.layerTwoComplete ? 'complete' : 'pending'} />
        </div>

        {/* Conflict zone alert */}
        {result.conflictZoneAlert && (
          <div className="border-2 border-dashed border-black px-4 py-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-black block mb-1">
              Conflict zone alert
            </span>
            <p className="text-xs text-slate-600">
              Location data indicates a conflict zone. This information is recorded for provenance purposes.
            </p>
          </div>
        )}

        {/* Manifest Invalid quarantine */}
        {result.manifestInvalid && (
          <div className="border-2 border-dashed border-black px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest bg-black text-white px-2 py-0.5">
                Manifest Invalid
              </span>
            </div>
            <p className="text-xs text-slate-600 mb-2">
              The C2PA manifest on this file is corrupt or unverifiable. The asset has been quarantined for staff review.
            </p>
            <p className="text-xs text-slate-400">
              Review SLA: 48 hours continuous. You will be notified of the outcome.
            </p>
          </div>
        )}

        {/* Declaration state */}
        {result.declarationState && !result.manifestInvalid && (
          <div className={cn(
            'border-2 px-4 py-3',
            result.declarationState === 'fully_validated' ? 'border-blue-600' : 'border-black'
          )}>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">
              Validation Declaration
            </span>
            <span className="text-sm font-bold text-black">
              {DECLARATION_STATE_LABELS[result.declarationState]}
            </span>
            {result.declarationState === 'provenance_pending' && (
              <p className="text-xs text-slate-500 mt-1">
                All FCS layers complete. C2PA manifest absent or below policy threshold. Asset is transactable with buyer acknowledgement.
              </p>
            )}
            {result.declarationState === 'fully_validated' && (
              <p className="text-xs text-slate-500 mt-1">
                All FCS layers complete. Valid C2PA v2.2+ manifest present and verified.
              </p>
            )}
          </div>
        )}

        {/* Extracted metadata summary */}
        {result.extractedMetadata && (
          <div className="border border-slate-200 px-4 py-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">
              Extracted metadata
            </span>
            <div className="grid grid-cols-2 gap-2">
              {result.extractedMetadata.cameraModel && (
                <MetaItem label="Camera" value={result.extractedMetadata.cameraModel} />
              )}
              {result.extractedMetadata.timestamp && (
                <MetaItem label="Timestamp" value={new Date(result.extractedMetadata.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
              )}
              {result.extractedMetadata.detectedLocation && (
                <MetaItem label="Location" value={result.extractedMetadata.detectedLocation} />
              )}
              {result.extractedMetadata.gpsCoordinates && (
                <MetaItem label="GPS" value={`${result.extractedMetadata.gpsCoordinates.lat.toFixed(4)}, ${result.extractedMetadata.gpsCoordinates.lng.toFixed(4)}`} />
              )}
            </div>
            {result.extractedMetadata.detectedObjects.length > 0 && (
              <div className="mt-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">
                  Detected objects
                </span>
                <div className="flex flex-wrap gap-1">
                  {result.extractedMetadata.detectedObjects.map((obj, i) => (
                    <span key={i} className="text-xs bg-slate-100 border border-slate-300 text-black px-2 py-0.5">
                      {obj}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AnalysisStep({ label, status, detail }: { label: string; status: 'complete' | 'running' | 'pending' | 'failed' | 'absent'; detail?: string }) {
  return (
    <div className="flex items-center gap-3">
      {status === 'complete' && (
        <div className="w-4 h-4 bg-black flex items-center justify-center shrink-0">
          <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5 text-white">
            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
      {status === 'running' && (
        <div className="w-4 h-4 border-2 border-blue-600/30 border-t-blue-600 animate-spin shrink-0" />
      )}
      {status === 'pending' && (
        <div className="w-4 h-4 border border-slate-300 shrink-0" />
      )}
      {status === 'failed' && (
        <div className="w-4 h-4 border-2 border-dashed border-black flex items-center justify-center shrink-0">
          <span className="text-[8px] text-black font-bold">!</span>
        </div>
      )}
      {status === 'absent' && (
        <div className="w-4 h-4 border border-dashed border-slate-400 shrink-0" />
      )}
      <div className="flex items-baseline gap-2">
        <span className={cn('text-xs font-bold', status === 'pending' ? 'text-slate-400' : 'text-black')}>{label}</span>
        {detail && <span className="text-[10px] text-slate-400">{detail}</span>}
      </div>
    </div>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
      <span className="text-xs text-black font-medium font-mono">{value}</span>
    </div>
  )
}
