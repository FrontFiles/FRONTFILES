import { UploadShellV2 } from '@/components/upload-v2/UploadShellV2'
import { CreatorGate } from '@/components/platform/CreatorGate'

export default function UploadPage() {
  return (
    <CreatorGate tool="Upload">
      <div className="flex-1 bg-white flex flex-col">
        <UploadShellV2 />
      </div>
    </CreatorGate>
  )
}
