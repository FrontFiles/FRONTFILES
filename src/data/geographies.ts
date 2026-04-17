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

  // ── Italy (extended) ──
  { id: 'geo-it-sicily', country: 'Italy', region: 'Sicily', city: null, locationLabel: 'Sicily, Italy', lat: 37.60, lng: 14.02 },

  // ── Hong Kong ──
  { id: 'geo-hk', country: 'China', region: 'Hong Kong', city: 'Hong Kong', locationLabel: 'Hong Kong', lat: 22.32, lng: 114.17 },

  // ── Mexico ──
  { id: 'geo-mx', country: 'Mexico', region: 'Mexico', city: null, locationLabel: 'Mexico', lat: 23.63, lng: -102.55 },
  { id: 'geo-mx-chiapas', country: 'Mexico', region: 'Chiapas', city: null, locationLabel: 'Chiapas, Mexico', lat: 16.75, lng: -93.10 },

  // ── United States ──
  { id: 'geo-us', country: 'United States', region: 'United States', city: null, locationLabel: 'United States', lat: 39.50, lng: -98.35 },
  { id: 'geo-us-dc', country: 'United States', region: 'District of Columbia', city: 'Washington D.C.', locationLabel: 'Washington D.C.', lat: 38.89, lng: -77.03 },

  // ── France (extended) ──
  { id: 'geo-fr', country: 'France', region: 'France', city: null, locationLabel: 'France', lat: 46.23, lng: 2.21 },
  { id: 'geo-fr-paris', country: 'France', region: 'Île-de-France', city: 'Paris', locationLabel: 'Paris, France', lat: 48.85, lng: 2.35 },

  // ── Brazil (extended) ──
  { id: 'geo-br', country: 'Brazil', region: 'Brazil', city: null, locationLabel: 'Brazil', lat: -14.24, lng: -51.93 },
  { id: 'geo-br-sp', country: 'Brazil', region: 'São Paulo', city: 'São Paulo', locationLabel: 'São Paulo, Brazil', lat: -23.55, lng: -46.63 },
  { id: 'geo-br-rj', country: 'Brazil', region: 'Rio de Janeiro', city: 'Rio de Janeiro', locationLabel: 'Rio de Janeiro, Brazil', lat: -22.91, lng: -43.17 },
  { id: 'geo-br-ba', country: 'Brazil', region: 'Bahia', city: 'Salvador', locationLabel: 'Bahia, Brazil', lat: -12.97, lng: -38.50 },
  { id: 'geo-br-am', country: 'Brazil', region: 'Amazonas', city: 'Manaus', locationLabel: 'Amazonas, Brazil', lat: -3.47, lng: -65.10 },
  { id: 'geo-br-bsb', country: 'Brazil', region: 'Distrito Federal', city: 'Brasília', locationLabel: 'Brasília, Brazil', lat: -15.78, lng: -47.93 },
  { id: 'geo-br-ms', country: 'Brazil', region: 'Mato Grosso do Sul', city: null, locationLabel: 'Mato Grosso do Sul, Brazil', lat: -20.51, lng: -54.54 },
  { id: 'geo-br-mg', country: 'Brazil', region: 'Minas Gerais', city: 'Belo Horizonte', locationLabel: 'Minas Gerais, Brazil', lat: -18.51, lng: -44.56 },
  { id: 'geo-br-pa', country: 'Brazil', region: 'Pará', city: 'Belém', locationLabel: 'Pará, Brazil', lat: -3.79, lng: -52.48 },

  // ── Argentina ──
  { id: 'geo-ar-chaco', country: 'Argentina', region: 'Chaco', city: null, locationLabel: 'Chaco, Argentina', lat: -26.85, lng: -60.01 },
  { id: 'geo-ar-bsas', country: 'Argentina', region: 'Buenos Aires', city: 'Buenos Aires', locationLabel: 'Buenos Aires, Argentina', lat: -34.60, lng: -58.38 },

  // ── Chile ──
  { id: 'geo-cl', country: 'Chile', region: 'Chile', city: null, locationLabel: 'Chile', lat: -35.68, lng: -71.54 },
  { id: 'geo-cl-stg', country: 'Chile', region: 'Santiago', city: 'Santiago', locationLabel: 'Santiago, Chile', lat: -33.45, lng: -70.67 },

  // ── Colombia ──
  { id: 'geo-co', country: 'Colombia', region: 'Colombia', city: null, locationLabel: 'Colombia', lat: 4.57, lng: -74.30 },

  // ── Bolivia ──
  { id: 'geo-bo', country: 'Bolivia', region: 'Bolivia', city: null, locationLabel: 'Bolivia', lat: -16.29, lng: -63.59 },

  // ── Philippines ──
  { id: 'geo-ph', country: 'Philippines', region: 'Philippines', city: null, locationLabel: 'Philippines', lat: 12.88, lng: 121.77 },
  { id: 'geo-ph-manila', country: 'Philippines', region: 'Metro Manila', city: 'Manila', locationLabel: 'Manila, Philippines', lat: 14.60, lng: 120.98 },

  // ── Qatar ──
  { id: 'geo-qa', country: 'Qatar', region: 'Qatar', city: 'Doha', locationLabel: 'Qatar', lat: 25.35, lng: 51.18 },

  // ── Ukraine ──
  { id: 'geo-ua', country: 'Ukraine', region: 'Ukraine', city: null, locationLabel: 'Ukraine', lat: 48.38, lng: 31.17 },

  // ── Turkey ──
  { id: 'geo-tr', country: 'Turkey', region: 'Turkey', city: null, locationLabel: 'Turkey', lat: 38.96, lng: 35.24 },
  { id: 'geo-tr-ist', country: 'Turkey', region: 'Istanbul', city: 'Istanbul', locationLabel: 'Istanbul, Turkey', lat: 41.01, lng: 28.97 },

  // ── Russia ──
  { id: 'geo-ru', country: 'Russia', region: 'Russia', city: null, locationLabel: 'Russia', lat: 61.52, lng: 105.32 },

  // ── Palestine ──
  { id: 'geo-ps', country: 'Palestine', region: 'Palestine', city: null, locationLabel: 'Palestine', lat: 31.95, lng: 35.30 },

  // ── United Kingdom ──
  { id: 'geo-uk', country: 'United Kingdom', region: 'United Kingdom', city: null, locationLabel: 'United Kingdom', lat: 55.38, lng: -3.44 },

  // ── Spain (extended) ──
  { id: 'geo-es', country: 'Spain', region: 'Spain', city: null, locationLabel: 'Spain', lat: 40.46, lng: -3.74 },
  { id: 'geo-es-basque', country: 'Spain', region: 'Basque Country', city: null, locationLabel: 'Basque Country, Spain', lat: 43.00, lng: -2.01 },

  // ── Portugal (extended) ──
  { id: 'geo-pt', country: 'Portugal', region: 'Portugal', city: null, locationLabel: 'Portugal', lat: 39.40, lng: -8.22 },

  // ── Greece (extended) ──
  { id: 'geo-gr', country: 'Greece', region: 'Greece', city: null, locationLabel: 'Greece', lat: 39.07, lng: 21.82 },

  // ── Iraq ──
  { id: 'geo-iq', country: 'Iraq', region: 'Iraq', city: null, locationLabel: 'Iraq', lat: 33.22, lng: 43.68 },

  // ── Egypt ──
  { id: 'geo-eg', country: 'Egypt', region: 'Egypt', city: null, locationLabel: 'Egypt', lat: 26.82, lng: 30.80 },

  // ── Cuba ──
  { id: 'geo-cu', country: 'Cuba', region: 'Cuba', city: null, locationLabel: 'Cuba', lat: 21.52, lng: -77.78 },

  // ── Vietnam ──
  { id: 'geo-vn', country: 'Vietnam', region: 'Vietnam', city: null, locationLabel: 'Vietnam', lat: 14.06, lng: 108.28 },

  // ── Kenya ──
  { id: 'geo-ke', country: 'Kenya', region: 'Kenya', city: 'Nairobi', locationLabel: 'Kenya', lat: -0.02, lng: 37.91 },

  // ── India ──
  { id: 'geo-in', country: 'India', region: 'India', city: null, locationLabel: 'India', lat: 20.59, lng: 78.96 },

  // ── Bangladesh ──
  { id: 'geo-bd', country: 'Bangladesh', region: 'Bangladesh', city: 'Dhaka', locationLabel: 'Bangladesh', lat: 23.68, lng: 90.36 },

  // ── Japan ──
  { id: 'geo-jp', country: 'Japan', region: 'Japan', city: 'Tokyo', locationLabel: 'Japan', lat: 36.20, lng: 138.25 },

  // ── Taiwan ──
  { id: 'geo-tw', country: 'Taiwan', region: 'Taiwan', city: 'Taipei', locationLabel: 'Taiwan', lat: 23.70, lng: 120.96 },

  // ── Tuvalu ──
  { id: 'geo-tv', country: 'Tuvalu', region: 'Tuvalu', city: 'Funafuti', locationLabel: 'Tuvalu', lat: -7.11, lng: 177.65 },

  // ── Africa (general) ──
  { id: 'geo-africa', country: 'Africa', region: 'Africa', city: null, locationLabel: 'Africa', lat: 1.65, lng: 10.27 },

  // ── Border / crossing (generic) ──
  { id: 'geo-border', country: 'International', region: 'Border', city: null, locationLabel: 'Border Region', lat: 40.00, lng: 26.00 },

  // ── Nigeria ──
  { id: 'geo-ng', country: 'Nigeria', region: 'Nigeria', city: null, locationLabel: 'Nigeria', lat: 9.08, lng: 8.68 },
  { id: 'geo-ng-lagos', country: 'Nigeria', region: 'Lagos', city: 'Lagos', locationLabel: 'Lagos, Nigeria', lat: 6.52, lng: 3.38 },
  { id: 'geo-ng-maiduguri', country: 'Nigeria', region: 'Borno', city: 'Maiduguri', locationLabel: 'Maiduguri, Borno', lat: 11.83, lng: 13.15 },
  { id: 'geo-ng-abuja', country: 'Nigeria', region: 'FCT', city: 'Abuja', locationLabel: 'Abuja, Nigeria', lat: 9.07, lng: 7.40 },

  // ── Mali ──
  { id: 'geo-ml', country: 'Mali', region: 'Mali', city: null, locationLabel: 'Mali', lat: 17.57, lng: -3.99 },
  { id: 'geo-ml-bamako', country: 'Mali', region: 'Bamako', city: 'Bamako', locationLabel: 'Bamako, Mali', lat: 12.65, lng: -8.00 },

  // ── Burkina Faso ──
  { id: 'geo-bf', country: 'Burkina Faso', region: 'Burkina Faso', city: null, locationLabel: 'Burkina Faso', lat: 12.36, lng: -1.53 },
  { id: 'geo-bf-ouaga', country: 'Burkina Faso', region: 'Centre', city: 'Ouagadougou', locationLabel: 'Ouagadougou, Burkina Faso', lat: 12.36, lng: -1.53 },

  // ── Niger ──
  { id: 'geo-ne', country: 'Niger', region: 'Niger', city: null, locationLabel: 'Niger', lat: 17.61, lng: 8.08 },
  { id: 'geo-ne-niamey', country: 'Niger', region: 'Niamey', city: 'Niamey', locationLabel: 'Niamey, Niger', lat: 13.51, lng: 2.12 },

  // ── Somalia ──
  { id: 'geo-so', country: 'Somalia', region: 'Somalia', city: null, locationLabel: 'Somalia', lat: 5.15, lng: 46.20 },
  { id: 'geo-so-mogadishu', country: 'Somalia', region: 'Banadir', city: 'Mogadishu', locationLabel: 'Mogadishu, Somalia', lat: 2.05, lng: 45.34 },

  // ── Ethiopia ──
  { id: 'geo-et', country: 'Ethiopia', region: 'Ethiopia', city: null, locationLabel: 'Ethiopia', lat: 9.15, lng: 40.49 },
  { id: 'geo-et-addis', country: 'Ethiopia', region: 'Addis Ababa', city: 'Addis Ababa', locationLabel: 'Addis Ababa, Ethiopia', lat: 9.03, lng: 38.74 },
  { id: 'geo-et-tigray', country: 'Ethiopia', region: 'Tigray', city: 'Mekelle', locationLabel: 'Tigray, Ethiopia', lat: 13.50, lng: 39.47 },

  // ── Sudan ──
  { id: 'geo-sd', country: 'Sudan', region: 'Sudan', city: null, locationLabel: 'Sudan', lat: 12.86, lng: 30.22 },
  { id: 'geo-sd-khartoum', country: 'Sudan', region: 'Khartoum', city: 'Khartoum', locationLabel: 'Khartoum, Sudan', lat: 15.55, lng: 32.53 },
  { id: 'geo-sd-portsudanr', country: 'Sudan', region: 'Red Sea', city: 'Port Sudan', locationLabel: 'Port Sudan, Sudan', lat: 19.62, lng: 37.22 },

  // ── South Sudan ──
  { id: 'geo-ss', country: 'South Sudan', region: 'South Sudan', city: null, locationLabel: 'South Sudan', lat: 6.88, lng: 31.31 },
  { id: 'geo-ss-juba', country: 'South Sudan', region: 'Central Equatoria', city: 'Juba', locationLabel: 'Juba, South Sudan', lat: 4.86, lng: 31.60 },

  // ── DR Congo ──
  { id: 'geo-cd', country: 'DR Congo', region: 'DR Congo', city: null, locationLabel: 'DR Congo', lat: -4.04, lng: 21.76 },
  { id: 'geo-cd-kinshasa', country: 'DR Congo', region: 'Kinshasa', city: 'Kinshasa', locationLabel: 'Kinshasa, DR Congo', lat: -4.32, lng: 15.32 },
  { id: 'geo-cd-goma', country: 'DR Congo', region: 'North Kivu', city: 'Goma', locationLabel: 'Goma, North Kivu', lat: -1.67, lng: 29.23 },

  // ── Libya ──
  { id: 'geo-ly', country: 'Libya', region: 'Libya', city: null, locationLabel: 'Libya', lat: 26.34, lng: 17.23 },
  { id: 'geo-ly-tripoli', country: 'Libya', region: 'Tripolitania', city: 'Tripoli', locationLabel: 'Tripoli, Libya', lat: 32.90, lng: 13.18 },

  // ── Yemen ──
  { id: 'geo-ye', country: 'Yemen', region: 'Yemen', city: null, locationLabel: 'Yemen', lat: 15.55, lng: 48.52 },
  { id: 'geo-ye-sanaa', country: 'Yemen', region: "Sana'a", city: "Sana'a", locationLabel: "Sana'a, Yemen", lat: 15.35, lng: 44.21 },
  { id: 'geo-ye-aden', country: 'Yemen', region: 'Aden', city: 'Aden', locationLabel: 'Aden, Yemen', lat: 12.79, lng: 45.04 },

  // ── Syria ──
  { id: 'geo-sy', country: 'Syria', region: 'Syria', city: null, locationLabel: 'Syria', lat: 34.80, lng: 38.99 },
  { id: 'geo-sy-damascus', country: 'Syria', region: 'Damascus', city: 'Damascus', locationLabel: 'Damascus, Syria', lat: 33.51, lng: 36.29 },
  { id: 'geo-sy-idlib', country: 'Syria', region: 'Idlib', city: null, locationLabel: 'Idlib, Syria', lat: 35.93, lng: 36.63 },

  // ── Lebanon ──
  { id: 'geo-lb', country: 'Lebanon', region: 'Lebanon', city: null, locationLabel: 'Lebanon', lat: 33.89, lng: 35.50 },
  { id: 'geo-lb-beirut', country: 'Lebanon', region: 'Beirut', city: 'Beirut', locationLabel: 'Beirut, Lebanon', lat: 33.89, lng: 35.50 },

  // ── Afghanistan ──
  { id: 'geo-af-country', country: 'Afghanistan', region: 'Afghanistan', city: null, locationLabel: 'Afghanistan', lat: 33.94, lng: 67.71 },
  { id: 'geo-af-kabul', country: 'Afghanistan', region: 'Kabul', city: 'Kabul', locationLabel: 'Kabul, Afghanistan', lat: 34.53, lng: 69.17 },

  // ── Jordan ──
  { id: 'geo-jo', country: 'Jordan', region: 'Jordan', city: null, locationLabel: 'Jordan', lat: 30.59, lng: 36.24 },
  { id: 'geo-jo-amman', country: 'Jordan', region: 'Amman', city: 'Amman', locationLabel: 'Amman, Jordan', lat: 31.95, lng: 35.93 },

  // ── Cameroon ──
  { id: 'geo-cm', country: 'Cameroon', region: 'Cameroon', city: null, locationLabel: 'Cameroon', lat: 3.85, lng: 11.50 },

  // ── Zimbabwe ──
  { id: 'geo-zw', country: 'Zimbabwe', region: 'Zimbabwe', city: null, locationLabel: 'Zimbabwe', lat: -19.02, lng: 29.15 },

  // ── Ghana ──
  { id: 'geo-gh', country: 'Ghana', region: 'Ghana', city: null, locationLabel: 'Ghana', lat: 7.95, lng: -1.02 },
  { id: 'geo-gh-accra', country: 'Ghana', region: 'Greater Accra', city: 'Accra', locationLabel: 'Accra, Ghana', lat: 5.60, lng: -0.19 },

  // ── Sahel (general) ──
  { id: 'geo-sahel', country: 'International', region: 'Sahel', city: null, locationLabel: 'Sahel Region', lat: 14.00, lng: 0.00 },

  // ── Horn of Africa (general) ──
  { id: 'geo-horn', country: 'International', region: 'Horn of Africa', city: null, locationLabel: 'Horn of Africa', lat: 7.00, lng: 42.00 },
]

export const geographyMap = Object.fromEntries(geographies.map(g => [g.id, g]))
