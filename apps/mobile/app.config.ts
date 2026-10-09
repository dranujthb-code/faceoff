import type { ExpoConfig } from "expo/config";

/**
 * EXPO_PUBLIC_API_URL points the app at a FaceOff API (the Next.js server).
 * Bundle identifiers are placeholders until the Apple/Google developer accounts exist.
 */
const config: ExpoConfig = {
  name: "FaceOff",
  slug: "faceoff",
  scheme: "faceoff",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  splash: { image: "./assets/splash-icon.png", resizeMode: "contain", backgroundColor: "#F3ECDF" },
  ios: {
    bundleIdentifier: process.env.IOS_BUNDLE_ID ?? "app.faceoff.mobile",
    supportsTablet: true,
    infoPlist: {
      NSCameraUsageDescription: "FaceOff uses your camera so your opponent and audience can see you during a live debate.",
      NSMicrophoneUsageDescription: "FaceOff uses your microphone so you can be heard during a live debate.",
      NSPhotoLibraryUsageDescription: "Choose a profile picture for your FaceOff Wall.",
      UIBackgroundModes: ["audio"],
    },
  },
  android: {
    package: process.env.ANDROID_PACKAGE ?? "app.faceoff.mobile",
    adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#F3ECDF" },
    permissions: ["android.permission.CAMERA", "android.permission.RECORD_AUDIO", "android.permission.MODIFY_AUDIO_SETTINGS", "android.permission.BLUETOOTH_CONNECT"],
    edgeToEdgeEnabled: true,
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-font",
    "@livekit/react-native-expo-plugin",
    [
      "@config-plugins/react-native-webrtc",
      {
        cameraPermission: "FaceOff uses your camera so your opponent and audience can see you during a live debate.",
        microphonePermission: "FaceOff uses your microphone so you can be heard during a live debate.",
      },
    ],
    ["expo-image-picker", { photosPermission: "Choose a profile picture for your FaceOff Wall." }],
    ["expo-notifications", { icon: "./assets/notification-icon.png", color: "#C93B35" }],
    ["expo-build-properties", { android: { minSdkVersion: 24 } }],
    ["expo-splash-screen", { image: "./assets/splash-icon.png", backgroundColor: "#F3ECDF", imageWidth: 180, dark: { backgroundColor: "#161B20" } }],
  ],
  experiments: { typedRoutes: false },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000",
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
};

export default config;
