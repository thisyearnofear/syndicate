/**
 * AUTO-PURCHASE SETTINGS COMPONENT
 * 
 * Core Principles Applied:
 * - ENHANCEMENT FIRST: New settings panel for managing auto-purchases
 * - CLEAN: Display permission status and execution history
 * - MODULAR: Can be embedded in user settings page
 * - ORGANIZED: Clear sections for different concerns
 * 
 * Displays:
 * - Current permission status
 * - Auto-purchase frequency and amount
 * - Last 5 executions
 * - Option to revoke or pause
 */

'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, AlertCircle as CheckCircle, Clock, Trash2, ToggleLeft, ToggleRight, Loader } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { useAdvancedPermissions, useAutoPurchaseState } from '@/hooks/useAdvancedPermissions';
import { useGelatoAutomation } from '@/hooks/useGelatoAutomation';
import { ImprovedAutoPurchaseModal } from '../modal/ImprovedAutoPurchaseModal';
import type { AutoPurchaseConfig } from '@/domains/wallet/types';
import { useAccount } from 'wagmi';

// =============================================================================
// COMPONENT
// =============================================================================

export function AutoPurchaseSettings() {
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  const { address } = useAccount();
  const {
    permission,
    autoPurchaseConfig,
    revokePermission,
    saveAutoPurchaseConfig,
  } = useAdvancedPermissions();

  const autoPurchaseState = useAutoPurchaseState();
  const gelato = useGelatoAutomation(address);

  // ENHANCEMENT FIRST: Sync Gelato task when permission changes
  useEffect(() => {
    if (!permission || !address || isCreatingTask) return;

    // If permission exists but no Gelato task, create one
    if (!gelato.activeTask && permission) {
      (async () => {
        setIsCreatingTask(true);
        const frequency = autoPurchaseState.config?.frequency || 'weekly';
        const success = await gelato.createTask(permission, frequency);
        if (!success) {
          console.warn('Failed to create Gelato task');
        }
        setIsCreatingTask(false);
      })();
    }
  }, [permission, address, gelato.activeTask]);

  // CLEAN: Handle permission granted
  const handlePermissionGranted = async (config: AutoPurchaseConfig) => {
    saveAutoPurchaseConfig(config);

    // ENHANCEMENT FIRST: Create database record for Vercel Cron automation
    if (address && config.permission) {
      try {
        const response = await fetch('/api/automation/create-purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: address,
            permissionId: config.permission.id,
            frequency: config.frequency,
            amountPerPeriod: config.amountPerPeriod.toString(),
          }),
        });

        if (!response.ok) {
          console.error('[AutoPurchaseSettings] Failed to create database record');
        } else {
          const data = (await response.json()) as { purchaseId?: string };
          console.log('[AutoPurchaseSettings] Database record created:', data.purchaseId);
        }
      } catch (err) {
        console.error('[AutoPurchaseSettings] Database creation error:', err);
        // Don't block on database error - automation still works via localStorage
      }
    }

    setShowPermissionModal(false);
  };

  // CLEAN: Handle revoke - also cancel Gelato task
  const handleRevoke = async () => {
    setIsCreatingTask(true);
    try {
      // Cancel Gelato task if active
      if (gelato.activeTask?.taskId) {
        await gelato.cancelTask();
      }
      
      // Revoke permission
      revokePermission();
      setShowRevokeConfirm(false);
    } finally {
      setIsCreatingTask(false);
    }
  };

  // CLEAN: Handle pause/resume - sync with Gelato
  const handleToggleEnabled = async () => {
    if (!autoPurchaseConfig || !gelato.activeTask) return;

    setIsCreatingTask(true);
    try {
      const isEnabled = autoPurchaseConfig.enabled;
      
      if (isEnabled) {
        // Pause task in Gelato
        await gelato.pauseTask();
      } else {
        // Resume task in Gelato
        await gelato.resumeTask();
      }

      // Update local state
      const updated: AutoPurchaseConfig = {
        ...autoPurchaseConfig,
        enabled: !isEnabled,
      };
      saveAutoPurchaseConfig(updated);
    } finally {
      setIsCreatingTask(false);
    }
  };

  // If no permission granted, show enable button
  if (!permission || !autoPurchaseState.isEnabled) {
    return (
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">
                💡 Never Miss a Ticket
              </h3>
              <p className="text-sm text-gray-700 mb-4">
                Enable automatic weekly or monthly purchases. Just set it once and forget it.
              </p>
              <Button
                onClick={() => setShowPermissionModal(true)}
              >
                Enable Auto-Purchase
              </Button>
            </div>
          </div>
        </div>

        <ImprovedAutoPurchaseModal
          isOpen={showPermissionModal}
          onClose={() => setShowPermissionModal(false)}
          onSuccess={handlePermissionGranted}
        />
      </div>
    );
  }

  // Permission is active - show status and controls
  return (
    <div className="space-y-4">
      {/* ACTIVE STATUS */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-gray-900">
                Auto-Purchase Enabled
              </h3>
              <p className="text-sm text-gray-700 mt-1">
                Syndicate will automatically purchase lottery tickets on your behalf
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {isCreatingTask ? (
              <button
                disabled
                className="p-2 cursor-not-allowed"
              >
                <Loader className="w-5 h-5 text-gray-400 animate-spin" />
              </button>
            ) : autoPurchaseState.isEnabled ? (
              <button
                onClick={handleToggleEnabled}
                className="p-2 hover:bg-green-100 rounded transition-colors"
                title="Pause auto-purchase"
              >
                <ToggleRight className="w-5 h-5 text-green-600" />
              </button>
            ) : (
              <button
                onClick={handleToggleEnabled}
                className="p-2 hover:bg-green-100 rounded transition-colors"
                title="Resume auto-purchase"
              >
                <ToggleLeft className="w-5 h-5 text-gray-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PERMISSION DETAILS */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-3">Permission Details</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-600 uppercase tracking-wide">
              Frequency
            </p>
            <p className="text-sm font-semibold text-gray-900 mt-1 capitalize">
              {autoPurchaseState.config?.frequency || 'weekly'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 uppercase tracking-wide">
              Amount per Period
            </p>
            <p className="text-sm font-semibold text-gray-900 mt-1">
              ${Number(autoPurchaseState.config?.amountPerPeriod || BigInt(0)) / 10 ** 6} USDC
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 uppercase tracking-wide">
              Remaining Allowance
            </p>
            <p className="text-sm font-semibold text-gray-900 mt-1">
              ${Number(permission.remaining) / 10 ** 6} USDC
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 uppercase tracking-wide">
              Granted On
            </p>
            <p className="text-sm font-semibold text-gray-900 mt-1">
              {new Date(permission.grantedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* EXECUTION SCHEDULE */}
      {autoPurchaseState.nextExecution && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Next Purchase Scheduled
              </p>
              <p className="text-sm text-gray-700 mt-1">
                {new Date(autoPurchaseState.nextExecution).toLocaleString()}
              </p>
              {autoPurchaseState.config?.lastExecuted && (
                <p className="text-xs text-gray-600 mt-2">
                  Last executed: {new Date(autoPurchaseState.config.lastExecuted).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WARNING: LOW ALLOWANCE */}
      {permission.remaining < BigInt(10 * 10 ** 6) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Low Allowance
              </p>
              <p className="text-sm text-gray-700 mt-1">
                Your permission has less than $10 USDC remaining.
                Request a new permission to continue auto-purchases.
              </p>
              <Button
                onClick={() => setShowPermissionModal(true)}
                variant="secondary"
                size="sm"
                className="mt-2"
              >
                Increase Allowance
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DANGER ZONE */}
      <div className="border-2 border-red-200 rounded-lg p-4 space-y-3">
        <h4 className="font-semibold text-red-900">Danger Zone</h4>
        {!showRevokeConfirm ? (
          <Button
            onClick={() => setShowRevokeConfirm(true)}
            variant="destructive"
            className="w-full"
            disabled={isCreatingTask}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Revoke Permission
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-700">
              Are you sure you want to revoke auto-purchase permission? This will also cancel your Gelato automation task. You'll need to grant a new permission to re-enable auto-purchase.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowRevokeConfirm(false)}
                variant="secondary"
                className="flex-1"
                disabled={isCreatingTask}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRevoke}
                variant="destructive"
                className="flex-1"
                disabled={isCreatingTask}
              >
                {isCreatingTask ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Revoking...
                  </>
                ) : (
                  'Confirm Revoke'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL */}
      <ImprovedAutoPurchaseModal
        isOpen={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        onSuccess={handlePermissionGranted}
      />
    </div>
  );
}