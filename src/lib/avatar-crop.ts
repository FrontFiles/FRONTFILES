// ═══════════════════════════════════════════════════════════════
// FRONTFILES — Avatar crop positions
// Per-creator object-position values keyed by slug.
// Ensures faces and key visual elements are centred in square crops.
// Default fallback: '50% 20%' (upper-center, works for most portraits)
// ═══════════════════════════════════════════════════════════════

export const AVATAR_CROP: Record<string, string> = {
  // Yellow jacket, waterfall bg — face in top quarter
  marcooliveira: '50% 15%',
  // Seated, camera raised to chest — face in upper third
  anasousa: '50% 20%',
  // Full-body in alley — face at very top
  dimitriskatsaros: '50% 8%',
  // Live reporter with mic, St. Peter's bg — face upper-center
  luciaferrante: '50% 25%',
  // Reading NYT, face partially behind newspaper — show face/glasses
  yaraboukhari: '50% 30%',
  // Camera raised at table, square-ish frame — face upper portion
  tomasznowak: '50% 18%',
  // Close portrait, press badge, autumn outdoor — face upper
  elenavasile: '50% 22%',
  // Smiling portrait, red hair — face upper portion
  carmenruiz: '50% 18%',
  // Outdoor with camera bag, looking down — face upper area
  nikospapadopoulos: '50% 18%',
  // Ring light portrait, face framed in ring
  sarahchen: '50% 22%',
  // Dark portrait, wide hat — face with hat, upper area
  kofimensah: '50% 18%',
  // Paris setting, looking at camera, face right of center
  priyasharma: '55% 20%',
  // Orange bg, big telephoto on shoulder — face upper, slightly right
  fatimaalrashid: '52% 12%',
  // Square headshot, grey hair, glasses — face fills frame
  larseriksson: '50% 30%',
  // Square headshot, dark hair — face fills frame
  aikotanaka: '50% 28%',
  // Autumn forest, backpack and tripod — face upper center
  carlosmendoza: '50% 15%',
  // Camera raised to eye, face upper right behind lens
  aminadiallo: '62% 15%',
  // Square headshot, stubble, grey bg — face fills frame
  jamesobrien: '50% 28%',
  // Dark bg seated portrait, vest — face upper portion
  oluwaseunadeyemi: '50% 12%',
  // Outdoors, teal hijab, smiling — full figure, face upper
  mariamtoure: '50% 18%',
  // Street market scene, taqiyah — face upper center
  abdirahimhassan: '50% 20%',
  // B&W portrait, flat cap, camera at shoulder — face centered
  yasminAlharazi: '50% 18%',
  // Light bg, long hair, camera on shoulder — face upper
  tigisthaile: '50% 15%',
  // Camera raised covering face — show composition + press badge
  khalidibrahim: '50% 20%',
}

/** Returns the object-position for a creator slug, with fallback. */
export function getAvatarCrop(slug: string): string {
  return AVATAR_CROP[slug] ?? '50% 20%'
}
