import { type Web3AuthContextConfig } from "@web3auth/modal/react";
import { WEB3AUTH_NETWORK, type Web3AuthOptions } from "@web3auth/modal";
import { CHAIN_NAMESPACES } from "@web3auth/base";

const web3AuthOptions: Web3AuthOptions = {
  clientId: process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID || "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ", // Get your Client ID from Web3Auth Dashboard
  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET, // or WEB3AUTH_NETWORK.SAPPHIRE_DEVNET for testing
  uiConfig: {
    appName: "Syndicate",
    appUrl: "https://syndicate.app",
    theme: {
      primary: "#7c3aed", // Purple theme to match the app
    },
    mode: "dark",
    logoLight: "https://syndicate.app/logo-light.png",
    logoDark: "https://syndicate.app/logo-dark.png",
    defaultLanguage: "en",
    loginGridCol: 3,
    primaryButton: "externalLogin", // "externalLogin" | "socialLogin" | "emailLogin"
  },
};

// Chain configuration for Solana
export const solanaChainConfig = {
  chainNamespace: CHAIN_NAMESPACES.SOLANA,
  chainId: "0x1", // Please use 0x1 for Mainnet, 0x2 for Testnet, 0x3 for Devnet
  rpcTarget: "https://rpc.ankr.com/solana", // This is the public RPC we have added, please pass on your own endpoint while creating an app
};

const web3AuthContextConfig: Web3AuthContextConfig = {
  web3AuthOptions,
};

export default web3AuthContextConfig;