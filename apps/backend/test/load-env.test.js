"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { parseEnvLine } = require("../src/config/load-env");

test("parseEnvLine ignores comments and invalid lines", () => {
  assert.equal(parseEnvLine("# comment"), null);
  assert.equal(parseEnvLine(""), null);
  assert.equal(parseEnvLine("not-a-valid-key=value"), null);
});

test("parseEnvLine parses exported and quoted values", () => {
  assert.deepEqual(parseEnvLine("API_BASE_URL=https://api.example.com"), {
    key: "API_BASE_URL",
    value: "https://api.example.com",
  });
  assert.deepEqual(parseEnvLine("export JWT_ACCESS_SECRET='12345678901234567890123456789012'"), {
    key: "JWT_ACCESS_SECRET",
    value: "12345678901234567890123456789012",
  });
});
