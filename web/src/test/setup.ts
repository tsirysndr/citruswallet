import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from "vitest";
import { server } from "./mocks/server";
import { rememberCsrf } from "../api";

// Session-dependent queries can need more than the default one-second wait on CI.
// Keep assertions bounded and allow the same async budget as the native UI tests.
configure({ asyncUtilTimeout: 5000 });

let unhandledFrames = 0;
beforeAll(() =>
  server.listen({
    onUnhandledFrame: ({ defaults }) => {
      unhandledFrames += 1;
      defaults.error();
    },
  }),
);
afterAll(() => server.close());
afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  expect(
    unhandledFrames,
    "Every network request must have an explicit MSW handler",
  ).toBe(0);
});
beforeEach(() => {
  unhandledFrames = 0;
  localStorage.clear();
  sessionStorage.clear();
  rememberCsrf("");
  delete window.ethereum;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes("min-width: 768px"),
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => true,
    })),
  });
});
// jsdom does not model layout, scrolling, or the native dialog top layer.
Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value() {},
});
Object.defineProperties(HTMLDialogElement.prototype, {
  showModal: {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  },
  close: {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    },
  },
});
Object.defineProperty(window, "scrollTo", {
  configurable: true,
  writable: true,
  value() {},
});
