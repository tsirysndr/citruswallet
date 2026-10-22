# Foundry workspace

`foundry.toml` at the project root reserves `src/`, `test/`, and `script/` here
for future Solidity code. Wallet linking itself uses off-chain SIWE signatures
and requires no deployed contracts, Solidity compiler, or forge-std dependency.

Anvil is included as a development dependency; `npm run anvil` starts it.
For future Solidity work, install the full Foundry toolchain using
https://getfoundry.sh/introduction/installation/ and run `forge build` / `forge test`
from the project root after adding contracts and tests.
