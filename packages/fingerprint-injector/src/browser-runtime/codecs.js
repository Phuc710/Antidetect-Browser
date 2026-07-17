const overrideCodecs = (audioCodecs, videoCodecs) => {
    try {
        const codecs = {
            ...Object.fromEntries(
                Object.entries(audioCodecs).map(([key, value]) => [
                    `audio/${key}`,
                    value,
                ]),
            ),
            ...Object.fromEntries(
                Object.entries(videoCodecs).map(([key, value]) => [
                    `video/${key}`,
                    value,
                ]),
            ),
        };

        const findCodec = (codecString) => {
            const [mime, codecSpec] = codecString.split(';');
            if (mime === 'video/mp4') {
                if (codecSpec && codecSpec.includes('avc1.42E01E')) {
                    // codec is missing from Chromium
                    return { name: mime, state: 'probably' };
                }
            }

            const codec = Object.entries(codecs).find(
                ([key]) => key === codecString.split(';')[0],
            );
            if (codec) {
                return { name: codec[0], state: codec[1] };
            }

            return undefined;
        };

        const canPlayType = {
            // eslint-disable-next-line
            apply: function (target, ctx, args) {
                if (!args || !args.length) {
                    return target.apply(ctx, args);
                }
                const [codecString] = args;
                const codec = findCodec(codecString);

                if (codec) {
                    return codec.state;
                }

                // If the codec is not in our collected data use
                return target.apply(ctx, args);
            },
        };

        overridePropertyWithProxy(
            HTMLMediaElement.prototype,
            'canPlayType',
            canPlayType,
        );
    } catch (e) {
        console.warn(e);
    }
};
