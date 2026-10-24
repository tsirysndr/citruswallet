const fs = require("fs");
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || "./google-services.json";
// Firebase clients are bound to an Android package; never bundle the old app's client.
const hasPeachletFirebase = fs.existsSync(googleServicesFile) &&
  JSON.parse(fs.readFileSync(googleServicesFile, "utf8")).client?.some(
    client => client.client_info?.android_client_info?.package_name === "app.peachlet",
  );
module.exports = {
  name: "Peachlet",
  // Retain the existing EAS project slug/ID; the display name and native package are Peachlet.
  slug: "citruswallet",
  owner: "tsirysndr",
  version: "1.0.0",
  scheme: "peachlet",
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "./assets/icon.png",
  backgroundColor: "#f7f3f0",
  newArchEnabled: true,
  ios: { bundleIdentifier: "app.peachlet", supportsTablet: true },
  android: {
    ...(hasPeachletFirebase ? { googleServicesFile } : {}),
    package: "app.peachlet",
    intentFilters: [{ action: "VIEW", autoVerify: true,
      data: [{ scheme: "https", host: "peachlet.app", path: "/invite" }],
      category: ["BROWSABLE", "DEFAULT"],
    }],
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffb995",
    },
  },
  plugins: [
    "expo-font",
    ["expo-secure-store", { faceIDPermission: "Use Face ID to unlock your Peachlet wallet." }],
    "expo-web-browser",
    ["expo-notifications", { color: "#ffb995" }],
  ],
  // Dedicated Peachlet project under the existing Expo account.
  extra: {
    eas: { projectId: "4111c93c-f70b-4ed0-b80e-efdb725dd710" },
    klipyApiKey: process.env.EXPO_PUBLIC_KLIPY_API_KEY ||
      (fs.existsSync('./klipy.config.json') ? JSON.parse(fs.readFileSync('./klipy.config.json', 'utf8')).apiKey : ''),
  },
};
