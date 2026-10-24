(() => {
  const url = location.href;
  history.replaceState(null, '', '/cloud-callback.html');
  if (window.opener) window.opener.postMessage({ type: 'peachlet-cloud-callback', url }, location.origin);
})();
