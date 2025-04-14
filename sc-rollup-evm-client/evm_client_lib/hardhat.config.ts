import { HardhatUserConfig, vars, task } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const DEV_OWNER_PRIVATE_KEY = vars.get("SC_ROLLUP_DEV_OWNER_PRIVATE_KEY");
const DEV_ATTESTOR_PRIVATE_KEY = vars.get("SC_ROLLUP_DEV_ATTESTOR_PRIVATE_KEY");
const DEV_USER1_PRIVATE_KEY = vars.get("DEV_USER1_PRIVATE_KEY");
const DEV_USER2_PRIVATE_KEY = vars.get("DEV_USER2_PRIVATE_KEY");
const MOONBASE_API_KEY = vars.get("MOONBASE_API_KEY");

task("accounts", "Prints the list of accounts", async (_taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

task("balance", "Prints an account's balance", async (taskArgs, hre) => {
  // @ts-ignore
  const balance = await hre.ethers.provider.getBalance(taskArgs.account);
  console.log(hre.ethers.formatEther(balance), "ETH");
}).addParam("account", "The account's address");

task("balances", "Prints the balance for all accounts", async (_taskArgs, hre) => {

  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    const balance =  await hre.ethers.provider.getBalance(account.address);
    const formattedBalance = hre.ethers.formatEther(balance);
    console.log("%s - %s ETH", account.address, formattedBalance);
  }

});

task("cancel", "Cancel pending transactions", async (_taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  const owner = accounts[0];
  const tx = {
    nonce: 107,
    to: owner.address,
    value: 0,
    //gaslimit: 58000;
    gasPrice: hre.ethers.parseUnits('50', 'gwei')
  }
  await owner.sendTransaction(tx);

});


const config: HardhatUserConfig = {
  solidity: {
    version:  "0.8.24",
  },
  ignition: {
    disableFeeBumping: false,
    maxFeeBumps: 10,
    timeBeforeBumpingFees: 1 * 60 * 1_000, // 1 minutes
    requiredConfirmations: 5,
  },
  networks: {
    'minato': {
      url: 'https://rpc.minato.soneium.org',
      accounts: [DEV_OWNER_PRIVATE_KEY, DEV_ATTESTOR_PRIVATE_KEY, DEV_USER1_PRIVATE_KEY, DEV_USER2_PRIVATE_KEY],
    },
    'moonbase': {
      url: 'https://rpc.api.moonbase.moonbeam.network',
      accounts: [DEV_OWNER_PRIVATE_KEY, DEV_ATTESTOR_PRIVATE_KEY, DEV_USER1_PRIVATE_KEY, DEV_USER2_PRIVATE_KEY],
    },
  },

  etherscan: {
    apiKey: {
      'minato': 'empty',
      'soneium': 'empty',
      'moonbase': MOONBASE_API_KEY,
      'shibuya': 'empty',
      'base-sepolia': 'empty'
    },
    customChains: [
      {
        network: "minato",
        chainId: 1946,
        urls: {
          apiURL: "https://soneium-minato.blockscout.com/api",
          browserURL: "https://soneium-minato.blockscout.com"
        }
      },
      {
        network: "soneium",
        chainId: 1868,
        urls: {
          apiURL: "https://soneium.blockscout.com/api",
          browserURL: "https://soneium.blockscout.com"
        }
      },
      {
        network: "moonbase",
        chainId: 1287,
        urls: {
          apiURL: "https://api-moonbase.moonscan.io/api",
          browserURL: "https://moonbase.moonscan.io"
        }
      },
    ]
  }
};

export default config;

