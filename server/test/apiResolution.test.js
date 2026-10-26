const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

test("API Resolution Suite", async (t) => {
  const clientApiModule = await import(
    "../../client/src/services/api.js"
  );
  const {
    normalizeApiUrl,
    resolveApiRoot,
    apiUrl,
    getApiErrorMessage,
    DEFAULT_API_BASE_URL,
    DEFAULT_API_ROOT,
  } = clientApiModule;

  await t.test("1. Production default is the absolute API URL", () => {
    const url = normalizeApiUrl(undefined, false);
    assert.equal(url, "https://api.archive.innov.rw/api");
    assert.equal(url, DEFAULT_API_BASE_URL);
  });

  await t.test("2. Development uses '/api' by default", () => {
    const url = normalizeApiUrl(undefined, true);
    assert.equal(url, "/api");
  });

  await t.test("3. VITE_API_URL overrides defaults", () => {
    const prodOverride = normalizeApiUrl("https://custom.api.innov.rw/api", false);
    assert.equal(prodOverride, "https://custom.api.innov.rw/api");

    const devOverride = normalizeApiUrl("http://localhost:5077/api", true);
    assert.equal(devOverride, "http://localhost:5077/api");
  });

  await t.test("4. Trailing slashes and missing /api suffix are normalised", () => {
    const withTrailingSlash = normalizeApiUrl("https://api.archive.innov.rw/api/", false);
    assert.equal(withTrailingSlash, "https://api.archive.innov.rw/api");

    const withoutApiSuffix = normalizeApiUrl("https://api.archive.innov.rw", false);
    assert.equal(withoutApiSuffix, "https://api.archive.innov.rw/api");

    const withMultipleTrailingSlashes = normalizeApiUrl("https://api.archive.innov.rw///", false);
    assert.equal(withMultipleTrailingSlashes, "https://api.archive.innov.rw/api");
  });

  await t.test("5. API_ROOT is never empty in production", () => {
    const rootFromDefault = resolveApiRoot(DEFAULT_API_BASE_URL, false);
    assert.equal(rootFromDefault, "https://api.archive.innov.rw");
    assert.ok(rootFromDefault.length > 0);

    const rootFromRelativeInProd = resolveApiRoot("/api", false);
    assert.equal(rootFromRelativeInProd, DEFAULT_API_ROOT);
    assert.ok(rootFromRelativeInProd.length > 0);

    const rootFromDev = resolveApiRoot("/api", true);
    assert.equal(rootFromDev, "");
  });

  await t.test("6. apiUrl helper builds correct URLs", () => {
    const pathUrl = apiUrl("/papers/123/download");
    assert.ok(pathUrl.startsWith("http://") || pathUrl.startsWith("https://") || pathUrl.startsWith("/api"));

    const alreadyAbsolute = apiUrl("https://api.archive.innov.rw/api/papers/access/abc/download");
    assert.equal(alreadyAbsolute, "https://api.archive.innov.rw/api/papers/access/abc/download");
  });

  await t.test("7. getApiErrorMessage maps network errors and 405 properly", () => {
    const networkErr = { code: "ERR_NETWORK" };
    const mappedNetwork = getApiErrorMessage(networkErr);
    assert.equal(
      mappedNetwork,
      "The app could not reach the server. Please try again, and tell the administrator if it continues."
    );

    const methodNotAllowedErr = { response: { status: 405 } };
    const mapped405 = getApiErrorMessage(methodNotAllowedErr);
    assert.equal(
      mapped405,
      "The app could not reach the server. Please try again, and tell the administrator if it continues."
    );

    const customErr = { response: { status: 400, data: { error: "Custom validation failed" } } };
    const mappedCustom = getApiErrorMessage(customErr);
    assert.equal(mappedCustom, "Custom validation failed");
  });
});
