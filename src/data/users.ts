/**
 * Frontfiles — Canonical User Seed
 *
 * This is the SINGLE ground truth for identity rows in the mock
 * (non-Supabase) environment. It feeds:
 *   - `src/lib/identity/store.ts` (in-memory store on first read)
 *   - `src/data/profiles.ts` (derives `creatorProfiles`, `buyers`, lookups)
 *   - `src/data/creators.ts` (derives `creators` via a decoration map)
 *   - `src/lib/user-context.tsx` (derives the session user)
 *
 * CANONICAL RULE:
 *   Every DB-backed identity field has exactly one home: this file.
 *   Files downstream DERIVE from `userSeed`. Non-DB display data
 *   (frontfolio summary, featured ids, languages) lives alongside
 *   the derivation in `data/creators.ts`.
 */

import type {
  UserRow,
  UserGrantedTypeRow,
  CreatorProfileRow,
  BuyerAccountRow,
} from '@/lib/db/schema'
import type { UserSeed } from '@/lib/identity/types'
import type { UserType } from '@/lib/types'

// ══════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════

/**
 * The user id used by the demo / prototype session.
 * Consumed by `user-context.tsx` (to resolve the session user)
 * and by `transaction/context.tsx` (as the initial buyer id
 * for the cart reducer).
 */
export const SESSION_DEMO_USER_ID = 'creator-010'

const SEED_CREATED_AT = '2026-01-01T00:00:00Z'
const SEED_UPDATED_AT = '2026-01-01T00:00:00Z'

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

type CreatorSeedArgs = {
  id: string
  username: string
  displayName: string
  avatarUrl: string
  foundingMember: boolean
  professionalTitle: string | null
  locationBase: string
  websiteUrl: string | null
  biography: string
  trustBadge: CreatorProfileRow['trust_badge']
  lastVerifiedAt: string
  coverageAreas?: string[]
  specialisations?: string[]
  mediaAffiliations?: string[]
  pressAccreditations?: string[]
  publishedIn?: string[]
  skills?: string[]
  alsoMeLinks?: string[]
  /** Additional grants beyond 'creator'. */
  extraGrants?: UserType[]
}

function userRow(args: {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  foundingMember: boolean
}): UserRow {
  return {
    id: args.id,
    username: args.username,
    display_name: args.displayName,
    email: `${args.username}@frontfiles.test`,
    avatar_url: args.avatarUrl,
    account_state: 'active',
    founding_member: args.foundingMember,
    created_at: SEED_CREATED_AT,
    updated_at: SEED_UPDATED_AT,
  }
}

function grantRow(userId: string, userType: UserType): UserGrantedTypeRow {
  return {
    id: `grant-${userId}-${userType}`,
    user_id: userId,
    user_type: userType,
    granted_at: SEED_CREATED_AT,
  }
}

function creatorProfileRow(
  userId: string,
  args: Omit<CreatorSeedArgs, 'id' | 'username' | 'displayName' | 'avatarUrl' | 'foundingMember' | 'extraGrants'>,
): CreatorProfileRow {
  return {
    id: `cprof-${userId}`,
    user_id: userId,
    professional_title: args.professionalTitle,
    location_base: args.locationBase,
    website_url: args.websiteUrl,
    biography: args.biography,
    trust_tier: 'standard',
    trust_badge: args.trustBadge,
    verification_status: 'verified',
    last_verified_at: args.lastVerifiedAt,
    coverage_areas: args.coverageAreas ?? [],
    specialisations: args.specialisations ?? [],
    media_affiliations: args.mediaAffiliations ?? [],
    press_accreditations: args.pressAccreditations ?? [],
    published_in: args.publishedIn ?? [],
    skills: args.skills ?? [],
    also_me_links: args.alsoMeLinks ?? [],
    created_at: SEED_CREATED_AT,
    updated_at: SEED_UPDATED_AT,
  }
}

function creator(args: CreatorSeedArgs): UserSeed {
  const user = userRow({
    id: args.id,
    username: args.username,
    displayName: args.displayName,
    avatarUrl: args.avatarUrl,
    foundingMember: args.foundingMember,
  })
  const grants: UserGrantedTypeRow[] = [grantRow(args.id, 'creator')]
  for (const extra of args.extraGrants ?? []) grants.push(grantRow(args.id, extra))
  return {
    user,
    grants,
    creatorProfile: creatorProfileRow(args.id, args),
  }
}

type BuyerSeedArgs = {
  id: string
  username: string
  displayName: string
  email: string
  avatarUrl: string | null
  buyerType: BuyerAccountRow['buyer_type']
  companyName: string | null
  vatNumber: string | null
  taxId: string | null
  /** Additional grants beyond 'buyer'. */
  extraGrants?: UserType[]
}

function buyer(args: BuyerSeedArgs): UserSeed {
  const user: UserRow = {
    id: args.id,
    username: args.username,
    display_name: args.displayName,
    email: args.email,
    avatar_url: args.avatarUrl,
    account_state: 'active',
    founding_member: false,
    created_at: SEED_CREATED_AT,
    updated_at: SEED_UPDATED_AT,
  }
  const grants: UserGrantedTypeRow[] = [grantRow(args.id, 'buyer')]
  for (const extra of args.extraGrants ?? []) grants.push(grantRow(args.id, extra))
  const buyerAccount: BuyerAccountRow = {
    id: `buyer-acc-${args.id}`,
    user_id: args.id,
    buyer_type: args.buyerType,
    company_name: args.companyName,
    vat_number: args.vatNumber,
    tax_id: args.taxId,
    created_at: SEED_CREATED_AT,
  }
  return { user, grants, buyerAccount }
}

// ══════════════════════════════════════════════
// FULL CREATOR PROFILES — founding members (001–010)
// ══════════════════════════════════════════════

const marco = creator({
  id: 'creator-001',
  username: 'marcooliveira',
  displayName: 'Marco Oliveira',
  avatarUrl: '/assets/avatars/pexels-edwin-malca-cerna-1875492332-32772332.jpg',
  foundingMember: true,
  professionalTitle: 'Photojournalist, Southern Brazil',
  locationBase: 'Porto Alegre, Brazil',
  websiteUrl: 'https://marcooliveira.press',
  biography:
    'Video and photo journalist covering displacement, flood events, and urban settlement disputes across southern Brazil since 2016. Formerly embedded with Defesa Civil RS during the 2024 Guaíba floods.',
  trustBadge: 'verified',
  lastVerifiedAt: '2026-03-02T00:00:00Z',
  coverageAreas: ['Rio Grande do Sul', 'Southern Brazil', 'São Paulo'],
  specialisations: ['Flood documentation', 'Displacement coverage', 'Aerial survey', 'Settlement reporting'],
  mediaAffiliations: ['Agência Brasil', 'Folha de S.Paulo', 'Reuters'],
  pressAccreditations: ['Federação Nacional dos Jornalistas', 'Rio Grande do Sul Press Association'],
  publishedIn: ['Agência Brasil', 'Folha de S.Paulo', 'Reuters', 'Le Monde'],
  skills: ['Flood documentation', 'Drone operation', 'Field reporting', 'Video journalism'],
  alsoMeLinks: [
    'https://linkedin.com/in/marcooliveira-journalist',
    'https://twitter.com/marcooliveira',
  ],
})

const ana = creator({
  id: 'creator-002',
  username: 'anasousa',
  displayName: 'Ana Sousa',
  avatarUrl: '/assets/avatars/pexels-caroline-veronez-112078470-10153201.jpg',
  foundingMember: true,
  professionalTitle: 'Parliamentary Photographer, Lisbon',
  locationBase: 'Lisbon, Portugal',
  websiteUrl: 'https://anasousa.photo',
  biography:
    'Institutional and parliamentary photographer based in Lisbon. Covers the Assembleia da República, municipal governance in the greater Lisbon area, and coastal impact stories along the Setúbal coast.',
  trustBadge: 'verified',
  lastVerifiedAt: '2026-03-03T00:00:00Z',
  coverageAreas: ['Lisbon', 'Setúbal', 'Alentejo'],
  specialisations: ['Parliamentary photography', 'Institutional documentation', 'Coastal reporting', 'Storm coverage'],
  mediaAffiliations: ['Agência Lusa', 'Público', 'Jornal de Negócios'],
  pressAccreditations: ['Assembleia da República Press Gallery', 'Sindicato dos Jornalistas'],
  publishedIn: ['Agência Lusa', 'Público', 'The Guardian', 'El País'],
  skills: ['Parliamentary photography', 'Institutional documentation', 'Portrait photography', 'Storm coverage'],
  alsoMeLinks: [
    'https://linkedin.com/in/anasousa-photo',
    'https://twitter.com/anasousaphoto',
  ],
})

const dimitris = creator({
  id: 'creator-003',
  username: 'dimitriskatsaros',
  displayName: 'Dimitris Katsaros',
  avatarUrl: '/assets/avatars/pexels-imadclicks-9712871.jpg',
  foundingMember: true,
  professionalTitle: 'Border Correspondent, Evros Region',
  locationBase: 'Alexandroupoli, Greece',
  websiteUrl: 'https://dimitriskatsaros.com',
  biography:
    'Documentarian covering the Evros border region since 2019. Focuses on crossing infrastructure, asylum processing, and the logistics of border enforcement at the EU external frontier.',
  trustBadge: 'verified',
  lastVerifiedAt: '2026-03-04T00:00:00Z',
  coverageAreas: ['Evros', 'Northern Greece', 'Eastern Aegean'],
  specialisations: ['Border documentation', 'Migration route reporting', 'Logistics photography', 'Checkpoint coverage'],
  mediaAffiliations: ['Kathimerini', 'SKAI TV', 'InfoMigrants'],
  pressAccreditations: ['Hellenic Federation of Journalists', 'EU External Borders Press Accreditation'],
  publishedIn: ['Kathimerini', 'InfoMigrants', 'Balkan Insight', 'Der Spiegel'],
  skills: ['Border documentation', 'Migration reporting', 'Long-form documentary', 'Logistics photography'],
  alsoMeLinks: [
    'https://linkedin.com/in/dimitriskatsaros',
    'https://twitter.com/dkatsaros',
  ],
})

const lucia = creator({
  id: 'creator-004',
  username: 'luciaferrante',
  displayName: 'Lucia Ferrante',
  avatarUrl: '/assets/avatars/pexels-efrem-efre-2786187-13824575.jpg',
  foundingMember: true,
  professionalTitle: 'Court and Accountability Reporter, Sicily',
  locationBase: 'Palermo, Italy',
  websiteUrl: 'https://luciaferrante.it',
  biography:
    'Reporter and photographer covering courts, police accountability cases, and environmental degradation across Sicily. Long-running documentation of coastal fishing communities and institutional access disputes.',
  trustBadge: 'verified',
  lastVerifiedAt: '2026-03-05T00:00:00Z',
  coverageAreas: ['Sicily', 'Southern Italy', 'Calabria'],
  specialisations: ['Court reporting', 'Police accountability', 'Environmental documentation', 'Coastal fishing communities'],
  mediaAffiliations: ['Giornale di Sicilia', 'Il Manifesto', 'ANSA'],
  pressAccreditations: ['Tribunale di Palermo Press Gallery', 'Ordine dei Giornalisti di Sicilia'],
  publishedIn: ['Giornale di Sicilia', 'Il Manifesto', 'ANSA', 'Internazionale'],
  skills: ['Court reporting', 'Police accountability', 'Environmental documentation', 'Long-form photography'],
  alsoMeLinks: [
    'https://linkedin.com/in/luciaferrante',
    'https://twitter.com/luciaferrante',
  ],
})

const yara = creator({
  id: 'creator-005',
  username: 'yaraboukhari',
  displayName: 'Yara Boukhari',
  avatarUrl: '/assets/avatars/pexels-thefullonmonet-17608522.jpg',
  foundingMember: true,
  professionalTitle: 'Public Health and Logistics Correspondent',
  locationBase: 'Marseille, France',
  websiteUrl: 'https://yaraboukhari.press',
  biography:
    'Public health and logistics reporter based in Marseille. Covers hospital corridor pressure during heatwave events, port congestion at Fos-sur-Mer, and frontline healthcare infrastructure across southern France.',
  trustBadge: 'verified',
  lastVerifiedAt: '2026-03-06T00:00:00Z',
  coverageAreas: ['Marseille', 'Bouches-du-Rhône', 'Provence'],
  specialisations: ['Public health reporting', 'Hospital systems documentation', 'Port logistics', 'Heatwave impact'],
  mediaAffiliations: ['France 24', 'Libération', 'Médecins Sans Frontières Communications'],
  pressAccreditations: ['Conseil de Déontologie Journalistique et de Médiation', 'AP-HP Press Access'],
  publishedIn: ['France 24', 'Libération', 'Le Monde', 'British Medical Journal'],
  skills: ['Public health reporting', 'Hospital documentation', 'Field interviewing', 'Video journalism'],
  alsoMeLinks: [
    'https://linkedin.com/in/yaraboukhari',
    'https://twitter.com/yaraboukhari',
  ],
})

const tomasz = creator({
  id: 'creator-006',
  username: 'tomasznowak',
  displayName: 'Tomasz Nowak',
  avatarUrl: '/assets/avatars/pexels-apunto-group-agencia-de-publicidad-53086916-7752812.jpg',
  foundingMember: true,
  professionalTitle: 'Labor and Civic Reporter, Poland',
  locationBase: 'Warsaw, Poland',
  websiteUrl: 'https://tomasznowak.news',
  biography:
    'Visual reporter covering labor disputes, transit strikes, and election security perimeters across central Poland. Multi-format documentation of commuter infrastructure breakdowns and rally staging areas.',
  trustBadge: 'verified',
  lastVerifiedAt: '2026-03-07T00:00:00Z',
  coverageAreas: ['Warsaw', 'Łódź', 'Central Poland'],
  specialisations: ['Labor strike coverage', 'Transit disruption', 'Election rally documentation', 'Public transport infrastructure'],
  mediaAffiliations: ['Gazeta Wyborcza', 'TVN24', 'Reuters Poland'],
  pressAccreditations: ['Stowarzyszenie Dziennikarzy Polskich', 'Polish National Electoral Commission Media Accreditation'],
  publishedIn: ['Gazeta Wyborcza', 'TVN24', 'Reuters', 'Der Spiegel'],
  skills: ['Labor strike coverage', 'Election documentation', 'Transit infrastructure reporting', 'Video production'],
  alsoMeLinks: [
    'https://linkedin.com/in/tomasznowak-reporter',
    'https://twitter.com/tomasznowak',
  ],
})

const elena = creator({
  id: 'creator-007',
  username: 'elenavasile',
  displayName: 'Elena Vasile',
  avatarUrl: '/assets/avatars/pexels-kirill-ozerov-109766512-9835449.jpg',
  foundingMember: true,
  professionalTitle: 'Youth Movements Reporter, Bucharest',
  locationBase: 'Bucharest, Romania',
  websiteUrl: 'https://elenavasile.ro',
  biography:
    'Reporter covering student demonstrations, education funding disputes, and municipal governance in Bucharest. Sustained coverage of the 2025–2026 Romanian university funding protests and campus security responses.',
  trustBadge: 'trusted',
  lastVerifiedAt: '2026-03-08T00:00:00Z',
  coverageAreas: ['Bucharest', 'Dolj', 'Wallachia'],
  specialisations: ['Student demonstration coverage', 'Education policy reporting', 'Municipal politics', 'Youth mobilization'],
  mediaAffiliations: ['ProTV', 'G4Media', 'Balkan Insight'],
  pressAccreditations: ['Uniunea Ziariştilor Profesionişti din România', 'University of Bucharest Press Access'],
  publishedIn: ['ProTV', 'G4Media', 'Balkan Insight', 'Euronews Romania'],
  skills: ['Student movement coverage', 'Education policy reporting', 'Photography', 'Social media documentation'],
  alsoMeLinks: [
    'https://linkedin.com/in/elenavasile',
    'https://twitter.com/elenavasile',
  ],
})

const carmen = creator({
  id: 'creator-008',
  username: 'carmenruiz',
  displayName: 'Carmen Ruiz',
  avatarUrl: '/assets/avatars/pexels-pexels-latam-478514802-16135619.jpg',
  foundingMember: true,
  professionalTitle: 'Data Visualization Journalist, Andalusia',
  locationBase: 'Seville, Spain',
  websiteUrl: 'https://carmenruiz.es',
  biography:
    'Infographic journalist and data visualizer covering drought response, wildfire recovery, and agricultural impact across Andalusia. Produces certified infographics, maps, and illustrated data packages.',
  trustBadge: 'verified',
  lastVerifiedAt: '2026-03-09T00:00:00Z',
  coverageAreas: ['Andalusia', 'Huelva', 'Almería'],
  specialisations: ['Data-led infographics', 'Drought mapping', 'Wildfire recovery documentation', 'Agricultural impact visualization'],
  mediaAffiliations: ['El País', 'ABC Sevilla', 'Agencia EFE'],
  pressAccreditations: ['Asociación de la Prensa de Sevilla', 'Junta de Andalucía Media Accreditation'],
  publishedIn: ['El País', 'ABC Sevilla', 'Agencia EFE', 'The Economist'],
  skills: ['Data visualization', 'Infographic design', 'Drought mapping', 'Wildfire documentation'],
  alsoMeLinks: [
    'https://linkedin.com/in/carmenruiz-journalist',
    'https://twitter.com/carmenruizdata',
  ],
})

const nikos = creator({
  id: 'creator-009',
  username: 'nikospapadopoulos',
  displayName: 'Nikos Papadopoulos',
  avatarUrl: '/assets/avatars/pexels-gaurav-vishwakarma-3386298-14591977.jpg',
  foundingMember: true,
  professionalTitle: 'Humanitarian Logistics Photographer',
  locationBase: 'Thessaloniki, Greece',
  websiteUrl: 'https://nikospapadopoulos.gr',
  biography:
    'Humanitarian logistics photographer covering asylum processing centers, reception facilities, and aid distribution across northern Greece. Independent documentation since 2020.',
  trustBadge: 'trusted',
  lastVerifiedAt: '2026-03-10T00:00:00Z',
  coverageAreas: ['Northern Greece', 'Evros', 'Thessaloniki'],
  specialisations: ['Asylum infrastructure', 'Humanitarian logistics', 'Processing center documentation'],
  mediaAffiliations: ['UNHCR Media Team', 'Ekathimerini', 'VICE Greece'],
  pressAccreditations: ['Hellenic Federation of Journalists', 'UNHCR Greece Media Partnership'],
  publishedIn: ['Ekathimerini', 'VICE Greece', 'UNHCR Reportages', 'Der Spiegel'],
  skills: ['Asylum infrastructure documentation', 'Humanitarian logistics', 'Photojournalism', 'Field reporting'],
  alsoMeLinks: [
    'https://linkedin.com/in/nikospapadopoulos',
    'https://twitter.com/nikospapa',
  ],
})

/**
 * Sarah Chen — the demo session user.
 * Granted all three user types so the existing `UserTypeSwitcher`
 * in `DiscoveryNav.tsx` keeps working as a multi-role demo.
 */
const sarah = creator({
  id: SESSION_DEMO_USER_ID,
  username: 'sarahchen',
  displayName: 'Sarah Chen',
  avatarUrl: '/assets/avatars/pexels-anete-lusina-4793183.jpg',
  foundingMember: true,
  professionalTitle: 'Senior Correspondent, Asia Pacific',
  locationBase: 'Hong Kong',
  websiteUrl: 'https://sarahchen.press',
  biography:
    'Award-winning journalist covering conflict, climate, and technology across Asia Pacific for over 12 years. Previously with Reuters and the South China Morning Post.',
  trustBadge: 'verified',
  lastVerifiedAt: '2026-03-11T00:00:00Z',
  coverageAreas: ['China', 'Hong Kong', 'Taiwan', 'Southeast Asia'],
  specialisations: ['Conflict reporting', 'Climate documentation', 'Technology', 'Regional politics'],
  mediaAffiliations: ['Reuters', 'South China Morning Post', 'Foreign Policy'],
  pressAccreditations: ["Foreign Correspondents' Club of China", 'Hong Kong Journalists Association'],
  publishedIn: ['Reuters', 'South China Morning Post', 'Foreign Policy', 'The Guardian'],
  skills: ['Long-form Reporting', 'Photojournalism', 'Video Production', 'Data Journalism'],
  alsoMeLinks: [
    'https://linkedin.com/in/sarahchen-journalist',
    'https://twitter.com/sarahchenreports',
    'https://instagram.com/sarahchenreports',
  ],
  extraGrants: ['buyer', 'reader'],
})

// ══════════════════════════════════════════════
// SPARSE CREATOR PROFILES (011–018)
// ══════════════════════════════════════════════

const kofi = creator({
  id: 'creator-011',
  username: 'kofimensah',
  displayName: 'Kofi Mensah',
  avatarUrl: '/assets/avatars/pexels-cottonbro-7611746.jpg',
  foundingMember: false,
  professionalTitle: 'Photojournalist',
  locationBase: 'Accra, Ghana',
  websiteUrl: null,
  biography:
    'Independent photojournalist covering elections, market economics, and artisanal gold mining across Ghana since 2018.',
  trustBadge: 'verified',
  lastVerifiedAt: '2026-03-12T00:00:00Z',
  coverageAreas: ['Accra', 'Volta Region', 'Ashanti'],
  specialisations: ['Election monitoring', 'Market economy reporting', 'Gold mining documentation'],
})

const priya = creator({
  id: 'creator-012',
  username: 'priyasharma',
  displayName: 'Priya Sharma',
  avatarUrl: '/assets/avatars/pexels-bethany-ferr-5176816.jpg',
  foundingMember: false,
  professionalTitle: 'Visual Journalist',
  locationBase: 'Mumbai, India',
  websiteUrl: null,
  biography:
    'Visual journalist covering monsoon impacts, urban displacement camps, and hospital infrastructure across western India.',
  trustBadge: 'verified',
  lastVerifiedAt: '2026-03-13T00:00:00Z',
  coverageAreas: ['Maharashtra', 'Gujarat', 'Rajasthan'],
  specialisations: ['Monsoon flooding', 'Urban displacement', 'Public health infrastructure'],
})

const fatima = creator({
  id: 'creator-013',
  username: 'fatimaalrashid',
  displayName: 'Fatima Al-Rashid',
  avatarUrl: '/assets/avatars/pexels-talie-photo-69424917-8346242.jpg',
  foundingMember: false,
  professionalTitle: 'Documentary Photographer',
  locationBase: 'Amman, Jordan',
  websiteUrl: null,
  biography:
    'Documentary photographer covering refugee camps, water infrastructure collapse, and cross-border humanitarian logistics in the Levant.',
  trustBadge: 'verified',
  lastVerifiedAt: '2026-03-14T00:00:00Z',
  coverageAreas: ['Jordan', 'Syria border', 'Lebanon'],
  specialisations: ['Refugee documentation', 'Water scarcity', 'Cross-border logistics'],
})

const lars = creator({
  id: 'creator-014',
  username: 'larseriksson',
  displayName: 'Lars Eriksson',
  avatarUrl: '/assets/avatars/portrait-man-grey-hair-glasses.jpeg',
  foundingMember: false,
  professionalTitle: 'Reporter and Photographer',
  locationBase: 'Stockholm, Sweden',
  websiteUrl: null,
  biography:
    'Reporter covering energy policy, Arctic shipping routes, and climate activism across Scandinavia.',
  trustBadge: 'trusted',
  lastVerifiedAt: '2026-03-15T00:00:00Z',
  coverageAreas: ['Stockholm', 'Gothenburg', 'Malmö'],
  specialisations: ['Energy transition', 'Arctic shipping', 'Climate protest'],
})

const aiko = creator({
  id: 'creator-015',
  username: 'aikotanaka',
  displayName: 'Aiko Tanaka',
  avatarUrl: '/assets/avatars/portrait-woman-asian-dark-hair.jpeg',
  foundingMember: false,
  professionalTitle: 'Photojournalist',
  locationBase: 'Tokyo, Japan',
  websiteUrl: null,
  biography:
    'Photojournalist covering earthquake preparedness, Fukushima decommissioning, and urban density issues across Japan.',
  trustBadge: 'verified',
  lastVerifiedAt: '2026-03-16T00:00:00Z',
  coverageAreas: ['Tokyo', 'Osaka', 'Fukushima'],
  specialisations: ['Earthquake response', 'Nuclear decommissioning', 'Urban density reporting'],
})

const carlos = creator({
  id: 'creator-016',
  username: 'carlosmendoza',
  displayName: 'Carlos Mendoza',
  avatarUrl: '/assets/avatars/pexels-imadclicks-19055975.jpg',
  foundingMember: false,
  professionalTitle: 'Documentary Filmmaker and Photographer',
  locationBase: 'Mexico City, Mexico',
  websiteUrl: null,
  biography:
    'Documentary filmmaker and photographer covering indigenous land rights, water privatization disputes, and electoral violence in Mexico.',
  trustBadge: 'verified',
  lastVerifiedAt: '2026-03-17T00:00:00Z',
  coverageAreas: ['CDMX', 'Oaxaca', 'Chiapas'],
  specialisations: ['Indigenous rights', 'Water infrastructure', 'Electoral violence'],
})

const amina = creator({
  id: 'creator-017',
  username: 'aminadiallo',
  displayName: 'Amina Diallo',
  avatarUrl: '/assets/avatars/pexels-rk-photography-32275125.jpg',
  foundingMember: false,
  professionalTitle: 'Visual Journalist',
  locationBase: 'Nairobi, Kenya',
  websiteUrl: null,
  biography:
    'Visual journalist covering climate-driven displacement, pastoralist migration, and Nairobi flooding events.',
  trustBadge: 'trusted',
  lastVerifiedAt: '2026-03-18T00:00:00Z',
  coverageAreas: ['Nairobi', 'Mombasa', 'Northern Kenya'],
  specialisations: ['Drought documentation', 'Pastoralist displacement', 'Urban flooding'],
})

const james = creator({
  id: 'creator-018',
  username: 'jamesobrien',
  displayName: "James O'Brien",
  avatarUrl: '/assets/avatars/portrait-man-stubble-grey-bg.jpeg',
  foundingMember: false,
  professionalTitle: 'Environmental Photojournalist',
  locationBase: 'Sydney, Australia',
  websiteUrl: null,
  biography:
    'Environmental photojournalist covering bushfire aftermath, Great Barrier Reef bleaching, and flooding along the east coast of Australia.',
  trustBadge: 'verified',
  lastVerifiedAt: '2026-03-19T00:00:00Z',
  coverageAreas: ['New South Wales', 'Queensland', 'Victoria'],
  specialisations: ['Bushfire recovery', 'Coral reef documentation', 'Flood response'],
})

// ══════════════════════════════════════════════
// FULL CREATOR PROFILES — non-founding (019–024)
// ══════════════════════════════════════════════

const oluwaseun = creator({
  id: 'creator-019',
  username: 'oluwaseunadeyemi',
  displayName: 'Oluwaseun Adeyemi',
  avatarUrl: '/assets/avatars/pexels-aidemstudios-35933269.jpg',
  foundingMember: false,
  professionalTitle: 'Security and Press Freedom Correspondent, Lagos',
  locationBase: 'Lagos, Nigeria',
  websiteUrl: 'https://oluwaseunadeyemi.press',
  biography:
    'Investigative photojournalist covering security in north-eastern Nigeria and the Lake Chad basin. Documents ISWAP displacement, humanitarian access failures, and press restriction patterns across the Sahel edge. Former stringer for international wires, now independent.',
  trustBadge: 'verified',
  lastVerifiedAt: '2026-03-20T00:00:00Z',
  coverageAreas: ['Lagos', 'Borno', 'Lake Chad basin', 'Sahel border'],
  specialisations: ['Security reporting', 'Armed group displacement', 'Humanitarian access', 'Press freedom'],
  mediaAffiliations: ['The Punch', 'Channels TV', 'Committee to Protect Journalists'],
  pressAccreditations: ['Nigerian Press Council', 'CPJ West Africa Media Accreditation'],
  publishedIn: ['The Punch', 'Channels TV', 'Reuters Africa', 'Al Jazeera'],
  skills: ['Security reporting', 'Armed group displacement', 'Press freedom documentation', 'Investigative photography'],
  alsoMeLinks: [
    'https://linkedin.com/in/oluwaseunadeyemi',
    'https://twitter.com/oluwaseunadeyemi',
  ],
})

const mariam = creator({
  id: 'creator-020',
  username: 'mariamtoure',
  displayName: 'Mariam Touré',
  avatarUrl: '/assets/avatars/pexels-adietska-kaka-plur-346078987-14232669.jpg',
  foundingMember: false,
  professionalTitle: 'Sahel Coup and Press Freedom Reporter',
  locationBase: 'Bamako, Mali',
  websiteUrl: 'https://mariamtoure.press',
  biography:
    'Journalist and photographer based in Bamako documenting the political and security crisis across the Sahel. Covers military coup aftermath, civilian displacement, humanitarian corridors, and the collapse of independent media in junta-controlled territories.',
  trustBadge: 'trusted',
  lastVerifiedAt: '2026-03-21T00:00:00Z',
  coverageAreas: ['Mali', 'Burkina Faso', 'Niger', 'Sahel corridor'],
  specialisations: ['Coup reporting', 'Humanitarian access', 'Military governance', 'Civilian displacement'],
  mediaAffiliations: ['RFI Afrique', 'Le Monde Afrique', 'RSF Sahel Network'],
  pressAccreditations: ['Maison de la Presse du Mali', 'IFJ Africa Media Accreditation'],
  publishedIn: ['RFI Afrique', 'Le Monde Afrique', 'Al Jazeera Français', 'Jeune Afrique'],
  skills: ['Coup reporting', 'Military governance documentation', 'Civilian displacement', 'Radio journalism'],
  alsoMeLinks: [
    'https://linkedin.com/in/mariamtoure',
    'https://twitter.com/mariamtoure',
  ],
})

const abdirahim = creator({
  id: 'creator-021',
  username: 'abdirahimhassan',
  displayName: 'Abdirahim Hassan',
  avatarUrl: '/assets/avatars/pexels-aslam-shah-938590627-20777265.jpg',
  foundingMember: false,
  professionalTitle: 'Famine and Displacement Photojournalist, Somalia',
  locationBase: 'Mogadishu, Somalia',
  websiteUrl: 'https://abdirahimhassan.com',
  biography:
    'Somali photojournalist covering displacement, famine response, and armed group activity across south-central Somalia. Operates in areas with severe access restrictions, documenting IDP arrivals, food distribution failures, and camp infrastructure collapse.',
  trustBadge: 'verified',
  lastVerifiedAt: '2026-03-22T00:00:00Z',
  coverageAreas: ['Mogadishu', 'Puntland', 'South Somalia', 'Dadaab'],
  specialisations: ['Famine documentation', 'IDP camp coverage', 'Humanitarian logistics', 'Conflict displacement'],
  mediaAffiliations: ['Somali National News Agency', 'UNICEF Somalia Media', 'VOA Somali Service'],
  pressAccreditations: ['Somali Journalists Syndicate', 'UN AMISOM Media Accreditation'],
  publishedIn: ['VOA Somali Service', 'UNICEF Stories', 'Reuters Africa', 'The New Humanitarian'],
  skills: ['Famine documentation', 'IDP camp coverage', 'Humanitarian logistics photography', 'Restricted-access reporting'],
  alsoMeLinks: [
    'https://linkedin.com/in/abdirahimhassan',
    'https://twitter.com/abdirahimhassan',
  ],
})

const yasmin = creator({
  id: 'creator-022',
  username: 'yasminAlharazi',
  displayName: 'Yasmin Al-Harazi',
  avatarUrl: '/assets/avatars/pexels-hesam-khodaei-1595988017-28086182.jpg',
  foundingMember: false,
  professionalTitle: 'Yemen Humanitarian and War Correspondent',
  locationBase: "Sana'a, Yemen",
  websiteUrl: 'https://yasminalharazi.press',
  biography:
    "Yemeni photojournalist covering the humanitarian consequences of war: blockades, hospital collapse, cholera outbreaks, and civilian displacement. Works across both Houthi and internationally recognised government areas.",
  trustBadge: 'verified',
  lastVerifiedAt: '2026-03-23T00:00:00Z',
  coverageAreas: ["Sana'a", 'Aden', 'Taiz', 'Marib', 'Hodeidah'],
  specialisations: ['Humanitarian blockade', 'Hospital infrastructure', 'Food insecurity', 'Civilian harm documentation'],
  mediaAffiliations: ['Yemen Media House', 'ICRC Media Team', 'Arab Reporters for Investigative Journalism'],
  pressAccreditations: ['Yemen Journalists Syndicate', 'OCHA Yemen Media Accreditation'],
  publishedIn: ['The New Humanitarian', 'ICRC Reportages', 'Al Jazeera English', 'The Guardian'],
  skills: ['Humanitarian blockade documentation', 'Hospital infrastructure photography', 'Civilian harm documentation', 'Conflict photojournalism'],
  alsoMeLinks: [
    'https://linkedin.com/in/yasminalharazi',
    'https://twitter.com/yasminalharazi',
  ],
})

const tigist = creator({
  id: 'creator-023',
  username: 'tigisthaile',
  displayName: 'Tigist Haile',
  avatarUrl: '/assets/avatars/pexels-thais-simplicio-483156064-15935639.jpg',
  foundingMember: false,
  professionalTitle: 'Post-Conflict Recovery Correspondent, Ethiopia',
  locationBase: 'Addis Ababa, Ethiopia',
  websiteUrl: 'https://tigisthaile.press',
  biography:
    'Ethiopian documentary photographer covering post-Tigray conflict recovery, refugee returns, and ongoing displacement in Amhara and Oromia. Documents the slow rebuild of civilian infrastructure and humanitarian aid delivery in areas with media blackouts.',
  trustBadge: 'trusted',
  lastVerifiedAt: '2026-03-24T00:00:00Z',
  coverageAreas: ['Addis Ababa', 'Tigray', 'Amhara', 'Afar', 'Oromia'],
  specialisations: ['Post-conflict documentation', 'Refugee return', 'Aid delivery', 'Media blackout coverage'],
  mediaAffiliations: ['Ethiopian Journalists Federation', 'The New Humanitarian', 'AFP Africa'],
  pressAccreditations: ['Ethiopian Press Agency Accreditation', 'AU Media Access Network'],
  publishedIn: ['The New Humanitarian', 'AFP Africa', 'Al Jazeera', 'Deutsche Welle Amharic'],
  skills: ['Post-conflict documentation', 'Refugee return coverage', 'Media blackout reporting', 'Documentary photography'],
  alsoMeLinks: [
    'https://linkedin.com/in/tigisthaile',
    'https://twitter.com/tigisthaile',
  ],
})

const khalid = creator({
  id: 'creator-024',
  username: 'khalidibrahim',
  displayName: 'Khalid Ibrahim',
  avatarUrl: '/assets/avatars/pexels-cottonbro-7618402.jpg',
  foundingMember: false,
  professionalTitle: 'Sudan Civil War Correspondent',
  locationBase: 'Port Sudan, Sudan',
  websiteUrl: 'https://khalidibrahim.press',
  biography:
    'Sudanese photojournalist covering the ongoing civil war. Displaced from Khartoum to Port Sudan during fighting, now documents mass displacement flows, humanitarian blockades in Darfur, and civilian life in contested urban areas.',
  trustBadge: 'verified',
  lastVerifiedAt: '2026-03-25T00:00:00Z',
  coverageAreas: ['Khartoum', 'Darfur', 'Port Sudan', 'El Fasher', 'Blue Nile'],
  specialisations: ['Civil war documentation', 'Mass displacement', 'Aid obstruction', 'Urban warfare aftermath'],
  mediaAffiliations: ['Sudan Journalists Network', 'OCHA Sudan Media', 'Middle East Eye'],
  pressAccreditations: ['Sudanese Journalists Union', 'OCHA Sudan Media Accreditation'],
  publishedIn: ['Middle East Eye', 'Al Jazeera Arabic', 'The New Humanitarian', 'BBC Arabic'],
  skills: ['Civil war documentation', 'Mass displacement photography', 'Aid obstruction reporting', 'Urban warfare coverage'],
  alsoMeLinks: [
    'https://linkedin.com/in/khalidibrahim',
    'https://twitter.com/khalidibrahim',
  ],
})

// ══════════════════════════════════════════════
// BUYER SEEDS
// ══════════════════════════════════════════════

const mariaSantos = buyer({
  id: 'buyer-001',
  username: 'mariasantos',
  displayName: 'Maria Santos',
  email: 'maria@globalreport.news',
  avatarUrl: null,
  buyerType: 'company',
  companyName: 'Global Report Media',
  vatNumber: 'IE1234567T',
  taxId: null,
})

const jamesOkafor = buyer({
  id: 'buyer-002',
  username: 'jamesokafor',
  displayName: 'James Okafor',
  email: 'james@conflictcoverage.org',
  avatarUrl: null,
  buyerType: 'company',
  companyName: 'Conflict Coverage Unit',
  vatNumber: null,
  taxId: null,
})

// ══════════════════════════════════════════════
// EXPORTS — canonical seed + lookups
// ══════════════════════════════════════════════

/**
 * Canonical user seed — the single source of truth for
 * identity rows in mock mode. Order: creators 001–024 in
 * numerical order, then buyers.
 */
export const userSeed: UserSeed[] = [
  marco,
  ana,
  dimitris,
  lucia,
  yara,
  tomasz,
  elena,
  carmen,
  nikos,
  sarah,
  kofi,
  priya,
  fatima,
  lars,
  aiko,
  carlos,
  amina,
  james,
  oluwaseun,
  mariam,
  abdirahim,
  yasmin,
  tigist,
  khalid,
  mariaSantos,
  jamesOkafor,
]

/** Keyed by user id (e.g. 'creator-010'). */
export const userSeedById: Record<string, UserSeed> = Object.fromEntries(
  userSeed.map((s) => [s.user.id, s]),
)

/** Keyed by username / slug (e.g. 'sarahchen'). */
export const userSeedByUsername: Record<string, UserSeed> = Object.fromEntries(
  userSeed.map((s) => [s.user.username, s]),
)

export function getUserSeedById(id: string): UserSeed | undefined {
  return userSeedById[id]
}

export function getUserSeedByUsername(
  username: string,
): UserSeed | undefined {
  return userSeedByUsername[username.toLowerCase()]
}
