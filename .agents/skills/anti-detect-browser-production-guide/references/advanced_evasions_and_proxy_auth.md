# Advanced Evasions, Proxy Auth, and SQLite Schema Blueprint

This document details advanced implementation techniques required to bypass strict fingerprinting and handle proxy authentication programmatically.

---

## 1. Advanced Evasions (Fonts & ClientRects)

### A. Font Fingerprinting Prevention
Anti-bot scripts detect your operating system's installed fonts by drawing text in a Canvas element with various font-family declarations and measuring the bounding width using `CanvasRenderingContext2D.prototype.measureText` or `Element.prototype.offsetWidth/offsetHeight`. If your User-Agent says "macOS" but your system has "Consolas" or "Calibri" (Windows-specific fonts) installed, you get flagged.

#### Solution: Font List Restricting & Measurement Fuzzing
```javascript
function restrictFontsAndFuzzMeasurements(allowedFontsList, noiseSeed) {
    const originalMeasureText = CanvasRenderingContext2D.prototype.measureText;

    CanvasRenderingContext2D.prototype.measureText = function (text) {
        const result = originalMeasureText.apply(this, arguments);
        
        // Add a micro-fraction of noise to the text width measurements
        const noise = (Math.sin(text.length + noiseSeed) * 0.05); // Tiny offset
        
        // Return a proxy wrapper over the TextMetrics object to override width
        return new Proxy(result, {
            get(target, prop) {
                if (prop === 'width') {
                    return target.width + noise;
                }
                return Reflect.get(target, prop);
            }
        });
    };
}
```

### B. ClientRects Fingerprinting Spoofing
ClientRects fingerprinting measures the exact sub-pixel coordinates of HTML elements rendered on the page using `Element.prototype.getClientRects()` and `Element.prototype.getBoundingClientRect()`. Since browser layouts render slightly differently depending on the operating system, device screen, and GPU, these exact sub-pixel dimensions form a unique hash.

#### Solution: Bounding Rect Sub-Pixel Jitter
```javascript
function injectClientRectsNoise(noiseSeed) {
    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

    Element.prototype.getBoundingClientRect = function () {
        const rect = originalGetBoundingClientRect.apply(this, arguments);
        
        // Add tiny deterministic jitter to sub-pixel values
        const jitterX = (Math.sin(this.tagName.length + noiseSeed) * 0.001);
        const jitterY = (Math.cos(this.childNodes.length + noiseSeed) * 0.001);

        return new Proxy(rect, {
            get(target, prop) {
                if (prop === 'x' || prop === 'left') return target[prop] + jitterX;
                if (prop === 'y' || prop === 'top') return target[prop] + jitterY;
                if (prop === 'right') return target.right + jitterX;
                if (prop === 'bottom') return target.bottom + jitterY;
                return Reflect.get(target, prop);
            }
        });
    };
}
```

---

## 2. Local Proxy Authentication Server (Bypassing Playwright Auth Prompts)

Playwright's `--proxy-server` CLI argument does not natively handle proxies that require authentication (username/password) without launching a blocking OS credentials dialog. 
To bypass this, the Electron backend starts a **local proxy tunnel** (using a package like `http-proxy` or `socks`) that forwards traffic to the authenticated upstream proxy.

```javascript
const http = require('http');
const httpProxy = require('http-proxy');

class LocalProxyTunnel {
    constructor(port, upstreamProxy) {
        this.port = port; // e.g., 8888
        this.upstream = upstreamProxy; // { host, port, username, password }
        this.server = null;
    }

    start() {
        const proxy = httpProxy.createProxyServer({});
        
        this.server = http.createServer((req, res) => {
            // Forward HTTP requests
            proxy.web(req, res, { target: `http://${this.upstream.host}:${this.upstream.port}` });
        });

        // Intercept CONNECT requests (HTTPS traffic)
        this.server.on('connect', (req, socket, head) => {
            const upstreamSocket = net.connect(this.upstream.port, this.upstream.host, () => {
                socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
                
                // If upstream proxy requires basic authentication:
                if (this.upstream.username) {
                    const authHeader = 'Basic ' + Buffer.from(`${this.upstream.username}:${this.upstream.password}`).toString('base64');
                    // Send auth header to upstream...
                }
                
                upstreamSocket.write(head);
                socket.pipe(upstreamSocket);
                upstreamSocket.pipe(socket);
            });
        });

        this.server.listen(this.port);
        console.log(`Local proxy tunnel listening on port ${this.port}`);
    }

    stop() {
        if (this.server) this.server.close();
    }
}
```

---

## 3. Database Schema for Profile Storage (SQLite)

In Electron, use SQLite (via Knex.js) to store profile data locally. Below is the relational schema design for managing isolated profiles:

```sql
-- Profile Configurations table
CREATE TABLE profiles (
    id TEXT PRIMARY KEY,               -- UUID of the profile
    name TEXT NOT NULL,                -- User-defined name
    proxy_host TEXT,                   -- Upstream proxy IP/Domain
    proxy_port INTEGER,
    proxy_username TEXT,
    proxy_password_encrypted TEXT,     -- Encrypted using master key
    user_agent TEXT,
    device_memory INTEGER,
    hardware_concurrency INTEGER,
    canvas_seed INTEGER,               -- Seed used for canvas noise
    webgl_vendor TEXT,
    webgl_renderer TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sync History logs
CREATE TABLE sync_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id TEXT FOREIGN KEY REFERENCES profiles(id),
    status TEXT CHECK(status IN ('SUCCESS', 'FAILED')),
    sync_direction TEXT CHECK(sync_direction IN ('UPLOAD', 'DOWNLOAD')),
    file_size_bytes INTEGER,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
