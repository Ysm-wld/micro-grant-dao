const fs = require("fs");
const path = require("path");

// Deployment script for GrantDAO contract.
// This script compiles the GrantDAO contract, deploys it to the selected
// Hardhat network, and writes deployment metadata into the repository.
async function main() {
  // Use the first signer account provided by Hardhat as the contract deployer.
  const [deployer] = await ethers.getSigners();

  // Fetch the compiled GrantDAO contract factory from Hardhat.
  const GrantDAO = await ethers.getContractFactory("GrantDAO");

  // Deploy the contract with a 60% approval threshold for proposal voting.
  const dao = await GrantDAO.deploy(60);
  await dao.waitForDeployment();

  // Attempt to capture the deployment transaction receipt for logging.
  const deploymentTx = dao.deploymentTransaction();
  const deploymentReceipt = deploymentTx ? await deploymentTx.wait() : null;

  // Package the deployment information for frontend and API consumption.
  const deployment = {
    network: network.name,
    deployedAt: new Date().toISOString(),
    deployedBlock: deploymentReceipt ? deploymentReceipt.blockNumber : null,
    admin: deployer.address,
    approvalThresholdPercent: 60,
    contracts: {
      GrantDAO: await dao.getAddress()
    }
  };

  // Save the metadata to the lab's deployment folder so the app can discover it.
  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${network.name}.json`), JSON.stringify(deployment, null, 2));

  console.log("Lab 5 deployment saved:", deployment);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
