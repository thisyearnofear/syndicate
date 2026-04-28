// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/fhenix/FhenixSyndicateVault.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * Foundry tests for the FhenixSyndicateVault.
 *
 * Note: this repo runs on a standard EVM locally, so the FHE precompile at address(128)
 * does not exist by default. We `vm.etch` a lightweight mock at that address to make
 * FHE library calls deterministic for unit tests.
 */

// Mock USDC for testing (6 decimals)
contract MockUSDC is ERC20 {
  constructor() ERC20("Mock USDC", "USDC") {}

  function mint(address to, uint256 amount) public {
    _mint(to, amount);
  }

  function decimals() public view virtual override returns (uint8) {
    return 6;
  }
}

/**
 * Minimal mock for the FheOps precompile interface (address 128).
 * We model ciphertexts as their plaintext uint256 for deterministic testing.
 */
contract MockFheOps {
  function add(uint8, bytes memory lhs, bytes memory rhs) external pure returns (bytes memory) {
    uint256 a = abi.decode(lhs, (uint256));
    uint256 b = abi.decode(rhs, (uint256));
    return abi.encode(a + b);
  }

  function verify(uint8, bytes memory input, int32) external pure returns (bytes memory) {
    // In tests, treat `input` as already being the "ciphertext hash" (uint256 encoded).
    // This allows constructing inEuint256.data as abi.encode(value).
    return input;
  }

  function trivialEncrypt(bytes memory input, uint8, int32) external pure returns (bytes memory) {
    // Identity for tests (ciphertext hash == plaintext)
    return input;
  }

  // Unused by these tests, but part of the interface in FheOS.sol.
  function sealOutput(uint8, bytes memory, bytes memory) external pure returns (string memory) {
    return "";
  }

  function decrypt(uint8, bytes memory, uint256 defaultValue) external pure returns (uint256) {
    return defaultValue;
  }
}

contract FhenixSyndicateVaultTest is Test {
  MockUSDC internal usdc;
  FhenixSyndicateVault internal vault;

  event DepositShielded(address indexed from, uint256 placeholder);

  uint256 internal coordinatorPk = 0xA11CE;
  uint256 internal member1Pk = 0xB0B;
  uint256 internal member2Pk = 0xB0B2;

  address internal coordinator;
  address internal member1;
  address internal member2;

  function setUp() public {
    coordinator = vm.addr(coordinatorPk);
    member1 = vm.addr(member1Pk);
    member2 = vm.addr(member2Pk);

    usdc = new MockUSDC();
    vault = new FhenixSyndicateVault(address(usdc), coordinator);

    // Install mock FHE precompile code at address(128)
    MockFheOps ops = new MockFheOps();
    vm.etch(address(128), address(ops).code);

    // Fund members
    usdc.mint(member1, 1_000_000_000); // 1000 USDC (6 decimals)
    usdc.mint(member2, 1_000_000_000);
  }

  function _permission(address signer, uint256 signerPk, bytes32 publicKey) internal view returns (Permission memory) {
    // Mirror Permissioned.sol:
    // digest = _hashTypedDataV4(keccak256(abi.encode(typeHash, permission.publicKey)))
    bytes32 typeHash = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 domainSeparator = keccak256(
      abi.encode(
        typeHash,
        keccak256(bytes("Fhenix Permission")),
        keccak256(bytes("1.0")),
        block.chainid,
        address(vault)
      )
    );

    bytes32 structHash = keccak256(
      abi.encode(
        keccak256("Permissioned(bytes32 publicKey)"),
        publicKey
      )
    );

    bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
    bytes memory sig = abi.encodePacked(r, s, v);

    // sanity: recovered signer should match
    address recovered = ecrecover(digest, v, r, s);
    assertEq(recovered, signer, "bad permission signature");

    return Permission({ publicKey: publicKey, signature: sig });
  }

  function test_DepositEncrypted_TracksMembersAndTotals() public {
    uint256 amount = 25 * 1e6; // 25 USDC

    // Approve + deposit
    vm.startPrank(member1);
    usdc.approve(address(vault), amount);

    inEuint256 memory enc = inEuint256({ data: abi.encode(amount), securityZone: 0 });

    vm.expectEmit(true, false, false, true, address(vault));
    emit DepositShielded(member1, 0);

    vault.depositEncrypted(enc, amount);
    vm.stopPrank();

    assertEq(vault.totalDeposited(), amount);
    assertTrue(vault.isMember(member1));
    assertEq(vault.activeMemberCount(), 1);
    assertEq(vault.memberCount(), 1);
  }

  function test_GetEncryptedBalanceCtHash_UnsealableOffchain() public {
    uint256 amount = 10 * 1e6;

    vm.startPrank(member1);
    usdc.approve(address(vault), amount);
    inEuint256 memory enc = inEuint256({ data: abi.encode(amount), securityZone: 0 });
    vault.depositEncrypted(enc, amount);

    Permission memory permission = _permission(member1, member1Pk, bytes32(uint256(123)));
    uint256 ctHash = vault.getEncryptedBalanceCtHash(permission);

    // In our mock, ctHash == plaintext amount
    assertEq(ctHash, amount);
    vm.stopPrank();
  }

  function test_MultipleDeposits_HomomorphicAdd_Mocked() public {
    uint256 a = 7 * 1e6;
    uint256 b = 11 * 1e6;

    vm.startPrank(member1);
    usdc.approve(address(vault), a + b);
    vault.depositEncrypted(inEuint256({ data: abi.encode(a), securityZone: 0 }), a);
    vault.depositEncrypted(inEuint256({ data: abi.encode(b), securityZone: 0 }), b);

    Permission memory permission = _permission(member1, member1Pk, bytes32(uint256(456)));
    uint256 ctHash = vault.getEncryptedBalanceCtHash(permission);
    assertEq(ctHash, a + b);
    vm.stopPrank();
  }

  function test_Withdraw_DecrementsActiveMemberCount() public {
    uint256 amount = 12 * 1e6;

    vm.startPrank(member1);
    usdc.approve(address(vault), amount);
    vault.depositEncrypted(inEuint256({ data: abi.encode(amount), securityZone: 0 }), amount);
    vm.stopPrank();

    assertEq(vault.memberCount(), 1);
    assertEq(usdc.balanceOf(member1), 1_000_000_000 - amount);

    vm.prank(member1);
    vault.withdraw(amount);

    assertEq(vault.memberCount(), 0);
    assertEq(vault.activeMemberCount(), 0);
    assertFalse(vault.isMember(member1));
    assertEq(usdc.balanceOf(member1), 1_000_000_000);
  }
}
