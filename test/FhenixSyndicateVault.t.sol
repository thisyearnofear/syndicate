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

    function sealOutput(uint8, bytes memory handle, bytes memory) external pure returns (string memory) {
        // Decode the uint256 plaintext from the handle and return it as bytes-encoded string
        uint256 val = abi.decode(handle, (uint256));
        return string(abi.encode(val));
    }

    function decrypt(uint8, bytes memory, uint256 defaultValue) external pure returns (uint256) {
        return defaultValue;
    }

    // FHE.sub support for distributeYield
    function sub(uint8, bytes memory lhs, bytes memory rhs) external pure returns (bytes memory) {
        uint256 a = abi.decode(lhs, (uint256));
        uint256 b = abi.decode(rhs, (uint256));
        return abi.encode(a - b);
    }
}

contract FhenixSyndicateVaultTest is Test {
    MockUSDC internal usdc;
    FhenixSyndicateVault internal vault;

    event DepositShielded(address indexed from, uint256 placeholder);
    event YieldDistributed(uint256 timestamp);
    event ApyUpdated(uint256 oldApy, uint256 newApy);

    uint256 internal coordinatorPk = 0xA11CE;
    uint256 internal member1Pk = 0xB0B;
    uint256 internal member2Pk = 0xB0B2;
    uint256 internal member3Pk = 0xC0FFEE;

    address internal coordinator;
    address internal member1;
    address internal member2;
    address internal member3;

    function setUp() public {
        coordinator = vm.addr(coordinatorPk);
        member1 = vm.addr(member1Pk);
        member2 = vm.addr(member2Pk);
        member3 = vm.addr(member3Pk);

        usdc = new MockUSDC();
        vault = new FhenixSyndicateVault(address(usdc), coordinator);

        // Install mock FHE precompile code at address(128)
        MockFheOps ops = new MockFheOps();
        vm.etch(address(128), address(ops).code);

        // Fund members
        usdc.mint(member1, 1_000_000_000); // 1000 USDC (6 decimals)
        usdc.mint(member2, 1_000_000_000);
        usdc.mint(member3, 1_000_000_000);

        // Fund coordinator (for yield deposits)
        usdc.mint(coordinator, 1_000_000_000);
    }

    function _permission(address signer, uint256 signerPk, bytes32 publicKey)
        internal
        view
        returns (Permission memory)
    {
        bytes32 typeHash =
            keccak256(bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"));
        bytes32 domainSeparator = keccak256(
            abi.encode(
                typeHash, keccak256(bytes("Fhenix Permission")), keccak256(bytes("1.0")), block.chainid, address(vault)
            )
        );

        bytes32 structHash = keccak256(abi.encode(keccak256(bytes("Permissioned(bytes32 publicKey)")), publicKey));

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        // sanity: recovered signer should match
        address recovered = ecrecover(digest, v, r, s);
        assertEq(recovered, signer, "bad permission signature");

        return Permission({publicKey: publicKey, signature: sig});
    }

    // ─── Basic Deposit Tests ─────────────────────────────────────────────────────

    function test_DepositEncrypted_TracksMembersAndTotals() public {
        uint256 amount = 25 * 1e6; // 25 USDC

        vm.startPrank(member1);
        usdc.approve(address(vault), amount);

        inEuint64 memory enc = inEuint64({data: abi.encode(amount), securityZone: 0});

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
        inEuint64 memory enc = inEuint64({data: abi.encode(amount), securityZone: 0});
        vault.depositEncrypted(enc, amount);

        Permission memory permission = _permission(member1, member1Pk, bytes32(uint256(123)));
        string memory output = vault.getEncryptedBalanceCtHash(permission);

        // In our mock, sealed output contains the plaintext amount abi-encoded
        assertEq(output, string(abi.encode(amount)));
        vm.stopPrank();
    }

    function test_MultipleDeposits_HomomorphicAdd_Mocked() public {
        uint256 a = 7 * 1e6;
        uint256 b = 11 * 1e6;

        vm.startPrank(member1);
        usdc.approve(address(vault), a + b);
        vault.depositEncrypted(inEuint64({data: abi.encode(a), securityZone: 0}), a);
        vault.depositEncrypted(inEuint64({data: abi.encode(b), securityZone: 0}), b);

        Permission memory permission = _permission(member1, member1Pk, bytes32(uint256(456)));
        string memory output = vault.getEncryptedBalanceCtHash(permission);
        assertEq(output, string(abi.encode(a + b)));
        vm.stopPrank();
    }

    // ─── Fuzz Deposit Tests ──────────────────────────────────────────────────────

    /// @dev Fuzz: multiple random deposits by the same member should add up
    function testFuzz_MultipleDepositsAccumulate(uint88 amountA, uint88 amountB) public {
        // Bound to avoid overflow: max is ~100M USDC
        uint256 a = uint256(amountA) % (10_000 * 1e6);
        uint256 b = uint256(amountB) % (10_000 * 1e6);
        vm.assume(a > 0 && b > 0);

        vm.startPrank(member1);
        usdc.mint(member1, a + b);

        usdc.approve(address(vault), a + b);
        vault.depositEncrypted(inEuint64({data: abi.encode(a), securityZone: 0}), a);
        vault.depositEncrypted(inEuint64({data: abi.encode(b), securityZone: 0}), b);

        Permission memory permission = _permission(member1, member1Pk, bytes32(uint256(789)));
        string memory output = vault.getEncryptedBalanceCtHash(permission);
        assertEq(output, string(abi.encode(a + b)), "FHE add should accumulate deposits");
        assertEq(vault.totalDeposited(), a + b, "totalDeposited should match sum");
        vm.stopPrank();
    }

    /// @dev Fuzz: multiple members depositing different amounts
    function testFuzz_MultipleMembers(uint88 amount1, uint88 amount2, uint88 amount3) public {
        uint256 a = uint256(amount1) % (100_000 * 1e6);
        uint256 b = uint256(amount2) % (100_000 * 1e6);
        uint256 c = uint256(amount3) % (100_000 * 1e6);
        vm.assume(a > 0 && b > 0 && c > 0);

        // Member 1 deposits
        usdc.mint(member1, a);
        vm.prank(member1);
        usdc.approve(address(vault), a);
        vm.prank(member1);
        vault.depositEncrypted(inEuint64({data: abi.encode(a), securityZone: 0}), a);

        // Member 2 deposits
        usdc.mint(member2, b);
        vm.prank(member2);
        usdc.approve(address(vault), b);
        vm.prank(member2);
        vault.depositEncrypted(inEuint64({data: abi.encode(b), securityZone: 0}), b);

        // Member 3 deposits
        usdc.mint(member3, c);
        vm.prank(member3);
        usdc.approve(address(vault), c);
        vm.prank(member3);
        vault.depositEncrypted(inEuint64({data: abi.encode(c), securityZone: 0}), c);

        assertEq(vault.totalDeposited(), a + b + c, "totalDeposited should be sum of all deposits");
        assertEq(vault.memberCount(), 3, "all three should be members");
        assertEq(vault.activeMemberCount(), 3, "all three active");

        // Each member's balance should match their deposit (in mock)
        // Each getEncrypted* call must be pranked as the permission signer
        Permission memory p1 = _permission(member1, member1Pk, bytes32(uint256(1)));
        Permission memory p2 = _permission(member2, member2Pk, bytes32(uint256(2)));
        Permission memory p3 = _permission(member3, member3Pk, bytes32(uint256(3)));

        vm.prank(member1);
        assertEq(vault.getEncryptedBalanceCtHash(p1), string(abi.encode(a)));
        vm.prank(member2);
        assertEq(vault.getEncryptedBalanceCtHash(p2), string(abi.encode(b)));
        vm.prank(member3);
        assertEq(vault.getEncryptedBalanceCtHash(p3), string(abi.encode(c)));
    }

    // ─── Withdrawal Tests ────────────────────────────────────────────────────────

    function test_Withdraw_DecrementsActiveMemberCount() public {
        uint256 amount = 12 * 1e6;

        vm.startPrank(member1);
        usdc.approve(address(vault), amount);
        vault.depositEncrypted(inEuint64({data: abi.encode(amount), securityZone: 0}), amount);
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

    function test_Withdraw_OnlyMember() public {
        vm.prank(member1);
        vm.expectRevert(abi.encodeWithSignature("NotMember()"));
        vault.withdraw(100);
    }

    function test_Withdraw_ZeroAmount() public {
        vm.startPrank(member1);
        usdc.approve(address(vault), 100);
        vault.depositEncrypted(inEuint64({data: abi.encode(100), securityZone: 0}), 100);
        vm.expectRevert(abi.encodeWithSignature("ZeroAmount()"));
        vault.withdraw(0);
        vm.stopPrank();
    }

    /// @dev Fuzz: withdraw after deposit should return exact funds
    function testFuzz_DepositThenWithdraw_ReturnsExactFunds(uint88 depositAmount) public {
        uint256 amount = uint256(depositAmount) % (10_000 * 1e6);
        vm.assume(amount > 100); // Must be > 0, use 100 min for dust

        // Ensure member has enough USDC
        usdc.mint(member1, amount);

        uint256 balanceBefore = usdc.balanceOf(member1);

        vm.startPrank(member1);
        usdc.approve(address(vault), amount);
        vault.depositEncrypted(inEuint64({data: abi.encode(amount), securityZone: 0}), amount);
        vm.stopPrank();

        assertEq(vault.totalDeposited(), amount);

        vm.prank(member1);
        vault.withdraw(amount);

        assertEq(usdc.balanceOf(member1), balanceBefore, "Should recover full deposit");
        assertEq(vault.totalDeposited(), 0, "Vault should be empty");
        assertFalse(vault.isMember(member1), "Should no longer be member");
    }

    // ─── Yield Distribution Tests ────────────────────────────────────────────────

    function test_DepositYield_CoordinatorOnly() public {
        uint256 yieldAmount = 100 * 1e6; // 100 USDC

        // Non-coordinator should fail
        vm.startPrank(member1);
        usdc.approve(address(vault), yieldAmount);
        vm.expectRevert(abi.encodeWithSignature("NotCoordinator()"));
        vault.depositYield(inEuint64({data: abi.encode(yieldAmount), securityZone: 0}), yieldAmount);
        vm.stopPrank();
    }

    function test_DepositYield_AndDistribute() public {
        // Setup: member deposits 1000 USDC
        uint256 depositAmount = 1000 * 1e6;
        vm.startPrank(member1);
        usdc.mint(member1, depositAmount);
        usdc.approve(address(vault), depositAmount);
        vault.depositEncrypted(inEuint64({data: abi.encode(depositAmount), securityZone: 0}), depositAmount);
        vm.stopPrank();

        // Coordinator deposits 50 USDC yield
        uint256 yieldAmount = 50 * 1e6;
        vm.startPrank(coordinator);
        usdc.approve(address(vault), yieldAmount);
        vm.expectEmit(true, false, false, true, address(vault));
        emit YieldDistributed(block.timestamp);
        vault.depositYield(inEuint64({data: abi.encode(yieldAmount), securityZone: 0}), yieldAmount);
        vm.stopPrank();

        // Verify accumulated yield ctHash (coordinator only — must prank as coordinator)
        Permission memory coordPerm = _permission(coordinator, coordinatorPk, bytes32(uint256(999)));
        vm.prank(coordinator);
        string memory yieldOutput = vault.getAccumulatedYieldCtHash(coordPerm);
        assertEq(yieldOutput, string(abi.encode(yieldAmount)), "Accumulated yield should match deposit");

        // Coordinator distributes yield to member
        address[] memory members = new address[](1);
        members[0] = member1;

        inEuint64[] memory allocations = new inEuint64[](1);
        allocations[0] = inEuint64({data: abi.encode(yieldAmount), securityZone: 0});

        vm.prank(coordinator);
        vault.distributeYield(members, allocations);

        // After distribution, member's balance should include yield
        Permission memory memberPerm = _permission(member1, member1Pk, bytes32(uint256(111)));
        vm.prank(member1);
        string memory balanceOutput = vault.getEncryptedBalanceCtHash(memberPerm);
        assertEq(balanceOutput, string(abi.encode(depositAmount + yieldAmount)), "Member balance should include yield");

        // Accumulated yield should be zero
        vm.prank(coordinator);
        string memory remainingOutput = vault.getAccumulatedYieldCtHash(coordPerm);
        assertEq(remainingOutput, string(abi.encode(0)), "Accumulated yield should be zero after distribution");

        // Verify distributed yield tracker
        vm.prank(member1);
        string memory distOutput = vault.getYieldDistributedCtHash(member1, memberPerm);
        assertEq(distOutput, string(abi.encode(yieldAmount)), "Member yield distributed should match");
    }

    function test_DistributeYield_MultipleMembers() public {
        // Two members deposit different amounts
        uint256 deposit1 = 600 * 1e6;
        uint256 deposit2 = 400 * 1e6;

        usdc.mint(member1, deposit1);
        vm.prank(member1);
        usdc.approve(address(vault), deposit1);
        vm.prank(member1);
        vault.depositEncrypted(inEuint64({data: abi.encode(deposit1), securityZone: 0}), deposit1);

        usdc.mint(member2, deposit2);
        vm.prank(member2);
        usdc.approve(address(vault), deposit2);
        vm.prank(member2);
        vault.depositEncrypted(inEuint64({data: abi.encode(deposit2), securityZone: 0}), deposit2);

        // Coordinator deposits yield
        uint256 yieldAmount = 100 * 1e6;
        vm.startPrank(coordinator);
        usdc.approve(address(vault), yieldAmount);
        vault.depositYield(inEuint64({data: abi.encode(yieldAmount), securityZone: 0}), yieldAmount);
        vm.stopPrank();

        // Distribute proportionally: 60% to member1, 40% to member2
        uint256 alloc1 = 60 * 1e6;
        uint256 alloc2 = 40 * 1e6;

        address[] memory members = new address[](2);
        members[0] = member1;
        members[1] = member2;

        inEuint64[] memory allocations = new inEuint64[](2);
        allocations[0] = inEuint64({data: abi.encode(alloc1), securityZone: 0});
        allocations[1] = inEuint64({data: abi.encode(alloc2), securityZone: 0});

        vm.prank(coordinator);
        vault.distributeYield(members, allocations);

        // Each member should have their deposit + allocation
        Permission memory p1 = _permission(member1, member1Pk, bytes32(uint256(10)));
        Permission memory p2 = _permission(member2, member2Pk, bytes32(uint256(20)));

        vm.prank(member1);
        assertEq(vault.getEncryptedBalanceCtHash(p1), string(abi.encode(deposit1 + alloc1)));
        vm.prank(member2);
        assertEq(vault.getEncryptedBalanceCtHash(p2), string(abi.encode(deposit2 + alloc2)));
    }

    function test_DistributeYield_CoordinatorOnly() public {
        address[] memory members = new address[](1);
        members[0] = member1;

        inEuint64[] memory allocations = new inEuint64[](1);
        allocations[0] = inEuint64({data: abi.encode(100), securityZone: 0});

        vm.prank(member1);
        vm.expectRevert(abi.encodeWithSignature("NotCoordinator()"));
        vault.distributeYield(members, allocations);
    }

    function test_DistributeYield_SkipsNonMembers() public {
        // Member1 deposits, member2 does not
        uint256 deposit1 = 500 * 1e6;
        usdc.mint(member1, deposit1);
        vm.prank(member1);
        usdc.approve(address(vault), deposit1);
        vm.prank(member1);
        vault.depositEncrypted(inEuint64({data: abi.encode(deposit1), securityZone: 0}), deposit1);

        // Coordinator deposits and distributes
        uint256 yieldAmount = 50 * 1e6;
        vm.startPrank(coordinator);
        usdc.approve(address(vault), yieldAmount);
        vault.depositYield(inEuint64({data: abi.encode(yieldAmount), securityZone: 0}), yieldAmount);
        vm.stopPrank();

        // Try to distribute to member1 (valid) and member2 (non-member)
        address[] memory members = new address[](2);
        members[0] = member1;
        members[1] = member2;

        inEuint64[] memory allocations = new inEuint64[](2);
        allocations[0] = inEuint64({data: abi.encode(yieldAmount), securityZone: 0});
        allocations[1] = inEuint64({data: abi.encode(100), securityZone: 0});

        vm.prank(coordinator);
        vault.distributeYield(members, allocations);

        // Only member1 should have received yield
        Permission memory p1 = _permission(member1, member1Pk, bytes32(uint256(100)));
        vm.prank(member1);
        assertEq(
            vault.getEncryptedBalanceCtHash(p1),
            string(abi.encode(deposit1 + yieldAmount)),
            "Member1 should receive all yield"
        );
    }

    function test_DistributeYield_MismatchedArrays() public {
        address[] memory members = new address[](1);
        members[0] = member1;

        inEuint64[] memory allocations = new inEuint64[](2); // Mismatched length
        allocations[0] = inEuint64({data: abi.encode(100), securityZone: 0});
        allocations[1] = inEuint64({data: abi.encode(100), securityZone: 0});

        vm.prank(coordinator);
        vm.expectRevert(abi.encodeWithSignature("InvalidWithdrawAmount()"));
        vault.distributeYield(members, allocations);
    }

    // ─── Signed Withdrawal Tests ────────────────────────────────────────────────

    /// @dev Helper: compute EIP-712 typed data digest for a withdraw message
    function _withdrawDigest(address member, uint256 amount, uint256 nonce) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(keccak256("Withdraw(address member,uint256 amount,uint256 nonce)"), member, amount, nonce)
        );

        // Match the contract's EIP712 domain ("FhenixSyndicateVault", "1")
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("FhenixSyndicateVault")),
                keccak256(bytes("1")),
                block.chainid,
                address(vault)
            )
        );

        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    /// @dev Coordinate signs a withdrawal for member1
    function _signWithdraw(address member, uint256 amount, uint256 nonce) internal view returns (bytes memory) {
        bytes32 digest = _withdrawDigest(member, amount, nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(coordinatorPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_WithdrawSigned_ValidSignature() public {
        uint256 amount = 25 * 1e6;

        vm.startPrank(member1);
        usdc.approve(address(vault), amount);
        vault.depositEncrypted(inEuint64({data: abi.encode(amount), securityZone: 0}), amount);
        vm.stopPrank();

        bytes memory sig = _signWithdraw(member1, amount, 0);

        vm.prank(member1);
        vault.withdrawSigned(amount, sig);

        assertFalse(vault.isMember(member1), "Should no longer be a member");
        assertEq(vault.totalDeposited(), 0, "Vault should be empty");
        assertEq(vault.coordinatorNonces(member1), 1, "Nonce should increment");
    }

    function test_WithdrawSigned_WrongSigner() public {
        uint256 amount = 25 * 1e6;

        vm.startPrank(member1);
        usdc.approve(address(vault), amount);
        vault.depositEncrypted(inEuint64({data: abi.encode(amount), securityZone: 0}), amount);
        vm.stopPrank();

        // Sign with member1's key instead of coordinator — should fail
        bytes32 digest = _withdrawDigest(member1, amount, 0);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(member1Pk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(member1);
        vm.expectRevert(abi.encodeWithSignature("InvalidSignature()"));
        vault.withdrawSigned(amount, sig);
    }

    function test_WithdrawSigned_ReplayProtection() public {
        uint256 amount = 25 * 1e6;

        // Member1 deposits
        vm.startPrank(member1);
        usdc.approve(address(vault), amount);
        vault.depositEncrypted(inEuint64({data: abi.encode(amount), securityZone: 0}), amount);
        vm.stopPrank();

        bytes memory sig = _signWithdraw(member1, amount, 0);

        // First use — succeeds (nonce goes 0 → 1, member removed)
        vm.prank(member1);
        vault.withdrawSigned(amount, sig);

        // Member re-deposits (fresh encrypted balance, but nonce is now 1)
        usdc.mint(member1, amount);
        vm.startPrank(member1);
        usdc.approve(address(vault), amount);
        vault.depositEncrypted(inEuint64({data: abi.encode(amount), securityZone: 0}), amount);
        vm.stopPrank();

        // Replay old signature — nonce is now 1 on-chain, but sig was for nonce 0
        // The digest mismatch causes ecrecover to return wrong address → InvalidSignature
        vm.prank(member1);
        vm.expectRevert(abi.encodeWithSignature("InvalidSignature()"));
        vault.withdrawSigned(amount, sig);
    }

    function test_WithdrawSigned_OnlyMember() public {
        bytes memory sig = _signWithdraw(member1, 100, 0);
        vm.prank(member1);
        vm.expectRevert(abi.encodeWithSignature("NotMember()"));
        vault.withdrawSigned(100, sig);
    }

    function test_WithdrawSigned_WrongAmount() public {
        uint256 depositAmount = 100 * 1e6;
        uint256 signedAmount = 25 * 1e6;

        vm.startPrank(member1);
        usdc.mint(member1, depositAmount);
        usdc.approve(address(vault), depositAmount);
        vault.depositEncrypted(inEuint64({data: abi.encode(depositAmount), securityZone: 0}), depositAmount);
        vm.stopPrank();

        // Coordinator signs for 25 USDC
        bytes memory sig = _signWithdraw(member1, signedAmount, 0);

        // Member submits with 50 USDC — different amount than in signature
        // Bounds check passes (50 ≤ 100), but digest doesn't match signature → InvalidSignature
        vm.prank(member1);
        vm.expectRevert(abi.encodeWithSignature("InvalidSignature()"));
        vault.withdrawSigned(50 * 1e6, sig);
    }

    // ─── Coordinator Tests ───────────────────────────────────────────────────────

    function test_TransferCoordinator() public {
        vm.prank(coordinator);
        vault.transferCoordinator(member1);
        assertEq(vault.coordinator(), member1);
    }

    function test_TransferCoordinator_NotCoordinator() public {
        vm.prank(member1);
        vm.expectRevert(abi.encodeWithSignature("NotCoordinator()"));
        vault.transferCoordinator(member2);
    }

    // ─── APY Oracle Tests ───────────────────────────────────────────────────────

    function test_SetApy_CoordinatorOnly() public {
        vm.prank(member1);
        vm.expectRevert(abi.encodeWithSignature("NotCoordinator()"));
        vault.setApy(500);
    }

    function test_SetApy_UpdatesValue() public {
        assertEq(vault.currentApy(), 0, "Should start at 0");

        vm.prank(coordinator);
        vault.setApy(500); // 5.00%
        assertEq(vault.currentApy(), 500);

        vm.prank(coordinator);
        vault.setApy(670); // 6.70%
        assertEq(vault.currentApy(), 670);
    }

    function test_SetApy_EmitsEvent() public {
        vm.expectEmit(true, false, false, true, address(vault));
        emit ApyUpdated(0, 500);
        vm.prank(coordinator);
        vault.setApy(500);
    }

    function test_SetApy_RejectsOver100Percent() public {
        vm.prank(coordinator);
        vm.expectRevert(abi.encodeWithSignature("InvalidWithdrawAmount()"));
        vault.setApy(10_001);
    }

    // ─── Edge Case Tests ─────────────────────────────────────────────────────────

    function testRevert_ZeroDeposit() public {
        vm.startPrank(member1);
        usdc.approve(address(vault), 100);
        vm.expectRevert(abi.encodeWithSignature("ZeroAmount()"));
        vault.depositEncrypted(inEuint64({data: abi.encode(0), securityZone: 0}), 0);
        vm.stopPrank();
    }

    function testRevert_WithdrawMoreThanDeposited() public {
        uint256 amount = 100 * 1e6;

        vm.startPrank(member1);
        usdc.mint(member1, amount);
        usdc.approve(address(vault), amount);
        vault.depositEncrypted(inEuint64({data: abi.encode(amount), securityZone: 0}), amount);

        // Try to withdraw more than totalDeposited
        vm.expectRevert(abi.encodeWithSignature("InvalidWithdrawAmount()"));
        vault.withdraw(amount + 1);
        vm.stopPrank();
    }

    function testRevert_DepositWithoutApproval() public {
        // Don't approve — OZ ERC20.transferFrom reverts with ERC20InsufficientAllowance
        // before the vault's TransferFailed() check is reached
        vm.startPrank(member1);
        vm.expectRevert(
            abi.encodeWithSignature("ERC20InsufficientAllowance(address,uint256,uint256)", address(vault), 0, 100)
        );
        vault.depositEncrypted(inEuint64({data: abi.encode(100), securityZone: 0}), 100);
        vm.stopPrank();
    }

    function test_GetEncryptedTotalCtHash_CoordinatorOnly() public {
        // Sign permission as member1 so onlySender passes, then onlyCoordinator should revert
        Permission memory perm = _permission(member1, member1Pk, bytes32(uint256(42)));
        vm.prank(member1);
        vm.expectRevert(abi.encodeWithSignature("NotCoordinator()"));
        vault.getEncryptedTotalCtHash(perm);
    }

    function test_GetAccumulatedYieldCtHash_CoordinatorOnly() public {
        Permission memory perm = _permission(member1, member1Pk, bytes32(uint256(42)));
        vm.prank(member1);
        vm.expectRevert(abi.encodeWithSignature("NotCoordinator()"));
        vault.getAccumulatedYieldCtHash(perm);
    }
}
