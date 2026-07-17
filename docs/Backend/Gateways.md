# Backend Service: Gateways (WebSockets, Notifications, RateLimits, Audits)

This service manages real-time socket connections, email delivery, rate limiting, and action logging.

---

## 1. WebSockets & Real-Time Locks
*   **Gateway**: NestJS `@WebSocketGateway()` powered by Socket.io.
*   **State Heartbeat**: When a user launches a profile, the client establishes a WS connection. The client emits a `profile:heartbeat` ping every 30 seconds.
*   **Lock Handling**: If the WebSocket disconnects, the heartbeat fails. The server releases the Redis profile lock after a 45-second timeout, allowing other team members to launch the profile.

---

## 2. Notification Mail Delivery
*   **Service**: Amazon SES or Sendgrid integration.
*   **Queue Handler**: Email triggers (e.g. member invitations, password resets) are pushed as jobs to BullMQ `email-delivery-queue` to prevent blocking REST execution threads.

---

## 3. Rate Limit Throttling
*   **Module**: NestJS Throttler configuration.
*   **Thresholds**:
    *   Auth: `10` requests per 1 minute.
    *   Sync uploads: `30` requests per 1 minute.
    *   Default APIs: `100` requests per 1 minute.
*   **Bypassing**: Internal daemon pings bypass the throttler via signature checks.

---

## 4. Audit & Action Logging
*   **Hooks**: Controller decorators push events to the database audit table:
    ```typescript
    @UseInterceptors(AuditInterceptor)
    @Post('/profiles')
    createProfile(...) { ... }
    ```
*   **Log Schema**:
    ```sql
    CREATE TABLE audit_logs (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL,
      action_type VARCHAR(50) NOT NULL, -- LAUNCH, UPDATE, DELETE
      workspace_id UUID NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    ```
