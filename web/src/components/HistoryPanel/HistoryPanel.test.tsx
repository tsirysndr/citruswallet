import { it, expect, vi } from "vitest";
import { renderComponent, screen, waitFor, act } from "../../test/render";
import { HistoryPanel } from "./HistoryPanel";
import { server } from "../../test/mocks/server";
import { http, HttpResponse } from "msw/http";
import { payment } from "../../test/mocks/fixtures";
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

it("keeps pagination on desktop", async () => {
  await renderComponent(<HistoryPanel advanced />);
  expect(await screen.findByRole('navigation', { name: 'Payment history pagination' })).toBeInTheDocument();
});

function mobileScroll() {
  vi.mocked(window.matchMedia).mockImplementation(query => ({ matches: query.includes('max-width: 767px'), media: query, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => true }));
  let intersect: (() => void) | undefined;
  vi.stubGlobal('IntersectionObserver', class {
    callback: (entries: { isIntersecting: boolean }[]) => void;
    constructor(callback: (entries: { isIntersecting: boolean }[]) => void) { this.callback = callback; }
    observe() { intersect = () => this.callback([{ isIntersecting: true }]); }
    disconnect() { intersect = undefined; }
  });
  return async () => {
    await waitFor(() => expect(intersect).toBeDefined());
    await act(async () => intersect?.());
  };
}
it('appends mobile history without pagination, deduplicates overlaps and resets search', async () => {
  const scroll = mobileScroll();
  const first = Array.from({ length: 20 }, (_, i) => ({ ...payment, id: `p${i}`, description: `Payment ${i}` }));
  const calls: URL[] = [];
  server.use(http.get(xrpc('listPayments'), ({ request }) => {
    const url = new URL(request.url); calls.push(url);
    const page = Number(url.searchParams.get('page') || 1);
    return HttpResponse.json({ payments: url.searchParams.get('q') ? [{ ...payment, description: 'Matched result' }] :
      page === 1 ? first : [first[19], { ...payment, id: 'p20', description: 'Payment 20' }],
      total: url.searchParams.get('q') ? 1 : 22, page, pageSize: 20 });
  }));
  const { user } = await renderComponent(<HistoryPanel advanced />);
  expect(await screen.findByText('Payment 0')).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'Payment history pagination' })).not.toBeInTheDocument();
  await scroll();
  expect(await screen.findByText('Payment 20')).toBeInTheDocument();
  expect(screen.getAllByText('Payment 19')).toHaveLength(1);
  expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Filters' }));
  expect(screen.queryByRole('combobox', { name: 'Per page' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Close filters' }));
  await user.type(screen.getByRole('searchbox', { name: 'Search payments' }), 'matched');
  expect(await screen.findByText('Matched result')).toBeInTheDocument();
  expect(screen.queryByText('Payment 0')).not.toBeInTheDocument();
  expect(calls.at(-1)?.searchParams.get('page')).toBe('1');
});
it('preserves loaded mobile history when another batch fails and allows retry', async () => {
  const scroll = mobileScroll(); let fail = true;
  server.use(http.get(xrpc('listPayments'), ({ request }) => {
    const page = Number(new URL(request.url).searchParams.get('page') || 1);
    if (page === 2 && fail) return HttpResponse.json({ error: 'Error', message: 'Offline' }, { status: 500 });
    return HttpResponse.json({ payments: [{ ...payment, id: `p${page}`, description: `Batch ${page}` }], total: 21, page, pageSize: 20 });
  }));
  const { user } = await renderComponent(<HistoryPanel advanced />);
  expect(await screen.findByText('Batch 1')).toBeInTheDocument();
  await scroll();
  const retry = await screen.findByRole('button', { name: 'Retry loading more' });
  expect(screen.getByText('Batch 1')).toBeInTheDocument();
  fail = false;
  await user.click(retry);
  expect(await screen.findByText('Batch 2')).toBeInTheDocument();
});

it("shows loading until a slower history response arrives", async () => {
  server.use(http.get(xrpc("listPayments"), async () => {
    // Deliberately exceed Testing Library's old one-second default.
    await new Promise(resolve => setTimeout(resolve, 1200));
    return HttpResponse.json({ payments: [payment], total: 1, page: 1, pageSize: 20 });
  }));
  await renderComponent(<HistoryPanel advanced />);
  expect(await screen.findByRole("status", { name: "Loading payments" })).toBeInTheDocument();
  expect(screen.queryByText("No payment intents yet.")).not.toBeInTheDocument();
  expect(await screen.findByText("Dinner with friends")).toBeInTheDocument();
  expect(screen.queryByRole("status", { name: "Loading payments" })).not.toBeInTheDocument();
});
