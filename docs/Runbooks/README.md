# Operations & Incident Runbook

This runbook specifies deployment pipelines, disaster recovery scripts, rollback triggers, and monitoring thresholds.

---

## 1. Disaster Recovery & Database Backups

In case of a regional outage or database corruption:

*   **Backup Schedule**: Continuous database snapshots (PostgreSQL WAL-G) are uploaded hourly to AWS S3 storage with a 30-day retention policy.
*   **Restoration Flow**:
    1.  Provision a new PostgreSQL cluster instance.
    2.  Download the latest full backup and replay logs:
        ```bash
        wal-g backup-fetch /var/lib/postgresql/data LATEST
        ```
    3.  Confirm schema consistency checks by running the Knex migrations status script.

---

## 2. Release & Rollback Procedures

*   **Zero-Downtime Deployment**: NestJS servers are deployed in a rolling update model. Old pods are killed only after new health check probes return `200 OK`.
*   **Rollback Trigger**: If error logs increase by **> 5%** within 10 minutes post-release:
    *   Trigger automated rollback to the previous Docker image tag via CI/CD.
    *   Revert local client updates on the update CDN by updating the `latest.yml` file back to the stable version.

---

## 3. Monitoring & Alerting Metrics

The DevOps team monitors systems using Prometheus and Grafana:

| Monitor | Trigger Condition | Severity | Action |
|---|---|---|---|
| **CPU Usage** | > 85% for 5 minutes | Warning | Auto-scale backend server pods. |
| **API Error Rate** | > 2% of total requests | Critical | Ping PagerDuty: developer on-call. |
| **Sync Database Delay** | > 30 seconds replication lag | Warning | Inspect PostgreSQL replica stream state. |
