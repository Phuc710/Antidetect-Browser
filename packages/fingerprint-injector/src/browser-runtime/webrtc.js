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
