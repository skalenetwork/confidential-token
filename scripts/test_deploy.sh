#!/usr/bin/env bash

set -e

NAME="D2 Token" SYMBOL="D2" yarn hardhat run migrations/deployMintable.ts

yarn hardhat run migrations/deployWrapper.ts
