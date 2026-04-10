'use client'

import { cn } from '@/lib/utils'
import { useAssignment } from '@/lib/assignment/context'
import { ASSIGNMENT_CLASS_LABELS } from '@/lib/types'

export function RightsPanel() {
  const { state } = useAssignment()
  const a = state.assignment
  if (!a) return null

  const { rightsRecord } = a

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-black/25">Assignment rights record</span>
        <span className={cn(
          'text-[8px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 border',
          a.assignmentClass === 'service' ? 'border-[#0000ff] text-[#0000ff]' : 'border-black text-black'
        )}>
          {ASSIGNMENT_CLASS_LABELS[a.assignmentClass]}
        </span>
      </div>

      {/* Asset rights */}
      {rightsRecord.assetRights && (
        <section className="mb-6">
          <div className="border-2 border-black">
            <div className="bg-black text-white px-4 py-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em]">Asset rights</span>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <RightsField label="Usage rights" value={rightsRecord.assetRights.usageRights} />
              {rightsRecord.assetRights.exclusivityTerms && <RightsField label="Exclusivity" value={rightsRecord.assetRights.exclusivityTerms} />}
              {rightsRecord.assetRights.permittedModifications && <RightsField label="Permitted modifications" value={rightsRecord.assetRights.permittedModifications} />}
              {rightsRecord.assetRights.duration && <RightsField label="Duration" value={rightsRecord.assetRights.duration} />}
              {rightsRecord.assetRights.territory && <RightsField label="Territory" value={rightsRecord.assetRights.territory} />}
              {rightsRecord.assetRights.publicationScope && <RightsField label="Publication scope" value={rightsRecord.assetRights.publicationScope} />}
            </div>
          </div>
        </section>
      )}

      {/* Service terms */}
      {rightsRecord.serviceTerms && (
        <section className="mb-6">
          <div className="border-2 border-[#0000ff]">
            <div className="bg-[#0000ff] text-white px-4 py-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em]">Service terms</span>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <RightsField label="Scope of work" value={rightsRecord.serviceTerms.scopeOfWork} />
              {rightsRecord.serviceTerms.confidentiality && <RightsField label="Confidentiality" value={rightsRecord.serviceTerms.confidentiality} />}
              {rightsRecord.serviceTerms.attendanceObligations && <RightsField label="Attendance obligations" value={rightsRecord.serviceTerms.attendanceObligations} />}
              {rightsRecord.serviceTerms.operationalRestrictions && <RightsField label="Operational restrictions" value={rightsRecord.serviceTerms.operationalRestrictions} />}
              {rightsRecord.serviceTerms.reimbursementTerms && <RightsField label="Reimbursement" value={rightsRecord.serviceTerms.reimbursementTerms} />}
              {rightsRecord.serviceTerms.liabilityFraming && <RightsField label="Liability" value={rightsRecord.serviceTerms.liabilityFraming} />}
            </div>
          </div>
        </section>
      )}

      {/* Empty state for class mismatch */}
      {!rightsRecord.assetRights && !rightsRecord.serviceTerms && (
        <div className="border-2 border-dashed border-black/15 py-12 text-center">
          <p className="text-[10px] text-black/25 uppercase tracking-widest">No rights record defined</p>
        </div>
      )}
    </div>
  )
}

function RightsField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-black/25 block mb-0.5">{label}</span>
      <p className="text-[10px] text-black leading-relaxed">{value}</p>
    </div>
  )
}
