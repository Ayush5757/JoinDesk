import { api, ApiError } from "./api";

export type BillingConfig = {
  enabled: boolean;
  configured: boolean;
  priceInr: number;
  days: number;
  trialDays: number;
};

export type AccessSummary = {
  // open = paywall off, free_all = admin gave every desk, paid, trial,
  // free_desks = admin gave only some desks, expired = must pay
  status: "open" | "free_all" | "paid" | "trial" | "free_desks" | "expired";
  until: string | null;
  freeAll: boolean;
  freeDeskIds: string[];
  subscriptionExpiresAt: string | null;
  trialEndsAt: string | null;
  daysLeft: number | null;
};

export type BillingStatus = BillingConfig & {
  access: AccessSummary;
  payments: {
    id: string;
    amount_paise: number;
    paid_at: string | null;
    starts_at: string | null;
    expires_at: string | null;
    days: number;
  }[];
};

export type PaymentRequiredInfo = { priceInr: number; days: number; trialDays: number };

/** Reads the price info the backend attaches to a 402 response. */
export function paymentInfoFromError(err: unknown): PaymentRequiredInfo | null {
  if (!(err instanceof ApiError) || err.status !== 402) return null;
  const d = err.data as Partial<PaymentRequiredInfo> | null;
  return {
    priceInr: Number(d?.priceInr ?? 0),
    days: Number(d?.days ?? 30),
    trialDays: Number(d?.trialDays ?? 0),
  };
}

export const getBillingStatus = () => api.get<BillingStatus>("/api/billing/status");

type OrderResponse = {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  priceInr: number;
  days: number;
  prefill: { name: string; email: string };
};

type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayCtor = new (options: Record<string, unknown>) => {
  open: () => void;
  on: (event: string, cb: (resp: { error?: { description?: string } }) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
let scriptPromise: Promise<void> | null = null;

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Couldn't load the payment window. Check your internet and try again."));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Opens Razorpay Checkout for one subscription period. The amount is
 * decided by the server (.env), never by this code. Resolves with the new
 * access summary once the payment is verified; resolves with null if the
 * person just closed the window.
 */
export async function payForAccess(): Promise<AccessSummary | null> {
  const order = await api.post<OrderResponse>("/api/billing/order");
  await loadRazorpay();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error("Payment window isn't available right now.");

  return new Promise((resolve, reject) => {
    const checkout = new Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: "JoinDesk",
      description: `${order.days} days full access — all desks`,
      prefill: order.prefill,
      theme: { color: "#7c3aed" },
      modal: { ondismiss: () => resolve(null) },
      handler: async (response: RazorpaySuccess) => {
        try {
          const { access } = await api.post<{ access: AccessSummary }>(
            "/api/billing/verify",
            response,
          );
          resolve(access);
        } catch (err) {
          reject(err);
        }
      },
    });
    checkout.on("payment.failed", (resp) => {
      reject(new Error(resp.error?.description || "Payment failed. You weren't charged."));
    });
    checkout.open();
  });
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
