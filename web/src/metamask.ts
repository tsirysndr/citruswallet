import { useEffect, useState } from "react";
import { detectedMetaMask } from "./wallet";

export const metamaskStoreUrl = "https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn?hl=en";

export function useMetaMask() {
  const [detected, setDetected] = useState(() => Boolean(detectedMetaMask()));
  useEffect(() => {
    const detect = () => setDetected(Boolean(detectedMetaMask()));
    window.addEventListener("ethereum#initialized", detect);
    window.addEventListener("focus", detect);
    const timeout = window.setTimeout(detect, 1000);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("ethereum#initialized", detect);
      window.removeEventListener("focus", detect);
    };
  }, []);
  return detected;
}
