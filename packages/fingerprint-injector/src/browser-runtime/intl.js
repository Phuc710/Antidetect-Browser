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
