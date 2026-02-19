import Config from "react-native-config";

const SUPABASE_URL = Config.SUPABASE_URL;
const SUPABASE_ANON_KEY = Config.SUPABASE_ANON_KEY;
const API_BASE_URL = Config.API_BASE_URL ?? "http://10.0.2.2:4000/api";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_ANON_KEY. Configure env values with your React Native env strategy.",
  );
}

export const env = {
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  apiBaseUrl: API_BASE_URL,
};
