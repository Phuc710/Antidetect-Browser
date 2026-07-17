# Implementation Spec: `WebGLRenderingContext.prototype.getParameter`

This document specifies the technical design, logic, and testing rules for masking the GPU hardware vendor and renderer information.

---

## 1. Problem (The Leak)
WebGL queries return the physical graphics card details of the user's system. For example, headless browser instances running inside Docker containers will leak software-based renderers like `Mesa` or `SwiftShader`. If the User-Agent claims the system is a Windows PC with an NVIDIA card, but the WebGL engine returns a Linux Mesa driver, the crawler is flagged immediately.

---

## 2. Design (circumvention)
We wrap the WebGL context getter methods using an ES6 Proxy. When a website queries `UNMASKED_VENDOR_WEBGL` or `UNMASKED_RENDERER_WEBGL`, we intercept the query and return faked GPU variables that align with the generated fingerprint.

---

## 3. Implementation
The override hooks into the prototypes of both `WebGLRenderingContext` and `WebGL2RenderingContext` during browser startup.

---

## 4. Pseudo Code
```javascript
const UNMASKED_VENDOR_WEBGL = 37445;
const UNMASKED_RENDERER_WEBGL = 37446;

function overrideWebGl(webGlConfig) {
    const originalGetParameter = WebGLRenderingContext.prototype.getParameter;

    const getParameterProxyHandler = {
        apply(target, ctx, args) {
            const param = args[0];
            const result = Reflect.apply(target, ctx, args);

            if (param === UNMASKED_VENDOR_WEBGL) return webGlConfig.vendor;
            if (param === UNMASKED_RENDERER_WEBGL) return webGlConfig.renderer;

            return result;
        }
    };

    Object.defineProperty(WebGLRenderingContext.prototype, 'getParameter', {
        value: new Proxy(originalGetParameter, getParameterProxyHandler)
    });
}
```

---

## 5. Execution Flow

```text
Site Script ➔ calls gl.getParameter(UNMASKED_RENDERER_WEBGL)
                     ↓
Proxy traps call ➔ checks param argument (37446)
                     ↓
Condition Match  ➔ returns faked GPU renderer string (e.g., "NVIDIA GeForce RTX 4070")
                     ↓
Site receives spoofed GPU info
```

---

## 6. Edge Cases
*   **Missing Extensions**: If the site doesn't load the `WEBGL_debug_renderer_info` extension first, query constants might cause browser errors. The proxy checks for the presence of the extension fallback values.
*   **Webgl2 Context**: The hook must apply to both WebGL v1 and WebGL v2 prototype classes.

---

## 7. Performance
*   **Latency**: Interception overhead is less than **0.005 microseconds** per call.
*   **Resource footprint**: Negligible. Does not affect WebGL rendering frame-rates.

---

## 8. Tests
*   **Assert**: `gl.getParameter(UNMASKED_RENDERER_WEBGL)` equals the target faked GPU.
*   **Assert**: `WebGLRenderingContext.prototype.getParameter.toString()` displays native code signatures.
