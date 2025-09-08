"use client";

import React from "react";

export default function NotificationSystem() {
  return (
    <div className="notification-system">
      {/* Notification bell icon */}
      <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-5 5v-5zM15 7v5H9V7h6zM12 2L9 5h6l-3-3z"
          />
        </svg>
        {/* Notification dot */}
        <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></div>
      </button>
    </div>
  );
}
