// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
// Uniswap v4 core interfaces (v4.0.0, in-repo: lib/v4-core)
// ─────────────────────────────────────────────────────────────────────────────
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "v4-core/types/BalanceDelta.sol";

// ─────────────────────────────────────────────────────────────────────────────
// OpenZeppelin
// ─────────────────────────────────────────────────────────────────────────────
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// ─────────────────────────────────────────────────────────────────────────────
// Internal
// ─────────────────────────────────────────────────────────────────────────────
import {PrizePoolHook} from "./PrizePoolHook.sol";

/**
 * @title PrizePoolSwapRouter
 * @notice M2: the swap wrapper that makes the prize pot self-funding.
 *
 * @dev THE MECHANIC
 * The hook cannot take tokens out of a v4 pool, so swaps on the lottery pool route
 * through THIS contract instead of the default router:
 *   1. pull `amountIn` from the user,
 *   2. withhold `surcharge` (surchargeBps% of the input) — this is the "pot cut",
 *   3. swap only the net (exact input),
 *   4. inside afterSwap the hook PHYSICALLY pulls the withheld `surcharge` into the
 *      pot (input == pot currency), so the pot accrues real tokens at swap time,
 *   5. settle the net input to the PoolManager and take the output for the user.
 *
 * No phantom money: potBalance only grows when tokens actually move.
 *
 * @dev FAILURE HANDLING
 * If the lock reverts (e.g. slippage), every inner state change is rolled back, so
 * this contract still holds the user's full `amountIn` — it refunds and bubbles the
 * original revert. Users can never leave funds stuck in the router.
 *
 * @dev NON-USDC INPUT
 * Surcharges from non-USDC inputs (e.g. WOKB) are parked in `pendingConversion` and
 * converted to USDC in M3. The pot never silently mixes currencies.
 */
contract PrizePoolSwapRouter is IUnlockCallback {
    using SafeERC20 for IERC20;
    using BalanceDeltaLibrary for BalanceDelta;

    /// @notice Magic value the router embeds in hookData so the hook only accepts
    /// surcharge credit from this router's swaps. Mirrored in PrizePoolHook.
    bytes4 public constant ROUTER_MAGIC = bytes4(keccak256("Syndicate PrizePool Surcharge"));

    // ─── Errors ───
    error NotPoolManager();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidSwapDelta();
    error SlippageExceeded();
    error RouterNotActive();
    error OnlyHook();

    // ─── Events ───
    event SurchargeWithheld(address indexed swapper, Currency indexed input, uint256 surcharge, uint256 netIn);

    // ─── State ───
    IPoolManager public immutable poolManager;
    PrizePoolHook public immutable hook;

    /// @notice The lottery pool this router serves (must carry the hook).
    PoolKey public poolKey;

    /// @notice Non-USDC surcharges withheld here, parked until M3 converts them to USDC.
    mapping(Currency => uint256) public pendingConversion;

    constructor(IPoolManager _poolManager, PrizePoolHook _hook, PoolKey memory _poolKey) {
        if (address(_poolManager) == address(0)) revert InvalidAddress();
        if (address(_hook) == address(0)) revert InvalidAddress();
        if (address(_poolKey.hooks) != address(_hook)) revert InvalidAddress();
        poolManager = _poolManager;
        hook = _hook;
        poolKey = _poolKey;

        // Let the hook pull USDC surcharges during afterSwap.
        IERC20(Currency.unwrap(_poolKey.currency0)).forceApprove(address(_hook), type(uint256).max);
        IERC20(Currency.unwrap(_poolKey.currency1)).forceApprove(address(_hook), type(uint256).max);
    }

    /// @notice Exact-input swap with a pot surcharge. The user approves this router
    /// for `amountIn` of the input token.
    /// @param zeroForOne true: currency0 → currency1; false: currency1 → currency0
    /// @param amountIn   gross input (surcharge withheld from this)
    /// @param minAmountOut slippage floor; the user's input is refunded on violation
    /// @param sqrtPriceLimitX96 price limit (0 = no limit)
    /// @return amountOut the output received by the caller
    function swapExactInput(bool zeroForOne, uint256 amountIn, uint256 minAmountOut, uint160 sqrtPriceLimitX96)
        external
        returns (uint256 amountOut)
    {
        if (amountIn == 0) revert InvalidAmount();
        if (hook.swapRouter() != address(this)) revert RouterNotActive();

        Currency input = zeroForOne ? poolKey.currency0 : poolKey.currency1;
        IERC20(Currency.unwrap(input)).safeTransferFrom(msg.sender, address(this), amountIn);

        // The hook is the single source of truth for the surcharge policy (the AI
        // agent tunes it there); this router just executes it.
        uint256 surcharge =
            hook.surchargeEnabled() && hook.surchargeBps() > 0 ? (amountIn * uint256(hook.surchargeBps())) / 10_000 : 0;
        uint256 netIn = amountIn - surcharge;
        bytes memory hookData = abi.encode(ROUTER_MAGIC, surcharge);

        try poolManager.unlock(abi.encode(zeroForOne, netIn, minAmountOut, sqrtPriceLimitX96, msg.sender, hookData))
        returns (bytes memory result) {
            amountOut = abi.decode(result, (uint256));
        } catch (bytes memory reason) {
            // A failed lock rolled back all inner state (including any surcharge the
            // hook pulled), so this contract holds the full amountIn. Refund + bubble.
            IERC20(Currency.unwrap(input)).safeTransfer(msg.sender, amountIn);
            assembly ("memory-safe") {
                revert(add(reason, 0x20), mload(reason))
            }
        }

        // Non-USDC surcharges stay here (M3 converts them); USDC ones were pulled by
        // the hook inside afterSwap.
        if (surcharge > 0 && Currency.unwrap(input) != Currency.unwrap(hook.potCurrency())) {
            pendingConversion[input] += surcharge;
        }
        emit SurchargeWithheld(msg.sender, input, surcharge, netIn);
    }

    /// @notice Sweep non-USDC surcharge balances from a retired router. The hook
    /// controls this path so a replacement cannot strand pending conversion funds.
    function sweepRetiredBalance(Currency currency, address recipient, uint256 amount) external {
        if (msg.sender != address(hook)) revert OnlyHook();
        IERC20(Currency.unwrap(currency)).safeTransfer(recipient, amount);
    }

    /// @notice Called by the PoolManager inside lock(). Executes the swap, settles the
    /// net input, and hands the output to the recipient.
    function unlockCallback(bytes calldata rawData) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();

        (
            bool zeroForOne,
            uint256 netIn,
            uint256 minAmountOut,
            uint160 sqrtPriceLimitX96,
            address recipient,
            bytes memory hookData
        ) = abi.decode(rawData, (bool, uint256, uint256, uint160, address, bytes));

        Currency input = zeroForOne ? poolKey.currency0 : poolKey.currency1;
        Currency output = zeroForOne ? poolKey.currency1 : poolKey.currency0;

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: -int256(netIn),
            sqrtPriceLimitX96: sqrtPriceLimitX96
        });
        BalanceDelta delta = poolManager.swap(poolKey, params, hookData);
        // afterSwap fired during the swap: for USDC-input swaps the hook pulled the
        // surcharge from this contract into potBalance already.

        int128 outDelta = zeroForOne ? delta.amount1() : delta.amount0();
        if (outDelta <= 0) revert InvalidSwapDelta();
        uint256 amountOut = uint256(int256(outDelta));
        if (amountOut < minAmountOut) revert SlippageExceeded();

        // Settle the input: checkpoint balance → transfer net input → settle.
        poolManager.sync(input);
        IERC20(Currency.unwrap(input)).safeTransfer(address(poolManager), netIn);
        poolManager.settle();

        // Hand the output to the user.
        poolManager.take(output, recipient, amountOut);

        return abi.encode(amountOut);
    }
}
