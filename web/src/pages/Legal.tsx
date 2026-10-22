import { Link } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

const contact = <a href="mailto:contact@citruswallet.app">contact@citruswallet.app</a>;

function LegalPage({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · Citrus Wallet`;
    return () => { document.title = previous; };
  }, [title]);

  return (
    <article className="legal-page">
      <header className="page-heading">
        <p className="eyebrow">CITRUS WALLET</p>
        <h1>{title}</h1>
        <p>{summary}</p>
        <p className="legal-date">Last updated: <time dateTime="2026-10-22">October 22, 2026</time></p>
      </header>
      <nav className="legal-nav" aria-label="Legal pages">
        <Link to="/privacy" activeProps={{ "aria-current": "page" }}>Privacy Policy</Link>
        <Link to="/terms" activeProps={{ "aria-current": "page" }}>Terms and Conditions</Link>
      </nav>
      <div className="legal-content">{children}</div>
    </article>
  );
}

export function Privacy() {
  return (
    <LegalPage title="Privacy Policy" summary="What we collect, what becomes public, and the choices you have.">
      <section>
        <h2>1. About this policy</h2>
        <p>This policy describes how Citrus Wallet at citruswallet.app handles information when you sign in, link an Ethereum address, or use payments. For privacy questions or requests, email {contact}.</p>
      </section>
      <section>
        <h2>2. Information we handle</h2>
        <ul>
          <li><strong>Account profiles:</strong> your AT Protocol DID, handle, display name, avatar URL, and profile creation and update timestamps. We obtain these from your account provider and public AT Protocol services. We also index public profiles associated with address records received through Jetstream, including accounts that have not signed in here.</li>
          <li><strong>Wallet links:</strong> chain, Ethereum address, signed ownership message and signature, receiving preferences, and whether a link is public.</li>
          <li><strong>Payment records:</strong> sender and recipient identifiers, addresses, amounts, optional descriptions, payment status, timestamps, invitation information, and transaction hashes. Invitations are stored with hashed tokens. Payment descriptions are visible to the participants in Citrus Wallet and are not published on-chain or to AT Protocol.</li>
          <li><strong>Authentication and operation:</strong> server-side OAuth credentials, sessions, temporary login state, and technical information needed to handle requests, prevent abuse, and diagnose failures, such as IP addresses and error logs.</li>
        </ul>
        <p>Citrus Wallet does not receive your AT Protocol password, wallet private keys, or recovery phrase. Your wallet handles transaction signing.</p>
      </section>
      <section>
        <h2>3. How we use information</h2>
        <p>We use this information to authenticate you, display profiles, verify wallet ownership, resolve receiving addresses, manage payment intents and invitations, check transactions, synchronize public address records, and secure and maintain the service.</p>
        <p>Where applicable data protection law requires a legal basis, we process information as necessary to provide the service you request, for legitimate interests in operating a secure service and maintaining the public address directory, and to meet legal obligations. Publishing a wallet link is an optional action you control.</p>
      </section>
      <section>
        <h2>4. Public records and private links</h2>
        <p>Choosing to publish a wallet address writes an app.citruswallet.address record to your AT Protocol repository. Its chain, address, signed message, signature, and creation time are public and associate that address with your DID. Other services can copy and index them.</p>
        <p>A private link is stored by Citrus Wallet without publishing that repository record. If you select it for an invitation, the sender can see the receiving address. “Private” does not make Ethereum transactions private: blockchain addresses, amounts, and transaction history are public.</p>
        <p>Unlinking a public address requests removal of its repository record. Synchronization can be delayed or fail; check any pending update shown in the app. Deletion cannot erase blockchain history or copies already held by other services.</p>
      </section>
      <section>
        <h2>5. Services that receive information</h2>
        <p>Your AT Protocol provider handles login and repository writes. AppView services receive profile and handle-search requests from our server. Avatar images load directly from their image host, which can see your IP address. Jetstream supplies public repository events.</p>
        <p>Ethereum RPC providers receive requests needed to check transactions; MetaMask and its providers handle wallet connections, balance queries, and broadcasting. Our hosting infrastructure processes requests and stored data to run Citrus Wallet. These providers may operate in different countries and have their own privacy policies.</p>
        <p>Payment participants receive the details needed for their payment. Information may also be disclosed where required by law or necessary to address abuse or protect the service. We do not use the app to sell personal information or serve targeted advertisements.</p>
      </section>
      <section>
        <h2>6. Cookies and browser storage</h2>
        <p>We use session and security cookies for authentication and request protection. Browser storage preserves invitation state across sign-in and pending transaction details to help avoid duplicate transfers. The installed web app caches only public offline-page assets, not account data, payment API responses, or OAuth responses. The app does not include advertising trackers or third-party analytics. Clearing browser storage can remove transaction recovery information; check your wallet history before retrying a payment.</p>
      </section>
      <section>
        <h2>7. Retention and your choices</h2>
        <p>Profile, wallet, and payment records persist in our database; they are not automatically erased when you sign out or a payment expires. We retain records to provide account and payment history, synchronize addresses, resolve issues, and protect against abuse. Backups may retain earlier copies. Temporary login and security records have expiration periods.</p>
        <p>You can permanently delete cancelled payment intents you created; this also removes them from the recipient’s Citrus Wallet history, although earlier copies may remain in backups. You can unlink an address, sign out, and revoke Citrus Wallet’s authorization through your account provider. Signing out removes the current browser session and associated server-side OAuth credentials; it does not delete your profile or payment history.</p>
        <p>Contact {contact} to request access, correction, or deletion, or to object to or request restriction of processing. Depending on where you live, you may also have portability rights and the right to complain to your local data protection authority. We may need to verify account ownership. Some records may need to be retained for legal or security reasons, and we cannot remove independently held public copies.</p>
      </section>
      <section>
        <h2>8. Updates and contact</h2>
        <p>We will update this page when our practices change and show the revision date above. Direct privacy questions to {contact}. Never send private keys, recovery phrases, or passwords.</p>
      </section>
    </LegalPage>
  );
}

export function Terms() {
  return (
    <LegalPage title="Terms and Conditions" summary="The terms for connecting your identity, linking a wallet, and sending ETH with Citrus.">
      <section>
        <h2>1. Using Citrus Wallet</h2>
        <p>These terms apply to your use of Citrus Wallet at citruswallet.app. By using the service, you agree to these terms. If you do not agree, do not use the service. You must be legally able to enter into these terms and use the service in accordance with laws that apply to you. Questions can be sent to {contact}.</p>
      </section>
      <section>
        <h2>2. Your wallet stays in your control</h2>
        <p>Citrus Wallet connects AT Protocol identities to verified Ethereum addresses and helps you prepare and track native ETH payments. We do not hold your funds or private keys, act as an escrow service, or execute automatic payouts. You approve and sign transfers in your own wallet.</p>
        <p>A payment intent or invitation does not reserve funds, create a deposit, or guarantee a payment. A recipient must not treat an invitation or pending intent as proof of receipt.</p>
      </section>
      <section>
        <h2>3. Your responsibilities</h2>
        <p>Keep your account, wallet, devices, and recovery information secure. Only link addresses you control and only authorize transactions you intend to make. Before confirming, verify the recipient’s identity, full address, network, amount, and network fee in both Citrus Wallet and your wallet.</p>
        <p>Handles, profile names, and pictures can change or be misleading. Ownership verification establishes control of an address at the time of signing; it does not establish a person’s real-world identity or trustworthiness.</p>
      </section>
      <section>
        <h2>4. Transactions, fees, and risks</h2>
        <p>Blockchain transfers generally cannot be reversed. Citrus Wallet cannot recover funds sent to the wrong address, reverse a confirmed transaction, or restore lost keys. You are responsible for Ethereum network fees shown by your wallet, which may be charged even if a transaction fails, and any taxes that apply to your activity.</p>
        <p>Network congestion, reorganizations, provider outages, software errors, or compromised accounts may delay transactions or affect displayed status. Check your wallet and blockchain transaction history before retrying a transfer. Cryptoasset values can fluctuate substantially. The service does not provide investment, tax, or financial advice.</p>
      </section>
      <section>
        <h2>5. Public address records and privacy</h2>
        <p>When you choose public payments, you authorize Citrus Wallet to publish and synchronize your verified address record in your AT Protocol repository using the permissions you grant. Public records may be copied by other services. Unlinking cannot remove blockchain history or third-party copies.</p>
        <p>Our <Link to="/privacy">Privacy Policy</Link> explains account data, signatures, public indexing, payment records, cookies, and your choices.</p>
      </section>
      <section>
        <h2>6. Acceptable use</h2>
        <p>Do not use the service for fraud, impersonation, theft, unlawful transfers, or infringement of others’ rights. Do not attempt unauthorized access, bypass security or rate limits, interfere with the service, or submit false ownership proofs. We may restrict access when necessary to address abuse, security threats, or legal requirements.</p>
      </section>
      <section>
        <h2>7. Third-party services and availability</h2>
        <p>AT Protocol providers, MetaMask, Ethereum, RPC providers, and other external services operate independently and have their own terms. Linking to or integrating a service does not guarantee its security or availability or imply endorsement by that provider.</p>
        <p>We may change, suspend, or discontinue features. Where permitted by law, Citrus Wallet is provided “as is” and “as available,” without warranties of uninterrupted operation, accuracy, or fitness for a particular purpose.</p>
      </section>
      <section>
        <h2>8. Liability and your rights</h2>
        <p>To the extent permitted by applicable law, Citrus Wallet is not liable for indirect or consequential losses, including lost profits, arising from use of the service. Nothing in these terms excludes liability that cannot lawfully be excluded or limits mandatory consumer rights.</p>
      </section>
      <section>
        <h2>9. Ending use, changes, and contact</h2>
        <p>You can stop using Citrus Wallet at any time, unlink addresses, and revoke authorization with your account provider. Ending use does not cancel a transaction already broadcast or erase records held on public networks.</p>
        <p>We may revise these terms and will display the updated date on this page. Review changes before continuing to use the service. For questions or disputes, contact {contact} so we can try to resolve the issue.</p>
      </section>
    </LegalPage>
  );
}
