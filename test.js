const fs = require('node:fs');
const path = require('node:path');
const { v2: cloudinary } = require('cloudinary');

const ROOT = __dirname;
const ENV_FILES = [
  path.join(ROOT, '.env.development'),
  path.join(ROOT, '.env'),
];

// Load local env files without adding another dependency to the project.
for (const envFile of ENV_FILES) {
  if (!fs.existsSync(envFile)) continue;

  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function decodeUrlPart(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getCloudinaryCredentials() {
  const cloudinaryUrl = process.env.CLOUDINARY_URL?.trim();

  if (cloudinaryUrl) {
    let parsed;
    try {
      parsed = new URL(cloudinaryUrl);
    } catch {
      throw new Error(
        'CLOUDINARY_URL is not a valid URL. Expected cloudinary://API_KEY:API_SECRET@CLOUD_NAME',
      );
    }

    if (parsed.protocol !== 'cloudinary:') {
      throw new Error('CLOUDINARY_URL must start with cloudinary://');
    }

    return {
      source: 'CLOUDINARY_URL',
      cloud_name: parsed.hostname,
      api_key: decodeUrlPart(parsed.username),
      api_secret: decodeUrlPart(parsed.password),
    };
  }

  return {
    source: 'CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET',
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
    api_key: process.env.CLOUDINARY_API_KEY?.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
  };
}

function mask(value) {
  if (!value) return '(missing)';
  return value.length <= 4
    ? '****'
    : `${value.slice(0, 2)}***${value.slice(-2)}`;
}

function sanitize(value, key = '') {
  if (value === null || value === undefined) return value;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return /secret|password|authorization/i.test(key) ? '[REDACTED]' : value;
  }
  if (Buffer.isBuffer(value)) return `[Buffer ${value.length} bytes]`;
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitize(entryValue, entryKey),
      ]),
    );
  }
  return String(value);
}

function printCloudinaryError(error, phase) {
  console.error(`\n[${phase}] Cloudinary request failed`);
  console.error(JSON.stringify(sanitize(error), null, 2));
  console.error('\nInterpretation:');
  if (error?.http_code === 401) {
    console.error('- Credentials are invalid or the API key is disabled.');
  } else if (error?.http_code === 403) {
    console.error(
      '- Credentials reached Cloudinary, but this operation/account is forbidden.',
    );
    console.error(
      '- Check upload permissions, upload preset mode, account restrictions, and quota in Dashboard.',
    );
  } else {
    console.error(
      '- Inspect the raw/response fields above and verify the Cloudinary account status.',
    );
  }
}

function uploadBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'cloudinary_diagnostic', resource_type: 'image' },
      (error, result) => (error ? reject(error) : resolve(result)),
    );
    stream.end(buffer);
  });
}

async function main() {
  const credentials = getCloudinaryCredentials();
  const missing = ['cloud_name', 'api_key', 'api_secret'].filter(
    (key) => !credentials[key],
  );

  if (missing.length) {
    throw new Error(`Missing Cloudinary setting(s): ${missing.join(', ')}`);
  }

  cloudinary.config({
    cloud_name: credentials.cloud_name,
    api_key: credentials.api_key,
    api_secret: credentials.api_secret,
  });

  console.log('Cloudinary configuration loaded:');
  console.log(`- source: ${credentials.source}`);
  console.log(`- cloud_name: ${credentials.cloud_name}`);
  console.log(`- api_key: ${mask(credentials.api_key)}`);
  console.log('- api_secret: set');

  try {
    const pingResult = await cloudinary.api.ping();
    console.log('\nAPI authentication check: OK');
    console.log(JSON.stringify(pingResult, null, 2));
  } catch (error) {
    printCloudinaryError(error, 'ping');
    process.exitCode = 2;
    return;
  }

  const imagePath = process.argv[2];
  const imageBuffer = imagePath
    ? fs.readFileSync(path.resolve(process.cwd(), imagePath))
    : Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      );

  try {
    const result = await uploadBuffer(imageBuffer);
    console.log('\nUpload check: OK');
    console.log(`- public_id: ${result.public_id}`);
    console.log(`- secure_url: ${result.secure_url}`);
  } catch (error) {
    printCloudinaryError(error, 'upload');
    process.exitCode = 3;
  }
}

main().catch((error) => {
  console.error(`\nDiagnostic could not start: ${error.message}`);
  process.exitCode = 1;
});
