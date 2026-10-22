# Citrus Wallet service

`citruswallet.service` follows the services in `rocksky/systemd`: root's interactive Bash environment, Doppler's `prd` configuration, journal logging, and automatic restart on failure.

The unit assumes the checkout is `/root/github/citruswallet`. Update `WorkingDirectory` if your checkout has another name, such as `/root/github/atproto-wallet`.

Install Bun, Node.js 24+, Gleam 1.19+, and Doppler for the service user. From the checkout, install dependencies with `bun install --frozen-lockfile` and configure the project's Doppler `prd` environment. Build dependencies must be installed, including Vite.

Configure `APP_URL` to the public HTTPS origin and `ETH_RPC_URL` to your Ethereum mainnet RPC in Doppler. The API defaults to `127.0.0.1:4747`; put it behind your HTTPS reverse proxy. Set `TRUST_PROXY_HOPS` for that proxy topology. See `../.env.example` for the remaining settings. Optional process environment defaults can be supplied through `/etc/default/citruswallet`; Doppler supplies the runtime configuration.

On every start or restart, the service runs `bun run build`, then `bun run start` under Doppler. The Gleam API serves the compiled frontend from `web/dist`. No Vite development server or Anvil process is launched. Dependencies must already be installed; a failed build prevents the API from starting.

Install and start on the Linux host:

```sh
sudo install -m 644 systemd/citruswallet.service /etc/systemd/system/citruswallet.service
sudo systemctl daemon-reload
sudo systemctl enable --now citruswallet.service
sudo journalctl -u citruswallet.service -f
```

After updating the checkout and dependencies:

```sh
sudo systemctl restart citruswallet.service
```
