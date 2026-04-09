'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Network, BrainCircuit, UserCheck } from 'lucide-react'
import { CROSS_CHECK_TASKS } from '@/lib/onboarding/constants'
import { runCreatorCrossCheck } from '@/lib/onboarding/mock-services'
import type { IdentityAnchor, CrossCheckSignal } from '@/lib/onboarding/types'
import type { OnboardingAction } from '@/lib/onboarding/reducer'

interface Step2Props {
  identityAnchor: IdentityAnchor
  crossCheckComplete: boolean
  crossCheckSignals: CrossCheckSignal[]
  dispatch: React.Dispatch<OnboardingAction>
  onComplete: () => void
}

type TaskStatus = 'pending' | 'running' | 'complete'

interface TaskState {
  id: string
  status: TaskStatus
}

const TASK_DURATION_MS = 700

export function Step2CrossCheck({ identityAnchor, crossCheckComplete, crossCheckSignals, dispatch, onComplete }: Step2Props) {
  const [running, setRunning] = useState(crossCheckComplete)
  const [started, setStarted] = useState(crossCheckComplete)
  const [taskStates, setTaskStates] = useState<TaskState[]>(
    CROSS_CHECK_TASKS.map(t => ({
      id: t.id,
      status: crossCheckComplete ? 'complete' : 'pending',
    }))
  )
  const [allDone, setAllDone] = useState(crossCheckComplete)

  async function handleStart() {
    setStarted(true)
    setRunning(true)

    const crossCheckPromise = runCreatorCrossCheck(identityAnchor)

    for (let i = 0; i < CROSS_CHECK_TASKS.length; i++) {
      const taskId = CROSS_CHECK_TASKS[i].id

      setTaskStates(prev =>
        prev.map(t => (t.id === taskId ? { ...t, status: 'running' } : t))
      )

      await new Promise(resolve => setTimeout(resolve, TASK_DURATION_MS))

      if (i === CROSS_CHECK_TASKS.length - 1) {
        const signals = await crossCheckPromise
        dispatch({ type: 'SET_CROSS_CHECK_SIGNALS', payload: signals })
      }

      setTaskStates(prev =>
        prev.map(t => (t.id === taskId ? { ...t, status: 'complete' } : t))
      )
    }

    dispatch({ type: 'SET_CROSS_CHECK_COMPLETE', payload: true })
    setAllDone(true)
    setRunning(false)
  }

  useEffect(() => {
    if (crossCheckComplete) {
      setTaskStates(CROSS_CHECK_TASKS.map(t => ({ id: t.id, status: 'complete' })))
      setAllDone(true)
      setStarted(true)
    }
  }, [crossCheckComplete])

  const flagCount = crossCheckSignals.filter(s => s.flagReason !== null).length

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      {/* Step header */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold tracking-widest uppercase border-2 border-black text-black">
            Step 02
          </span>
        </div>
        <h1 className="text-4xl font-bold text-black tracking-tight mb-3">
          Credibility Cross-Check
        </h1>
        <p className="text-slate-600 text-base leading-relaxed max-w-xl">
          Frontfiles performs an AI-assisted cross-check of your professional presence to corroborate your credentials. This is not surveillance, it is structured verification using publicly available data.
        </p>
      </div>

      {/* Explanation */}
      <div className="border-2 border-black">
        <div className="px-6 py-4 border-b-2 border-black bg-black">
          <span className="text-sm font-bold text-white uppercase tracking-wide">How this works</span>
        </div>
        <div className="flex flex-col divide-y divide-slate-200">
          <InfoRow
            icon={<Network className="w-3.5 h-3.5 text-black" />}
            title="Parallel source queries"
            body="Our system queries professional networks, byline databases, press accreditation registries, and open web sources simultaneously."
          />
          <InfoRow
            icon={<BrainCircuit className="w-3.5 h-3.5 text-black" />}
            title="AI-assisted reconciliation"
            body="Discovered signals are cross-referenced against your verified identity anchor. Conflicts are flagged; nothing is imposed on your profile."
          />
          <InfoRow
            icon={<UserCheck className="w-3.5 h-3.5 text-black" />}
            title="You review everything"
            body="You will see every proposed data point and can correct, edit, or remove anything before your profile is confirmed."
          />
        </div>
      </div>

      {/* Task list */}
      <div className="flex flex-col gap-0 border-2 border-black">
        {CROSS_CHECK_TASKS.map((task, index) => {
          const taskState = taskStates.find(t => t.id === task.id)
          const status = taskState?.status ?? 'pending'
          const isLast = index === CROSS_CHECK_TASKS.length - 1

          return (
            <div
              key={task.id}
              className={cn(
                'flex items-center gap-4 px-4 py-3 transition-all duration-300',
                !isLast && 'border-b border-slate-200',
                status === 'complete' && 'bg-slate-50',
                status === 'running' && 'bg-blue-50',
                status === 'pending' && 'bg-white'
              )}
            >
              {/* Status icon */}
              <div className="shrink-0">
                {status === 'complete' && (
                  <div className="w-5 h-5 bg-black flex items-center justify-center">
                    <svg viewBox="0 0 14 14" fill="none" className="w-3 h-3 text-white">
                      <path d="M2 7L5.5 10.5L12 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
                {status === 'running' && (
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent animate-spin" />
                )}
                {status === 'pending' && (
                  <div className="w-5 h-5 border border-slate-300 flex items-center justify-center">
                    <span className="text-[10px] text-slate-400 font-mono">{index + 1}</span>
                  </div>
                )}
              </div>

              {/* Task info */}
              <div className="flex-1">
                <div
                  className={cn(
                    'text-sm font-medium transition-colors duration-200',
                    status === 'complete' && 'text-black',
                    status === 'running' && 'text-blue-600 font-bold',
                    status === 'pending' && 'text-slate-400'
                  )}
                >
                  {task.label}
                </div>
                <div className="text-xs text-slate-400">{task.description}</div>
              </div>

              {/* Status label */}
              <div
                className={cn(
                  'text-[10px] font-bold shrink-0 uppercase tracking-widest',
                  status === 'complete' && 'text-black',
                  status === 'running' && 'text-blue-600',
                  status === 'pending' && 'text-slate-300'
                )}
              >
                {status === 'complete' && 'Done'}
                {status === 'running' && 'Scanning'}
                {status === 'pending' && 'Queued'}
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary after completion */}
      {allDone && (
        <div className="border border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 bg-blue-600" />
            <span className="text-sm text-black font-bold">Cross-check complete</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            {crossCheckSignals.length} data signals discovered across {CROSS_CHECK_TASKS.length} source categories.
            {flagCount > 0
              ? ` ${flagCount} signal${flagCount > 1 ? 's require' : ' requires'} your attention.`
              : ' All signals reconciled cleanly.'}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4">
        {!started && (
          <Button
            onClick={handleStart}
            className="h-11 px-8 bg-blue-600 text-white hover:bg-blue-700 font-bold text-sm rounded-none uppercase tracking-wide"
          >
            Begin credibility check
          </Button>
        )}
        {started && !allDone && (
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-black border-t-transparent animate-spin" />
            <span className="text-slate-500 text-sm">Running cross-check…</span>
          </div>
        )}
        {allDone && (
          <Button
            onClick={onComplete}
            className="h-11 px-8 bg-blue-600 text-white hover:bg-blue-700 font-bold text-sm rounded-none uppercase tracking-wide"
          >
            Review results
          </Button>
        )}
      </div>
    </div>
  )
}

function InfoRow({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3 px-6 py-4">
      <span className="w-7 h-7 border border-slate-300 flex items-center justify-center shrink-0">
        {icon}
      </span>
      <div>
        <div className="text-sm font-bold text-black mb-0.5">{title}</div>
        <div className="text-xs text-slate-500 leading-relaxed mt-0.5">{body}</div>
      </div>
    </div>
  )
}
