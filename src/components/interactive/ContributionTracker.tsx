import React from "react";
import { useContributionData } from "@/hooks/data/useContributionData";
import ComponentLoader from "@/components/shared/ComponentLoader";

/**
 * ContributionTracker
 *
 * Displays real-time contribution totals for a syndicate.
 * Now fetches data via `useContributionData` hook.
 */
export const ContributionTracker: React.FC = () => {
  const { data, loading, error } = useContributionData();

  if (loading) {
    return <ComponentLoader />;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg text-red-600">
        Failed to load contributions.
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { totalContributions, contributorsCount } = data;

  const formatNumber = (num: number): string => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="flex flex-col items-center p-4 bg-white rounded-lg shadow-sm">
      <h3 className="text-lg font-medium text-gray-800 mb-2">
        Syndicate Contributions
      </h3>
      <div className="text-2xl font-bold text-green-600">
        ${formatNumber(totalContributions)}
      </div>
      <div className="text-sm text-gray-500 mt-1">
        from {contributorsCount}{" "}
        {contributorsCount === 1 ? "member" : "members"}
      </div>
    </div>
  );
};

export default ContributionTracker;
