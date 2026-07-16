import { customers, orders, tickets } from "./fixtures.js";
import type { Customer, Order, Ticket } from "./types.js";

export type { Customer, Order, Ticket, TicketStatus } from "./types.js";
export { FAKE_STRIPE_KEY, customers, orders, tickets } from "./fixtures.js";

/** Return a shallow copy of all tickets (newest-looking first by id). */
export function listTickets(): Ticket[] {
  return tickets.map((t) => ({ ...t }));
}

/** Look up a ticket by id, or `undefined` if missing. */
export function getTicket(id: string): Ticket | undefined {
  const ticket = tickets.find((t) => t.id === id);
  return ticket === undefined ? undefined : { ...ticket };
}

/** Return a shallow copy of all customers. */
export function listCustomers(): Customer[] {
  return customers.map((c) => ({ ...c }));
}

/**
 * Look up a customer by id, email, or phone (exact match, case-insensitive for email).
 *
 * @example
 * ```ts
 * lookupCustomer("alice.chen@example.com")?.id // "cust_alice"
 * ```
 */
export function lookupCustomer(query: string): Customer | undefined {
  const q = query.trim();
  if (q.length === 0) return undefined;
  const lower = q.toLowerCase();
  const customer = customers.find(
    (c) => c.id === q || c.email.toLowerCase() === lower || c.phone === q,
  );
  return customer === undefined ? undefined : { ...customer };
}

/** Look up an order by id, or `undefined` if missing. */
export function getOrder(id: string): Order | undefined {
  const order = orders.find((o) => o.id === id);
  return order === undefined ? undefined : { ...order };
}

/** Orders for a given customer id (may be empty). */
export function listOrdersByCustomer(customerId: string): Order[] {
  return orders.filter((o) => o.customerId === customerId).map((o) => ({ ...o }));
}
