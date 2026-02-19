declare module "react-native-config" {
  interface NativeConfig {
    SUPABASE_URL?: string;
    SUPABASE_ANON_KEY?: string;
    API_BASE_URL?: string;
  }

  const Config: NativeConfig;
  export default Config;
}

