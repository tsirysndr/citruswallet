import { createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
import { App } from "./App";
import { Account } from "./pages/Account";
import { Activity } from "./pages/Activity";
import { Payments } from "./pages/Payments";
import { Wallet } from "./pages/Wallet";

const root = createRootRoute({ component: App });

export const routeTree = root.addChildren([
  createRoute({ getParentRoute: () => root, path: "/", component: Account }),
  createRoute({ getParentRoute: () => root, path: "/wallet", component: Wallet }),
  createRoute({ getParentRoute: () => root, path: "/payments", component: Payments }),
  createRoute({ getParentRoute: () => root, path: "/activity", component: Activity }),
]);

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: () => {
    throw redirect({ to: "/" });
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
