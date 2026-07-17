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
