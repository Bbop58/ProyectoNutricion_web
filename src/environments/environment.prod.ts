import { resolveApiUrl } from './runtime-config';

export const environment = {
  production: true,
  apiUrl: resolveApiUrl(''),
};

