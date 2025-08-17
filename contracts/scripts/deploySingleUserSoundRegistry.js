const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No signer available");
  console.log("Deployer:", await deployer.getAddress());

  const user = process.env.DEMO_USER_ADDRESS;
  const hash = process.env.DEMO_SOUND_HASH;
  if (!user || !hash) {
    throw new Error("Set DEMO_USER_ADDRESS and DEMO_SOUND_HASH in contracts/.env");
  }

  const SingleUserSoundRegistry = await ethers.getContractFactory("SingleUserSoundRegistry", deployer);
  const registry = await SingleUserSoundRegistry.deploy(user, hash);
  await registry.deployed();
  const address = registry.address;
  console.log("SingleUserSoundRegistry deployed:", address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

