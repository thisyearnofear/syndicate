import React from "react";

/**
 * Simple loading spinner component used across the app.
 * Utilizes Tailwind CSS for styling.
 *
 * The component respects the user's `prefers-reduced-motion` setting
 * by disabling the spin animation when reduced motion is requested.
 */
export const ComponentLoader: React.FC = () => {
  return (
    <div className="flex items-center justify-center p-8">
      <svg
        className="w-12 h-12 text-gray-500 animate-spin motion-reduce:animate-none"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-label="Loading"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        />
      </svg>
    </div>
  );
};

export default ComponentLoader;
