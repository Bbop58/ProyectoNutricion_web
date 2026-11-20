declare global {
  interface Window {
    __NUTRISALUD_CONFIG__?: {
      apiUrl?: string;
    };
  }
}

export function resolveApiUrl(fallback: string): string {
  if (typeof window === 'undefined') return fallback;

  const configuredUrl = window.__NUTRISALUD_CONFIG__?.apiUrl?.trim();
  return configuredUrl || fallback;
}
