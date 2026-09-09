# Payments (Paystack) — Frontend Integration Guide

**Audience:** Frontend engineers replacing the mocked "Proceed To Pay" flow in `BookTruckParkPage.tsx`, `BookEPTPage.tsx`, `BookFishPage.tsx`, `BookBondedTerminalPage.tsx` (and `book-assist/BookAssistUi.tsx`'s `PaymentSummaryPanel`) with real Paystack payments.
**Backend:** Maritime-ETSS
**Auth:** `Authorization: Bearer <access_token>` — every endpoint below except the Paystack webhook (which the backend receives directly from Paystack, not from you) is SuperAdmin-only, same as everything else in `/dashboard/bookings`.

## 0. Read this first — what's breaking

`PATCH /api/bookings/:id/confirm-payment` **is gone.** Confirmed live in this repo: `services/bookings.service.ts`'s `confirmPayment()`, `hooks/booking-creation/useBookingCreationMutations.ts`'s `useConfirmBookingPayment()`, and the `handleProceedToPay()` function duplicated across all 4 booking pages all currently call it. Once this backend deploys, every "Proceed To Pay" click 404s.

What replaces it is a real, Paystack-verified payment — not a bigger mock. Money actually moves. Read this whole doc before wiring anything.

**Response envelope** (same as every other endpoint in the app):
```ts
type ApiResponse<T> = { success: boolean; message: string; data: T };
```
Errors are the same `ApiError` shape you already handle: `{ statusCode, message, timestamp, path }`.

---

## 1. The flow, end to end

```
Booking created (existing flow — unchanged)
        │  booking.invoice = { id, invoice_number, status: 'PENDING', amount, currency }
        ▼
User checks "I agree to..." → clicks "Proceed To Pay"
        │  POST /api/bookings/:id/payments/initialize   { terms_accepted: true }
        ▼
Backend returns { reference, authorization_url, access_code, amount, currency }
        │  window.location.href = authorization_url
        ▼
Browser is now on Paystack's hosted checkout page (you don't render this — Paystack does)
        │  user pays with a card/bank transfer
        ▼
Paystack redirects the browser to your callback page with ?reference=...&trxref=...
        │  NEW page: /dashboard/bookings/payment-callback
        ▼
Callback page reads `reference` from the URL, calls:
        │  POST /api/payments/verify   { reference }
        ▼
Backend re-verifies directly with Paystack (never trusts the redirect alone), marks
Invoice/Booking PAID, returns the payment record including `payable_id` (the booking's id)
        ▼
Callback page shows success and routes to /dashboard/bookings/{payable_id} (or wherever
you want — the booking is already fully paid and updated server-side by this point)
```

**Why a redirect, not a popup:** there's no Paystack SDK in this repo yet (checked `package.json` — no `@paystack/inline-js`, no `<script>` tag anywhere) and no CSP configured (`next.config.ts` is empty, no `middleware.ts`), so either approach is technically available. The redirect approach needs **zero new dependencies** — `authorization_url` is a plain URL, `window.location.href = ...` is the entire integration. Paystack's Inline JS popup (staying on your page, no redirect) is a nicer UX but is extra work; treat it as a follow-up enhancement, not blocking. This doc only covers the redirect flow.

---

## 2. Endpoints

### 2.1 Initialize — `POST /api/bookings/:id/payments/initialize`

Call this when the user clicks "Proceed To Pay" (button already gated on `detailsConfirmed && termsAccepted` in your existing `PaymentSummaryPanel` — keep that gate).

```ts
type InitializePaymentRequest = { terms_accepted: true };

type InitializePaymentResponse = {
  reference: string;          // Paystack's transaction reference — you don't need to store this, the callback page reads it back from the URL
  authorization_url: string;  // redirect the browser here
  access_code: string;        // only needed if you later add Inline JS
  amount: number;              // Naira, matches booking.invoice.amount
  currency: string;            // 'NGN'
};
```

```ts
const { data } = await apiClient.post<ApiResponse<InitializePaymentResponse>>(
  PAYMENTS.INITIALIZE(bookingId),
  { terms_accepted: true },
);
window.location.href = data.data.authorization_url;
```

**Error responses to handle (toast, same pattern as your existing `validateStep1()`):**

| Status | Message | Meaning |
|---|---|---|
| `400` | `This booking is already paid` | Don't show "Proceed To Pay" at all once `booking.payment_status === 'PAID'` — check before rendering the panel. |
| `400` | `This booking is cancelled — payment can no longer be initiated` | Same — hide the panel for `CANCELLED` bookings. |
| `422` | `This invoice has no fee configured — configure a Payment Type before it can be paid` | **This will happen in real testing right now** — only 2 of the 4 booking types have a `PaymentType` configured as of this doc. Show this message as-is; it's actionable (tells ops what to do), don't swallow it. |
| `400` | `terms_accepted must be true to proceed to payment` | Shouldn't happen if the button is properly gated — defensive only. |

Calling `initialize` again on a booking that already has a live Paystack checkout link open (double-click, or the user navigates back) is **safe** — the backend returns the *same* `authorization_url`/`reference` rather than creating a duplicate charge, as long as that link isn't stale (>30 min old). No special handling needed on your end; just don't add your own debounce-prevention that would block a legitimate retry after a failed attempt.

### 2.2 Verify by reference — `POST /api/payments/verify` (the callback page uses this one)

```ts
type VerifyByReferenceRequest = { reference: string };

type PaymentTransactionResponse = {
  id: string;
  reference: string;
  invoice_id: string;
  invoice_number?: string;
  payable_type?: 'BOOKING';
  payable_id?: string;        // the booking's id — use this to route the user after success
  gateway: 'PAYSTACK';
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'ABANDONED';
  amount: number;
  currency: string;
  customer_email?: string;
  paystack_authorization_url?: string;
  channel?: string;           // 'card' | 'bank_transfer' | ... — populated once verified
  gateway_response?: string;  // human-readable reason, populated on FAILED too
  paid_at?: string;
  created_at: string;
};
```

This is idempotent and safe to call more than once (e.g. if the user refreshes the callback page) — it always returns the current, authoritative state, and never double-charges or re-verifies a transaction that's already `SUCCESSFUL`/`FAILED`.

`404` if the reference doesn't exist (shouldn't happen from a real Paystack redirect, but handle it — show a generic "we couldn't find that payment, contact support" state rather than crashing).

### 2.3 Verify a specific booking (optional — for a manual "check payment status" retry button, if you want one)

`POST /api/bookings/:id/payments/verify`, body `{ reference?: string }` (omit `reference` to verify the booking's most recent attempt). Functionally the same as 2.2 but scoped to a booking you already have the id for — use 2.2 for the callback page since that's all it has, use this if you ever add a "Check payment status" button on the booking detail view itself.

### 2.4 Paystack public key — `GET /api/payments/config`

```ts
type PaymentsConfigResponse = { public_key: string };
```

Nothing to do with this endpoint for the redirect flow (the public key is only needed for Inline JS, which this doc doesn't cover) — call it out because it exists specifically so the public key is **never hardcoded in the frontend**, matching the "nothing hardcoded" rule already applied to every other dropdown in the booking forms. If/when you add Inline JS later, fetch the key from here, don't check it into source.

### 2.5 Admin list/detail — `GET /api/payments`, `GET /api/payments/:id`

Same list-page shape as everything else (`{data: T[], meta: PaginationMetaDto}`), filterable by `status`/`search`/`date_from`/`date_to`. Not required for the booking-payment flow itself — these exist for a future "Payments"/"e-Revenue" admin screen, if/when one gets built. Mentioned here so you know it exists rather than building a second one.

---

## 3. What changes in existing files

### 3.1 `types/booking-creation.types.ts` and `types/bookings.types.ts`

Delete `BookingPaymentMethod = "WALLET" | "PAYSTACK"` and `ConfirmPaymentRequest`. `BookingExtras.payment_method` should become `payment_method?: 'PAYSTACK'` (WALLET is gone — there was never a real wallet ledger behind it, it was always just a string tag). Add:
```ts
invoice?: {
  id: string;
  invoice_number: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  amount: number;
  currency: string;
};
```
to `BookingExtras` — every booking response now includes this (bookings created before this backend shipped will have `invoice: undefined`, handle that as "no payment info available" rather than an error).

### 3.2 `api/endpoints.ts`

Remove `BOOKINGS.CONFIRM_PAYMENT`. Add, mirroring the existing `PAYMENT_TYPES` block style:
```ts
export const PAYMENTS = {
  INITIALIZE: (bookingId: string) => `/bookings/${bookingId}/payments/initialize`,
  VERIFY_BOOKING: (bookingId: string) => `/bookings/${bookingId}/payments/verify`,
  VERIFY: "/payments/verify",
  CONFIG: "/payments/config",
  LIST: "/payments",
  BY_ID: (id: string) => `/payments/${id}`,
} as const;
```

### 3.3 `services/bookings.service.ts` / new `services/payments.service.ts`

Delete `confirmPayment`. Add a new `services/payments.service.ts` following the exact pattern every other method in `bookings.service.ts` already uses:
```ts
import apiClient from "@/api/client";
import { PAYMENTS } from "@/api/endpoints";
import type { ApiResponse } from "@/types/api.types";

export const paymentsService = {
  initialize: async (bookingId: string) => {
    const { data } = await apiClient.post<ApiResponse<InitializePaymentResponse>>(
      PAYMENTS.INITIALIZE(bookingId),
      { terms_accepted: true },
    );
    return data.data;
  },
  verifyByReference: async (reference: string) => {
    const { data } = await apiClient.post<ApiResponse<PaymentTransactionResponse>>(
      PAYMENTS.VERIFY,
      { reference },
    );
    return data.data;
  },
};
```

### 3.4 `hooks/booking-creation/useBookingCreationMutations.ts`

Delete `useConfirmBookingPayment`. Add `useInitializePayment` (same `useMutation` + `handleBookingError` toast pattern):
```ts
export function useInitializePayment() {
  return useMutation({
    mutationFn: (bookingId: string) => paymentsService.initialize(bookingId),
    onError: (error: AxiosError<ApiError>) =>
      handleBookingError(error, "Failed to start payment"),
  });
}
```
You don't need a `useVerifyPayment` mutation hook in the booking pages themselves — verification happens on the new callback page (below), not here.

### 3.5 All 4 booking pages (`BookTruckParkPage.tsx`, `BookEPTPage.tsx`, `BookFishPage.tsx`, `BookBondedTerminalPage.tsx`)

Replace each page's `handleProceedToPay` (currently calling `confirmPaymentMutation.mutateAsync(...)`) with:
```ts
async function handleProceedToPay() {
  if (!detailsConfirmed) {
    toast.error("Please confirm booking details first.");
    return;
  }
  if (!termsAccepted) {
    toast.error("Please accept the Maritime-ETSS terms and conditions.");
    return;
  }
  if (!createdBookingId) {
    toast.error("Booking not found. Please confirm details again.");
    return;
  }
  try {
    const { authorization_url } = await initializePaymentMutation.mutateAsync(createdBookingId);
    window.location.href = authorization_url;
  } catch {
    // toast handled in mutation
  }
}
```
`isPaying = initializePaymentMutation.isPending;` — same shape as before, so `PaymentSummaryPanel`'s existing `isPaying`/`onProceedToPay` props don't need to change.

Note the UX shift: **the browser navigates away** on success (to Paystack, then to your new callback page) — `BookingPaymentSuccessModal` no longer fires from inside these pages. Move that modal (or an equivalent) to the callback page instead; these pages should just show a normal loading state while `isPaying` is true, since the user is about to leave anyway.

### 3.6 `book-assist/BookAssistUi.tsx` — `PaymentSummaryPanel`

Remove the WALLET option entirely: the wallet `<button>` block (the one labelled "Your wallet balance" / "Wallet ledger not yet integrated"), the `Wallet` icon import, and the `PaymentMethod = "wallet" | "paystack"` type + `paymentMethod`/`onPaymentMethodChange` props (there's only one method now, so there's nothing to select — you can drop the whole method-picker UI, or leave a single non-interactive "Pay via Paystack" row if you want to keep the visual structure). Everything else in the panel (fee breakdown, T&C checkbox, "Proceed To Pay" button, `detailsConfirmed`/`isPaying` gating) is unaffected — it was already correctly wired.

**The fee display needs no changes at all.** It's already real: `lib/booking-form-utils.ts`'s `mapPreviewFee()` already reads `fee_configured`/`total`/`lines` straight from the preview/create response and feeds `PaymentSummaryPanel`'s `fee` prop — this was never mocked. `fee_configured: false` (which you'll see for Truck Park/EPT until those get a `PaymentType` configured) already renders your existing "Fee not yet configured" amber message correctly — no new work needed there either.

### 3.7 Delete dead mock exports

`lib/book-assist-mock-data.ts`'s `BOOK_ASSIST_FEES` and `MOCK_WALLET_BALANCE`, and the re-exports of them in `lib/book-fish-mock-data.ts` — confirmed unused by any component already (the real fee data comes from the preview/create response, not these). Safe to delete outright.

### 3.8 New page — `/dashboard/bookings/payment-callback`

Two files, following the exact pattern `app/reset-password/page.tsx` + `components/auth/ResetPasswordPage.tsx` already use for reading a URL param on mount (the only existing `useSearchParams()` usage in this repo):

`app/dashboard/bookings/payment-callback/page.tsx`:
```tsx
import { Suspense } from "react";
import { PaymentCallbackPage } from "@/components/dashboard/PaymentCallbackPage";

export default function PaymentCallback() {
  return (
    <Suspense>
      <PaymentCallbackPage />
    </Suspense>
  );
}
```

`components/dashboard/PaymentCallbackPage.tsx` (new):
```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { paymentsService } from "@/services/payments.service";
import type { PaymentTransactionResponse } from "@/types/payments.types";

export function PaymentCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [result, setResult] = useState<PaymentTransactionResponse | "error" | null>(null);

  useEffect(() => {
    const reference = searchParams.get("reference") ?? searchParams.get("trxref");
    if (!reference) {
      setResult("error");
      return;
    }
    paymentsService
      .verifyByReference(reference)
      .then(setResult)
      .catch(() => setResult("error"));
  }, [searchParams]);

  // render a loading state while result === null, a success state with
  // "View Booking" -> router.push(`/dashboard/bookings/${result.payable_id}`)
  // when result.status === 'SUCCESSFUL', and a failure state (with
  // result.gateway_response, e.g. "Insufficient funds") otherwise —
  // this is where BookingPaymentSuccessModal's content should move to.
}
```

`PAYSTACK_CALLBACK_URL` is set **server-side** (an env var on the backend, currently pointing at `https://etss-global.onrender.com/dashboard/bookings/payment-callback` in `.env.example` — confirm the deployed value matches wherever this route actually lives) and is what Paystack redirects to after checkout — you don't pass a callback URL from the frontend per-request, it's fixed. If your routing structure differs from `/dashboard/bookings/payment-callback`, tell the backend team the real path so `PAYSTACK_CALLBACK_URL` gets updated to match.

Paystack appends both `?reference=` and `?trxref=` (same value, both for historical compatibility with older integrations) — read either.

---

## 4. Testing

Paystack test cards (works against `sk_test_.../pk_test_...` keys only): card `4084084084084081`, any future expiry, any CVV, OTP `123456` if prompted. Full list: Paystack's own docs.

Right now the backend is running with **placeholder** Paystack keys (not real test keys) — `initialize` will reach Paystack and get rejected with `"Invalid key"` until the backend team swaps in real `sk_test_.../pk_test_...` values. Confirm with them before doing an end-to-end click-through; until then you can still build and unit-test everything up to the `window.location.href = authorization_url` redirect (the URL just won't be a valid live Paystack session).

Also confirm with the backend team which of the 4 booking types have a `PaymentType` configured before demoing — `initialize` 422s for any type that doesn't (see §2.1).
