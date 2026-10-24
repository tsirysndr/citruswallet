// drizzle-kit input only: re-exports the tables defined in Gleam
// (src/wallet/drizzle/schema/*.gleam) so that `drizzle-kit generate` can read
// them. Run `gleam build` first.
import {
  address_repository_records,
  challenges,
  kv,
  notifications,
  push_devices,
  push_deliveries,
  links,
  payments,
  user_profiles,
} from "../build/dev/javascript/peachlet/peachlet/drizzle/tables.mjs";

export const kvTable = kv();
export const challengesTable = challenges();
export const linksTable = links();
export const paymentsTable = payments();

export const userProfilesTable = user_profiles();

export const addressRepositoryRecordsTable = address_repository_records();

export const notificationsTable = notifications();
export const pushDevicesTable = push_devices();
export const pushDeliveriesTable = push_deliveries();
