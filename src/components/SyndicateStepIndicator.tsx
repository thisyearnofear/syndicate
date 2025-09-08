"use client";

import React from 'react';
import { Check, Users, Heart, Target, Eye } from 'lucide-react';

interface SyndicateStepIndicatorProps {
  currentStep: 'basic' | 'cause' | 'config' | 'preview';
  className?: string;
}

export default function SyndicateStepIndicator({ currentStep, className = '' }: SyndicateStepIndicatorProps) {
  const steps = [
    { id: 'basic', label: 'Basic Info', icon: Users },
    { id: 'cause', label: 'Choose Cause', icon: Heart },
    { id: 'config', label: 'Configure', icon: Target },
    { id: 'preview', label: 'Preview', icon: Eye }
  ];

  const getCurrentStepIndex = () => steps.findIndex(step => step.id === currentStep);
  const currentIndex = getCurrentStepIndex();

  return (
    <div className={`flex items-center justify-center space-x-4 ${className}`}>
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isUpcoming = index > currentIndex;

        return (
          <div key={step.id} className="flex items-center">
            {/* Step Circle */}
            <div className={`
              relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300
              ${isCompleted ? 'bg-green-500 border-green-500 text-white' : ''}
              ${isCurrent ? 'bg-purple-600 border-purple-600 text-white scale-110' : ''}
              ${isUpcoming ? 'bg-gray-700 border-gray-600 text-gray-400' : ''}
            `}>
              {isCompleted ? (
                <Check className="w-5 h-5" />
              ) : (
                <Icon className="w-5 h-5" />
              )}
              
              {/* Pulse animation for current step */}
              {isCurrent && (
                <div className="absolute inset-0 rounded-full bg-purple-600 animate-ping opacity-30"></div>
              )}
            </div>

            {/* Step Label */}
            <div className={`ml-2 text-sm font-medium transition-colors duration-300 ${
              isCompleted || isCurrent ? 'text-white' : 'text-gray-400'
            }`}>
              {step.label}
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div className={`w-8 h-0.5 mx-4 transition-colors duration-300 ${
                isCompleted ? 'bg-green-500' : 'bg-gray-600'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}