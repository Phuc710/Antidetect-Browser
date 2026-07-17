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
