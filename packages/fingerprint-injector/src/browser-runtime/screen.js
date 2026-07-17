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
