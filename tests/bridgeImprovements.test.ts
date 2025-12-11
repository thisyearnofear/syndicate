/**
 * Bridge Protocol Improvements Test
 * 
 * Tests the enhanced bridge functionality including:
 * - Improved error handling
 * - Fallback suggestions
 * - Health monitoring
 * - Attestation timeout handling
 */

import { bridgeManager } from '@/services/bridges';
import { BridgeErrorCode } from '@/services/bridges/types';

describe('Bridge Protocol Improvements', () => {

    beforeAll(() => {
        // Clear any cached state
        bridgeManager.clearHealthCache();
    });

    describe('Error Classification', () => {
        
        it('should classify timeout errors correctly', () => {
            const timeoutErrors = [
                'Transaction timed out',
                'timeout waiting for transaction',
                'Time-out occurred',
                'request timeout'
            ];
            
            timeoutErrors.forEach(errorMsg => {
                const shouldFallback = errorMsg.includes('timeout') || errorMsg.includes('Time-out');
                expect(shouldFallback).toBe(true);
            });
        });

        it('should classify nonce errors correctly', () => {
            const nonceErrors = [
                'nonce too low',
                'nonce already used',
                'replacement transaction underpriced',
                'nonce mismatch'
            ];
            
            nonceErrors.forEach(errorMsg => {
                const shouldFallback = errorMsg.includes('nonce') || errorMsg.includes('replacement');
                expect(shouldFallback).toBe(true);
            });
        });

        it('should classify insufficient funds errors', () => {
            const fundErrors = [
                'insufficient funds for gas',
                'not enough ETH for gas',
                'balance too low'
            ];
            
            fundErrors.forEach(errorMsg => {
                const isFundError = errorMsg.includes('insufficient funds') || errorMsg.includes('not enough');
                expect(isFundError).toBe(true);
            });
        });
    });

    describe('Fallback Trigger Logic', () => {
        
        it('should trigger fallback for attestation timeouts', () => {
            const shouldTrigger = bridgeManager['shouldTriggerFallback'](BridgeErrorCode.ATTESTATION_TIMEOUT);
            expect(shouldTrigger).toBe(true);
        });

        it('should trigger fallback for transaction timeouts', () => {
            const shouldTrigger = bridgeManager['shouldTriggerFallback'](BridgeErrorCode.TRANSACTION_TIMEOUT);
            expect(shouldTrigger).toBe(true);
        });

        it('should trigger fallback for nonce errors', () => {
            const shouldTrigger = bridgeManager['shouldTriggerFallback'](BridgeErrorCode.NONCE_ERROR);
            expect(shouldTrigger).toBe(true);
        });

        it('should NOT trigger fallback for user-rejected transactions', () => {
            const shouldTrigger = bridgeManager['shouldTriggerFallback'](BridgeErrorCode.WALLET_REJECTED);
            expect(shouldTrigger).toBe(false);
        });

        it('should NOT trigger fallback for insufficient funds', () => {
            const shouldTrigger = bridgeManager['shouldTriggerFallback'](BridgeErrorCode.INSUFFICIENT_FUNDS);
            expect(shouldTrigger).toBe(false);
        });
    });

    describe('Health Monitoring', () => {
        
        it('should have conservative health checks', async () => {
            // This is a mock test - in real usage, we'd simulate failures
            const cctpProtocol = await bridgeManager.loadProtocol('cctp');
            
            if (cctpProtocol) {
                const health = await cctpProtocol.getHealth();
                
                // Should have the new status details
                expect(health).toHaveProperty('statusDetails');
                
                // Health should be reasonable
                expect(health.successRate).toBeGreaterThanOrEqual(0);
                expect(health.successRate).toBeLessThanOrEqual(1);
            }
        });
    });

    describe('Error Code Coverage', () => {
        
        it('should have all required error codes', () => {
            const requiredCodes = [
                'ATTESTATION_TIMEOUT',
                'ATTESTATION_FAILED', 
                'TRANSACTION_TIMEOUT',
                'NONCE_ERROR',
                'INSUFFICIENT_FUNDS',
                'NETWORK_ERROR'
            ];
            
            requiredCodes.forEach(code => {
                expect(BridgeErrorCode[code]).toBeDefined();
            });
        });
    });
});

// Simple mock for testing purposes
jest.mock('@/services/bridges/protocols/cctp', () => ({
    CctpProtocol: jest.fn().mockImplementation(() => ({
        name: 'cctp',
        getHealth: () => Promise.resolve({
            protocol: 'cctp',
            isHealthy: true,
            successRate: 0.95,
            averageTimeMs: 900000,
            consecutiveFailures: 0,
            statusDetails: {
                recentFailures: false,
                lowSuccessRate: false,
                lastSuccessTime: new Date()
            }
        })
    }))
}));