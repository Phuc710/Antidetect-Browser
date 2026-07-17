function overrideWebGl(webGl) {
    try {
        const getParameterProxyHandler = {
            apply(target, ctx, args) {
                const param = (args || [])[0];
                const result = cache.Reflect.apply(target, ctx, args);
                const debugInfo = ctx.getExtension('WEBGL_debug_renderer_info');
                const UNMASKED_VENDOR_WEBGL =
                    (debugInfo && debugInfo.UNMASKED_VENDOR_WEBGL) || 37445;
                const UNMASKED_RENDERER_WEBGL =
                    (debugInfo && debugInfo.UNMASKED_RENDERER_WEBGL) || 37446;

                if (param === UNMASKED_VENDOR_WEBGL) {
                    return webGl.vendor;
                }
                if (param === UNMASKED_RENDERER_WEBGL) {
                    return webGl.renderer;
                }

                return result;
            },
            get(target, prop, receiver) {
                useStrictModeExceptions(prop);
                return Reflect.get(target, prop, receiver);
            },
        };
        const addProxy = (obj, propName) => {
            overridePropertyWithProxy(obj, propName, getParameterProxyHandler);
        };
        addProxy(WebGLRenderingContext.prototype, 'getParameter');
        addProxy(WebGL2RenderingContext.prototype, 'getParameter');
    } catch (err) {
        console.warn(err);
    }
}
