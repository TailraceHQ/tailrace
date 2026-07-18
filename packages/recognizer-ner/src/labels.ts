/**
 * Privacy Filter label space (33 BIOES classes) and mapping to Tailrace EntityClass.
 * Locked: OPEN_QUESTIONS.md §Locked for M8 (M8-2).
 */

import type { EntityClass } from "@tailrace/core";

/** Official `id2label` order from openai/privacy-filter config.json. */
export const PRIVACY_FILTER_ID2LABEL: readonly string[] = [
  "O",
  "B-account_number",
  "I-account_number",
  "E-account_number",
  "S-account_number",
  "B-private_address",
  "I-private_address",
  "E-private_address",
  "S-private_address",
  "B-private_date",
  "I-private_date",
  "E-private_date",
  "S-private_date",
  "B-private_email",
  "I-private_email",
  "E-private_email",
  "S-private_email",
  "B-private_person",
  "I-private_person",
  "E-private_person",
  "S-private_person",
  "B-private_phone",
  "I-private_phone",
  "E-private_phone",
  "S-private_phone",
  "B-private_url",
  "I-private_url",
  "E-private_url",
  "S-private_url",
  "B-secret",
  "I-secret",
  "E-secret",
  "S-secret",
];

/** Model span category → Tailrace entity (M8-2). */
export const MODEL_LABEL_TO_ENTITY: Readonly<Record<string, EntityClass>> = {
  secret: "secret",
  account_number: "account_number",
  private_person: "person",
  private_address: "private_address",
  private_email: "email",
  private_phone: "phone",
  private_url: "private_url",
  private_date: "private_date",
};

export const NER_RECOGNIZER_ID = "privacy-filter";

export const NER_RECOGNIZER_ENTITIES: readonly EntityClass[] = [
  "secret",
  "account_number",
  "person",
  "private_address",
  "email",
  "phone",
  "private_url",
  "private_date",
];

export function mapModelLabelToEntity(modelLabel: string): EntityClass | null {
  return MODEL_LABEL_TO_ENTITY[modelLabel] ?? null;
}
