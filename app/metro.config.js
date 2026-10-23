const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");
const config = getDefaultConfig(__dirname);
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "ws")
    return {
      type: "sourceFile",
      filePath: path.resolve(__dirname, "src/native-websocket.js"),
    };
  return context.resolveRequest(context, moduleName, platform);
};
const empty = path.resolve(__dirname, "src/empty-module.js");
config.resolver.extraNodeModules = {
  stream: require.resolve("readable-stream"),
  ...Object.fromEntries(
    [
      "crypto",
      "http",
      "https",
      "net",
      "tls",
      "zlib",
      "os",
      "dns",
      "assert",
      "url",
      "path",
      "fs",
    ].map((name) => [name, empty]),
  ),
};
module.exports = withNativeWind(config, { input: "./global.css" });
