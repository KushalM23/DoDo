function getDefaultApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:4000/api';
  }
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:4000/api';
  }
  return `${window.location.protocol}//${host}:4000/api`;
}

function getOptionalEnvValue(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export const env = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || getDefaultApiBaseUrl(),
  supabaseUrl: getOptionalEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: getOptionalEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
};
