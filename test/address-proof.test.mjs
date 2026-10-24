import { test } from "node:test";
import assert from "node:assert/strict";
import { privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";
import {
  AddressProofError,
  addressRecordKey,
  verifyAddressProof,
} from "@peachlet/wallet-core";

const did = "did:plc:2bbbbbbbbbbbbbbbbbbbbbbb";
const origin = "https://peachlet.app";
const chainId = 1;
const owner = privateKeyToAccount(`0x${"11".repeat(32)}`);
const stranger = privateKeyToAccount(`0x${"22".repeat(32)}`);

function message(overrides = {}) {
  return createSiweMessage({
    domain: "peachlet.app",
    address: owner.address,
    chainId,
    uri: `${origin}/wallet-link`,
    version: "1",
    nonce: "0123456789abcdef01234567",
    issuedAt: new Date("2026-10-01T00:00:00.000Z"),
    expirationTime: new Date("2026-10-01T00:10:00.000Z"),
    statement: `Link this wallet to AT Protocol account ${did}. This does not authorize transactions.`,
    resources: [did],
    ...overrides,
  });
}

async function record(overrides = {}, signer = owner) {
  const text = overrides.message ?? message();
  return {
    $type: "app.peachlet.address",
    chain: `eip155:${chainId}`,
    address: owner.address.toLowerCase(),
    message: text,
    signature: await signer.signMessage({ message: text }),
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

/* Only the recipient's own repository and the identity directory are read: the
   stub fails the test if anything else is requested. */
function directory({ document, value, uri, status = 200 } = {}) {
  const rkey = addressRecordKey(chainId, owner.address);
  return async (url) => {
    const target = String(url);
    if (target === `https://plc.directory/${did}`)
      return reply(
        document ?? {
          id: did,
          alsoKnownAs: ["at://alice.test"],
          service: [
            {
              id: "#atproto_pds",
              type: "AtprotoPersonalDataServer",
              serviceEndpoint: "https://pds.example",
            },
          ],
        },
      );
    if (
      target ===
      `https://pds.example/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}` +
        `&collection=app.peachlet.address&rkey=${encodeURIComponent(rkey)}`
    )
      return status === 200
        ? reply({
            uri: uri ?? `at://${did}/app.peachlet.address/${rkey}`,
            value,
          })
        : reply({ error: "RecordNotFound" }, status);
    throw new Error(`unexpected request: ${target}`);
  };
}

const reply = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body),
});

const request = (handle = "alice.test") => ({
  did,
  address: owner.address,
  chainId,
  origin,
  handle,
});

async function refusal(fetchImpl, value) {
  return await assert.rejects(
    verifyAddressProof(request(), { fetch: directory({ value, ...fetchImpl }) }),
    AddressProofError,
  );
}

test("a signed proof in the recipient's own repository verifies locally", async () => {
  const value = await record();
  const proof = await verifyAddressProof(request(), {
    fetch: directory({ value }),
  });
  assert.equal(proof.address.toLowerCase(), owner.address.toLowerCase());
  assert.equal(proof.did, did);
  assert.equal(proof.originMatches, true);
  assert.equal(proof.claimsHandle, true);
  assert.equal(proof.server, "https://pds.example");
  assert.equal(proof.createdAt, "2026-10-01T00:00:00.000Z");
});

test("a proof signed by another wallet is refused", async () => {
  const value = await record({}, stranger);
  await assert.rejects(
    verifyAddressProof(request(), { fetch: directory({ value }) }),
    (error) => error.reason === "mismatch",
  );
});

test("a proof for another account, address or network is refused", async () => {
  const other = "did:plc:3cccccccccccccccccccccccc";
  for (const value of [
    await record({ message: message({ resources: [other] }) }),
    await record({ message: message({ chainId: 4326 }) }),
    await record({ message: message({ address: stranger.address }) }),
    await record({ chain: "eip155:4326" }),
    await record({ address: stranger.address.toLowerCase() }),
  ])
    await assert.rejects(
      verifyAddressProof(request(), { fetch: directory({ value }) }),
      (error) => error.reason === "mismatch",
      JSON.stringify(value.chain),
    );
});

test("a proof replayed from another repository is refused", async () => {
  const value = await record();
  await assert.rejects(
    verifyAddressProof(request(), {
      fetch: directory({
        value,
        uri: `at://did:plc:4dddddddddddddddddddddddd/app.peachlet.address/${addressRecordKey(chainId, owner.address)}`,
      }),
    }),
    (error) => error.reason === "mismatch",
  );
});

test("an identity document for a different DID is refused", async () => {
  const value = await record();
  await assert.rejects(
    verifyAddressProof(request(), {
      fetch: directory({
        value,
        document: {
          id: "did:plc:5eeeeeeeeeeeeeeeeeeeeeeee",
          service: [
            {
              id: "#atproto_pds",
              serviceEndpoint: "https://pds.example",
            },
          ],
        },
      }),
    }),
    (error) => error.reason === "mismatch",
  );
});

test("an unpublished address reports itself instead of failing closed", async () => {
  await assert.rejects(
    verifyAddressProof(request(), {
      fetch: directory({ status: 400 }),
    }),
    (error) =>
      error.reason === "unpublished" && /@alice\.test/.test(error.message),
  );
});

test("an unreachable directory is distinguishable from an invalid proof", async () => {
  await assert.rejects(
    verifyAddressProof(request(), {
      fetch: async () => {
        throw new Error("offline");
      },
    }),
    (error) => error.reason === "unreachable",
  );
});

test("a proof signed for another site still verifies but reports the domain", async () => {
  const value = await record({
    message: message({ domain: "old.example", uri: "https://old.example/wallet-link" }),
  });
  const proof = await verifyAddressProof(request(), {
    fetch: directory({ value }),
  });
  assert.equal(proof.originMatches, false);
  assert.equal(proof.domain, "old.example");
});
