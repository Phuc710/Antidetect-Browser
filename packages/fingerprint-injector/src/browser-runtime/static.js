function overrideStatic() {
    try {
        window.SharedArrayBuffer = undefined;
    } catch (e) {
        console.error(e);
    }
}
