export default {
  dialect: "sqlite",
  schema: "./drizzle/schema.mjs",
  out: "./drizzle",
  dbCredentials: { url: "file:./data/wallet.sqlite" },
  strict: true,
};
