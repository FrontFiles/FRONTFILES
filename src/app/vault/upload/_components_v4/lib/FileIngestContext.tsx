/**
 * Frontfiles Upload V4 — File Ingest Context (D2.7 internal plumbing)
 *
 * Tiny context for sharing the file picker handler across components
 * without prop-drilling. UploadShellV4 owns the hidden <input type="file">
 * ref and provides openFilePicker() through this context. LeftRailHeader's
 * "+ Add files" button and EmptyState's "click to browse" link both call
 * the same function.
 *
 * Throws if used outside the provider — fail-loud signaling.
 */

'use client'

import { createContext, useContext, type ReactNode } from 'react'

interface FileIngestContextValue {
  openFilePicker: () => void
}

const FileIngestContext = createContext<FileIngestContextValue | null>(null)

export function FileIngestProvider({
  value,
  children,
}: {
  value: FileIngestContextValue
  children: ReactNode
}) {
  return <FileIngestContext.Provider value={value}>{children}</FileIngestContext.Provider>
}

export function useFileIngest(): FileIngestContextValue {
  const ctx = useContext(FileIngestContext)
  if (!ctx) {
    throw new Error('useFileIngest must be used within a FileIngestProvider')
  }
  return ctx
}
