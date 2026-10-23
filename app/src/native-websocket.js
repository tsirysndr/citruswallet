// MetaMask relay uses React Native’s WebSocket, never the Node ws implementation.
module.exports = globalThis.WebSocket;
module.exports.default = globalThis.WebSocket;
