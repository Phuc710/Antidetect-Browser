/* eslint-disable no-unused-vars */
const isHeadlessChromium =
    /headless/i.test(navigator.userAgent) && navigator.plugins.length === 0;
const isChrome = navigator.userAgent.includes('Chrome');
const isFirefox = navigator.userAgent.includes('Firefox');
const isSafari =
    navigator.userAgent.includes('Safari') &&
    !navigator.userAgent.includes('Chrome');

let slim = null;
function getSlim() {
    if (slim === null) {
        slim = window.slim || false;
        if (typeof window.slim !== 'undefined') {
            delete window.slim;
        }
    }

    return slim;
}

// some protections can mess with these to prevent the overrides - our script is first so we can reference the old values.
const cache = {
    Reflect: {
        get: Reflect.get.bind(Reflect),
        apply: Reflect.apply.bind(Reflect),
    },
    // Used in `makeNativeString`
    nativeToStringStr: `${Function.toString}`, // => `function toString() { [native code] }`
};

function overridePropertyWithProxy(masterObject, propertyName, proxyHandler) {
    const originalObject = masterObject[propertyName];
    const proxy = new Proxy(
        masterObject[propertyName],
        stripProxyFromErrors(proxyHandler),
    );

    redefineProperty(masterObject, propertyName, { value: proxy });
    redirectToString(proxy, originalObject);
}

const prototypeProxyHandler = {
    setPrototypeOf: (target, newProto) => {
        try {
            throw new TypeError('Cyclic __proto__ value');
        } catch (e) {
            const oldStack = e.stack;
            const oldProto = Object.getPrototypeOf(target);
            Object.setPrototypeOf(target, newProto);
            try {
                // shouldn't throw if prototype is okay, will throw if there is a prototype cycle (maximum call stack size exceeded).
                // eslint-disable-next-line no-unused-expressions
                target.nonexistentpropertytest;
                return true;
            } catch (err) {
                Object.setPrototypeOf(target, oldProto);
                if (oldStack.includes('Reflect.setPrototypeOf')) return false;
                const newError = new TypeError('Cyclic __proto__ value');
                const stack = oldStack.split('\n');
                newError.stack = [stack[0], ...stack.slice(2)].join('\n');
                throw newError;
            }
        }
    },
};

function useStrictModeExceptions(prop) {
    if (['caller', 'callee', 'arguments'].includes(prop)) {
        throw TypeError(
            `'caller', 'callee', and 'arguments' properties may not be accessed on strict mode functions or the arguments objects for calls to them`,
        );
    }
}

function overrideGetterWithProxy(masterObject, propertyName, proxyHandler) {
    const fn = Object.getOwnPropertyDescriptor(masterObject, propertyName).get;
    const fnStr = fn.toString; // special getter function string
    const proxyObj = new Proxy(fn, {
        ...stripProxyFromErrors(proxyHandler),
        ...prototypeProxyHandler,
    });

    redefineProperty(masterObject, propertyName, { get: proxyObj });
    redirectToString(proxyObj, fnStr);
}

function overrideInstancePrototype(instance, overrideObj) {
    try {
        Object.keys(overrideObj).forEach((key) => {
            if (!(overrideObj[key] === null)) {
                try {
                    overrideGetterWithProxy(
                        Object.getPrototypeOf(instance),
                        key,
                        makeHandler().getterValue(overrideObj[key]),
                    );
                } catch (e) {
                    console.debug(e);
                }
            }
        });
    } catch (e) {
        console.error(e);
    }
}

function makeHandler() {
    return {
        // Used by simple `navigator` getter evasions
        getterValue: (value) => ({
            apply(target, ctx, args) {
                // Let's fetch the value first, to trigger and escalate potential errors
                // Illegal invocations like `navigator.__proto__.vendor` will throw here
                const ret = cache.Reflect.apply(...arguments); // eslint-disable-line
                if (args && args.length === 0) {
                    return value;
                }
                return ret;
            },
            get(target, prop, receiver) {
                useStrictModeExceptions(prop);
                return Reflect.get(target, prop, receiver);
            },
        }),
    };
}

function redirectToString(proxyObj, originalObj) {
    if (getSlim()) return;

    const handler = {
        setPrototypeOf: (target, newProto) => {
            try {
                throw new TypeError('Cyclic __proto__ value');
            } catch (e) {
                if (e.stack.includes('Reflect.setPrototypeOf')) return false;
                throw e;
            }
        },
        apply(target, ctx) {
            // This fixes e.g. `HTMLMediaElement.prototype.canPlayType.toString + ""`
            if (ctx === Function.prototype.toString) {
                return makeNativeString('toString');
            }

            // `toString` targeted at our proxied Object detected
            if (ctx === proxyObj) {
                // Return the toString representation of our original object if possible
                return makeNativeString(proxyObj.name);
            }

            // Check if the toString prototype of the context is the same as the global prototype,
            // if not indicates that we are doing a check across different windows., e.g. the iframeWithdirect` test case
            const hasSameProto = Object.getPrototypeOf(
                Function.prototype.toString,
            ).isPrototypeOf(ctx.toString); // eslint-disable-line no-prototype-builtins

            if (!hasSameProto) {
                // Pass the call on to the local Function.prototype.toString instead
                return ctx.toString();
            }

            if (Object.getPrototypeOf(ctx) === proxyObj) {
                try {
                    return target.call(ctx);
                } catch (err) {
                    err.stack = err.stack.replace(
                        'at Object.toString (',
                        'at Function.toString (',
                    );
                    throw err;
                }
            }
            return target.call(ctx);
        },
        get(target, prop, receiver) {
            if (prop === 'toString') {
                return new Proxy(target.toString, {
                    apply(tget, thisArg, argumentsList) {
                        try {
                            return tget.bind(thisArg)(...argumentsList);
                        } catch (err) {
                            if (Object.getPrototypeOf(thisArg) === tget) {
                                err.stack = err.stack.replace(
                                    'at Object.toString (',
                                    'at Function.toString (',
                                );
                            }

                            throw err;
                        }
                    },
                });
            }
            useStrictModeExceptions(prop);
            return Reflect.get(target, prop, receiver);
        },
    };

    const toStringProxy = new Proxy(
        Function.prototype.toString,
        stripProxyFromErrors(handler),
    );
    redefineProperty(Function.prototype, 'toString', {
        value: toStringProxy,
    });
}

function makeNativeString(name = '') {
    return cache.nativeToStringStr.replace('toString', name || '');
}

function redefineProperty(
    masterObject,
    propertyName,
    descriptorOverrides = {},
) {
    return Object.defineProperty(masterObject, propertyName, {
        // Copy over the existing descriptors (writable, enumerable, configurable, etc)
        ...(Object.getOwnPropertyDescriptor(masterObject, propertyName) || {}),
        // Add our overrides (e.g. value, get())
        ...descriptorOverrides,
    });
}

function stripProxyFromErrors(handler) {
    const newHandler = {};
    // We wrap each trap in the handler in a try/catch and modify the error stack if they throw
    const traps = Object.getOwnPropertyNames(handler);
    traps.forEach((trap) => {
        newHandler[trap] = function () {
            try {
                // Forward the call to the defined proxy handler
                return handler[trap].apply(this, arguments || []); //eslint-disable-line
            } catch (err) {
                // Stack traces differ per browser, we only support chromium based ones currently
                if (!err || !err.stack || !err.stack.includes(`at `)) {
                    throw err;
                }

                // When something throws within one of our traps the Proxy will show up in error stacks
                // An earlier implementation of this code would simply strip lines with a blacklist,
                // but it makes sense to be more surgical here and only remove lines related to our Proxy.
                // We try to use a known "anchor" line for that and strip it with everything above it.
                // If the anchor line cannot be found for some reason we fall back to our blacklist approach.

                const stripWithBlacklist = (stack, stripFirstLine = true) => {
                    const blacklist = [
                        `at Reflect.${trap} `, // e.g. Reflect.get or Reflect.apply
                        `at Object.${trap} `, // e.g. Object.get or Object.apply
                        `at Object.newHandler.<computed> [as ${trap}] `, // caused by this very wrapper :-)
                        `at newHandler.<computed> [as ${trap}] `, // also caused by this wrapper :p
                    ];
                    return (
                        err.stack
                            .split('\n')
                            // Always remove the first (file) line in the stack (guaranteed to be our proxy)
                            .filter(
                                (line, index) =>
                                    !(index === 1 && stripFirstLine),
                            )
                            // Check if the line starts with one of our blacklisted strings
                            .filter(
                                (line) =>
                                    !blacklist.some((bl) =>
                                        line.trim().startsWith(bl),
                                    ),
                            )
                            .join('\n')
                    );
                };

                const stripWithAnchor = (stack, anchor) => {
                    const stackArr = stack.split('\n');
                    // eslint-disable-next-line no-param-reassign
                    anchor =
                        anchor ||
                        `at Object.newHandler.<computed> [as ${trap}] `; // Known first Proxy line in chromium
                    const anchorIndex = stackArr.findIndex((line) =>
                        line.trim().startsWith(anchor),
                    );
                    if (anchorIndex === -1) {
                        return false; // 404, anchor not found
                    }
                    // Strip everything from the top until we reach the anchor line
                    // Note: We're keeping the 1st line (zero index) as it's unrelated (e.g. `TypeError`)
                    stackArr.splice(1, anchorIndex);
                    return stackArr.join('\n');
                };

                if (typeof Error.captureStackTrace === 'function') {
                    const oldStackLines = err.stack.split('\n');
                    Error.captureStackTrace(err);
                    const newStackLines = err.stack.split('\n');

                    err.stack = [
                        newStackLines[0],
                        oldStackLines[1],
                        ...newStackLines.slice(1),
                    ].join('\n');
                }

                if ((err.stack || '').includes('toString (')) {
                    err.stack = stripWithBlacklist(err.stack, false);
                    throw err;
                }

                // Try using the anchor method, fallback to blacklist if necessary
                err.stack =
                    stripWithAnchor(err.stack) || stripWithBlacklist(err.stack);

                throw err; // Re-throw our now sanitized error
            }
        };
    });
    return newHandler;
}

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

const overrideCodecs = (audioCodecs, videoCodecs) => {
    try {
        const codecs = {
            ...Object.fromEntries(
                Object.entries(audioCodecs).map(([key, value]) => [
                    `audio/${key}`,
                    value,
                ]),
            ),
            ...Object.fromEntries(
                Object.entries(videoCodecs).map(([key, value]) => [
                    `video/${key}`,
                    value,
                ]),
            ),
        };

        const findCodec = (codecString) => {
            const [mime, codecSpec] = codecString.split(';');
            if (mime === 'video/mp4') {
                if (codecSpec && codecSpec.includes('avc1.42E01E')) {
                    // codec is missing from Chromium
                    return { name: mime, state: 'probably' };
                }
            }

            const codec = Object.entries(codecs).find(
                ([key]) => key === codecString.split(';')[0],
            );
            if (codec) {
                return { name: codec[0], state: codec[1] };
            }

            return undefined;
        };

        const canPlayType = {
            // eslint-disable-next-line
            apply: function (target, ctx, args) {
                if (!args || !args.length) {
                    return target.apply(ctx, args);
                }
                const [codecString] = args;
                const codec = findCodec(codecString);

                if (codec) {
                    return codec.state;
                }

                // If the codec is not in our collected data use
                return target.apply(ctx, args);
            },
        };

        overridePropertyWithProxy(
            HTMLMediaElement.prototype,
            'canPlayType',
            canPlayType,
        );
    } catch (e) {
        console.warn(e);
    }
};

function overrideBattery(batteryInfo) {
    try {
        const getBattery = {
            ...prototypeProxyHandler,
            // eslint-disable-next-line
            apply: async function () {
                return batteryInfo;
            },
        };

        if (navigator.getBattery) {
            overridePropertyWithProxy(
                Object.getPrototypeOf(navigator),
                'getBattery',
                getBattery,
            );
        }
    } catch (e) {
        console.warn(e);
    }
}

function overrideIntlAPI(language) {
    try {
        const innerHandler = {
            construct(Target, [locales, options]) {
                return new Target(locales ?? language, options);
            },
            apply(target, _, [locales, options]) {
                return target(locales ?? language, options);
            },
        };

        overridePropertyWithProxy(window, 'Intl', {
            get(target, key) {
                if (typeof key !== 'string' || key[0].toLowerCase() === key[0])
                    return target[key];
                return new Proxy(target[key], innerHandler);
            },
        });
    } catch (e) {
        console.warn(e);
    }
}

function overrideScreenByReassigning(target, newProperties) {
    for (const [prop, value] of Object.entries(newProperties)) {
        if (value > 0) {
            // The 0 values are introduced by collecting in the hidden iframe.
            // They are document sizes anyway so no need to test them or inject them.
            // eslint-disable-next-line no-param-reassign
            target[prop] = value;
        }
    }
}

function overrideWindowDimensionsProps(props) {
    try {
        overrideScreenByReassigning(window, props);
    } catch (e) {
        console.warn(e);
    }
}

function overrideDocumentDimensionsProps(props) {
    try {
        // FIX THIS = non-zero values here block the injecting process?
        // overrideScreenByReassigning(window.document.body, props);
    } catch (e) {
        console.warn(e);
    }
}

function replace(target, key, value) {
    if (target?.[key]) {
        // eslint-disable-next-line no-param-reassign
        target[key] = value;
    }
}

function blockWebRTC() {
    const handler = {
        get: () => {
            return new Proxy(() => {}, handler);
        },
        apply: () => {
            return new Proxy(() => {}, handler);
        },
        construct: () => {
            return new Proxy(() => {}, handler);
        },
    };

    const ConstrProxy = new Proxy(Object, handler);
    const proxy = new Proxy(() => {}, handler);

    replace(navigator.mediaDevices, 'getUserMedia', proxy);
    replace(navigator, 'webkitGetUserMedia', proxy);
    replace(navigator, 'mozGetUserMedia', proxy);
    replace(navigator, 'getUserMedia`', proxy);
    replace(window, 'webkitRTCPeerConnection', proxy);

    replace(window, 'RTCPeerConnection', ConstrProxy);
    replace(window, 'MediaStreamTrack', ConstrProxy);
}

function overrideUserAgentData(userAgentData) {
    try {
        const { brands, mobile, platform, ...highEntropyValues } =
            userAgentData;
        const getHighEntropyValues = {
            // eslint-disable-next-line
            apply: async function (target, ctx, args) {
                const stripErrorStack = (stack) =>
                    stack
                        .split('\n')
                        .filter((line) => !line.includes('at Object.apply'))
                        .filter((line) => !line.includes('at Object.get'))
                        .join('\n');

                try {
                    if (!args || !args.length) {
                        return target.apply(ctx, args);
                    }
                    const [hints] = args;
                    await target.apply(ctx, args);

                    const data = { brands, mobile, platform };
                    hints.forEach((hint) => {
                        data[hint] = highEntropyValues[hint];
                    });
                    return data;
                } catch (err) {
                    err.stack = stripErrorStack(err.stack);
                    throw err;
                }
            },
        };

        if (window.navigator.userAgentData) {
            overridePropertyWithProxy(
                Object.getPrototypeOf(window.navigator.userAgentData),
                'getHighEntropyValues',
                getHighEntropyValues,
            );

            overrideInstancePrototype(window.navigator.userAgentData, {
                brands,
                mobile,
                platform,
            });
        }
    } catch (e) {
        console.warn(e);
    }
}

function fixWindowChrome() {
    if (isChrome && !window.chrome) {
        Object.defineProperty(window, 'chrome', {
            writable: true,
            enumerable: true,
            configurable: false,
            value: {}, // incomplete, todo!
        });
    }
}

function fixPermissions() {
    const isSecure = document.location.protocol.startsWith('https');

    if (isSecure) {
        overrideGetterWithProxy(Notification, 'permission', {
            apply() {
                return 'default';
            },
        });
    }

    if (!isSecure) {
        const handler = {
            apply(target, ctx, args) {
                const param = (args || [])[0];

                const isNotifications =
                    param && param.name && param.name === 'notifications';
                if (!isNotifications) {
                    return cache.Reflect.apply(target, ctx, args);
                }

                return Promise.resolve(
                    Object.setPrototypeOf(
                        {
                            state: 'denied',
                            onchange: null,
                        },
                        PermissionStatus.prototype,
                    ),
                );
            },
        };

        overridePropertyWithProxy(Permissions.prototype, 'query', handler);
    }
}

function fixIframeContentWindow() {
    try {
        const addContentWindowProxy = (iframe) => {
            const contentWindowProxy = {
                get(target, key) {
                    if (key === 'self') {
                        return this;
                    }
                    if (key === 'frameElement') {
                        return iframe;
                    }

                    if (key === '0') {
                        return undefined;
                    }
                    return Reflect.get(target, key);
                },
            };

            if (!iframe.contentWindow) {
                const proxy = new Proxy(window, contentWindowProxy);
                Object.defineProperty(iframe, 'contentWindow', {
                    get() {
                        return proxy;
                    },
                    set(newValue) {},
                    enumerable: true,
                    configurable: false,
                });
            }
        };

        const handleIframeCreation = (target, thisArg, args) => {
            const iframe = target.apply(thisArg, args);

            const _iframe = iframe;
            const _srcdoc = _iframe.srcdoc;

            Object.defineProperty(iframe, 'srcdoc', {
                configurable: true,
                get() {
                    return _srcdoc;
                },
                set(newValue) {
                    addContentWindowProxy(this);
                    const srcdoc = `${newValue}`;
                    Object.defineProperty(iframe, 'srcdoc', {
                        configurable: false,
                        writable: false,
                        value: srcdoc,
                    });
                    _iframe.setAttribute('srcdoc', srcdoc);
                },
            });
            return iframe;
        };

        const addIframeCreationSniffer = () => {
            const createElementHandler = {
                get(target, key) {
                    return Reflect.get(target, key);
                },
                apply(target, thisArg, args) {
                    if (`${args[0]}`.toLowerCase() === 'iframe') {
                        return handleIframeCreation(target, thisArg, args);
                    }
                    return target.apply(thisArg, args);
                },
            };

            overridePropertyWithProxy(
                document,
                'createElement',
                createElementHandler,
            );
        };

        addIframeCreationSniffer();
    } catch (err) {}
}

function fixPluginArray() {
    if (window.navigator.plugins.length !== 0) {
        return;
    }

    Object.defineProperty(navigator, 'plugins', {
        get: () => {
            const ChromiumPDFPlugin = Object.create(Plugin.prototype, {
                description: {
                    value: 'Portable Document Format',
                    enumerable: false,
                },
                filename: { value: 'internal-pdf-viewer', enumerable: false },
                name: { value: 'Chromium PDF Plugin', enumerable: false },
            });

            return Object.create(PluginArray.prototype, {
                length: { value: 1 },
                0: { value: ChromiumPDFPlugin },
            });
        },
    });
}

function runHeadlessFixes() {
    try {
        if (isHeadlessChromium) {
            fixWindowChrome();
            fixPermissions();
            fixIframeContentWindow();
            fixPluginArray();
        }
    } catch (e) {
        console.error(e);
    }
}

function overrideStatic() {
    try {
        window.SharedArrayBuffer = undefined;
    } catch (e) {
        console.error(e);
    }
}

