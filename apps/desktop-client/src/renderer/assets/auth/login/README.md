# Login assets

This folder owns all static artwork used only by the Login screen.

Recommended files:

| File | Purpose | Recommendation |
| --- | --- | --- |
| `login-showcase.webp` | Full-bleed artwork on the left panel | 1600×1200 or larger, WebP, under 500 KB |
| `login-showcase-placeholder.svg` | Repository-safe fallback artwork | SVG |
| `product-mark.svg` | Optional custom Fingerprint Suite mark | Square SVG |

To replace the showcase image:

1. Add the reviewed image to this folder.
2. Export it from `index.ts` as `loginShowcaseImage`.
3. Do not change `LoginPage.tsx`.

The image must belong to Fingerprint Suite or have an approved commercial
license. Do not copy AdsPower artwork or load it from their servers.

