# Local Proxy Tunnel Specification

This specification documents the local proxy tunnel routing, downstream Basic Authentication forwarding, and port allocation logic.

---

## 1. Upstream Proxy Auth Problem

*   **Why**: Modern automation libraries (Playwright, Puppeteer) do not support passing proxy authentication credentials (username and password) directly via command line arguments (`--proxy-server=http://user:pass@host:port`) without triggering blocking OS-level credentials dialogs.
*   **What**: We run a lightweight local HTTP proxy server (tunnel) that listens on a dynamic localhost port.
*   **How**: Playwright connects to the local tunnel *without* any credentials. The local tunnel then automatically appends the `Proxy-Authorization: Basic [token]` header to all outgoing requests and forwards them to the authenticated upstream proxy (SOCKS5, HTTP, or HTTPS).

---

## 2. Dynamic Port Allocation & Routing Flow

```text
Playwright Chromium  ➔  localhost:XXXXX  ➔  Local Tunnel  ➔  Upstream Proxy  ➔  Target Web Page
 (No auth required)      (Dynamic port)     (Inject Auth Header)  (SOCKS5/HTTP)      (Cloudflare, etc)
```

1.  **Port Picker**: The application scans for an available port in the private range (`49152` to `65535`).
2.  **Server Startup**: Spawns a local proxy server instance listening on `127.0.0.1:[port]`.
3.  **Forwarding Handler**:
    *   For `CONNECT` requests (HTTPS): Establishes a TCP socket connection directly to the upstream proxy, sends the proxy handshake, and pipes the raw data stream.
    *   For standard HTTP requests: Prepends the `Proxy-Authorization` header with the base64-encoded username/password credentials.

---

## 3. Proxy Health Checks & Latency Audits

Before launching a browser profile, the Local Proxy component runs validation:
*   **HTTP Ping Test**: Sends a fast, lightweight request to a public geolocation API (e.g., `http://ip-api.com/json`) through the proxy.
*   **Audit Checks**:
    *   Checks if the request timed out.
    *   Asserts that the returned IP address matches the proxy IP (checks for leaks).
    *   Measures network latency (in milliseconds) and displays it on the Dashboard.
*   **Safety Lock**: If the ping check fails, the launcher blocks browser startup to prevent the browser from exposing the user's real home IP.
