'use client'

import { useReducer, type ReactNode } from 'react'
import { AssignmentContext, assignmentReducer, initialAssignmentEngineState } from '@/lib/assignment/context'

export function AssignmentProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(assignmentReducer, initialAssignmentEngineState)
  return (
    <AssignmentContext value={{ state, dispatch }}>
      {children}
    </AssignmentContext>
  )
}
