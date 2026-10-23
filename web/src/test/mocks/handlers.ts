import { http, HttpResponse } from "msw/http";
import { alice, bob, payment, session, media } from "./fixtures";
export const xrpc = (method: string) =>
  `http://localhost:3000/xrpc/app.citruswallet.${method}`;
export const handlers = [
  http.get(xrpc("getSession"), () => HttpResponse.json(session)),
  http.get(xrpc("getProfile"), () => HttpResponse.json({ actor: alice })),
  http.get(xrpc("searchActors"), () =>
    HttpResponse.json({ actors: [alice, bob] }),
  ),
  http.get(xrpc("listPayments"), ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.toLowerCase() ?? "";
    const matches = [payment].filter((item) =>
      `${item.description} ${bob.handle} ${bob.displayName}`
        .toLowerCase()
        .includes(q),
    );
    return HttpResponse.json({
      payments: matches,
      total: matches.length,
      page: Number(url.searchParams.get("page") ?? 1),
      pageSize: Number(url.searchParams.get("pageSize") ?? 8),
    });
  }),
  http.get(xrpc("getPayment"), () => HttpResponse.json({ payment })),
  http.get(xrpc("getInvitation"), () => HttpResponse.json({ payment })),
  http.get("https://api.klipy.com/api/v1/test-klipy-key/:kind/:action", () =>
    HttpResponse.json({
      result: true,
      data: {
        data: [
          {
            slug: media.slug,
            title: media.title,
            file: {
              md: { gif: { url: media.url }, webp: { url: media.preview } },
            },
          },
        ],
        has_next: false,
      },
    }),
  ),
];
