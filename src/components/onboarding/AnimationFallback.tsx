// Fallback animations for when framer-motion is not available
"use client";

import React from 'react';

// Simple CSS-based animations as fallback
export const motion = {
  div: ({ children, className, initial, animate, exit, transition, ...props }: any) => (
    <div className={`${className} animate-fade-in`} {...props}>
      {children}
    </div>
  ),
  button: ({ children, className, whileHover, whileTap, ...props }: any) => (
    <button className={`${className} transition-transform hover:scale-105 active:scale-95`} {...props}>
      {children}
    </button>
  )
};

export const AnimatePresence = ({ children, mode }: any) => (
  <div className="animate-presence">
    {children}
  </div>
);

// Add CSS animations
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    .animate-fade-in {
      animation: fadeIn 0.3s ease-in-out;
    }
    
    .animate-presence > * {
      animation: slideIn 0.3s ease-in-out;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(-10px); }
      to { opacity: 1; transform: translateX(0); }
    }
  `;
  document.head.appendChild(style);
}