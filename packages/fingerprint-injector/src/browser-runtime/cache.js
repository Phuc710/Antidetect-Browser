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
