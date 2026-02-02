#!/usr/bin/env bash

set -e

NAME="D2 Token" SYMBOL="D2" yarn hardhat run migrations/deployMintable.ts

## Start hardhat node setup
HARDHAT_NODE_SESSION="hardhat-node"
yarn pm2 start "yarn hardhat node" --name "$HARDHAT_NODE_SESSION"

echo "Node Initialized."

cleanup() {
    echo "Stopping Hardhat Node"
    yarn pm2 delete "$HARDHAT_NODE_SESSION"
    echo "SUCCESS"
}

trap cleanup EXIT
## End of node setup

UNDERLYING_TOKEN_ADDRESS=$(yarn hardhat run scripts/deployTestERC20.ts --network localhost | grep --max-count 1 "TestERC20" | awk '{print $NF}')

ORIGIN_TOKEN="$UNDERLYING_TOKEN_ADDRESS" yarn hardhat run migrations/deployWrapper.ts --network localhost


