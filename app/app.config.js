const fs = require("fs");
module.exports = {
  name: "Citrus Wallet",
  slug: "citruswallet",
  owner: "tsirysndr",
  version: "1.0.0",
  scheme: "citruswallet",
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "./assets/icon.png",
  backgroundColor: "#f2f1ed",
  newArchEnabled: true,
  ios: { bundleIdentifier: "app.citruswallet", supportsTablet: true },
  android: {
    ...(process.env.GOOGLE_SERVICES_JSON ||
    fs.existsSync("./google-services.json")
      ? {
          googleServicesFile:
            process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
        }
      : {}),
    package: "app.citruswallet",
    intentFilters: [{ action: "VIEW", autoVerify: true,
      data: [{ scheme: "https", host: "citruswallet.app", path: "/invite" }],
      category: ["BROWSABLE", "DEFAULT"],
    }],
    adaptiveIcon: {
      foregroundImage: "./assets/icon.png",
      backgroundColor: "#f2f1ed",
    },
  },
  plugins: [
    "expo-font",
    "expo-secure-store",
    "expo-web-browser",
    ["expo-notifications", { color: "#c5f277" }],
  ],
  // Dedicated Citrus Wallet project under the existing Expo account.
  extra: {
    eas: { projectId: "4111c93c-f70b-4ed0-b80e-efdb725dd710" },
    klipyApiKey: process.env.EXPO_PUBLIC_KLIPY_API_KEY ||
      (fs.existsSync('./klipy.config.json') ? JSON.parse(fs.readFileSync('./klipy.config.json', 'utf8')).apiKey : ''),
  },
};
