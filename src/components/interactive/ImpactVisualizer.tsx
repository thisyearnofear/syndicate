import React from "react";
import { colors } from "@/lib/constants/design";
import { DelightAnimation } from "@/components/interactive/DelightAnimation";

/**
 * ImpactVisualizer
 *
 * Visualizes the impact of a syndicate or jackpot contribution.
 *
 * Props:
 * - cause: string – name of the cause (e.g., "Ocean Cleanup")
 * - metric: string – description of the metric (e.g., "Trees Planted")
 * - value: number – numeric value to display
 *
 * Core Principles:
 *   - DRY: single source of truth for impact display
 *   - MODULAR: composable and testable in isolation
 *   - PERFORMANT: lightweight markup, animation can be added later
 */
export interface ImpactVisualizerProps {
  cause: string;
  metric: string;
  value: number;
}

/**
 * Helper to format large numbers (e.g., 1500 → "1.5k").
 */
const formatValue = (num: number): string => {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return num.toString();
};

export const ImpactVisualizer: React.FC<ImpactVisualizerProps> = ({
  cause,
  metric,
  value,
}) => {
  return (
    <DelightAnimation>
      <div
        className="flex flex-col items-center p-4 rounded-lg shadow-sm"
        style={{
          backgroundColor: colors.surface,
          color: colors.textPrimary,
        }}
      >
        <h4 className="text-lg font-medium mb-1">{cause}</h4>
        <div className="text-2xl font-bold text-green-600">
          {formatValue(value)}
        </div>
        <p className="text-sm">{metric}</p>
      </div>
    </DelightAnimation>
  );
};

export default ImpactVisualizer;
