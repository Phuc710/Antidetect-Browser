export const BROWSER_HTTP_NODE_NAME = '*BROWSER_HTTP' as const;
export const HTTP_VERSION_NODE_NAME = '*HTTP_VERSION' as const;
export const BROWSER_NODE_NAME = '*BROWSER' as const;
export const OPERATING_SYSTEM_NODE_NAME = '*OPERATING_SYSTEM' as const;
export const DEVICE_NODE_NAME = '*DEVICE' as const;
export const MISSING_VALUE_DATASET_TOKEN = '*MISSING_VALUE*' as const;

export const NON_GENERATED_NODES = [
    BROWSER_HTTP_NODE_NAME,
    BROWSER_NODE_NAME,
    OPERATING_SYSTEM_NODE_NAME,
    DEVICE_NODE_NAME,
] as const;

export const STRINGIFIED_PREFIX = '*STRINGIFIED*' as const;

export const PLUGIN_CHARACTERISTICS_ATTRIBUTES = [
    'plugins',
    'mimeTypes',
] as const;

export const KNOWN_WEBGL_RENDERER_PARTS = [
    'AMD',
    'ANGLE',
    'ASUS',
    'ATI',
    'ATI Radeon',
    'ATI Technologies Inc',
    'Adreno',
    'Android Emulator',
    'Apple',
    'Apple GPU',
    'Apple M1',
    'Chipset',
    'D3D11',
    'Direct3D',
    'Express Chipset',
    'GeForce',
    'Generation',
    'Generic Renderer',
    'Google',
    'Google SwiftShader',
    'Graphics',
    'Graphics Media Accelerator',
    'HD Graphics Family',
    'Intel',
    'Intel(R) HD Graphics',
    'Intel(R) UHD Graphics',
    'Iris',
    'KBL Graphics',
    'Mali',
    'Mesa',
    'Mesa DRI',
    'Metal',
    'Microsoft',
    'Microsoft Basic Render Driver',
    'Microsoft Corporation',
    'NVIDIA',
    'NVIDIA Corporation',
    'NVIDIAGameReadyD3D',
    'OpenGL',
    'OpenGL Engine',
    'Open Source Technology Center',
    'Parallels',
    'Parallels Display Adapter',
    'PCIe',
    'Plus Graphics',
    'PowerVR',
    'Pro Graphics',
    'Quadro',
    'Radeon',
    'Radeon Pro',
    'Radeon Pro Vega',
    'Samsung',
    'SSE2',
    'VMware',
    'VMware SVGA 3D',
    'Vega',
    'VirtualBox',
    'VirtualBox Graphics Adapter',
    'Vulkan',
    'Xe Graphics',
    'llvmpipe',
] as const;

export const KNOWN_OS_FONTS = {
    WINDOWS: [
        'Cambria Math',
        'Calibri',
        'MS Outlook',
        'HoloLens MDL2 Assets',
        'Segoe Fluent Icons',
    ],
    APPLE: [
        'Helvetica Neue',
        'Luminari',
        'PingFang HK Light',
        'InaiMathi Bold',
        'Galvji',
        'Chakra Petch',
    ],
} as const;
