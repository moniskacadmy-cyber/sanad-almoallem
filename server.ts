  if (!raw) return null;
  let str = raw.trim();
  if (!str) return null;

  // Unwrap outer quotes if wrapped
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }

  // Normalize common Vercel/JSON-stringified forms without ever logging the secret.
  // Some pasted values contain literal backslashes before every quote.
  str = str.replace(/\\"/g, '"').replace(/^\\+/, '').trim();
  if (!str.startsWith('{')) {
    const typeIndex = str.indexOf('"type"');
    if (typeIndex >= 0) str = `{${str.slice(typeIndex)}`;
  }

  // If the value still contains an escaped JSON object, unescape it and extract
  // the object from the first service-account field through its final brace.
  str = str.replace(/\\"/g, '"').trim();
  const jsonStart = str.indexOf('{');
  const typeStart = str.indexOf('"type"');
  if (jsonStart < 0 && typeStart >= 0) str = `{${str.slice(typeStart)}`;

  // Handle Base64 encoded string
  if (!str.startsWith('{') && (str.startsWith('ey') || str.includes('='))) {
    try {
      const decoded = Buffer.from(str, 'base64').toString('utf-8').trim();
      if (decoded.startsWith('{')) {
        str = decoded;
      }
    } catch (_) {}
  }

  // Extract JSON payload between first '{' and last '}' to prune trailing non-whitespace characters
  const startIdx = str.indexOf('{');
  const endIdx = str.lastIndexOf('}');
  if (startIdx !== -1 && endIdx > startIdx) {
    str = str.substring(startIdx, endIdx + 1);
  }

  try {
    let parsed = JSON.parse(str);
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    if (parsed && typeof parsed === 'object' && parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    return parsed;
  } catch (err) {
    console.warn('Could not parse FIREBASE_SERVICE_ACCOUNT JSON:', err);
    return null;
  }
}// Helper to robustly parse FIREBASE_SERVICE_ACCOUNT environment variable
function safeParseServiceAccount(raw: string | undefined): any {
  if (!raw) return null;
  let str = raw.trim();
  if (!str) return null;

  // Normalize values copied through dashboards that may have been JSON-stringified
  // one or more times. Keep escaped newlines in private_key intact.
  for (let pass = 0; pass < 3; pass += 1) {
    if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
      str = str.slice(1, -1).trim();
    }
    str = str.replace(/\\\\+"/g, '"').replace(/\\+"/g, '"').replace(/^\\+/, '').trim();
  }

  // Some values arrive without the outer object braces. Reconstruct them from
  // the first service-account field rather than depending on the original shape.
  const typeIndex = str.indexOf('"type"');
  if (!str.startsWith('{') && typeIndex >= 0) {
    str = `{${str.slice(typeIndex)}`;
  }

  // A second normalization pass handles nested JSON-stringification while
  // preserving the private-key newline escape sequence.
  const newlinePlaceholder = '__FIREBASE_ESCAPED_NEWLINE__';
  str = str.replace(/\\\\n/g, newlinePlaceholder);
  str = str.replace(/\\\\+"/g, '"').replace(/\\+"/g, '"');
  str = str.replace(/\\+/g, '');
  str = str.replace(new RegExp(newlinePlaceholder, 'g'), '\\\\n').trim();

  const normalizedTypeIndex = str.indexOf('"type"');
  if (!str.startsWith('{') && normalizedTypeIndex >= 0) {
    str = `{${str.slice(normalizedTypeIndex)}`;
  }

  // Handle Base64 encoded service-account JSON.
  if (!str.startsWith('{') && /^(?:ey|eyJ)/.test(str)) {
    try {
      const decoded = Buffer.from(str, 'base64').toString('utf-8').trim();
      if (decoded.startsWith('{')) str = decoded;
    } catch (_) {}
  }

  // Extract only the JSON object so harmless trailing characters do not break parsing.
  const startIdx = str.indexOf('{');
  const endIdx = str.lastIndexOf('}');
  if (startIdx !== -1 && endIdx > startIdx) {
    str = str.substring(startIdx, endIdx + 1);
  }

  try {
    let parsed = JSON.parse(str);
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    if (parsed && typeof parsed === 'object' && parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\\\n/g, '\\n');
    }
    if (parsed?.type !== 'service_account' || !parsed?.project_id || !parsed?.client_email || !parsed?.private_key) {
      throw new Error('Firebase service account fields are incomplete');
    }
    return parsed;
  } catch (err) {
    console.warn('Could not parse FIREBASE_SERVICE_ACCOUNT JSON:', err);
    return null;
  }
}
