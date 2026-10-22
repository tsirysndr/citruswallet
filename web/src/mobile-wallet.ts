import type { MetamaskConnectEVM } from "@metamask/connect-evm";

// Device hints select the connection UI; they do not prove the app is installed.
export function isMobileWalletBrowser() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

let client: Promise<MetamaskConnectEVM> | undefined;
export function mobileWalletClient() {
  client ??= import("@metamask/connect-evm").then(({ createEVMClient }) =>
    createEVMClient({
      dapp: {
        name: "Citrus Wallet",
        url: window.location.origin,
        iconUrl: new URL("/icons/icon-192.png", window.location.origin).href,
      },
      api: { supportedNetworks: { "0x1": "https://eth.drpc.org" } },
      analytics: { enabled: false },
      mobile: { useDeeplink: false },
      skipAutoAnnounce: true,
    }),
  ).catch((error) => { client = undefined; throw error; });
  return client;
}
