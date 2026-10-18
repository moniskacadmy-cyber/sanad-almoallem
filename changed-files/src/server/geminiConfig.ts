/**
 * Pure Gemini helpers (no SDK / express imports so they are unit-testable offline).
 *
 * thinkingConfigForModel: per Google's Gemini docs
 *   - gemini-3.1-flash-lite, gemini-3.5-flash (and 3.6): support MINIMAL thinking (fastest).
 *   - gemini-3.7-flash, gemini-3.8-flash: default to MEDIUM and do NOT support MINIMAL
 *     (MINIMAL is rejected by the API), so LOW is the fastest valid level.
 *   - any other model (Gemma, 2.5, unknown): do not send thinkingConfig at all.
 * The string values are identical to the `ThinkingLevel` enum values of @google/genai.
 */
export type ThinkingLevelName = 'MINIMAL' | 'LOW';

export function thinkingConfigForModel(
  model: string | undefined | null
): { thinkingLevel: ThinkingLevelName } | undefined {
  const m = String(model ?? '').trim().toLowerCase();
  if (m === 'gemini-3.1-flash-lite' || m === 'gemini-3.5-flash' || m === 'gemini-3.6-flash') {
    return { thinkingLevel: 'MINIMAL' };
  }
  if (m === 'gemini-3.8-flash' || m === 'gemini-3.7-flash') {
    return { thinkingLevel: 'LOW' };
  }
  return undefined;
}

/**
 * Returns a copy of a generateContent request whose `config.thinkingConfig` matches the request's
 * model. Any thinkingConfig supplied for another model is removed first, so a fallback model never
 * receives a thinking level it may not support.
 */
export function applyModelThinking<T extends { model?: string; config?: Record<string, any> | undefined }>(
  request: T
): T {
  const { thinkingConfig: _ignored, ...restConfig } = (request.config ?? {}) as Record<string, any>;
  const thinking = thinkingConfigForModel(request.model);
  return {
    ...request,
    config: thinking ? { ...restConfig, thinkingConfig: thinking } : restConfig,
  };
}

/**
 * True when an error from the Gemini API should trigger the fallback model:
 * quota (429), temporary server errors (500/502/503/504), "unavailable"/"high demand" messages,
 * and 404 / NOT_FOUND / "model not found" (a wrong or retired model name must never break the app).
 */
export function isFallbackEligibleError(error: any): boolean {
  const status = Number(error?.status ?? error?.code ?? error?.error?.code);
  const message = String(error?.message ?? '').toLowerCase();
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    status === 404 ||
    message.includes('unavailable') ||
    message.includes('high demand') ||
    message.includes('not_found') ||
    message.includes('not found') ||
    message.includes('model not found')
  );
}

export const DEFAULT_FREE_FALLBACK_MODEL = 'gemini-3.5-flash-lite';

export function resolveFallbackModel(env: Record<string, string | undefined> = process.env): string {
  return env.GEMINI_FREE_FALLBACK_MODEL?.trim() || DEFAULT_FREE_FALLBACK_MODEL;
}

export const ASSISTANT_ALLOWED_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'] as const;
