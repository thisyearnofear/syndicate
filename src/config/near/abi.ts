// Contract ABIs (minimal required functions)
export const CONTRACT_ABIS = {
  megapot: [
    'function purchaseTickets(uint256 count) external payable',
    'function getTicketPrice() external view returns (uint256)',
    'function getCurrentJackpot() external view returns (uint256)',
  ],
  
  erc20: [
    'function transfer(address to, uint256 amount) external returns (bool)',
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function balanceOf(address account) external view returns (uint256)',
    'function allowance(address owner, address spender) external view returns (uint256)',
  ],
  
  bridge: [
    'function deposit(address token, uint256 amount, string memory recipient) external payable',
    'function withdraw(bytes memory proof) external',
    'function getFee(address token, uint256 amount) external view returns (uint256)',
  ],
};
