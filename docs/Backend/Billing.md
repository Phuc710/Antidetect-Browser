# Backend Service: Billing & Subscriptions

This service coordinates subscription tiers, checkout payments, and Stripe webhook event processors.

---

## 1. Stripe Checkout Integration
*   **Checkout Flow**: Client requests checkout session using target subscription price ID. The backend creates a Stripe Session and returns the checkout URL:
    ```typescript
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    ```

---

## 2. Webhook Event Handlers
The API verifies incoming Webhook signatures using the Stripe Webhook secret key:

*   **`checkout.session.completed`**: Dispatched on initial checkout completion. Activates the user license.
*   **`customer.subscription.updated` / `customer.subscription.deleted`**: Fired when a user cancels or changes plans. Updates limits:
    ```sql
    UPDATE subscriptions 
    SET tier = $1, max_profiles = $2, active = $3, expires_at = $4 
    WHERE stripe_sub_id = $5;
    ```

---

## 3. Subscription Pricing Tiers Mappings

| Subscription Tier | Max Profiles | Max Team Seats | S3 Sync Storage Limit |
|---|---|---|---|
| **Starter** | 10 | 1 | 500 MB |
| **Pro** | 100 | 5 | 5 GB |
| **Enterprise** | Custom | Custom | Custom |
