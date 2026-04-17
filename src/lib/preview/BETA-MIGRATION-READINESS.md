# Beta Migration Readiness — Preview System

## Status: READY FOR IMPORT ARCHITECTURE

The canonical preview system is now structured to support future beta
data import. An importer reading legacy beta rows can produce valid
`CanonicalPreview` shapes without needing UI context or component logic.

---

## 1. Canonical Preview Fields — Available or Implied

| Canonical Field        | Status     | Source                                        |
|------------------------|------------|-----------------------------------------------|
| `entityType`           | Available  | `PreviewFamily` — 'asset' / 'story' / 'article' / 'collection' / 'frontfiler' |
| `entityId`             | Available  | Entity primary key (stable across import)     |
| `previewKind`          | Derivable  | Derived from entity type + image field presence via `derivePreviewKindFromLegacy()` |
| `previewSource`        | Derivable  | Derived from entity type + image field presence via `derivePreviewSourceFromLegacy()` |
| `previewAspectRatio`   | Derivable  | From entity `aspectRatio` field, normalised via `normalizeAspectRatio()`. Default: '16:9' |
| `coverImageUrl`        | Available  | Direct field on assets (`thumbnailUrl`), stories/articles (`coverImageUrl`), creators (`avatarUrl`) |
| `coverImageAssetId`    | Available  | Asset's own ID, or story/article `heroAssetId`. null for collections/creators |
| `assetFormat`          | Available  | `AssetFormat` on asset entities. null for non-assets |
| `alt`                  | Derivable  | Entity `title` or `displayName`               |
| `mosaicUrls`           | Derivable  | Collection thumbnail URLs (first 4 items)     |
| `holderReason`         | Derivable  | From holder resolvers in `holders.ts`          |

**All preview decisions are derived from stable entity/media data.**
No preview decision depends on UI state, viewport size, or component context.

---

## 2. Preview Decision Derivation Rules

Each entity type has a deterministic resolution path:

### Asset
```
Input:  format, thumbnailUrl, aspectRatio
Rule:   thumbnailUrl present → kind='asset-thumbnail', source='protected-delivery'
        thumbnailUrl null + format='audio' → kind='holder', reason='audio-only'
        thumbnailUrl null + format='text'  → kind='holder', reason='text-only'
        thumbnailUrl null + other format   → kind='holder', reason='no-thumbnail'
```

### Story / Article
```
Input:  coverImageUrl, heroAssetId
Rule:   coverImageUrl present → kind='cover-image', source='protected-delivery'
        coverImageUrl null    → kind='holder', reason='no-cover-image'
```

### Collection
```
Input:  itemCount, thumbnailUrls[]
Rule:   itemCount > 0 && thumbnailUrls.length > 0 → kind='mosaic', source='composite'
        itemCount = 0 || thumbnailUrls empty       → kind='holder', reason='empty-collection'
```

### Creator (frontfiler)
```
Input:  avatarUrl
Rule:   avatarUrl present → kind='avatar', source='avatar-ref'
        avatarUrl null    → kind='holder', reason='no-avatar'
```

---

## 3. Deprecated / Legacy Naming — Migration Map

The beta version used inconsistent naming. Full mapping in `deprecated-map.ts`.

| Legacy Beta Name   | Canonical Target     | Import Rule                                    |
|--------------------|----------------------|------------------------------------------------|
| `thumb`            | `coverImageUrl`      | Re-resolve via `resolveProtectedUrl(id, 'thumbnail')` |
| `thumbnail`        | `coverImageUrl`      | Same as `thumb`                                |
| `thumbnailRef`     | `coverImageUrl`      | Storage path — must re-resolve, not import raw |
| `thumbnailUrl`     | `coverImageUrl`      | If already `/api/media/...`, use directly      |
| `poster`           | `coverImageUrl`      | Map directly; resolve heroAssetId separately   |
| `cardImage`        | `coverImageUrl`      | Map directly; beta card images = thumbnails    |
| `cover`            | `coverImageUrl`      | Map directly                                   |
| `avatarRef`        | `coverImageUrl`      | Set `previewSource='avatar-ref'`               |
| `aspectRatio`      | `previewAspectRatio` | Normalise to canonical values; default '16:9'  |
| `format` (caps)    | `assetFormat`        | Lowercase: "Photo" → "photo"                   |
| `mediaTypeDisplay` | *(do not map)*       | Display text, not a canonical format            |

### Current codebase names (NOT deprecated — active use):

| Current Name       | Location                        | Role                              |
|--------------------|---------------------------------|-----------------------------------|
| `thumbnailRef`     | `data/assets.ts` (mock data)    | Storage reference path            |
| `thumbnailUrl`     | `VaultAsset`, `search-data.ts`  | Pre-resolved delivery URL         |
| `previewUrl`       | `HydratedPostAttachment`        | Runtime-resolved delivery URL     |
| `coverImageUrl`    | `Story`, `Article`              | Hero/cover image URL              |
| `avatarUrl`        | `CreatorProfile`                | Avatar storage reference          |
| `thumbnails`       | `Collection`                    | Array of mosaic thumbnail URLs    |

These are the **active canonical names** in the current codebase.
They do not need migration; they are the migration target.

---

## 4. Holder Determinism

All holder decisions are derived from entity facts, not UI heuristics:

| Holder Reason        | Trigger                                      | Label         |
|----------------------|----------------------------------------------|---------------|
| `no-thumbnail`       | Asset with no `thumbnailUrl`                 | "NO IMAGE"    |
| `audio-only`         | Audio asset with no `thumbnailUrl`           | "AUDIO"       |
| `text-only`          | Text asset with no `thumbnailUrl`            | "TEXT"        |
| `no-cover-image`     | Story/article with no `coverImageUrl`        | "NO IMAGE"    |
| `no-avatar`          | Creator with no `avatarUrl`                  | "NO AVATAR"   |
| `empty-collection`   | Collection with zero items or thumbnails     | ""            |
| `image-missing`      | Expected image reference was broken/invalid  | "NO IMAGE"    |
| `entity-unavailable` | Entity removed, revoked, or not public       | "UNAVAILABLE" |

**Import safety:** When importing beta records with broken image URLs,
the importer should pass `null` for the image field. The holder resolver
will produce the correct deterministic reason without crashing.

---

## 5. Beta Migration Compatibility

### What the importer CAN do today (architecture ready):

1. **Map legacy field names** → canonical fields using `LEGACY_FIELD_MAP`
2. **Derive preview kind/source** → using `derivePreviewKindFromLegacy()`
3. **Produce valid holders** → by calling entity-specific holder resolvers
4. **Normalise aspect ratios** → via `normalizeAspectRatio()`
5. **Produce complete `CanonicalPreview`** → using `resolve*.ts` resolvers

### What the importer needs to handle (not in scope this pass):

1. **Image re-resolution** — beta storage paths must be re-resolved
   through `resolveProtectedUrl()`, not imported as raw URLs
2. **Format case normalisation** — beta used "Photo", current uses "photo"
3. **Hero asset ID resolution** — beta stories/articles may store cover
   image differently; importer must resolve the hero asset ID
4. **Broken image detection** — importer should validate image URLs exist
   before importing; pass null for broken references
5. **Collection mosaic assembly** — importer must look up the first 4
   item thumbnails to populate `mosaicUrls`

### What still needs migration later (deprecated naming):

- `thumbnailRef` in `data/assets.ts` — mock data uses storage paths;
  production will use `resolveProtectedUrl()` directly
- `format` capitalisation — `data/assets.ts` uses "Photo"/"Video" (caps);
  domain types use "photo"/"video" (lowercase). Adapter code exists in
  `hydrate.ts` line 76: `.toLowerCase() as AssetFormat`

---

## 6. File Inventory

| File                      | Purpose                                          |
|---------------------------|--------------------------------------------------|
| `canonical.ts`            | `CanonicalPreview` type definition               |
| `holders.ts`              | Deterministic holder resolvers per entity type    |
| `deprecated-map.ts`       | Legacy field name → canonical field mapping table |
| `resolve-canonical.ts`    | Entity → `CanonicalPreview` resolver functions    |
| `types.ts`                | `PreviewFamily`, `MediaConfig`, `PreviewConfig`   |
| `policy.ts`               | UI-level field visibility + action resolution     |
| `media.ts`                | Aspect ratio + crop strategy resolution           |

The first four files are new (this pass). The last three are existing.
The new files depend only on types from the existing files and from
`@/lib/types` — no circular dependencies, no runtime side effects.
