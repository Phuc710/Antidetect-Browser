# Backend Service: Identity (Auth, Authz, User)

This service manages user registration, JWT generation, Role-Based Access Control (RBAC) guards, and password hashing security.

---

## 1. Authentication & JWT Engine
*   **Framework**: `Passport.js` with `passport-jwt` strategy in NestJS.
*   **Signing Protocol**: RS256 (RSA Signature with SHA-256). The auth service holds the private key; all other microservices verify tokens using the public key set (JWKS).
*   **Token Expiry**:
    *   *Access Token*: 15 minutes (`exp` claim verified on every gateway request).
    *   *Refresh Token*: 30 days (stored in httpOnly cookies, auto-rotated on token refresh).

---

## 2. Authorization & RBAC Guards
*   **Guard Pattern**: NestJS `@UseGuards(RolesGuard)` controller interceptor.
*   **Roles Hierarchy**:
    ```text
    OWNER ➔ ADMIN ➔ MANAGER ➔ OPERATOR
    ```
*   **Implementation logic**:
    ```typescript
    @Injectable()
    export class RolesGuard implements CanActivate {
      canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        return requiredRoles.includes(user.role);
      }
    }
    ```

---

## 3. User Data & Hashing Models
*   **Hashing Algorithm**: **Argon2id** (standard parameters: m=65536, t=3, p=4) using native binding.
*   **Salt Metadata**: Unique 32-byte cryptographically secure random salt generated per user.
*   **Database Entity**:
    ```sql
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      salt BYTEA NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    ```
