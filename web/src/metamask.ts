import { useEffect, useState } from "react";
import { detectedMetaMask } from "./wallet";

export const metamaskFirefoxUrl =
  "https://addons.mozilla.org/en-US/firefox/addon/ether-metamask";
export const metamaskChromeUrl =
  "https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn?hl=en";

export function metamaskStoreUrl() {
  return /Firefox\//i.test(navigator.userAgent)
    ? metamaskFirefoxUrl
    : metamaskChromeUrl;
}

function available() {
  try {
    return Boolean(detectedMetaMask());
  } catch {
    return false;
  }
}

export function useMetaMask() {
  const [detected, setDetected] = useState(() => available());
  useEffect(() => {
    const detect = () => setDetected(available());
    window.addEventListener("ethereum#initialized", detect);
    window.addEventListener("focus", detect);
    window.addEventListener("citrus:wallet-connected", detect);
    const timeout = window.setTimeout(detect, 1000);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("ethereum#initialized", detect);
      window.removeEventListener("focus", detect);
      window.removeEventListener("citrus:wallet-connected", detect);
    };
  }, []);
  return detected;
}
