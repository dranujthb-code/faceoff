import { NativeModules } from "react-native";

/**
 * Registers LiveKit's WebRTC globals. Requires a development/production build that includes
 * the native WebRTC module (EAS build or `expo run:*`); Expo Go doesn't ship it, so we skip
 * registration there and the debate room explains that video needs the full app build.
 */
export let liveKitAvailable = false;

export function setupLiveKit() {
  if (!NativeModules.WebRTCModule) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { registerGlobals } = require("@livekit/react-native") as typeof import("@livekit/react-native");
    registerGlobals();
    liveKitAvailable = true;
  } catch {
    liveKitAvailable = false;
  }
}
