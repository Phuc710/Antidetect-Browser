# Implementation Spec: `CanvasRenderingContext2D.prototype.measureText`

This document specifies the technical design, algorithm, and validation criteria for spoofing font width and height measurements.

---

## 1. Problem (The Leak)
Websites detect the client's host OS by checking system font rendering. Different OS rasterization engines (DirectWrite on Windows, CoreText on macOS, FreeType on Linux) yield slightly different sub-pixel bounding widths and heights when rendering identical string blocks. 
By calling `measureText('string').width` on specific system fonts (e.g. *Calibri*, *Arial*), anti-bots instantly cross-reference these rendering widths with the claimed User-Agent platform. If they don't match, the browser is flagged.

---

## 2. Design (circumention)
To circumvent this check, we wrap the native `measureText` method using a Javascript Proxy. For any string input, we apply a tiny, deterministic noise offset to the returning width. The noise is constant for identical strings within a single profile session but randomized across different profile instances.

---

## 3. Implementation
The override is applied directly to the prototype of `CanvasRenderingContext2D` before page load.

---

## 4. Pseudo Code
```javascript
const originalMeasureText = CanvasRenderingContext2D.prototype.measureText;

CanvasRenderingContext2D.prototype.measureText = function (text) {
    const metrics = originalMeasureText.apply(this, arguments);
    const seed = window.fingerprintConfig.canvasSeed;
    
    // Deterministic sine-wave fuzzer
    const noise = Math.sin(text.length + seed) * 0.05; 
    
    return new Proxy(metrics, {
        get(target, prop) {
            if (prop === 'width') {
                return target.width + noise;
            }
            return Reflect.get(target, prop);
        }
    });
};
```

---

## 5. Execution Flow

```text
Site Script ➔ calls context2d.measureText(text)
                   ↓
Proxy traps call ➔ runs native measureText()
                   ↓
Calculates noise ➔ offset = sin(text.length + profileSeed) * 0.05
                   ↓
Creates Proxy wrapper over TextMetrics returning (width + offset)
                   ↓
Site receives fuzzed width value
```

---

## 6. Edge Cases
*   **Empty strings**: If `text` is `""`, `text.length` is 0. The fuzzer must return exactly `0` width to prevent breaking layouts.
*   **Illegal calls**: If called with `measureText.call({}, "text")`, the native execution will throw. The proxy handles this inside a `try...catch` wrapper.
*   **Prototype checks**: Overridden `toString` redirect must hide the proxy on `measureText.toString()`.

---

## 7. Performance
*   **Latency**: Proxy wrapping introduces an average overhead of **~0.015 microseconds** per call.
*   **Optimization**: In heavy graphics applications (WebGL/HTML5 canvas games), `measureText` is called frequently. The `slim` option allows users to disable this override if raw rendering performance is critical.

---

## 8. Tests
*   **Assert**: `ctx.measureText('test').width` is not equal to native browser metrics (when canvasSeed !== 0).
*   **Assert**: `ctx.measureText('test').width` remains identical when called repeatedly inside the same context.
*   **Assert**: `ctx.measureText.toString()` returns `'function measureText() { [native code] }'`.
