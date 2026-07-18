# DESKTOP-CORE-006 — Browser Fingerprint Injection Adapter

## 1. Status

**PARTIAL**

Desktop Phase 1 adapter cho bundled Playwright Chromium đã được triển khai và kiểm chứng end-to-end. Production activation chưa thể được gọi là complete vì Cloud transport, owner-approved production Ed25519 public keys và license decision provider thuộc RFC-0027A/chức năng Cloud chưa tồn tại. Production hiện fail closed; không dùng local generator, mock hoặc cache khi chưa có quyết định license.

Một điểm cần owner review: adapter dùng default Chromium CDP context thay cho `browser.newContext()` qua Playwright WS. Integration thật chứng minh context tạo qua WS không phải context mà external CDP client nhận được; dùng default CDP context bảo đảm endpoint được publish chính là context đã inject. RFC-0027 cần errata/owner confirmation cho chi tiết này trước production rollout.

## 2. RFC/commit used

- Branch: `feature/desktop-core-006-fingerprint-injection`
- RFC Approved commit cherry-picked: `e51fd45` — RFC-0027 revision 003, owner Approved.
- Final errata commit cherry-picked: `455f0cd` — RFC-0027 revision 003-E.
- Không tự thay đổi status hoặc approve RFC.

## 3. Existing packages reused

- `packages/fingerprint-generator` — development/test adapter tạo fingerprint.
- `packages/header-generator` — được tái sử dụng gián tiếp qua generator.
- `packages/fingerprint-injector` — tạo injectable script và lọc headers.
- `packages/generative-bayesian-network` — dependency hiện hữu của generator.
- Không move/copy package source vào Desktop. Desktop import workspace packages tại chỗ; packaging dùng `pnpm deploy` để materialize production artifacts.
- Các public type contracts bị global `.gitignore` che mất đã được phục hồi từ upstream package version `2.1.83`, không lấy từ dirty mixed worktree.

## 4. Architecture implemented

- Shared data-only `FingerprintEnvelope` schema v2 và typed error codes.
- RFC 8785 JCS canonicalization qua dependency `canonicalize@3.0.0`.
- Ed25519 signature validation, raw public-key conversion, timestamp/freshness, engine/OS/runtime validation.
- `CloudFingerprintProvider` dùng injected authenticated transport, không mock/fallback production.
- `DevelopmentFingerprintProvider` ký envelope bằng ephemeral test/development key và bị chặn trong production.
- Main mapper `FingerprintEnvelope DTO -> BrowserFingerprintWithHeaders -> PreparedFingerprintInjection`.
- `BrowserRuntimeSession` và `PlaywrightRuntimeAdapter` không rò Playwright types vào service/shared contract.
- `BrowserApplicationService` thực hiện resolve/validate trước lock/process; apply headers/init script; probe `about:blank`; close probe; publish endpoint; cache; register exit handler; cuối cùng mới emit `running`.
- Electron IPC và Local Automation API nhận cùng một `BrowserApplicationService` instance từ composition root; có unit test identity.
- Bundled Chromium + CDP là runtime Phase 1 duy nhất. Chrome/Edge/Brave/Firefox/WebKit/custom trả unsupported rõ ràng.

## 5. Files changed

Nhóm chính:

- Shared contract: `packages/shared/src/contracts/fingerprint-envelope.ts`.
- Main validation/provider: `fingerprint-envelope-validator.ts`, `fingerprint-provider.ts`, `fingerprint-public-keys.ts`.
- Main adapter: `fingerprint-envelope-mapper.ts`, `playwright-runtime-adapter.ts`.
- Lifecycle: `browser-application-service.ts`, composition root, safe error mapping, redaction.
- Cache/migration: migration v4 và `fingerprint-envelope-cache-repository.ts`.
- Workspace remediation: restored package type contracts; removed injector access to Playwright private `_options`; exposed tested public header filtering method.
- Test/config/package: Vitest aliases, focused ESLint coverage, Electron Builder config, deploy helper và packaged injector smoke script.
- Không sửa file nào dưới `apps/desktop-client/src/renderer/**`.

## 6. Migration/cache impact

- Migration v4 tạo riêng `fingerprint_envelopes_cache` với FK `ON DELETE CASCADE` tới `profiles_cache`.
- Lưu nguyên signed envelope JSON cùng metadata cần query; không ghi fingerprint mới vào deprecated columns của `profiles_cache`.
- Online/development envelope chỉ được cache sau readiness thành công; lỗi cache không làm hỏng browser session.
- Offline cache chỉ được đọc khi provider trả `FINGERPRINT_SERVICE_UNAVAILABLE`, envelope vượt toàn bộ validation và injected policy `canUseOfflineFingerprintCache(profileId)` trả `true`.
- Default policy là deny. Chưa có license provider production nên production không tự suy diễn quyền dùng cache.
- Upgrade test xác nhận profile metadata không đổi, cascade hoạt động, `PRAGMA foreign_key_check` rỗng và `foreign_keys` vẫn bật.

## 7. Security impact

- Production từ chối key ID bắt đầu bằng `test:` và local provider.
- Unknown key, tampering, invalid signature, invalid timestamp, expired envelope và runtime mismatch đều fail closed trước process start.
- Test signing key nằm trong test-only fixture, không được production import/build.
- Production key bundle hiện cố ý rỗng cho đến khi owner cung cấp trust material; không có key giả.
- Payload, signature, signed-envelope JSON, credentials và tokens được redaction; readiness log chỉ ghi field name + pass/fail.
- Safe IPC/Local API error mapping không phản chiếu raw errors, payload, path hoặc signature.
- Injector private `_options` và các suppression liên quan đã bị loại bỏ; không có `any`, `@ts-ignore`, `@ts-expect-error` trong feature paths.
- Automation endpoint không thể lấy trước readiness; failure đóng context/process rồi release durable lock và ghi session `error`.

## 8. Tests and exact exit codes

Runtime verification: Node `v20.18.1`, pnpm `10.33.4`.

| Command | Result | Exit |
|---|---:|---:|
| `pnpm install --frozen-lockfile` | PASS | 0 |
| `pnpm --filter desktop-client typecheck` | PASS | 0 |
| `pnpm --filter desktop-client lint` | PASS | 0 |
| Focused lint for changed workspace package sources | PASS | 0 |
| `pnpm --filter desktop-client test:unit` | 8 files, 36 tests PASS | 0 |
| `pnpm --filter desktop-client test:integration` | 4 files, 13 tests PASS | 0 |
| `pnpm --filter desktop-client build` | Main, preload, renderer bundles PASS | 0 |
| `pnpm --filter desktop-client package:dir` | Windows unpacked package PASS | 0 |

Coverage gồm JCS vector, Ed25519 valid/tampered/unknown/test-key-production, freshness boundaries, engine/OS/runtime mismatch, provider selection/error mapping, DTO mapping, redaction, IPC errors, ordering, double launch, crash recovery, failure cleanup, migration/cache, license cache gate và actual bundled Chromium.

Actual Chromium integration không gọi Internet: readiness dùng `about:blank`; user-navigation proof dùng `data:text/html`. Inline document script quan sát marker/language/user-agent/platform sau injection, chứng minh injection chạy trước document script đầu tiên.

## 9. Packaged smoke result

- Command: `pnpm --filter desktop-client smoke:packaged-injector`
- Result: `Packaged fingerprint-injector smoke test passed.`
- Exit code: `0`.
- `node_modules/fingerprint-injector/dist/utils.js` có explicit `asarUnpack`.
- Smoke chạy packaged Electron executable với `ELECTRON_RUN_AS_NODE=1`, require package từ `app.asar`, instantiate `FingerprintInjector` và thực thi public header-filter method.
- Packaging dùng materialized workspace production packages, không copy source vào Desktop tree.

## 10. Git commits/diff

Implementation commits:

- `20bba2f` — `fix(fingerprint): restore tracked package contracts`
- `378fdf1` — `feat(desktop): inject verified browser fingerprints`
- `3a0245c` — `test(desktop): verify fingerprint readiness lifecycle`
- `3c4a6ed` — `build(desktop): package workspace fingerprint runtime`
- `2b5ba7b` — `fix(desktop): gate offline fingerprint cache`

Diff từ RFC errata commit `455f0cd` đến implementation HEAD trước report:

```text
47 files changed, 2651 insertions(+), 246 deletions(-)
```

Không merge, không push, không tag.

## 11. Scope audit

- Bundled Chromium: implemented/tested.
- Chrome/Edge: disabled rõ ràng vì chưa có resolver + integration proof.
- Brave/Firefox/WebKit/custom: không triển khai.
- Proxy, proxy credentials, cookies, extensions: không đụng.
- Renderer/UI: không sửa.
- Cloud backend/API: không triển khai.
- Browser runtime download feature: không triển khai; test dùng Playwright-managed Chromium đã có trên verification host.
- Không dùng website public hoặc Internet trong test.

## 12. Known limitations

1. Production Cloud transport chưa được composition root cung cấp; packaged production startup fail closed với `FINGERPRINT_SERVICE_UNAVAILABLE`.
2. Production Ed25519 public-key bundle chưa có owner-approved key; bundle cố ý rỗng, chờ RFC-0027A.
3. License policy chưa có provider; offline cache default deny và chỉ mở bằng injected policy.
4. Default CDP context là thay đổi cần owner xác nhận so với text `browser.newContext()` trong RFC; nó cần thiết để external CDP endpoint nhìn thấy đúng injected context.
5. Chrome/Edge chưa được enable.
6. Windows package hiện dùng fallback Electron icon và không code-sign; đây không phải fingerprint correctness issue nhưng là release limitation.
7. Electron Builder báo một số unresolved optional/transitive dependencies trong dependency scan, nhưng native rebuild, package creation và packaged injector execution đều PASS.

## 13. Suggested next task

Chỉ đề xuất một task tiếp theo sau code review/owner decision:

**RFC-0027A — Production Fingerprint Trust Bootstrap**: chốt authenticated Cloud transport contract, pinned Ed25519 key rotation bundle, license-backed offline-cache policy và xác nhận default CDP context errata. Không bắt đầu task này trong DESKTOP-CORE-006.

---

Đã dừng tại đây để chờ code review.
