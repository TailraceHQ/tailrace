import type { Customer, Order, Ticket } from "./types.js";

/**
 * Synthetic Stripe test key used in one ticket body.
 * Concatenated so casual greps for a single literal are less noisy; still a fake marker.
 */
export const FAKE_STRIPE_KEY = "sk_test_" + "51FakeKeyForTailraceTests000FAKE";

export const customers: readonly Customer[] = [
  {
    id: "cust_alice",
    name: "Alice Chen",
    email: "alice.chen@example.com",
    phone: "555-010-1001",
  },
  {
    id: "cust_bob",
    name: "Bob Martinez",
    email: "bob.martinez@example.com",
    phone: "555-010-2002",
  },
  {
    id: "cust_carol",
    name: "Carol Nguyen",
    email: "carol.nguyen@example.com",
    phone: "555-010-3003",
  },
];

export const tickets: readonly Ticket[] = [
  {
    id: "tkt_1001",
    subject: "Invoice copy for last month",
    body: "Hi, can you resend the March invoice to alice.chen@example.com? Thanks!",
    status: "open",
    customerId: "cust_alice",
  },
  {
    id: "tkt_1002",
    subject: "Webhook signing key not working",
    body:
      "Our staging webhooks started failing after rotate. I tried the old key " +
      FAKE_STRIPE_KEY +
      " in the dashboard - can you confirm which key is live?",
    status: "open",
    customerId: "cust_bob",
  },
  {
    id: "tkt_1003",
    subject: "Upgrade from Starter to Pro",
    body: "We want to move to Pro before the next billing cycle. Phone on file is 555-010-3003.",
    status: "pending",
    customerId: "cust_carol",
  },
  {
    id: "tkt_1004",
    subject: "Charge showed as past due",
    body: "Card ending 4242 was declined once; please confirm order ord_9002 is active again.",
    status: "open",
    customerId: "cust_bob",
  },
];

export const orders: readonly Order[] = [
  {
    id: "ord_9001",
    customerId: "cust_alice",
    plan: "Pro",
    amountCents: 4900,
    status: "active",
  },
  {
    id: "ord_9002",
    customerId: "cust_bob",
    plan: "Starter",
    amountCents: 1900,
    status: "past_due",
  },
  {
    id: "ord_9003",
    customerId: "cust_carol",
    plan: "Enterprise",
    amountCents: 19900,
    status: "active",
  },
];
