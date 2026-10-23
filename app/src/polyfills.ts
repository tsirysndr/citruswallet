import { Buffer } from "buffer";
const g = globalThis as any;
g.Buffer ??= Buffer;
g.window ??= g;
g.window.location ??= {
  hostname: "citruswallet.app",
  href: "https://citruswallet.app",
};
g.window.addEventListener ??= () => {};
g.window.removeEventListener ??= () => {};
g.window.dispatchEvent ??= () => true;
