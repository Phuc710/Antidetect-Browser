# Frontend Spec: Landing Website & Stripe Checkout

This document specifies the marketing landing pages, SEO properties, pricing components, and Stripe integrations.

---

## 1. SEO & Metadata Headers

To guarantee optimal indexing scores, landing pages include standard SEO tags:

*   **Global Titles**: `Midnight Browser - Anti-Detect Command Center`
*   **Description**: `Secure, undetectable browser profile sandboxes. Manage social and advertising profiles with faked fingerprint architectures.`
*   **OpenGraph Tags**: Configures `og:image`, `og:title`, and `og:type` tags for social sharing previews.

---

## 2. Pricing Matrix Component

*   **Visual Layout**: Curated midnight pricing grid showing plan details (Starter, Pro, Enterprise).
*   **Pricing Cards**:
    *   *Starter*: Price: `$0/month`. Gates: 10 profiles limit.
    *   *Pro*: Price: `$49/month`. Gates: 100 profiles limit.
    *   *Enterprise*: Price: Custom. Gates: custom bounds.

---

## 3. Stripe Checkout Flow

When a user clicks "Upgrade" on the website pricing tier card:

```text
Click Upgrade ➔ Create Stripe Checkout Intent ➔ Redirect to checkout.stripe.com
                      ➔ Stripe processes payment ➔ Redirect back to /success
```

*   **API call**: Triggers `POST /api/v1/billing/checkout` payload containing `priceId`.
*   **Redirect**: Backend returns Stripe Checkout url. The user gets redirected to finish payment processing.
