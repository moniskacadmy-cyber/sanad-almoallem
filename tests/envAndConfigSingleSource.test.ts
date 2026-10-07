import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { validateEnvironment } from '../scripts/check-env.js';

test('environment validator: detects missing required Vercel variables and returns exact missing names', () => {
  // Empty environment
  const emptyResult = validateEnvironment({});
  assert.equal(emptyResult.isValid, false);
  assert.ok(emptyResult.missing.includes('VITE_FIREBASE_API_KEY'));
  assert.ok(emptyResult.missing.includes('VITE_FIREBASE_AUTH_DOMAIN'));
  assert.ok(emptyResult.missing.includes('VITE_FIREBASE_PROJECT_ID'));
  assert.ok(emptyResult.missing.includes('VITE_FIREBASE_STORAGE_BUCKET'));
  assert.ok(emptyResult.missing.includes('VITE_FIREBASE_MESSAGING_SENDER_ID'));
  assert.ok(emptyResult.missing.includes('VITE_FIREBASE_APP_ID'));
  assert.ok(emptyResult.missing.includes('VITE_FIREBASE_VAPID_KEY'));
  assert.ok(emptyResult.missing.includes('FIREBASE_SERVICE_ACCOUNT'));

  // Missing only VAPID key
  const missingVapid = validateEnvironment({
    VITE_FIREBASE_API_KEY: 'key',
    VITE_FIREBASE_AUTH_DOMAIN: 'auth',
    VITE_FIREBASE_PROJECT_ID: 'sanad-1464f',
    VITE_FIREBASE_STORAGE_BUCKET: 'bucket',
    VITE_FIREBASE_MESSAGING_SENDER_ID: '123',
    VITE_FIREBASE_APP_ID: 'app',
    FIREBASE_SERVICE_ACCOUNT: '{"project_id":"sanad-1464f"}',
  });
  assert.equal(missingVapid.isValid, false);
  assert.deepEqual(missingVapid.missing, ['VITE_FIREBASE_VAPID_KEY']);

  // Missing only service account
  const missingServiceAccount = validateEnvironment({
    VITE_FIREBASE_API_KEY: 'key',
    VITE_FIREBASE_AUTH_DOMAIN: 'auth',
    VITE_FIREBASE_PROJECT_ID: 'sanad-1464f',
    VITE_FIREBASE_STORAGE_BUCKET: 'bucket',
    VITE_FIREBASE_MESSAGING_SENDER_ID: '123',
    VITE_FIREBASE_APP_ID: 'app',
    VITE_FIREBASE_VAPID_KEY: 'vapid_key_123',
  });
  assert.equal(missingServiceAccount.isValid, false);
  assert.deepEqual(missingServiceAccount.missing, ['FIREBASE_SERVICE_ACCOUNT']);

  // Complete environment
  const complete = validateEnvironment({
    VITE_FIREBASE_API_KEY: 'key',
    VITE_FIREBASE_AUTH_DOMAIN: 'auth',
    VITE_FIREBASE_PROJECT_ID: 'sanad-1464f',
    VITE_FIREBASE_STORAGE_BUCKET: 'bucket',
    VITE_FIREBASE_MESSAGING_SENDER_ID: '123',
    VITE_FIREBASE_APP_ID: 'app',
    VITE_FIREBASE_VAPID_KEY: 'vapid_key_123',
    FIREBASE_SERVICE_ACCOUNT: '{"project_id":"sanad-1464f"}',
  });
  assert.equal(complete.isValid, true);
  assert.deepEqual(complete.missing, []);
});

test('security & single source: public/firebase-messaging-sw.js does not contain hardcoded legacy AI Studio credentials', () => {
  const swContent = fs.readFileSync(path.resolve(process.cwd(), 'public/firebase-messaging-sw.js'), 'utf8');
  assert.equal(swContent.includes('gen-lang-client-0886550561'), false, 'Service worker must not contain hardcoded gen-lang-client project ID');
  assert.equal(swContent.includes('AIzaSyCW-2H9dXUvJEpWKs9x1Cr7ME9gqV3uZMk'), false, 'Service worker must not contain hardcoded API key');
});

test('security & single source: src/firebase.ts does not depend on firebase-applet-config.json', () => {
  const clientFirebaseContent = fs.readFileSync(path.resolve(process.cwd(), 'src/firebase.ts'), 'utf8');
  assert.equal(clientFirebaseContent.includes('firebase-applet-config.json'), false, 'src/firebase.ts must not import firebase-applet-config.json');
});

test('security & single source: server.ts does not depend on firebase-applet-config.json', () => {
  const serverContent = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');
  assert.equal(serverContent.includes('firebase-applet-config.json'), false, 'server.ts must not depend on firebase-applet-config.json');
});
