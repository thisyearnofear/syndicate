# NextJS Gator Starter Template

This is a NextJS Gator Starter template created with create-gator-app.

This template is meant to help you bootstrap your own projects with [Metamask Delegation Toolkit](https://metamask.io/developer/delegation-toolkit). It helps you build smart accounts with account abstraction, and powerful delegation features.

Learn more about [Metamask Delegation Toolkit](https://metamask.io/developer/delegation-toolkit).

## Prerequisites

1. **Pimlico API Key**: In this template, we use Pimlico’s Bundler and Paymaster services to submit user operations and sponsor transactions, respectively. You can retrieve the required API key from [Pimlico’s Dashboard](https://dashboard.pimlico.io/apikeys).

## Project Structure

```bash
nextjs-starter/
├── public/ # Static assets
├── src/
│ ├── app/ # App router pages
│ ├── components/ # UI Components
│ ├── hooks/ # Custom React hooks
│ ├── providers/ # Custom React Context Provider
│ ├── connectors(optional)/ # Web3Auth connector for Wagmi
│ └── utils/ # Utils for the starter
├── .env # Environment variables
├── .gitignore # Git ignore rules
├── next.config.ts # Next.js configuration
└── tsconfig.json # TypeScript configuration
```

## Setup Enviroment Variables

Update the following environment variables in the `.env` file located in your project's root directory.

```
NEXT_PUBLIC_PIMLICO_API_KEY =
```

## Getting Started

First, start the development server using the package manager you selected during setup.

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Learn More

To learn more about Delegation Toolkit, take a look at the following resources:

- [Delegation Toolkit Documentation](https://docs.gator.metamask.io/) - learn about Delegation Toolkit features and API.
