/** Synthetic Acme Support customer record. */
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export type TicketStatus = "open" | "pending" | "resolved";

/** Synthetic support ticket. */
export interface Ticket {
  id: string;
  subject: string;
  body: string;
  status: TicketStatus;
  customerId: string;
}

/** Synthetic order / subscription row for richer draft replies. */
export interface Order {
  id: string;
  customerId: string;
  plan: string;
  amountCents: number;
  status: "active" | "past_due" | "canceled";
}
