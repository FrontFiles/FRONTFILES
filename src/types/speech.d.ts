// ═══════════════════════════════════════════════════════════════
// Web Speech API — ambient types
//
// TypeScript's built-in DOM lib does NOT ship these types (the
// Web Speech API is still Chromium-vendor-specific). This file
// fills that gap so `SpeechRecognition`, `SpeechRecognitionEvent`,
// and `window.(webkit)SpeechRecognition` typecheck across the
// project.
//
// Scope is deliberately minimal — only the surface Frontfiles
// actually uses (AssistantInput voice query). Extend here if/when
// other voice features arrive.
//
// Canonical reference:
//   https://wicg.github.io/speech-api/
// ═══════════════════════════════════════════════════════════════

interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

interface SpeechRecognitionResult {
  readonly [index: number]: SpeechRecognitionAlternative
  readonly length: number
  readonly isFinal: boolean
}

interface SpeechRecognitionResultList {
  readonly [index: number]: SpeechRecognitionResult
  readonly length: number
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null
  onend: ((this: SpeechRecognition, ev: Event) => void) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition
}

declare const SpeechRecognition: SpeechRecognitionConstructor | undefined

interface Window {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}
