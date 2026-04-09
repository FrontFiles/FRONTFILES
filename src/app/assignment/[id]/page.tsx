'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import { AssignmentProvider } from '@/components/assignment/AssignmentProvider'
import { AssignmentShell } from '@/components/assignment/AssignmentShell'
import { mockAssignmentMap } from '@/lib/assignment/mock-data'

export default function AssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const assignment = mockAssignmentMap[id]

  if (!assignment) {
    notFound()
  }

  return (
    <AssignmentProvider>
      <AssignmentShell assignment={assignment} />
    </AssignmentProvider>
  )
}
