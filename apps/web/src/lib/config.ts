/** Centralized frontend configuration (env-driven, typed). */
export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? '/api/backend',
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'CE Board Master',
} as const;
