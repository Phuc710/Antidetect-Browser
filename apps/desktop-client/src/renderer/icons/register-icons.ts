/**
 * Register only the specific icons the app needs, using addIcon (one call per icon).
 * Each icon body is accessed directly from the collection's icons map — Vite bundles
 * only the imported data. No CDN or Iconify API calls at runtime.
 *
 * Non-null assertions (!) are safe here: these icon names are verified to exist in
 * the installed version of @iconify-json/logos and @iconify-json/simple-icons.
 */
import { addIcon } from '@iconify/react';
import { icons as logosIcons } from '@iconify-json/logos';
import { icons as siIcons } from '@iconify-json/simple-icons';

// Logos coloured brand icons (prefix: "logos")
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
addIcon('logos:facebook', logosIcons.icons['facebook']!);
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
addIcon('logos:linkedin-icon', logosIcons.icons['linkedin-icon']!);
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
addIcon('logos:paypal', logosIcons.icons['paypal']!);
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
addIcon('logos:google-gmail', logosIcons.icons['google-gmail']!);
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
addIcon('logos:microsoft-icon', logosIcons.icons['microsoft-icon']!);

// Simple Icons monochrome (prefix: "simple-icons")
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
addIcon('simple-icons:amazon', siIcons.icons['amazon']!);
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
addIcon('simple-icons:x', siIcons.icons['x']!);
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
addIcon('simple-icons:vinted', siIcons.icons['vinted']!);
