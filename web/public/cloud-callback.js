(() => {
  const url = location.href;
  const message = { type: "peachlet-cloud-callback", url, at: Date.now() };
  history.replaceState(null, "", "/cloud-callback.html");
  /* Dropbox serves its sign-in pages with their own Cross-Origin-Opener-Policy,
     which moves this window into a fresh browsing context group: window.opener
     is null here and the handle the app kept reports the popup as closed. Only
     same-origin storage survives that, so relay over every channel and let
     whichever one the browser left intact deliver the callback. */
  try {
    if (window.opener) window.opener.postMessage(message, location.origin);
  } catch {
    /* severed opener */
  }
  try {
    const channel = new BroadcastChannel("peachlet-cloud");
    channel.postMessage(message);
    channel.close();
  } catch {
    /* unsupported */
  }
  try {
    localStorage.setItem("peachlet-cloud-callback", JSON.stringify(message));
  } catch {
    /* storage blocked */
  }
  /* A window whose session history grew past the provider redirects is not
     script-closable in every browser, hence the instruction on the page. */
  setTimeout(() => window.close(), 250);
})();
