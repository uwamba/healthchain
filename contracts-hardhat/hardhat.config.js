require("@nomiclabs/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("dotenv").config();

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // @openzeppelin/contracts ^5.6 uses the mcopy opcode (EIP-5656) in
      // Bytes.sol, which only exists from the Cancun hardfork onward.
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {
      // Default local network — instant blocks, free test ETH, and supports
      // evm_increaseTime so 24h/7d/30d access-grant expiry is testable in
      // seconds instead of waiting real time on a public testnet.
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
  },
};
