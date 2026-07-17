# Backend Infrastructure Specification (DB, Cache, Queue, Monitoring)

This document specifies the PostgreSQL pools, Redis caches TTL rules, BullMQ job queues, and Prometheus monitoring metrics.

---

## 1. Relational Database (PostgreSQL)
*   **Connection Pool**: Managed using `pg` pool driver with default size parameters:
    *   `max`: 20 connections per node instance.
    *   `idleTimeoutMillis`: 30000 (releases idle connections after 30 seconds).
*   **Indexing strategy**:
    *   `INDEX idx_profiles_workspace_id` on `profiles(workspace_id)`.
    *   `INDEX idx_audit_logs_user_id` on `audit_logs(user_id)`.

---

## 2. Redis Caching & TTL Keys
*   **Connection**: Managed via `ioredis` Client.
*   **Keys and TTL mappings**:
    *   `session:{user_id}` ➔ Store current JWT session parameters (TTL: 900 seconds).
    *   `lock:{profile_id}` ➔ Store active running user locks (TTL: 45 seconds).
    *   `limits:{user_id}` ➔ Store cached license limits checking results (TTL: 3600 seconds).

---

## 3. Background Job Queues (BullMQ)
*   **Queue Configuration**:
    *   Uses a single Redis cluster instance as the job backend store.
    *   *Queues list*:
        *   `sync-processing-queue`: Runs background verification on R2 sync zip files.
        *   `email-delivery-queue`: Manages email notifications.
*   **Workers**: Independent container processes run BullMQ Workers to handle jobs asynchronously.

---

## 4. Monitoring & Metrics Export (Prometheus)
*   **Exporter**: Pushes telemetry statistics to `/metrics` endpoint.
*   **Telemetry list**:
    *   `http_requests_total`: Counter tracking total HTTP endpoints requests.
    *   `websocket_active_connections`: Gauge tracking active Socket.io sessions.
    *   `db_pool_idle_connections`: Gauge tracking idle PostgreSQL connections count.
