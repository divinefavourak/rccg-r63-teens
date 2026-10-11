#!/usr/bin/env node
/**
 * Keeps every Android build of the app, and says which one people should get.
 *
 * Expo deletes a build's file after a while, and the address changes with each
 * build, so the website's download link kept going stale. This copies a
 * finished build into the R2 bucket the backend already uses, under
 * `apps/android/`:
 *
 *   faith-tribe-1.0.0-2.apk     one per build, never overwritten
 *   faith-tribe-latest.apk      a copy of whichever build is current
 *   versions.json               every build kept, and which one is current
 *
 * `faith-tribe-latest.apk` is the address to hand out: it never changes.
 *
 *   node scripts/release.mjs add <expo build id> [--notes "what changed"]
 *   node scripts/release.mjs promote <build number>
 *   node scripts/release.mjs list
 *
 * `add` only stores a build. Nobody is sent to it until `promote`, so a build
 * can be tried on a phone first — and an older one promoted again to go back.
 *
 * R2 settings are read from the environment, or failing that from
 * `backend/.env` (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 * R2_BUCKET_NAME, R2_PUBLIC_DOMAIN). No dependencies: requests are signed here.
 */
import { execSync } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PREFIX = 'apps/android';
const MANIFEST = `${PREFIX}/versions.json`;
const LATEST = `${PREFIX}/faith-tribe-latest.apk`;
const APK = 'application/vnd.android.package-archive';

const here = dirname(fileURLToPath(import.meta.url));

function settings() {
  const fromFile = {};
  const envFile = resolve(here, '../../backend/.env');
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*(R2_[A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (match) fromFile[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  const get = (name) => process.env[name] || fromFile[name] || '';
  const config = {
    account: get('R2_ACCOUNT_ID'),
    keyId: get('R2_ACCESS_KEY_ID'),
    secret: get('R2_SECRET_ACCESS_KEY'),
    bucket: get('R2_BUCKET_NAME'),
    publicBase: get('R2_PUBLIC_DOMAIN').replace(/\/+$/, ''),
  };
  const missing = Object.entries(config).filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) fail(`R2 is not set up here: missing ${missing.join(', ')}.`);
  if (!/^https?:\/\//.test(config.publicBase)) config.publicBase = `https://${config.publicBase}`;
  return config;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();

/** One signed request to the bucket (AWS Signature Version 4, which R2 speaks). */
async function r2(config, method, key, { body, headers = {} } = {}) {
  const host = `${config.account}.r2.cloudflarestorage.com`;
  const path = `/${config.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
  const stamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = stamp.slice(0, 8);
  const payloadHash = sha256(body ?? '');

  const signed = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': stamp };
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase().startsWith('x-amz-')) signed[name.toLowerCase()] = value;
  }
  const names = Object.keys(signed).sort();
  const canonical = [
    method,
    path,
    '',
    ...names.map((name) => `${name}:${signed[name]}`),
    '',
    names.join(';'),
    payloadHash,
  ].join('\n');
  const scope = `${day}/auto/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', stamp, scope, sha256(canonical)].join('\n');
  const key4 = ['auto', 's3', 'aws4_request'].reduce(hmac, hmac(`AWS4${config.secret}`, day));
  const signature = createHmac('sha256', key4).update(toSign).digest('hex');

  return fetch(`https://${host}${path}`, {
    method,
    body,
    headers: {
      ...headers,
      ...signed,
      authorization: `AWS4-HMAC-SHA256 Credential=${config.keyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`,
    },
  });
}

async function expectOk(response, what) {
  if (!response.ok) fail(`${what} failed: ${response.status} ${(await response.text()).slice(0, 300)}`);
}

async function readManifest(config) {
  const response = await r2(config, 'GET', MANIFEST);
  if (response.status === 404) return { current: null, builds: [] };
  await expectOk(response, 'Reading versions.json');
  return response.json();
}

async function writeManifest(config, manifest) {
  const response = await r2(config, 'PUT', MANIFEST, {
    body: Buffer.from(JSON.stringify(manifest, null, 2)),
    // Short-lived: this is the file that changes.
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' },
  });
  await expectOk(response, 'Writing versions.json');
}

async function add(config, buildId, notes) {
  if (!buildId) fail('Which build? node scripts/release.mjs add <expo build id>');
  const build = JSON.parse(
    execSync(`npx eas-cli build:view ${buildId} --json`, {
      cwd: resolve(here, '..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }),
  );
  if (build.platform !== 'ANDROID') fail(`Build ${buildId} is ${build.platform}, not Android.`);
  if (build.status !== 'FINISHED') fail(`Build ${buildId} is ${build.status}. Wait for it to finish.`);
  const source = build.artifacts?.buildUrl;
  if (!source?.endsWith('.apk')) fail(`Build ${buildId} did not produce an .apk (${source ?? 'no file'}).`);

  const number = Number(build.appBuildVersion);
  const manifest = await readManifest(config);
  if (manifest.builds.some((entry) => entry.build === number)) {
    fail(`Build ${number} is already stored. Builds are never overwritten.`);
  }

  console.log(`Downloading ${build.appVersion} (${number}) from Expo…`);
  const download = await fetch(source);
  await expectOk(download, 'Downloading the build');
  const file = Buffer.from(await download.arrayBuffer());

  const name = `faith-tribe-${build.appVersion}-${number}.apk`;
  console.log(`Storing ${name} (${(file.length / 1048576).toFixed(1)} MB)…`);
  const upload = await r2(config, 'PUT', `${PREFIX}/${name}`, {
    body: file,
    headers: {
      'content-type': APK,
      'content-disposition': `attachment; filename="${name}"`,
      // A build's file never changes, so it can be cached for good.
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
  await expectOk(upload, 'Storing the build');

  manifest.builds.push({
    version: build.appVersion,
    build: number,
    profile: build.buildProfile,
    file: name,
    url: `${config.publicBase}/${PREFIX}/${name}`,
    size: file.length,
    sha256: sha256(file),
    commit: build.gitCommitHash ?? null,
    builtAt: build.completedAt ?? build.createdAt,
    expoBuildId: build.id,
    notes: notes ?? '',
  });
  manifest.builds.sort((a, b) => b.build - a.build);
  await writeManifest(config, manifest);
  console.log(`Stored: ${config.publicBase}/${PREFIX}/${name}`);
  console.log(`Not current yet. When it has been tried: node scripts/release.mjs promote ${number}`);
}

async function promote(config, which) {
  const number = Number(which);
  const manifest = await readManifest(config);
  const entry = manifest.builds.find((candidate) => candidate.build === number);
  if (!entry) fail(`No stored build ${which}. See: node scripts/release.mjs list`);

  // Copied inside the bucket, so the file is not downloaded and sent back.
  const copy = await r2(config, 'PUT', LATEST, {
    headers: {
      'x-amz-copy-source': `/${config.bucket}/${PREFIX}/${entry.file}`,
      'x-amz-metadata-directive': 'REPLACE',
      'content-type': APK,
      'content-disposition': 'attachment; filename="faith-tribe.apk"',
      // The one address that is reused, so it must not be held on to.
      'cache-control': 'public, max-age=300',
    },
  });
  await expectOk(copy, 'Making the build current');

  manifest.current = number;
  manifest.currentUrl = `${config.publicBase}/${LATEST}`;
  manifest.promotedAt = new Date().toISOString();
  await writeManifest(config, manifest);
  console.log(`Current build is now ${entry.version} (${number}).`);
  console.log(`Download address: ${manifest.currentUrl}`);
}

async function list(config) {
  const manifest = await readManifest(config);
  if (!manifest.builds.length) return console.log('No builds stored yet.');
  for (const entry of manifest.builds) {
    const mark = entry.build === manifest.current ? '* ' : '  ';
    const size = `${(entry.size / 1048576).toFixed(1)} MB`;
    console.log(`${mark}${entry.version} (${entry.build})  ${entry.builtAt.slice(0, 10)}  ${size}  ${entry.notes}`);
    console.log(`    ${entry.url}`);
  }
  console.log(manifest.current ? `\n* current: ${manifest.currentUrl}` : '\nNo build is current yet.');
}

const [command, ...rest] = process.argv.slice(2);
const flag = rest.indexOf('--notes');
const notes = flag >= 0 ? rest[flag + 1] : undefined;
const config = settings();

if (command === 'add') await add(config, rest[0], notes);
else if (command === 'promote') await promote(config, rest[0]);
else if (command === 'list') await list(config);
else fail('Usage: node scripts/release.mjs add <expo build id> [--notes "…"] | promote <build number> | list');
