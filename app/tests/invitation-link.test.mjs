import { test } from "node:test";
import assert from "node:assert/strict";
import { invitationToken } from "../src/invitation-link.ts";
const token = "a".repeat(64);
test("accepts verified invitation URLs, legacy links and native fallback links", () => {
  for (const base of [
    "https://peachlet.app/invite",
    "https://peachlet.app/",
    "peachlet://invite",
  ])
    assert.equal(invitationToken(`${base}#invite=${token}`), token);
});
test("rejects foreign domains, malformed tokens, query secrets and OAuth callbacks", () => {
  for (const url of [
    `https://evil.test/invite#invite=${token}`,
    `https://peachlet.app.evil.test/invite#invite=${token}`,
    `http://peachlet.app/invite#invite=${token}`,
    `https://peachlet.app/invite?invite=${token}`,
    `peachlet://auth#invite=${token}`,
    `peachlet://invite#invite=${token}&invite=${token}`,
    "peachlet://invite#invite=bad",
    "not a url",
  ])
    assert.equal(invitationToken(url), null);
});
