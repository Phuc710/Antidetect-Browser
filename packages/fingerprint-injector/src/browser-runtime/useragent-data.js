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
