// drizzle-kit input only: re-exports the tables defined in Gleam
// (src/wallet/drizzle/schema/*.gleam) so that `drizzle-kit generate` can read
// them. Run `gleam build` first.
import {
  challenges,
  kv,
  links,
  payments,
} from "../build/dev/javascript/citruswallet/citruswallet/drizzle/tables.mjs";

export const kvTable = kv();
export const challengesTable = challenges();
export const linksTable = links();
export const paymentsTable = payments();
