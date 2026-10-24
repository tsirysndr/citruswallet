import { Settings } from "./pages/Settings";
import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { App } from "./App";
import { Account } from "./pages/Account";
import { Activity } from "./pages/Activity";
import { Payments } from "./pages/Payments";
import { Privacy, Terms } from "./pages/Legal";
import { Wallet } from "./pages/Wallet";

const root = createRootRoute({ component: App });

export const routeTree = root.addChildren([
  createRoute({ getParentRoute: () => root, path: "/", component: Account }),
  createRoute({
    getParentRoute: () => root,
    path: "/invite",
    component: Wallet,
  }),
  createRoute({
    getParentRoute: () => root,
    path: "/wallet",
    component: Wallet,
    validateSearch: (search: Record<string, unknown>) => ({
      setup: search.setup === true || search.setup === "true",
    }),
  }),
  createRoute({
    getParentRoute: () => root,
    path: "/payments",
    component: Payments,
  }),
  createRoute({
    getParentRoute: () => root,
    path: "/settings",
    component: Settings,
  }),
  createRoute({
    getParentRoute: () => root,
    path: "/activity",
    component: Activity,
  }),
  createRoute({
    getParentRoute: () => root,
    path: "/privacy",
    component: Privacy,
  }),
  createRoute({ getParentRoute: () => root, path: "/terms", component: Terms }),
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
