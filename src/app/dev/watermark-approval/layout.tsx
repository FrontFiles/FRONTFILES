/**
 * Standalone layout for the watermark approval harness.
 * Strips the main app shell (nav, overflow:hidden body)
 * so the harness can scroll freely.
 */
export default function WatermarkApprovalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, overflow: 'auto', background: '#0a0a0a' }}>
      {children}
    </div>
  )
}
