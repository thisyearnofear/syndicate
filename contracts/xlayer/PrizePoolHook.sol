// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
// Uniswap v4 core interfaces (v4.0.0, in-repo: lib/v4-core)
// ─────────────────────────────────────────────────────────────────────────────
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "v4-core/types/BalanceDelta.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/types/BeforeSwapDelta.sol";

// ─────────────────────────────────────────────────────────────────────────────
// OpenZeppelin (in-repo: lib/openzeppelin-contracts)
// ─────────────────────────────────────────────────────────────────────────────
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// ─────────────────────────────────────────────────────────────────────────────
// Internal
// ─────────────────────────────────────────────────────────────────────────────
import {IRandomnessOracle} from "./interfaces/IRandomnessOracle.sol";

/**
 * @title PrizePoolHook
 * @notice A Uniswap v4 hook that turns swap fees into a lossless lottery on X Layer.
 *
 * @dev THE PITCH
 * "The DEX is the lottery." Depositors provide USDC to the hook, which acts as the
 * pool's liquidity provider. Swap fees split into LP yield + a prize pot. Every epoch,
 * the pot is awarded to one depositor, weighted by their share at the snapshot. Everyone
 * keeps their principal and can redeem it between epochs (FWA's "keep or sell back" ->
 * guaranteed redeem path). FWA principles kept: weighted selection, snapshot/FIFO
 * anti-gaming (deposits after the snapshot count only for the next draw), guaranteed
 * exit, and exits locked while a draw is open (see withdrawPrincipal).
 *
 * @dev MILESTONE MAP (see contracts/xlayer/README.md)
 *   M1 (this file): deposit/withdraw principal, pot accounting, snapshot-based epoch
 *     draws, weighted winner selection, randomness via IRandomnessOracle seam, and the
 *     v4 hook shell (beforeSwap/afterSwap) compiling against real v4-core interfaces.
 *   M2 (implemented): swaps route through PrizePoolSwapRouter, which withholds the
 *     surcharge up front; this hook PHYSICALLY pulls it from the router inside
 *     afterSwap, so potBalance grows with real tokens at swap time.
 *   M3: hook provides pool liquidity; LP fees split into per-depositor yield + pot.
 *   M4: drand beacon verifier + permissionless relay (BLS12-381) behind IRandomnessOracle.
 *
 * @dev HONESTY GUARANTEE
 * potBalance is only ever increased by tokens that physically arrive (deposits,
 * fundPot, or the afterSwap surcharge pull from the swap router). There is no
 * phantom accounting — a dollar in the pot is a dollar in this contract.
 *
 * @dev DEPLOYMENT NOTE (v4.0.0)
 * Hook permissions are encoded in the least-significant bits of the deployed hook
 * address. The deployer must set BEFORE_SWAP + AFTER_SWAP (+ AFTER_INITIALIZE) bits;
 * see the v4-core Hooks library and the deploy script in later milestones.
 *
 * @custom:security This is hackathon-grade code. Review before mainnet (timelock on
 * draw parameters and rejection sampling to remove modulo bias are planned hardening).
 * The draw timeout is a liveness escape, not a fairness oracle. M1 assumptions: the pot token is
 * trusted (USDC) and the randomness oracle is owner-set and trusted (a malicious
 * oracle is equivalent to a rug).
 */
contract PrizePoolHook is IHooks {
    using SafeERC20 for IERC20;
    using CurrencyLibrary for Currency;

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════
    error NotPoolManager();
    error NotOwner();
    error InvalidAddress();
    error InvalidAmount();
    error DrawNotOpen();
    error DrawOpen();
    error DrawAlreadyOpen();
    error DrawNotResolved();
    error DrawAlreadyResolved();
    error NoEntries();
    error PotTooSmall();
    error InvalidRandomness();
    error NotWinner();
    error AlreadyClaimed();
    error CooldownNotElapsed();
    error OracleNotSet();
    error PoolNotConfigured();
    error PoolAlreadyConfigured();
    error DrawTimeoutNotElapsed();
    error ConfigTimelockRequired();
    error ConfigNotScheduled();
    error ConfigTimelockNotPassed();
    error RouterChangeNotScheduled();
    error RouterChangeTimelockNotPassed();

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════
    event Deposited(address indexed depositor, uint256 amount);
    event Withdrawn(address indexed depositor, uint256 amount);
    event PotFunded(address indexed funder, uint256 amount);
    event PoolBound(PoolId indexed poolId);
    event DrawOpened(uint256 indexed epochId, uint256 potAtSnapshot, uint256 snapshotTotalShares, uint256 snapshotAt);
    event DrawResolved(uint256 indexed epochId, address indexed winner, uint256 randomValue);
    event PrizeClaimed(uint256 indexed epochId, address indexed winner, uint256 amount);
    event SwapSurcharged(PoolId indexed poolId, address indexed swapper, uint256 surcharge);
    event SurchargeConfigUpdated(uint24 surchargeBps, bool enabled);
    event RandomnessOracleUpdated(address indexed oracle);
    event MinPotUpdated(uint256 minPotForDraw);
    event DrawCooldownUpdated(uint256 drawCooldown);
    event DrawResolutionTimeoutUpdated(uint256 drawResolutionTimeout);
    event DrawCancelled(uint256 indexed epochId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ConfigurationScheduled(uint256 executeAfter);
    event ConfigurationExecuted();
    event RouterChangeScheduled(address indexed router, uint256 executeAfter);
    event RouterChanged(address indexed previousRouter, address indexed newRouter);

    // ═══════════════════════════════════════════════════════════════════════════
    // IMMUTABLE / STATE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice The v4 PoolManager this hook serves (canonical on X Layer mainnet).
    IPoolManager public immutable poolManager;

    /// @notice Pot + principal token (USDC on X Layer, 6 decimals).
    Currency public immutable potCurrency;
    address public immutable potToken;

    address public owner;

    /// @notice Randomness delivery seam (drand in production, mock in tests).
    IRandomnessOracle public randomnessOracle;

    /// @notice Per-swap surcharge toward the pot, in basis points (10_000 = 100%).
    uint24 public surchargeBps;
    /// @notice Disabled until the M2 swap wrapper physically settles surcharge tokens.
    bool public surchargeEnabled;

    /// @notice Router surcharge must leave at least half the gross input for the swap.
    uint24 public constant MAX_SURCHARGE_BPS = 5_000;

    /// @notice USDC physically held by this contract for prizes.
    uint256 public potBalance;

    /// @notice The registered swap router. Only swaps initiated by it can fund the pot
    /// via afterSwap (it embeds ROUTER_MAGIC + the withheld amount in hookData).
    address public swapRouter;

    /// @notice Magic value embedded in the router's hookData; mirrored in the router.
    bytes4 public constant ROUTER_MAGIC = bytes4(keccak256("Syndicate PrizePool Surcharge"));

    /// @notice Depositor principal (always redeemable).
    mapping(address => uint256) public principal;
    /// @notice Depositor shares (1 wei = 1 share in M1; odds = share / totalShares).
    mapping(address => uint256) public shares;
    uint256 public totalShares;
    /// @notice Append-only depositor list for the weighted pick (skips zero-share slots).
    address[] public depositors;

    /// @notice Per-epoch frozen shares — the anti-gaming snapshot (FWA FIFO ordering).
    mapping(uint256 => mapping(address => uint256)) public epochShares;

    struct DrawState {
        bool open; // snapshot taken, awaiting randomness
        bool resolved; // winner determined
        bool claimed; // pot paid out
        bool cancelled; // draw timed out without a payout
        uint256 epochId;
        uint256 snapshotAt;
        uint256 snapshotTotalShares;
        uint256 potAtSnapshot;
        address winner;
        uint256 randomValue;
    }

    DrawState public draw;

    uint256 public minPotForDraw;
    uint256 public drawCooldown;
    /// @notice Maximum time a draw may wait for randomness before cancellation.
    uint256 public drawResolutionTimeout = 1 days;
    uint256 public lastDrawAt;

    uint256 public constant CONFIG_TIMELOCK = 2 days;

    struct PendingRouterChange {
        address router;
        uint256 executeAfter;
    }

    PendingRouterChange public pendingRouterChange;

    struct PendingConfiguration {
        uint24 surchargeBps;
        bool surchargeEnabled;
        address oracle;
        uint256 minPotForDraw;
        uint256 drawCooldown;
        uint256 drawResolutionTimeout;
        uint256 executeAfter;
    }

    PendingConfiguration public pendingConfiguration;

    /// @notice The single pool this hook instance serves (configured before afterInitialize).
    PoolId public expectedPoolId;
    PoolKey public expectedPoolKey;
    PoolId public boundPoolId;
    PoolKey public boundPoolKey;
    bool public poolConfigSet;
    bool public poolBound;

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════
    constructor(IPoolManager _poolManager, Currency _potCurrency, address _owner) {
        if (address(_poolManager) == address(0)) revert InvalidAddress();
        if (_potCurrency.isAddressZero()) revert InvalidAddress();
        if (_owner == address(0)) revert InvalidAddress();
        poolManager = _poolManager;
        potCurrency = _potCurrency;
        potToken = Currency.unwrap(_potCurrency);
        owner = _owner;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONFIGURATION (owner)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Set the per-swap pot surcharge. The swap router reads this policy and
    /// withholds the cut; this hook pulls it physically during afterSwap.
    function setSurcharge(uint24 _surchargeBps, bool enabled) external onlyOwner {
        if (poolBound) revert ConfigTimelockRequired();
        _setSurcharge(_surchargeBps, enabled);
    }

    /// @notice Register the swap router (M2) whose swaps fund the pot.
    function setSwapRouter(address _swapRouter) external onlyOwner {
        if (poolBound || swapRouter != address(0)) revert ConfigTimelockRequired();
        if (_swapRouter == address(0)) revert InvalidAddress();
        swapRouter = _swapRouter;
    }

    function scheduleRouterChange(address _swapRouter, uint256 executeAfter) external onlyOwner {
        if (!poolBound || _swapRouter == address(0)) revert InvalidAddress();
        if (!_isCompatibleRouter(_swapRouter)) revert InvalidAddress();
        if (executeAfter < block.timestamp + CONFIG_TIMELOCK) revert ConfigTimelockRequired();
        pendingRouterChange = PendingRouterChange({router: _swapRouter, executeAfter: executeAfter});
        emit RouterChangeScheduled(_swapRouter, executeAfter);
    }

    function executeRouterChange() external onlyOwner {
        PendingRouterChange memory pending = pendingRouterChange;
        if (pending.executeAfter == 0) revert RouterChangeNotScheduled();
        if (block.timestamp < pending.executeAfter) revert RouterChangeTimelockNotPassed();
        delete pendingRouterChange;
        address previousRouter = swapRouter;
        swapRouter = pending.router;
        emit RouterChanged(previousRouter, swapRouter);
    }

    /// @notice Recover tokens left in a retired router after a replacement.
    function sweepRetiredRouterBalance(address retiredRouter, Currency currency, uint256 amount, address recipient)
        external
        onlyOwner
    {
        if (retiredRouter == swapRouter || retiredRouter == address(0) || recipient == address(0)) {
            revert InvalidAddress();
        }
        (bool success,) = retiredRouter.call(
            abi.encodeWithSignature("sweepRetiredBalance(address,address,uint256)", currency, recipient, amount)
        );
        if (!success) revert InvalidAddress();
    }

    function _isCompatibleRouter(address candidate) internal view returns (bool compatible) {
        (bool okHook, bytes memory hookResult) = candidate.staticcall(abi.encodeWithSignature("hook()"));
        (bool okManager, bytes memory managerResult) = candidate.staticcall(abi.encodeWithSignature("poolManager()"));
        (bool okKey, bytes memory keyResult) = candidate.staticcall(abi.encodeWithSignature("poolKey()"));
        if (
            !okHook || !okManager || !okKey || hookResult.length < 32 || managerResult.length < 32
                || keyResult.length < 160
        ) {
            return false;
        }
        address candidateHook = abi.decode(hookResult, (address));
        address candidateManager = abi.decode(managerResult, (address));
        PoolKey memory candidateKey = abi.decode(keyResult, (PoolKey));
        return candidateHook == address(this) && candidateManager == address(poolManager)
            && PoolId.unwrap(candidateKey.toId()) == PoolId.unwrap(boundPoolId);
    }

    function setRandomnessOracle(IRandomnessOracle oracle) external onlyOwner {
        if (poolBound) revert ConfigTimelockRequired();
        _setRandomnessOracle(oracle);
    }

    function setMinPotForDraw(uint256 _minPotForDraw) external onlyOwner {
        if (poolBound) revert ConfigTimelockRequired();
        minPotForDraw = _minPotForDraw;
        emit MinPotUpdated(_minPotForDraw);
    }

    function setDrawCooldown(uint256 _drawCooldown) external onlyOwner {
        if (poolBound) revert ConfigTimelockRequired();
        drawCooldown = _drawCooldown;
        emit DrawCooldownUpdated(_drawCooldown);
    }

    function setDrawResolutionTimeout(uint256 _drawResolutionTimeout) external onlyOwner {
        if (poolBound) revert ConfigTimelockRequired();
        if (_drawResolutionTimeout < 1 days) revert InvalidAmount();
        drawResolutionTimeout = _drawResolutionTimeout;
        emit DrawResolutionTimeoutUpdated(_drawResolutionTimeout);
    }

    function scheduleConfiguration(
        uint24 _surchargeBps,
        bool _surchargeEnabled,
        IRandomnessOracle _oracle,
        uint256 _minPotForDraw,
        uint256 _drawCooldown,
        uint256 _drawResolutionTimeout,
        uint256 executeAfter
    ) external onlyOwner {
        if (!poolBound) revert PoolNotConfigured();
        if (_surchargeBps > MAX_SURCHARGE_BPS || address(_oracle) == address(0) || _drawResolutionTimeout < 1 days) {
            revert InvalidAmount();
        }
        if (executeAfter < block.timestamp + CONFIG_TIMELOCK) revert ConfigTimelockRequired();
        pendingConfiguration = PendingConfiguration({
            surchargeBps: _surchargeBps,
            surchargeEnabled: _surchargeEnabled,
            oracle: address(_oracle),
            minPotForDraw: _minPotForDraw,
            drawCooldown: _drawCooldown,
            drawResolutionTimeout: _drawResolutionTimeout,
            executeAfter: executeAfter
        });
        emit ConfigurationScheduled(executeAfter);
    }

    function executeConfiguration() external onlyOwner {
        PendingConfiguration memory pending = pendingConfiguration;
        if (pending.executeAfter == 0) revert ConfigNotScheduled();
        if (block.timestamp < pending.executeAfter) revert ConfigTimelockNotPassed();
        delete pendingConfiguration;
        _setSurcharge(pending.surchargeBps, pending.surchargeEnabled);
        _setRandomnessOracle(IRandomnessOracle(pending.oracle));
        minPotForDraw = pending.minPotForDraw;
        drawCooldown = pending.drawCooldown;
        drawResolutionTimeout = pending.drawResolutionTimeout;
        emit MinPotUpdated(minPotForDraw);
        emit DrawCooldownUpdated(drawCooldown);
        emit DrawResolutionTimeoutUpdated(drawResolutionTimeout);
        emit ConfigurationExecuted();
    }

    function _setSurcharge(uint24 _surchargeBps, bool enabled) internal {
        if (_surchargeBps > MAX_SURCHARGE_BPS) revert InvalidAmount();
        surchargeBps = _surchargeBps;
        surchargeEnabled = enabled;
        emit SurchargeConfigUpdated(_surchargeBps, enabled);
    }

    function _setRandomnessOracle(IRandomnessOracle oracle) internal {
        if (address(oracle) == address(0)) revert InvalidAddress();
        randomnessOracle = oracle;
        emit RandomnessOracleUpdated(address(oracle));
    }

    /// @notice Configure the exact pool this hook may bind to before initialization.
    /// This prevents an attacker from front-running the first afterInitialize callback.
    function configurePool(PoolKey calldata key) external onlyOwner {
        _configurePool(key);
    }

    function _configurePool(PoolKey calldata key) internal {
        if (poolConfigSet || poolBound) revert PoolAlreadyConfigured();
        if (address(key.hooks) != address(this)) revert InvalidAddress();
        if (Currency.unwrap(key.currency0) != potToken && Currency.unwrap(key.currency1) != potToken) {
            revert InvalidAddress();
        }
        expectedPoolId = key.toId();
        expectedPoolKey = key;
        poolConfigSet = true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DEPOSITOR FLOWS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Deposit USDC. Principal is preserved; shares accrue for the NEXT epoch
    /// if a draw is already open (snapshot anti-gaming).
    function deposit(uint256 amount) external {
        if (amount == 0) revert InvalidAmount();
        IERC20(potToken).safeTransferFrom(msg.sender, address(this), amount);

        if (shares[msg.sender] == 0) depositors.push(msg.sender);
        unchecked {
            principal[msg.sender] += amount;
            shares[msg.sender] += amount;
            totalShares += amount;
        }
        emit Deposited(msg.sender, amount);
    }

    /// @notice Redeem principal between epochs. While a draw is open, exits are locked
    /// (same rule as SyndicatePool's post-purchase exit lock): the open draw's snapshot
    /// shares are frozen per-epoch (FWA FIFO), so a depositor who exits mid-draw would
    /// otherwise stay eligible for a pot they no longer fund.
    function withdrawPrincipal(uint256 amount) external {
        if (draw.open) revert DrawOpen();
        if (amount == 0 || amount > principal[msg.sender]) revert InvalidAmount();
        unchecked {
            principal[msg.sender] -= amount;
            shares[msg.sender] -= amount;
            totalShares -= amount;
        }
        IERC20(potToken).safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Seed the pot (M1 admin path; M2/M3 replace this with surcharge + LP-fee
    /// sweeps so the pot funds itself from trading).
    function fundPot(uint256 amount) external onlyOwner {
        if (amount == 0) revert InvalidAmount();
        IERC20(potToken).safeTransferFrom(msg.sender, address(this), amount);
        potBalance += amount;
        emit PotFunded(msg.sender, amount);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DRAW STATE MACHINE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Open a new epoch: freeze per-user shares + pot, await randomness.
    /// Callable by anyone (keeper / AI agent). Cooldown + min pot are the AI agent's
    /// strategy knobs (fee split + draw cadence recommendations).
    function openDraw() external {
        if (draw.open) revert DrawAlreadyOpen();
        if (draw.resolved && !draw.claimed) revert DrawAlreadyResolved();
        if (block.timestamp < lastDrawAt + drawCooldown) revert CooldownNotElapsed();
        if (potBalance < minPotForDraw) revert PotTooSmall();

        uint256 nextEpoch = draw.epochId + 1;
        uint256 snapTotal;
        uint256 len = depositors.length;
        for (uint256 i = 0; i < len; ++i) {
            address d = depositors[i];
            uint256 s = shares[d];
            if (s == 0) continue;
            epochShares[nextEpoch][d] = s;
            snapTotal += s;
        }
        if (snapTotal == 0) revert NoEntries();

        draw = DrawState({
            open: true,
            resolved: false,
            claimed: false,
            cancelled: false,
            epochId: nextEpoch,
            snapshotAt: block.timestamp,
            snapshotTotalShares: snapTotal,
            potAtSnapshot: potBalance,
            winner: address(0),
            randomValue: 0
        });
        lastDrawAt = block.timestamp;
        emit DrawOpened(nextEpoch, potBalance, snapTotal, block.timestamp);
    }

    /// @notice Cancel an abandoned draw after the resolution timeout. The pot remains
    /// untouched and the next epoch can be opened; this also releases exit locks.
    function cancelDraw() external {
        if (!draw.open) revert DrawNotOpen();
        if (block.timestamp < draw.snapshotAt + drawResolutionTimeout) revert DrawTimeoutNotElapsed();
        draw.open = false;
        draw.cancelled = true;
        emit DrawCancelled(draw.epochId);
    }

    /// @notice Deliver randomness and resolve the draw. Permissionless — any relayer
    /// (including the AI agent) can submit, but only a value valid per the oracle
    /// (e.g. an authentic, un-reused drand beacon) is accepted.
    function fulfillRandomness(uint256 beaconValue, bytes calldata proof) external {
        if (!draw.open) revert DrawNotOpen();
        if (address(randomnessOracle) == address(0)) revert OracleNotSet();

        uint256 seed = deriveSeed();
        if (!randomnessOracle.isRandomnessValid(draw.epochId, seed, beaconValue, proof)) {
            revert InvalidRandomness();
        }

        address winner = computeWinner(seed, beaconValue);
        draw.open = false;
        draw.resolved = true;
        draw.cancelled = false;
        draw.winner = winner;
        draw.randomValue = beaconValue;
        emit DrawResolved(draw.epochId, winner, beaconValue);
    }

    /// @notice Winner claims the pot. They keep their principal + shares (lossless).
    function claimPrize() external {
        if (!draw.resolved) revert DrawNotResolved();
        if (draw.claimed) revert AlreadyClaimed();
        if (msg.sender != draw.winner) revert NotWinner();

        uint256 prize = draw.potAtSnapshot;
        draw.claimed = true;
        draw.cancelled = false;
        potBalance -= prize;
        IERC20(potToken).safeTransfer(msg.sender, prize);
        emit PrizeClaimed(draw.epochId, msg.sender, prize);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEWS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Draw-bound seed tying the beacon value to this exact draw (prevents
    /// replaying a beacon value across epochs).
    function deriveSeed() public view returns (uint256) {
        return uint256(
            keccak256(abi.encodePacked(draw.epochId, draw.snapshotAt, draw.potAtSnapshot, draw.snapshotTotalShares))
        );
    }

    /// @notice Weighted winner for `(seed, beaconValue)` against the CURRENT epoch's
    /// frozen snapshot. Pure + public so the UI can preview winners before the tx.
    /// @dev NOTE: modulo bias is acceptable at demo scale; production hardening should
    /// add rejection sampling (see README).
    function computeWinner(uint256 seed, uint256 beaconValue) public view returns (address winner_) {
        uint256 snapTotal = draw.snapshotTotalShares;
        if (snapTotal == 0) revert NoEntries();
        uint256 randomIndex = uint256(keccak256(abi.encodePacked(seed, beaconValue))) % snapTotal;

        uint256 cumulative;
        uint256 len = depositors.length;
        for (uint256 i = 0; i < len; ++i) {
            address d = depositors[i];
            uint256 s = epochShares[draw.epochId][d];
            if (s == 0) continue;
            cumulative += s;
            if (randomIndex < cumulative) return d;
        }
        revert NoEntries(); // unreachable if snapshot is consistent — defensive
    }

    /// @notice Full draw state (public struct getters return tuples; this keeps the
    /// struct shape for the UI and tests).
    function getDraw() external view returns (DrawState memory) {
        return draw;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // v4 HOOK CALLBACKS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @dev Bind this instance to the owner-configured pool (one pool per hook
    /// instance in V1). Only the PoolManager may trigger this.
    function afterInitialize(address, PoolKey calldata key, uint160, int24) external returns (bytes4) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        if (!poolConfigSet) revert PoolNotConfigured();
        if (PoolId.unwrap(key.toId()) != PoolId.unwrap(expectedPoolId)) revert InvalidAddress();
        if (!poolBound) {
            boundPoolId = key.toId();
            boundPoolKey = key;
            poolBound = true;
            emit PoolBound(key.toId());
        }
        return IHooks.afterInitialize.selector;
    }

    function beforeInitialize(address, PoolKey calldata, uint160) external returns (bytes4) {
        return IHooks.beforeInitialize.selector;
    }

    function beforeAddLiquidity(address, PoolKey calldata, IPoolManager.ModifyLiquidityParams calldata, bytes calldata)
        external
        returns (bytes4)
    {
        return IHooks.beforeAddLiquidity.selector;
    }

    function afterAddLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external returns (bytes4, BalanceDelta) {
        return (IHooks.afterAddLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }

    function beforeRemoveLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external returns (bytes4) {
        return IHooks.beforeRemoveLiquidity.selector;
    }

    function afterRemoveLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external returns (bytes4, BalanceDelta) {
        return (IHooks.afterRemoveLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }

    /// @dev No-op: static fee pool, no pre-swap state changes.
    function beforeSwap(address, PoolKey calldata, IPoolManager.SwapParams calldata, bytes calldata)
        external
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    /// @dev M2: physically fund the pot from the swap router's withheld surcharge.
    /// The router embeds `(ROUTER_MAGIC, surcharge)` in hookData; only swaps it
    /// initiated on the bound pool can credit the pot, and only when the input
    /// currency IS the pot currency (USDC). Non-USDC surcharges stay parked in the
    /// router (M3 converts them). Draws pay from potBalance only.
    function afterSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) external returns (bytes4, int128) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        if (
            !surchargeEnabled || surchargeBps == 0 || !poolBound
                || PoolId.unwrap(key.toId()) != PoolId.unwrap(boundPoolId) || swapRouter == address(0)
        ) {
            return (IHooks.afterSwap.selector, 0);
        }

        // Only swaps initiated by the registered router carry the surcharge magic.
        // Swaps through any OTHER router pass arbitrary hookData — never revert on it.
        if (sender != swapRouter || hookData.length != 64) return (IHooks.afterSwap.selector, 0);
        (bytes4 magic, uint256 surcharge) = abi.decode(hookData, (bytes4, uint256));
        if (magic != ROUTER_MAGIC || surcharge == 0) return (IHooks.afterSwap.selector, 0);

        // Sanity: the surcharge can never exceed the swap's actual input.
        int128 inputDelta = params.zeroForOne ? delta.amount0() : delta.amount1();
        if (inputDelta >= 0) return (IHooks.afterSwap.selector, 0);
        uint256 inputAmount = uint256(-int256(inputDelta));
        if (surcharge > inputAmount) revert InvalidAmount();

        // Only USDC-input swaps fund the USDC pot; others park in the router (M3).
        Currency input = params.zeroForOne ? key.currency0 : key.currency1;
        if (Currency.unwrap(input) != Currency.unwrap(potCurrency)) return (IHooks.afterSwap.selector, 0);

        // Physical pull: potBalance only grows when the tokens actually arrive.
        IERC20(potToken).safeTransferFrom(swapRouter, address(this), surcharge);
        potBalance += surcharge;
        emit SwapSurcharged(key.toId(), sender, surcharge);
        return (IHooks.afterSwap.selector, 0);
    }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external returns (bytes4) {
        return IHooks.beforeDonate.selector;
    }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external returns (bytes4) {
        return IHooks.afterDonate.selector;
    }
}
