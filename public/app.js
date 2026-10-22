/* Wallet keys and OAuth/session credentials never enter browser storage. */
const $ = id => document.getElementById(id);
let session, resolved, review, invitation;
let balances = new Map(), walletAddress = null, walletOnNetwork = false;
let inviteError='';
let busy = false, history = [];
const inviteFragment = new URLSearchParams(window.location.hash.slice(1)).get('invite');
if (inviteFragment && /^[a-f0-9]{64}$/.test(inviteFragment)) {
  sessionStorage.setItem('wallet-link-invite', inviteFragment);
  window.history.replaceState(null, '', '/');
}
let inviteToken = sessionStorage.getItem('wallet-link-invite');
function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', 'x-csrf-token': session?.csrf ?? '', ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Request failed.');
  return data;
}
const broadcastKey = () => `wallet-link-broadcast:${session.did}`;
function formatUnits(wei, decimals, places = 6) {
  const unit = 10n ** BigInt(decimals), value = BigInt(wei);
  const fraction = (value % unit).toString().padStart(decimals, '0').slice(0, places).replace(/0+$/, '');
  return fraction ? `${value / unit}.${fraction}` : `${value / unit}`;
}
/* Balances are read through the wallet's own provider, so they need no server RPC. */
async function loadBalances() {
  balances = new Map(); walletAddress = null; walletOnNetwork = false;
  if (!session?.did) return;
  let wallet;
  try { wallet = provider(); } catch { return; }
  try {
    walletOnNetwork = await wallet.request({method:'eth_chainId'}) === session.network.chainIdHex;
    walletAddress = (await wallet.request({method:'eth_accounts'}))[0] ?? null;
    if (!walletOnNetwork) return;
    const wanted = new Set((session.links ?? []).filter(link => link.chain_id === session.network.chainId).map(link => link.address));
    if (walletAddress) wanted.add(walletAddress);
    await Promise.all([...wanted].map(async address => {
      const wei = await wallet.request({method:'eth_getBalance',params:[address,'latest']});
      balances.set(address.toLowerCase(), wei);
    }));
  } catch { /* A wallet that refuses the read simply leaves balances unknown. */ }
}
function balanceOf(address) {
  const wei = balances.get(address.toLowerCase());
  if (wei === undefined) return null;
  const currency = session.network.nativeCurrency;
  return `${formatUnits(wei, currency.decimals)} ${currency.symbol}`;
}
const labels = {waiting:'Awaiting recipient setup',ready:'Ready for review',prepared:'Prepared · awaiting wallet approval',submitted:'Submitted · checking chain',confirming:'Confirming',confirmed:'Confirmed',failed:'Transaction verification failed',cancelled:'Cancelled',expired:'Expired'};
function text(tag, value, className) { const node = document.createElement(tag); node.textContent = value; if (className) node.className = className; return node; }
function action(label, handler) { const button = text('button',label,'subtle'); button.type='button'; button.disabled=busy; button.onclick=()=>run(handler); return button; }
function render() {
  const loggedIn = Boolean(session?.did);
  $('login-form').hidden=loggedIn; $('identity').hidden=!loggedIn; $('did').textContent=session?.did??'';
  $('identity-state').textContent=loggedIn?'Connected':'Not connected'; $('identity-state').classList.toggle('success',loggedIn);
  $('wallet-hint').textContent=loggedIn?`${session.network.name} · chain ${session.network.chainId} · standard MetaMask accounts`:'Sign in with AT Protocol to continue.';
  $('wallet-state').textContent=session?.links?.length?'Linked':'Not linked'; $('links-panel').hidden=!session?.links?.length;
  const connectedBalance=walletAddress?balanceOf(walletAddress):null;
  $('wallet-balance').hidden=!loggedIn||!walletAddress;
  $('wallet-balance').textContent=!walletAddress?'':walletOnNetwork
    ?`Balance of ${walletAddress.slice(0,6)}…${walletAddress.slice(-4)}: ${connectedBalance??'unavailable'}`
    :`Switch MetaMask to ${session.network.name} to see this account's balance.`;
  $('links').replaceChildren();
  for (const link of session?.links??[]) {
    const row=text('div','','link-row'), info=text('div','','link-info');
    info.append(text('p',link.address,'mono'),text('p',`${link.chain_id===31337?'Anvil local':'Ethereum mainnet'} · ${link.public?'Public':'Private'}${link.is_default?' · Receiving default':''}`,'hint'));
    if (link.chain_id===session.network.chainId) {
      const balance=balanceOf(link.address);
      if (balance) info.append(text('p',balance,'balance'));
      else if (!walletOnNetwork) info.append(text('p','Balance hidden · MetaMask is on another network.','hint'));
    }
    const buttons=text('div','','link-buttons');
    if (link.public && !link.is_default && link.chain_id===session.network.chainId) buttons.append(action('Make default',async()=>{
      await api('/api/links/default',{method:'POST',body:JSON.stringify({address:link.address})}); await refresh(); status('Receiving default updated.');
    }));
    if (link.chain_id===session.network.chainId) buttons.append(action('Unlink',async()=>{
      await api(`/api/links/${link.address}`,{method:'DELETE'}); await refresh(); status('Wallet unlinked.');
    }));
    row.append(info,buttons); $('links').append(row);
  }
  $('payment-tools').hidden=!loggedIn; $('history-panel').hidden=!loggedIn;
  $('payment-network').textContent=session?.network?.name??'';
  $('rpc-hint').textContent=session?.paymentsEnabled?'Direct ETH transfers · funds leave only after MetaMask approval.':'Recipient setup and invitations are available. Set ETH_RPC_URL on the server to enable sending and receipt verification.';
  $('recipient-preview').hidden=!resolved;
  if (resolved) {
    $('resolved-name').textContent=resolved.handle?`@${resolved.handle}`:'Recipient DID'; $('resolved-did').textContent=resolved.did;
    $('resolved-address').textContent=resolved.address?`Receiving address: ${resolved.address}`:'No public receiving address. Create an intent and invite them to choose a wallet.';
  }
  $('payment-history').replaceChildren();
  for(const payment of history) {
    const row=text('div','','payment-row'),info=text('div','','link-info');
    info.append(text('p',`${payment.amount} ETH → ${payment.recipientLabel}`),text('p',labels[payment.state]??payment.state,'hint'));
    row.append(info,action('Review',async()=>{await loadReview(payment.id);status('Review the payment details below.');})); $('payment-history').append(row);
  }
  if (!history.length) $('payment-history').append(text('p','No payment intents yet.','hint'));
  renderReview(); renderInvitation();
  document.querySelectorAll('button').forEach(button=>{button.disabled=busy;});
  $('connect').disabled=busy||!loggedIn;
  $('send-payment').disabled=busy||!$('review-confirm').checked||!session?.paymentsEnabled;
  $('accept-invite').disabled=busy||!invitation||!['waiting','ready'].includes(invitation.state)||!$('invite-wallet').value;
  $('logout').disabled=busy;
}
function renderReview() {
  $('review-panel').hidden=!review; if(!review)return;
  $('review-state').textContent=labels[review.state]??review.state;
  const details=[['Recipient',`${review.recipientLabel} (name at creation)`],['Pinned DID',review.recipientDid],['Network',`${session.network.name} · ${review.chainId}`],['Amount',`${review.amount} ETH + network fee`],['Address',review.address??'Recipient has not selected an address'],['Expires',new Date(review.expiresAt).toLocaleString()]];
  if(review.fromAddress)details.push(['From',review.fromAddress]);
  if(review.txHash)details.push(['Transaction',review.txHash],['Confirmations',`${review.confirmationsRequired} required`]);
  $('review-details').replaceChildren();for(const[label,value]of details)$('review-details').append(text('dt',label),text('dd',value,'mono'));
  $('review-error').textContent=review.error??'';
  $('send-actions').hidden=!['ready','prepared'].includes(review.state);
  $('invite-actions').hidden=review.state!=='waiting';
  $('recover-actions').hidden=!review.attemptId||!['prepared','expired','submitted'].includes(review.state);
  $('cancel-payment').hidden=!['waiting','ready'].includes(review.state);
}
function renderInvitation() {
  $('invite-panel').hidden=!inviteToken;
  if(!inviteToken)return;
  $('invite-description').textContent=!session?.did?'Sign in with the AT Protocol account this invitation was intended for.':invitation?`${invitation.amount} ETH from ${invitation.senderDid}`:inviteError||'Checking invitation…';
  $('invite-details').textContent=invitation?`Recipient: ${invitation.recipientDid} · ${session.network.name} · ${labels[invitation.state]}`:'';
  const select=$('invite-wallet'),selected=select.value;select.replaceChildren();
  const placeholder=text('option','Choose a linked address');placeholder.value='';placeholder.disabled=true;placeholder.selected=true;select.append(placeholder);
  for(const link of session?.links??[])if(link.chain_id===session.network.chainId){const option=text('option',`${link.address} · ${link.public?'public':'private'}`);option.value=link.address;select.append(option);}
  if([...select.options].some(o=>o.value===selected))select.value=selected;
  $('invite-status').textContent=invitation?.source==='recipient'&&invitation.address?`You selected ${invitation.address}. The sender must return and approve the transfer.`:'Link a wallet above, then choose it here. No funds have been deposited for you.';
}
async function loadReview(id) {
  const payment=(await api(`/api/payments/${id}`)).payment;
  // A changed destination always clears the sender's review acknowledgement.
  if(review?.id!==payment.id||review.revision!==payment.revision||review.address!==payment.address)$('review-confirm').checked=false;
  review=payment; $('share-box').hidden=true; render();
}
async function refresh() {
  session=await api('/api/session');
  history=session.did?(await api('/api/payments')).payments:[];
  if(review&&session.did){
    const updated=(await api(`/api/payments/${review.id}`)).payment;
    if(updated.revision!==review.revision||updated.address!==review.address)$('review-confirm').checked=false;
    review=updated;
  }
  if(!session.did){review=null;resolved=null;invitation=null;}
  await loadBalances();
  if(inviteToken&&session.did){try{invitation=(await api(`/api/invitations/${inviteToken}`)).payment;inviteError='';}catch(error){invitation=null;inviteError=error.message;status(error.message,true);}}
  render();
}
async function run(operation) {
  if(busy)return;busy=true;render();
  try{await operation();}catch(error){status(error.code===4001?'Request declined. No new transfer was approved.':error.message??'Request failed.',true);}
  finally{busy=false;render();}
}
function provider() {
  const injected=window.ethereum;const wallet=injected?.providers?.find(p=>p.isMetaMask)??(injected?.isMetaMask?injected:null);
  if(!wallet)throw new Error('Open this page in a browser with MetaMask installed, or in the MetaMask in-app browser.');return wallet;
}
async function walletAccount(wallet) {
  const accounts=await wallet.request({method:'eth_requestAccounts'}),address=accounts[0];
  if(!address)throw new Error('No Ethereum account selected.');
  const network=session.network;
  if(await wallet.request({method:'eth_chainId'})!==network.chainIdHex){
    try{await wallet.request({method:'wallet_switchEthereumChain',params:[{chainId:network.chainIdHex}]});}
    catch(error){
      if((error.code!==4902&&error.data?.originalError?.code!==4902)||!network.rpcUrls)throw error;
      await wallet.request({method:'wallet_addEthereumChain',params:[{chainId:network.chainIdHex,chainName:network.name,rpcUrls:network.rpcUrls,nativeCurrency:network.nativeCurrency}]});
      await wallet.request({method:'wallet_switchEthereumChain',params:[{chainId:network.chainIdHex}]});
    }
  }
  return address;
}
async function checkWallet(wallet,address) {
  const accounts=await wallet.request({method:'eth_accounts'});
  if(accounts[0]?.toLowerCase()!==address.toLowerCase()||await wallet.request({method:'eth_chainId'})!==session.network.chainIdHex)throw new Error('Account or network changed. Review and try again.');
}
$('login-form').onsubmit=event=>{event.preventDefault();run(async()=>{status('Finding your account provider…');const{url}=await api('/auth/start',{method:'POST',body:JSON.stringify({identifier:$('identifier').value})});window.location.assign(url);});};
$('logout').onclick=()=>run(async()=>{await api('/api/logout',{method:'POST',body:'{}'});await refresh();status('Signed out.');});
$('connect').onclick=()=>run(async()=>{
  const wallet=provider(),address=await walletAccount(wallet);
  const challenge=await api('/api/challenge',{method:'POST',body:JSON.stringify({address,public:$('discoverable').checked})});
  if(challenge.chainId!==session.network.chainId)throw new Error('Server network changed. Reload and try again.');
  status('Review the DID and domain, then sign the linking message in MetaMask…');
  const hex='0x'+Array.from(new TextEncoder().encode(challenge.message),byte=>byte.toString(16).padStart(2,'0')).join('');
  const signature=await wallet.request({method:'personal_sign',params:[hex,address]});await checkWallet(wallet,address);
  await api('/api/verify',{method:'POST',body:JSON.stringify({id:challenge.id,signature})});await refresh();status('Wallet linked. Your keys stay in MetaMask.');
});
$('recipient').oninput=()=>{resolved=null;render();};
$('recipient-form').onsubmit=event=>{event.preventDefault();run(async()=>{
  resolved=await api('/api/recipients/resolve',{method:'POST',body:JSON.stringify({identifier:$('recipient').value})});render();status('Recipient identity verified. Check the DID before creating the intent.');
});};
$('create-payment').onclick=()=>run(async()=>{
  if(!resolved)throw new Error('Resolve the recipient first.');
  const result=await api('/api/payments',{method:'POST',body:JSON.stringify({identifier:$('recipient').value,expectedDid:resolved.did,amount:$('amount').value})});
  await refresh();await loadReview(result.payment.id);
  if(review.state==='waiting')showInvitationUrl(result.invitationUrl);
  status(review.state==='waiting'?'Share the invitation with your recipient. Funds stay in your wallet.':'Payment intent created. Review it before opening MetaMask.');
});
function showInvitationUrl(url){$('invitation-url').value=url;$('share-box').hidden=false;}
$('generate-invite').onclick=()=>run(async()=>{const result=await api(`/api/payments/${review.id}/invitation`,{method:'POST',body:'{}'});showInvitationUrl(result.invitationUrl);status('Invitation generated. Earlier invitation links for this payment no longer work.');});
$('copy-invite').onclick=()=>run(async()=>{await navigator.clipboard.writeText($('invitation-url').value);status('Invitation link copied.');});
$('review-confirm').onchange=()=>render();
$('send-payment').onclick=()=>run(async()=>{
  if(!$('review-confirm').checked||!review)throw new Error('Review and acknowledge the payment details first.');
  const shown={...review},wallet=provider(),fromAddress=await walletAccount(wallet);
  const previous=sessionStorage.getItem(broadcastKey());
  if(previous)throw new Error('Check the previous MetaMask prompt and recover its transaction hash before sending another payment.');
  const prepared=await api(`/api/payments/${shown.id}/prepare`,{method:'POST',body:JSON.stringify({revision:shown.revision,address:shown.address,fromAddress})});
  const tx=prepared.transaction;
  // Check the response against the sender's reviewed values before invoking the wallet.
  if(prepared.payment.recipientDid!==shown.recipientDid||tx.to.toLowerCase()!==shown.address.toLowerCase()||BigInt(tx.value)!==BigInt(shown.amountWei)||tx.chainId!==session.network.chainIdHex||tx.from.toLowerCase()!==fromAddress.toLowerCase()||tx.data!=='0x')throw new Error('Prepared transaction differs from your review. Refresh before sending.');
  await checkWallet(wallet,fromAddress);
  const pending={id:shown.id,attemptId:prepared.attemptId};
  sessionStorage.setItem(broadcastKey(),JSON.stringify(pending));
  review=prepared.payment;render();status('Review the address, amount, network fee, and nonce in MetaMask.');
  let txHash;
  try{txHash=await wallet.request({method:'eth_sendTransaction',params:[tx]});}
  catch(error){if(error.code===4001)sessionStorage.removeItem(broadcastKey());throw error;}
  pending.txHash=txHash;sessionStorage.setItem(broadcastKey(),JSON.stringify(pending));
  const result=await api(`/api/payments/${pending.id}/submit`,{method:'POST',body:JSON.stringify({attemptId:pending.attemptId,txHash})});
  sessionStorage.removeItem(broadcastKey());review=result.payment;await refresh();
  status(`Transaction ${txHash}. ${labels[review.state]}. Refresh to check confirmations.`);
});
$('refresh-payment').onclick=()=>run(async()=>{await loadReview(review.id);await refresh();status(labels[review.state]);});
$('refresh-history').onclick=()=>run(async()=>{await refresh();status('Payment intents refreshed.');});
$('refresh-balances').onclick=()=>run(async()=>{await loadBalances();render();status(walletOnNetwork?'Balances refreshed from your wallet.':`Switch MetaMask to ${session.network.name} to read balances.`);});
$('cancel-payment').onclick=()=>run(async()=>{review=(await api(`/api/payments/${review.id}/cancel`,{method:'POST',body:'{}'})).payment;await refresh();status('Payment intent cancelled. No funds were reserved.');});
$('recover-payment').onclick=()=>run(async()=>{
  review=(await api(`/api/payments/${review.id}/submit`,{method:'POST',body:JSON.stringify({attemptId:review.attemptId,txHash:$('recover-hash').value.trim()})})).payment;await refresh();status(labels[review.state]);
});
$('invite-wallet').onchange=()=>render();
$('accept-invite').onclick=()=>run(async()=>{invitation=(await api(`/api/invitations/${inviteToken}/accept`,{method:'POST',body:JSON.stringify({address:$('invite-wallet').value})})).payment;status('Receiving address shared. The sender must return and approve the transfer.');});
$('dismiss-invite').onclick=()=>{inviteToken=null;invitation=null;sessionStorage.removeItem('wallet-link-invite');render();};
$('retry-review').onclick=()=>{
  sessionStorage.removeItem(broadcastKey());$('review-confirm').checked=false;render();
  status('Review the same prepared transaction again. Check MetaMask for an existing transfer before approving another request.');
};
async function init(){
  await refresh();
  const saved=session.did?sessionStorage.getItem(broadcastKey()):null;
  if(saved&&session.did){
    const pending=JSON.parse(saved);
    await loadReview(pending.id);
    if(pending.txHash){review=(await api(`/api/payments/${pending.id}/submit`,{method:'POST',body:JSON.stringify({attemptId:pending.attemptId,txHash:pending.txHash})})).payment;sessionStorage.removeItem(broadcastKey());render();status('Recovered the broadcast transaction. Refresh its status to check confirmations.');}
    else status('A previous wallet prompt may have broadcast a transaction. Check MetaMask and attach its original transaction hash before retrying.',true);
  }
}
init().catch(error=>status(error.message,true));
