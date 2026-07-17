# Backend Service: Operations (Organization, Workspace, Team)

This service manages multi-tenant workspace isolation, team members invitation flows, and profile sharing permissions.

---

## 1. Organization & Multi-Tenancy
*   An **Organization** acts as the top-level billing container.
*   **Workspace Isolation**: Profiles are bound to unique `workspace_id` parameters. Query operations must always filter by `workspace_id` from the user's active context token.
    ```sql
    SELECT * FROM profiles WHERE workspace_id = $1;
    ```

---

## 2. Workspace Sharing Rules
*   Browser profiles cannot be shared directly with single users. Instead, they are bound to a **Workspace**.
*   Any team member invited to a specific workspace gains access to the workspace profiles based on their assigned role:
    *   *ADMIN/MANAGER*: Full access to create, edit, launch, and delete profiles.
    *   *OPERATOR*: Allowed to launch/stop profiles only. Editing or deleting configs is blocked.

---

## 3. Team Invitation Flows
1.  **Generate Invite Link**: Owner generates a secure UUID token:
    `POST /api/v1/organization/invitations`
2.  **Queue Notification**: Pushes an email invite job to BullMQ queue:
    `email-delivery-queue`.
3.  **Accept Invitation**: The recipient clicks the invite URL, registering under the Organization's workspace memberships:
    ```sql
    CREATE TABLE workspace_memberships (
      workspace_id UUID REFERENCES workspaces(id),
      user_id UUID REFERENCES users(id),
      role VARCHAR(50) NOT NULL, -- ADMIN, MANAGER, OPERATOR
      PRIMARY KEY (workspace_id, user_id)
    );
    ```
4.  **Audit Logging**: The invitation acceptance triggers an audit logging hook.
