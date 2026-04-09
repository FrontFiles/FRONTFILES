// ═══════════════════════════════════════════════════════════════
// FRONTFILES — Geography Reference
// Canonical location vocabulary for discovery clustering
// ═══════════════════════════════════════════════════════════════

export interface Geography {
  id: string
  country: string
  region: string
  city: string | null
  locationLabel: string
  lat: number
  lng: number
}

export const geographies: Geography[] = [
  // ── Brazil ──
  { id: 'geo-br-poa', country: 'Brazil', region: 'Rio Grande do Sul', city: 'Porto Alegre', locationLabel: 'Porto Alegre, Rio Grande do Sul', lat: -30.03, lng: -51.23 },
  { id: 'geo-br-canoas', country: 'Brazil', region: 'Rio Grande do Sul', city: 'Canoas', locationLabel: 'Canoas, Rio Grande do Sul', lat: -29.92, lng: -51.17 },
  { id: 'geo-br-eldorado', country: 'Brazil', region: 'Rio Grande do Sul', city: 'Eldorado do Sul', locationLabel: 'Eldorado do Sul, Rio Grande do Sul', lat: -30.09, lng: -51.37 },
  { id: 'geo-br-gravatai', country: 'Brazil', region: 'Rio Grande do Sul', city: 'Gravataí', locationLabel: 'Gravataí, Rio Grande do Sul', lat: -29.94, lng: -50.99 },

  // ── Portugal ──
  { id: 'geo-pt-lisbon', country: 'Portugal', region: 'Lisboa', city: 'Lisbon', locationLabel: 'Lisbon, Portugal', lat: 38.72, lng: -9.14 },
  { id: 'geo-pt-setubal', country: 'Portugal', region: 'Setúbal', city: 'Setúbal', locationLabel: 'Setúbal, Portugal', lat: 38.52, lng: -8.89 },
  { id: 'geo-pt-sines', country: 'Portugal', region: 'Setúbal', city: 'Sines', locationLabel: 'Sines, Setúbal', lat: 37.96, lng: -8.87 },

  // ── Greece ──
  { id: 'geo-gr-evros', country: 'Greece', region: 'Evros', city: null, locationLabel: 'Evros region, Greece', lat: 41.15, lng: 26.41 },
  { id: 'geo-gr-orestiada', country: 'Greece', region: 'Evros', city: 'Orestiada', locationLabel: 'Orestiada, Evros', lat: 41.50, lng: 26.53 },
  { id: 'geo-gr-alexandroupoli', country: 'Greece', region: 'Evros', city: 'Alexandroupoli', locationLabel: 'Alexandroupoli, Evros', lat: 40.85, lng: 25.87 },

  // ── Italy ──
  { id: 'geo-it-palermo', country: 'Italy', region: 'Sicily', city: 'Palermo', locationLabel: 'Palermo, Sicily', lat: 38.12, lng: 13.36 },
  { id: 'geo-it-catania', country: 'Italy', region: 'Sicily', city: 'Catania', locationLabel: 'Catania, Sicily', lat: 37.50, lng: 15.09 },

  // ── France ──
  { id: 'geo-fr-marseille', country: 'France', region: 'Bouches-du-Rhône', city: 'Marseille', locationLabel: 'Marseille, France', lat: 43.30, lng: 5.37 },
  { id: 'geo-fr-fos', country: 'France', region: 'Bouches-du-Rhône', city: 'Fos-sur-Mer', locationLabel: 'Fos-sur-Mer, France', lat: 43.44, lng: 4.95 },

  // ── Spain ──
  { id: 'geo-es-huelva', country: 'Spain', region: 'Andalusia', city: 'Huelva', locationLabel: 'Huelva, Andalusia', lat: 37.26, lng: -6.95 },
  { id: 'geo-es-almeria', country: 'Spain', region: 'Andalusia', city: 'Almería', locationLabel: 'Almería, Andalusia', lat: 36.83, lng: -2.46 },

  // ── Poland ──
  { id: 'geo-pl-warsaw', country: 'Poland', region: 'Masovia', city: 'Warsaw', locationLabel: 'Warsaw, Poland', lat: 52.23, lng: 21.01 },
  { id: 'geo-pl-lodz', country: 'Poland', region: 'Łódź', city: 'Łódź', locationLabel: 'Łódź, Poland', lat: 51.77, lng: 19.46 },

  // ── Romania ──
  { id: 'geo-ro-bucharest', country: 'Romania', region: 'Bucharest', city: 'Bucharest', locationLabel: 'Bucharest, Romania', lat: 44.43, lng: 26.10 },
  { id: 'geo-ro-craiova', country: 'Romania', region: 'Dolj', city: 'Craiova', locationLabel: 'Craiova, Romania', lat: 44.32, lng: 23.80 },
]

export const geographyMap = Object.fromEntries(geographies.map(g => [g.id, g]))
