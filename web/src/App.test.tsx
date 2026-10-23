import { expect, it } from "vitest";
import { App } from "./App";
import { renderComponent, screen, waitFor, act } from "./test/render";
import { server } from "./test/mocks/server";
import { http, HttpResponse } from "msw/http";
import { xrpc } from "./test/mocks/handlers";
import { session, signedOut } from "./test/mocks/fixtures";

it("only mounts activity search for signed-in users and closes it when the session ends", async () => {
  let current = signedOut;
  server.use(http.get(xrpc("getSession"), () => HttpResponse.json(current)));
  const { client, user } = await renderComponent(<App />);
  await waitFor(() =>
    expect(client.getQueryData(["session"])).toEqual(signedOut),
  );
  expect(
    screen.queryByRole("button", { name: "Search activity" }),
  ).not.toBeInTheDocument();
  await user.keyboard("/");
  expect(
    screen.queryByRole("dialog", { name: "Search activity" }),
  ).not.toBeInTheDocument();
  current = session;
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["session"] });
  });
  await user.click(
    await screen.findByRole("button", { name: "Search activity" }),
  );
  expect(
    screen.getByRole("dialog", { name: "Search activity" }),
  ).toBeInTheDocument();
  current = signedOut;
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["session"] });
  });
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Search activity" }),
    ).not.toBeInTheDocument(),
  );
  expect(
    screen.queryByRole("button", { name: "Search activity" }),
  ).not.toBeInTheDocument();
});
