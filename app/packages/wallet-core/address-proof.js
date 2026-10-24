import { verifyMessage } from "viem";
import { parseSiweMessage } from "viem/siwe";

/* Independent verification of a recipient's receiving address. The signed proof
   is read from the recipient's own repository and checked here, so a hostile or
   compromised Peachlet API cannot redirect a payment to an address its owner
   never signed for. Nothing in this module may call the Peachlet API: its whole
   value is being a second opinion about the address the API reported. */
export const addressCollection = "app.peachlet.address";
const plcDirectory = "https://plc.directory";
const maxBytes = 65_536;
const requestTimeout = 10_000;
const didPlc = /^did:plc:[a-z2-7]{24}$/;
const didWeb = /^did:web:[a-zA-Z0-9.%:-]{1,253}$/;
const hexAddress = /^0x[0-9a-fA-F]{40}$/;
const hexSignature = /^0x[0-9a-fA-F]{130}$/;

export const addressRecordKey = (chainId, address) =>
  `eip155-${chainId}-${address.toLowerCase()}`;

/** reason: unsupported | unreachable | unpublished | mismatch */
export class AddressProofError extends Error {
  constructor(reason, message) {
    super(message);
    this.name = "AddressProofError";
    this.reason = reason;
  }
}

const unreachable = (label) =>
  new AddressProofError(
    "unreachable",
    `Could not reach ${label} to verify the receiving address. Check your connection, then verify again.`,
  );

/* The deadline covers reading the body too: an endless response from someone
   else's server must not hold a payment open. */
async function readJson(url, label, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeout);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      credentials: "omit",
      headers: { accept: "application/json" },
    });
    const text = await response.text();
    if (text.length > maxBytes)
      throw new AddressProofError(
        "unreachable",
        `${label} returned too much data to verify the receiving address.`,
      );
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    // A repository without this record is a verification outcome, not a failure.
    if (!response.ok) {
      if (body?.error === "RecordNotFound") return null;
      throw unreachable(label);
    }
    if (!body || typeof body !== "object") throw unreachable(label);
    return body;
  } catch (error) {
    throw error instanceof AddressProofError ? error : unreachable(label);
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveDidDocument(did, options = {}) {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const directory = options.directory ?? plcDirectory;
  if (typeof fetchImpl !== "function")
    throw new AddressProofError(
      "unsupported",
      "This device cannot verify receiving addresses.",
    );
  // The DID already passed a strict character test, so it is safe in the path.
  if (didPlc.test(did))
    return readJson(`${directory}/${did}`, "the PLC directory", fetchImpl);
  if (didWeb.test(did)) {
    const segments = did.slice(8).split(":").map(decodeURIComponent);
    const host = segments[0];
    if (!host || /[/@\\?#]/.test(host))
      throw new AddressProofError(
        "unsupported",
        "The recipient's identity uses an address Peachlet cannot verify.",
      );
    const path =
      segments.length > 1
        ? `${segments.slice(1).join("/")}/did.json`
        : ".well-known/did.json";
    return readJson(
      `https://${host}/${path}`,
      "the recipient's domain",
      fetchImpl,
    );
  }
  throw new AddressProofError(
    "unsupported",
    "The recipient's identity method is not supported for address verification.",
  );
}

export function personalDataServer(document, did) {
  /* No document at all is a lookup problem, not evidence against the address:
     only a document that names a different account contradicts the review. */
  if (!document || typeof document !== "object")
    throw unreachable("the recipient's identity directory");
  if (document.id !== did)
    throw new AddressProofError(
      "mismatch",
      "The recipient's identity document does not match their pinned DID.",
    );
  const services = Array.isArray(document.service) ? document.service : [];
  const service = services.find(
    (entry) =>
      entry?.id === "#atproto_pds" || entry?.id === `${did}#atproto_pds`,
  );
  let endpoint;
  try {
    endpoint = new URL(String(service?.serviceEndpoint));
  } catch {
    throw new AddressProofError(
      "unpublished",
      "The recipient's account does not publish a repository server, so their address cannot be verified.",
    );
  }
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password)
    throw new AddressProofError(
      "mismatch",
      "The recipient's repository server is not a plain HTTPS endpoint.",
    );
  return endpoint.origin;
}

function siweBindings(message, { did, address, chainId, origin }) {
  let parsed;
  try {
    parsed = parseSiweMessage(message);
  } catch {
    parsed = undefined;
  }
  if (!parsed)
    throw new AddressProofError(
      "mismatch",
      "The recipient's address proof is not a readable signed message.",
    );
  /* Every proof this app asks for carries the account as a SIWE resource, so
     require it there rather than trusting the free-text statement. */
  const resources = Array.isArray(parsed.resources) ? parsed.resources : [];
  if (
    String(parsed.address).toLowerCase() !== address.toLowerCase() ||
    parsed.chainId !== chainId ||
    !resources.includes(did)
  )
    throw new AddressProofError(
      "mismatch",
      "The recipient's address proof was signed for a different account, address, or network.",
    );
  /* The proof's own domain is a relinking concern, not an authenticity one: the
     statement and resources already bind it to this DID and address. */
  let expected;
  try {
    expected = new URL(origin);
  } catch {
    expected = undefined;
  }
  return {
    originMatches:
      Boolean(expected) &&
      parsed.domain === expected.host &&
      parsed.uri === `${expected.origin}/wallet-link`,
    domain: typeof parsed.domain === "string" ? parsed.domain : null,
  };
}

/* Resolves with the verified proof, or throws AddressProofError. `origin` is
   this app's own origin, used only to report whether the proof was signed for
   it. Callers must treat a `mismatch` as a refusal to pay. */
export async function verifyAddressProof(request, options = {}) {
  const { did, address, chainId, origin, handle } = request;
  if (typeof did !== "string" || !did.startsWith("did:"))
    throw new AddressProofError(
      "unsupported",
      "This payment has no pinned recipient DID to verify.",
    );
  if (typeof address !== "string" || !hexAddress.test(address))
    throw new AddressProofError(
      "mismatch",
      "The receiving address is not a valid Ethereum address.",
    );
  if (!Number.isSafeInteger(chainId) || chainId <= 0)
    throw new AddressProofError(
      "unsupported",
      "This payment has no network to verify against.",
    );

  const document = await resolveDidDocument(did, options);
  const server = personalDataServer(document, did);
  const rkey = addressRecordKey(chainId, address);
  const found = await readJson(
    `${server}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}` +
      `&collection=${addressCollection}&rkey=${encodeURIComponent(rkey)}`,
    "the recipient's repository",
    options.fetch ?? globalThis.fetch,
  );
  if (!found)
    throw new AddressProofError(
      "unpublished",
      `${handle ? `@${handle}` : "This recipient"} has not published a signed proof for this address.`,
    );
  if (found.uri !== `at://${did}/${addressCollection}/${rkey}`)
    throw new AddressProofError(
      "mismatch",
      "The address proof came from a different repository than the pinned DID.",
    );

  const record = found.value;
  const message = record?.message;
  if (
    !record ||
    record.chain !== `eip155:${chainId}` ||
    typeof record.address !== "string" ||
    record.address.toLowerCase() !== address.toLowerCase() ||
    typeof message !== "string" ||
    !message ||
    message.length > 8192 ||
    typeof record.signature !== "string" ||
    !hexSignature.test(record.signature)
  )
    throw new AddressProofError(
      "mismatch",
      "The recipient's published proof does not describe this address on this network.",
    );

  const bindings = siweBindings(message, { did, address, chainId, origin });
  let valid = false;
  try {
    valid = await verifyMessage({
      address: record.address,
      message,
      signature: record.signature,
    });
  } catch {
    valid = false;
  }
  if (!valid)
    throw new AddressProofError(
      "mismatch",
      "The signature on the recipient's address proof does not match the address.",
    );

  const names = Array.isArray(document.alsoKnownAs) ? document.alsoKnownAs : [];
  return {
    did,
    address: record.address,
    chainId,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : null,
    server,
    originMatches: bindings.originMatches,
    domain: bindings.domain,
    /* The DID document's own claim. Only a handle that resolves back to this
       DID proves the pairing, which this check does not attempt. */
    claimsHandle: handle ? names.includes(`at://${handle}`) : null,
  };
}
