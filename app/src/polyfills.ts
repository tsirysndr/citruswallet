import { Buffer } from "buffer";
const g = globalThis as any;
g.Buffer ??= Buffer;
g.window ??= g;
g.window.location ??= {
  hostname: "peachlet.app",
  href: "https://peachlet.app",
};
g.window.addEventListener ??= () => {};
g.window.removeEventListener ??= () => {};
g.window.dispatchEvent ??= () => true;
