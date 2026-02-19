import Config from "react-native-config";
import { NativeModules, Platform } from "react-native";

function getDevMachineHost(): string | null {
  const scriptURL = NativeModules?.SourceCode?.scriptURL as string | undefined;
  if (!scriptURL) return null;

  const match = scriptURL.match(/^https?:\/\/([^/:]+)(?::\d+)?\//i);
  return match?.[1] ?? null;
}

function getDefaultApiBaseUrl(): string {
  // Prefer Metro host in dev so real devices hit the same machine running Metro/backend.
  const metroHost = getDevMachineHost();
  if (metroHost) {
    return `http://${metroHost}:4000/api`;
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:4000/api";
  }

  return "http://localhost:4000/api";
}

export const env = {
  apiBaseUrl: Config.API_BASE_URL || getDefaultApiBaseUrl(),
};
