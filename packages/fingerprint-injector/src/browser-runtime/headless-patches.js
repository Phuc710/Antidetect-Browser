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
