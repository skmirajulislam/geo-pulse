const crypto = require("crypto");
const stringSimilarity = require("string-similarity");

const TRACKING_QUERY_PREFIXES = ["utm_", "ref", "fbclid", "gclid", "msclkid"];

const normalizeTitle = (title = "") =>
  String(title)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const canonicalizeUrl = (rawUrl = "") => {
  if (!rawUrl) return "";

  try {
    const parsed = new URL(rawUrl);
    parsed.hash = "";
    parsed.hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();

    const params = [...parsed.searchParams.entries()]
      .filter(([key]) => !TRACKING_QUERY_PREFIXES.some((prefix) => key.toLowerCase().startsWith(prefix)))
      .sort(([a], [b]) => a.localeCompare(b));

    parsed.search = "";
    for (const [key, value] of params) parsed.searchParams.append(key, value);

    const pathname = parsed.pathname.replace(/\/+$/, "");
    parsed.pathname = pathname || "/";

    return parsed.toString();
  } catch {
    return String(rawUrl).trim();
  }
};

const digest = (value) =>
  crypto.createHash("sha1").update(value).digest("hex");

const buildEventIdentity = (event = {}) => {
  const canonicalUrl = canonicalizeUrl(
    event.canonical_url || event.source_url || event.sources?.[0]?.url || event.url || ""
  );
  const normalizedTitle = normalizeTitle(event.title || "");
  const country = String(event.country || "global").toLowerCase().trim();
  const type = String(event.type || event.event_type || "other").toLowerCase().trim();
  const titleTokens = normalizedTitle.split(" ").filter(Boolean);

  const strictFingerprint = digest(`${country}|${type}|${normalizedTitle}`);
  const coarseFingerprint = digest(
    `${country}|${type}|${titleTokens.slice(0, 12).join(" ")}`
  );

  return {
    canonicalUrl,
    normalizedTitle,
    strictFingerprint,
    coarseFingerprint,
    country,
    type,
    timestamp: event.timestamp || event.published_at || null,
  };
};

const isLikelyDuplicate = (incomingIdentity, existingIdentity) => {
  if (!incomingIdentity || !existingIdentity) return false;

  if (
    incomingIdentity.canonicalUrl &&
    existingIdentity.canonicalUrl &&
    incomingIdentity.canonicalUrl === existingIdentity.canonicalUrl
  ) {
    return true;
  }

  if (
    incomingIdentity.strictFingerprint &&
    existingIdentity.strictFingerprint &&
    incomingIdentity.strictFingerprint === existingIdentity.strictFingerprint
  ) {
    return true;
  }

  if (
    incomingIdentity.country !== existingIdentity.country ||
    incomingIdentity.type !== existingIdentity.type
  ) {
    return false;
  }

  const incomingTitle = incomingIdentity.normalizedTitle || "";
  const existingTitle = existingIdentity.normalizedTitle || "";
  if (!incomingTitle || !existingTitle) return false;

  const similarity = stringSimilarity.compareTwoStrings(incomingTitle, existingTitle);
  if (similarity < 0.88) return false;

  if (!incomingIdentity.timestamp || !existingIdentity.timestamp) return true;

  const hoursDiff =
    Math.abs(new Date(incomingIdentity.timestamp) - new Date(existingIdentity.timestamp)) /
    (1000 * 60 * 60);

  return hoursDiff <= 24;
};

module.exports = {
  buildEventIdentity,
  canonicalizeUrl,
  normalizeTitle,
  isLikelyDuplicate,
};
