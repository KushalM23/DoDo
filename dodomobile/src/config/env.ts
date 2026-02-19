import Config from "react-native-config";

const defaultApiBaseUrl = "http://localhost:4000/api";

export const env = {
  apiBaseUrl: Config.API_BASE_URL || defaultApiBaseUrl,
};
