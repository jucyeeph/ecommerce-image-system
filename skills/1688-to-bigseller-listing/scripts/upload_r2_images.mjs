#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const result = { dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") result.dryRun = true;
    else if (arg === "--env") result.envPath = argv[++index];
    else if (arg === "--manifest") result.manifestPath = argv[++index];
    else if (arg === "--output") result.outputPath = argv[++index];
    else if (arg === "--help" || arg === "-h") result.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return result;
}

function printHelp() {
  console.log("Usage: node upload_r2_images.mjs --env <.env> --manifest <input.json> --output <output.json> [--dry-run]");
}

function parseEnv(text) {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function sha256(data, encoding = "hex") {
  return crypto.createHash("sha256").update(data).digest(encoding);
}

function hmac(key, data, encoding) {
  return crypto.createHmac("sha256", key).update(data).digest(encoding);
}

function encodeKey(key) {
  return key.split("/").map(encodeURIComponent).join("/");
}

function publicUrl(base, key) {
  return `${base.replace(/\/+$/, "")}/${encodeKey(key)}`;
}

function contentType(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  throw new Error(`Unsupported image type: ${fileName}`);
}

function validateConfig(env) {
  const required = ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ACCOUNT_ID", "R2_BUCKET", "R2_PUBLIC_BASE_URL"];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing R2 configuration: ${missing.join(", ")}`);
  const base = new URL(env.R2_PUBLIC_BASE_URL);
  if (base.protocol !== "https:") throw new Error("R2_PUBLIC_BASE_URL must use HTTPS");
  if (base.hostname.endsWith(".r2.cloudflarestorage.com")) {
    throw new Error("R2_PUBLIC_BASE_URL is an authenticated S3 endpoint; use an r2.dev URL or custom domain");
  }
}

async function validateManifest(manifest) {
  if (!manifest.object_prefix || !Array.isArray(manifest.images)) throw new Error("Manifest requires object_prefix and images[]");
  const main = manifest.images.filter((item) => item.role === "main");
  const details = manifest.images.filter((item) => item.role === "detail");
  const skus = manifest.images.filter((item) => item.role === "sku");
  if (main.length !== 1) throw new Error(`Manifest must contain exactly 1 main image; found ${main.length}`);
  if (details.length !== 8) throw new Error(`Manifest must contain exactly 8 detail images; found ${details.length}`);
  if (!skus.length) throw new Error("Manifest must contain at least 1 SKU image");
  const detailPositions = new Set(details.map((item) => Number(item.position)));
  if (detailPositions.size !== 8 || [...detailPositions].some((value) => value < 1 || value > 8)) {
    throw new Error("Detail positions must be unique integers 1 through 8");
  }
  const skuIds = skus.map((item) => String(item.sku || "").trim());
  if (skuIds.some((value) => !value) || new Set(skuIds).size !== skuIds.length) {
    throw new Error("Every SKU image must have a unique non-empty sku value");
  }
  const names = new Set();
  for (const item of manifest.images) {
    if (!item.file_path || !item.file_name) throw new Error("Every image requires file_path and file_name");
    if (names.has(item.file_name)) throw new Error(`Duplicate public file_name: ${item.file_name}`);
    names.add(item.file_name);
    contentType(item.file_name);
    const stats = await fs.stat(item.file_path);
    if (!stats.isFile() || stats.size === 0) throw new Error(`Invalid image file: ${item.file_path}`);
  }
}

async function mapConcurrent(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, run));
  return results;
}

async function putObject(env, item, key) {
  const payload = await fs.readFile(item.file_path);
  const payloadHash = sha256(payload);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const host = `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${encodeURIComponent(env.R2_BUCKET)}/${encodeKey(key)}`;
  const mime = contentType(item.file_name);
  const canonicalHeaders = `content-type:${mime}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["PUT", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");
  const kDate = hmac(`AWS4${env.R2_SECRET_ACCESS_KEY}`, dateStamp);
  const kRegion = hmac(kDate, "auto");
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmac(kSigning, stringToSign, "hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${env.R2_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const response = await fetch(`https://${host}${canonicalUri}`, {
    method: "PUT",
    headers: {
      Authorization: authorization,
      "Content-Type": mime,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
    body: payload,
  });
  if (!response.ok) throw new Error(`Upload failed for ${item.file_name}: HTTP ${response.status}`);
  return { ...item, key, bytes: payload.length, content_type: mime, url: publicUrl(env.R2_PUBLIC_BASE_URL, key) };
}

async function verifyPublic(item) {
  const response = await fetch(item.url, { method: "HEAD", redirect: "follow" });
  if (!response.ok) throw new Error(`Public verification failed for ${item.file_name}: HTTP ${response.status}`);
  return { ...item, public_status: response.status };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (!args.envPath || !args.manifestPath || (!args.outputPath && !args.dryRun)) {
    printHelp();
    throw new Error("Missing required arguments");
  }
  const [envText, manifestText] = await Promise.all([
    fs.readFile(path.resolve(args.envPath), "utf8"),
    fs.readFile(path.resolve(args.manifestPath), "utf8"),
  ]);
  const env = parseEnv(envText);
  const manifest = JSON.parse(manifestText);
  validateConfig(env);
  await validateManifest(manifest);

  const items = manifest.images.map((item) => ({
    ...item,
    key: `${String(manifest.object_prefix).replace(/^\/+|\/+$/g, "")}/${item.file_name}`,
  }));
  if (args.dryRun) {
    console.log(`DRY_RUN valid images=${items.length} main=1 detail=8 sku=${items.length - 9}`);
    return;
  }

  const uploaded = await mapConcurrent(items, 4, async (item, index) => {
    const result = await putObject(env, item, item.key);
    console.log(`UPLOADED ${index + 1}/${items.length} ${item.file_name}`);
    return result;
  });
  const verified = await mapConcurrent(uploaded, 6, verifyPublic);
  const mainImage = verified.find((item) => item.role === "main");
  const detailImages = verified.filter((item) => item.role === "detail").sort((a, b) => Number(a.position) - Number(b.position));
  const skuImages = verified.filter((item) => item.role === "sku");
  const output = {
    provider: "Cloudflare R2",
    bucket: env.R2_BUCKET,
    public_base_url: env.R2_PUBLIC_BASE_URL,
    object_prefix: manifest.object_prefix,
    uploaded_at: new Date().toISOString(),
    main: [mainImage.url],
    detail: detailImages.map((item) => item.url),
    skus: Object.fromEntries(skuImages.map((item) => [item.sku, item.url])),
    objects: verified,
  };
  const outputPath = path.resolve(args.outputPath);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`COMPLETE images=${verified.length} output=${outputPath}`);
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
