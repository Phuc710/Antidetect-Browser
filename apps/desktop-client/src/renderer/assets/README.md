# Renderer assets

Static images owned by the React renderer live here and are grouped by feature
and screen:

```text
assets/
├── auth/
│   └── login/       # Login showcase and login-only brand artwork
├── profiles/        # Profile feature artwork
├── proxies/         # Proxy feature artwork
└── shared/          # Assets reused by at least two features
```

Rules:

- Keep screen-specific images inside that screen's folder.
- Move an asset to `shared/` only when at least two features use it.
- Import assets through the nearest `index.ts`; components must not reference
  deep asset paths directly.
- Prefer WebP for large photographic artwork and SVG for owned vector artwork.
- Do not hotlink images from a CDN or third-party product.
- Use lowercase kebab-case names such as `login-showcase.webp`.
- Do not store secrets, user uploads, or runtime profile data here.

