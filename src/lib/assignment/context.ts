'use client'

import { createContext, useContext, useReducer, type Dispatch } from 'react'
import { assignmentReducer, initialAssignmentEngineState } from './reducer'
import type { AssignmentEngineState, AssignmentAction } from './types'

interface AssignmentContextValue {
  state: AssignmentEngineState
  dispatch: Dispatch<AssignmentAction>
}

export const AssignmentContext = createContext<AssignmentContextValue | null>(null)

export function useAssignment() {
  const ctx = useContext(AssignmentContext)
  if (!ctx) throw new Error('useAssignment must be used within AssignmentProvider')
  return ctx
}

export { assignmentReducer, initialAssignmentEngineState }
