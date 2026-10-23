import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { router } from "./router";
import "./styles.css";

// Preserve an opaque notification target across browser OAuth redirects.
const notificationParams = new URLSearchParams(window.location.search);
const notificationPayment = notificationParams.get('notificationPayment');
if (notificationPayment && /^[A-Za-z0-9_-]{1,128}$/.test(notificationPayment)) {
  try { sessionStorage.setItem('citrus:notification-target', JSON.stringify({ paymentId: notificationPayment, notificationId: notificationParams.get('notificationId') })); } catch {}
}

const queries = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queries}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);

// Register only production builds. A worker update never forces a page reload.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => { /* The online app remains usable when installation fails. */ });
  });
}
