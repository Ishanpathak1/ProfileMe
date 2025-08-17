const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const { ethers } = hre;
  const signers = await ethers.getSigners();
  let deployer = signers[0];

  if (!deployer) {
    const pk = process.env.PRIVATE_KEY;
    if (!pk) {
      throw new Error(
        "No signer available. Set PRIVATE_KEY in contracts/.env (0x-prefixed) or configure accounts in hardhat.config.js"
      );
    }
    deployer = new ethers.Wallet(pk, ethers.provider);
  }

  console.log("Deployer:", await deployer.getAddress());

  const SecretVaultFactory = await ethers.getContractFactory("SecretVault", deployer);
  const secretVault = await SecretVaultFactory.deploy();
  await secretVault.waitForDeployment();
  const address = await secretVault.getAddress();
  console.log("SecretVault deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

