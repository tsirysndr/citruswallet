import { it, expect } from "vitest";
import { renderComponent, screen } from "../../test/render";
import { HistoryPanel } from "./HistoryPanel";
import { server } from "../../test/mocks/server";
import { http, HttpResponse } from "msw/http";
import { xrpc } from "../../test/mocks/handlers";
it("searches participant history and opens the filter drawer", async () => {
  const { user } = await renderComponent(<HistoryPanel advanced />);
  expect(await screen.findByText("Dinner with friends")).toBeInTheDocument();
  await user.type(
    screen.getByRole("searchbox", { name: "Search payments" }),
    "missing",
  );
  expect(
    await screen.findByText("No payments match these filters."),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Filters" }));
  expect(
    screen.getByRole("dialog", { name: "Filter activity" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Status" })).toBeInTheDocument();
});
it("reports API failure instead of displaying a misleading empty history", async () => {
  server.use(
    http.get(xrpc("listPayments"), () =>
      HttpResponse.json(
        { error: "Error", message: "Unavailable" },
        { status: 500 },
      ),
    ),
  );
  await renderComponent(<HistoryPanel advanced />);
  expect(
    await screen.findByText(/Could not load payment history/),
  ).toBeInTheDocument();
});
