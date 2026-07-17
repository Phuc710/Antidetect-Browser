# Security Specification: Secrets & JWT Management

Stateless JWT token handling, HTTP security headers, and token rotation rules.

---

## 1. Token Lifecycles & Encryption

*   **Access Token**: JWT signed using RS256. Expiration claims (`exp`) are hard-coded to 15 minutes.
*   **Refresh Token**: 30-day token stored in database as a hashed string. Rotates automatically on every refresh action.

---

## 2. Secure Transport Headers (OWASP compliant)

The Cloud Gateway API injects security headers on all responses:

*   **`Strict-Transport-Security`**: `max-age=63072000; includeSubDomains; preload` (Forces HTTPS).
*   **`Content-Security-Policy`**: Enforces strict asset load rules:
    ```text
    default-src 'self'; script-src 'self' 'unsafe-inline'; object-src 'none';
    ```
*   **`X-Content-Type-Options`**: `nosniff` (Prevents MIME-type sniffing).
*   **`X-Frame-Options`**: `DENY` (Mitigates clickjacking attacks).

---

## 3. OWASP Top 10 Protections

*   **A01:2021-Broken Access Control**: Enforces workspace boundary ownership audits on every request.
*   **A02:2021-Cryptographic Failures**: Never transfers cleartext proxy details or encryption salts.
*   **A03:2021-Injection**: Uses knex parameterized queries to prevent SQL injections.
