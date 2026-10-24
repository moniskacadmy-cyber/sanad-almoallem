import test from 'node:test';
import assert from 'node:assert/strict';
import {
  thinkingConfigForModel,
  applyModelThinking,
  isFallbackEligibleError,
  resolveFallbackModel,
  ASSISTANT_ALLOWED_MODELS,
} from '../src/server/geminiConfig';

test('thinkingConfigForModel: MINIMAL for 3.1-flash-lite / 3.5-flash / 3.6-flash', () => {
  for (const m of ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.6-flash']) {
    assert.deepEqual(thinkingConfigForModel(m), { thinkingLevel: 'MINIMAL' }, m);
  }
});

test('thinkingConfigForModel: LOW (never MINIMAL) for 3.7 / 3.8 flash', () => {
  for (const m of ['gemini-3.8-flash', 'gemini-3.7-flash']) {
    assert.deepEqual(thinkingConfigForModel(m), { thinkingLevel: 'LOW' }, m);
  }
});

test('thinkingConfigForModel: nothing for other / unknown / empty models', () => {
  for (const m of ['gemini-2.5-flash', 'gemma-4-26b-a4b-it', 'gemini-3.5-flash-lite', 'whatever', '', undefined, null]) {
    assert.equal(thinkingConfigForModel(m as any), undefined, String(m));
  }
});

test('every allowed assistant model has a thinking config (so none runs at the slow default)', () => {
  for (const m of ASSISTANT_ALLOWED_MODELS) assert.ok(thinkingConfigForModel(m), m);
  assert.ok(!(ASSISTANT_ALLOWED_MODELS as readonly string[]).includes('gemini-4-argon'));
});

test('applyModelThinking sets the level for the request model and keeps other config', () => {
  const out = applyModelThinking({
    model: 'gemini-3.8-flash',
    contents: 'x',
    config: { systemInstruction: 'sys', maxOutputTokens: 1024 },
  } as any);
  assert.deepEqual((out as any).config, {
    systemInstruction: 'sys',
    maxOutputTokens: 1024,
    thinkingConfig: { thinkingLevel: 'LOW' },
  });
  assert.equal((out as any).contents, 'x');
});

test('applyModelThinking drops a stale thinkingConfig when the model has no mapping (fallback safety)', () => {
  const out = applyModelThinking({
    model: 'gemma-4-26b-a4b-it',
    config: { systemInstruction: 'sys', thinkingConfig: { thinkingLevel: 'MINIMAL' } },
  } as any);
  assert.deepEqual((out as any).config, { systemInstruction: 'sys' });
});

test('applyModelThinking works when no config was supplied and does not mutate its input', () => {
  const input: any = { model: 'gemini-3.1-flash-lite', contents: 'x' };
  const out: any = applyModelThinking(input);
  assert.deepEqual(out.config, { thinkingConfig: { thinkingLevel: 'MINIMAL' } });
  assert.equal(input.config, undefined);
});

test('isFallbackEligibleError: 404 / NOT_FOUND / model not found / quota / 5xx -> fallback', () => {
  assert.equal(isFallbackEligibleError({ status: 404 }), true);
  assert.equal(isFallbackEligibleError({ code: 404 }), true);
  assert.equal(isFallbackEligibleError({ message: 'models/foo is not found for API version v1beta' }), true);
  assert.equal(isFallbackEligibleError({ message: '{"error":{"status":"NOT_FOUND"}}' }), true);
  for (const status of [429, 500, 502, 503, 504]) assert.equal(isFallbackEligibleError({ status }), true, String(status));
  assert.equal(isFallbackEligibleError({ message: 'The model is overloaded. high demand' }), true);
});

test('isFallbackEligibleError: 400 / 401 / 403 / plain errors -> NO fallback', () => {
  for (const status of [400, 401, 403]) assert.equal(isFallbackEligibleError({ status }), false, String(status));
  assert.equal(isFallbackEligibleError(new Error('invalid argument')), false);
  assert.equal(isFallbackEligibleError(undefined), false);
});

test('resolveFallbackModel: env override, otherwise gemini-3.5-flash-lite (not Gemma)', () => {
  assert.equal(resolveFallbackModel({}), 'gemini-3.5-flash-lite');
  assert.equal(resolveFallbackModel({ GEMINI_FREE_FALLBACK_MODEL: '  ' }), 'gemini-3.5-flash-lite');
  assert.equal(resolveFallbackModel({ GEMINI_FREE_FALLBACK_MODEL: 'my-model' }), 'my-model');
});
