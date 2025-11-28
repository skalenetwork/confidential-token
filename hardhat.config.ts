import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "solidity-docgen";

const config: HardhatUserConfig = {
  docgen: {
    outputDir: "docs",
    pages: "files",
    templates: "./docs/templates",
    exclude: [
      "test"
    ]
  },
  networks: {
    custom: {
      url: process.env.ENDPOINT || "http://localhost:8545",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    }
  },
  solidity: "0.8.30",
};

export default config;
