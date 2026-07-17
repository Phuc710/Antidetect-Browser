# Cloud Backend Services & Infrastructure

This document specifies the NestJS/Go backend modular services, Redis connection caching, rate limiting, and queue configurations.

---

## 1. Backend Modules & Service Boundaries

The backend handles core cloud tasks through decoupled modules:

### A. Authentication & Authorization
*   **OAuth2 / Passport**: Handled using JWT tokens signed via RSA-256 keys.
*   **Role-Based Access Control (RBAC)**: Checks user membership constraints on endpoints (e.g. only `ADMIN` can invite workspace users).

### B. Billing & Subscriptions (Stripe)
*   **Stripe Webhook Handler**: Listens to Stripe events, mapping active subscriptions directly to local license limitations.
*   **Checkout Gateway**: Creates sessions for payment checkout flows.

### C. Workspace & Team Sharing
*   **Workspace Controller**: Groups profiles under shared database buckets.
*   **WebSocket Gateway**: Runs a Socket.io portal. Clients send a heartbeat every 30 seconds to lock profile IDs:
    ```typescript
    @SubscribeMessage('heartbeat')
    handleHeartbeat(@MessageBody() data: { profileId: string }) {
      this.redis.set(`lock:${data.profileId}`, this.currentUser.id, 'EX', 45);
    }
    ```

---

## 2. Infrastructure & Middleware

### A. Rate Limiting (Throttler)
*   Protects APIs against brute-force attacks.
*   *Thresholds*:
    *   Auth endpoints: 10 calls / 1 minute.
    *   Sync upload endpoints: 20 calls / 1 minute (limit bandwidth spamming).

### B. Redis Cache & Queues (BullMQ)
*   **Caching**: Stores active profile locks and user session tokens.
*   **BullMQ Message Queues**:
    *   `sync-processing-queue`: Handles compression and validation checks on R2 file uploads.
    *   `email-delivery-queue`: Manages team member invite notifications.

---

## 3. Monitoring & Analytics (Prometheus)
*   **Exporter**: Exposes a `/metrics` scrape endpoint.
*   **Metrics Tracked**:
    *   `http_request_duration_seconds` (API Latency)
    *   `sync_upload_size_bytes` (Upload sizes metrics)
    *   `active_websocket_connections` (Connected clients count)
