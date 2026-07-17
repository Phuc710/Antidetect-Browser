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
