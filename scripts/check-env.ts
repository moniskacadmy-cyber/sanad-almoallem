import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
dotenv.config();

export const REQUIRED_FIREBASE_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_VAPID_KEY',
  'FIREBASE_SERVICE_ACCOUNT',
] as const;

export interface ValidationResult {
  isValid: boolean;
  missing: string[];
}

export function validateEnvironment(env: Record<string, string | undefined> = process.env): ValidationResult {
  const missing: string[] = [];
  for (const varName of REQUIRED_FIREBASE_VARS) {
    const val = env[varName];
    if (!val || typeof val !== 'string' || !val.trim()) {
      missing.push(varName);
    }
  }
  return {
    isValid: missing.length === 0,
    missing,
  };
}

export function runCheck(): void {
  const result = validateEnvironment(process.env);
  if (!result.isValid) {
    // Print ONLY the names of the missing variables as required
    for (const name of result.missing) {
      console.error(name);
    }
    // Fail build if running in Vercel or in strict mode
    if (process.env.VERCEL || process.env.STRICT_CHECK === 'true') {
      process.exit(1);
    }
  }
}

// Auto-run when executed directly
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runCheck();
}
