"use client";

import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  Users, 
  TrendingUp, 
  Globe, 
  Droplets, 
  Utensils, 
  GraduationCap, 
  Leaf,
  Award,
  Target,
  BarChart3,
  MapPin
} from 'lucide-react';

interface CauseImpactTrackerProps {
  poolId?: string;
  userContribution?: number;
  className?: string;
}

const CAUSE_IMPACTS = {
  'ocean-cleanup': {
    icon: Droplets,
    name: 'Ocean Cleanup',
    color: 'blue',
    totalImpact: {
      primary: { value: 2847, unit: 'kg', label: 'Plastic Removed' },
      secondary: { value: 156, unit: 'km²', label: 'Ocean Area Cleaned' }
    },
    recentActivity: [
      { action: 'Plastic removed from Pacific Gyre', amount: '45kg', time: '2 hours ago', location: 'Pacific Ocean' },
      { action: 'Beach cleanup completed', amount: '23kg', time: '5 hours ago', location: 'California Coast' },
      { action: 'Microplastic filtered', amount: '12kg', time: '8 hours ago', location: 'Great Barrier Reef' }
    ],
    milestones: [
      { target: 1000, achieved: 1000, label: 'First Ton Removed', completed: true },
      { target: 3000, achieved: 2847, label: 'Three Tons Goal', completed: false },
      { target: 5000, achieved: 2847, label: 'Five Tons Target', completed: false }
    ]
  },
  'food-security': {
    icon: Utensils,
    name: 'Food Security',
    color: 'green',
    totalImpact: {
      primary: { value: 12450, unit: 'meals', label: 'Meals Provided' },
      secondary: { value: 847, unit: 'families', label: 'Families Fed' }
    },
    recentActivity: [
      { action: 'Emergency food distribution', amount: '200 meals', time: '1 hour ago', location: 'Bangladesh' },
      { action: 'School lunch program', amount: '150 meals', time: '3 hours ago', location: 'Kenya' },
      { action: 'Community kitchen opened', amount: '100 meals', time: '6 hours ago', location: 'Haiti' }
    ],
    milestones: [
      { target: 5000, achieved: 5000, label: '5K Meals Milestone', completed: true },
      { target: 10000, achieved: 10000, label: '10K Meals Goal', completed: true },
      { target: 15000, achieved: 12450, label: '15K Meals Target', completed: false }
    ]
  },
  'education': {
    icon: GraduationCap,
    name: 'Education Access',
    color: 'purple',
    totalImpact: {
      primary: { value: 234, unit: 'students', label: 'Scholarships Funded' },
      secondary: { value: 12, unit: 'schools', label: 'Schools Supported' }
    },
    recentActivity: [
      { action: 'Scholarship awarded', amount: '1 student', time: '30 min ago', location: 'Rural India' },
      { action: 'School supplies delivered', amount: '50 students', time: '2 hours ago', location: 'Guatemala' },
      { action: 'Digital library established', amount: '200 students', time: '4 hours ago', location: 'Nigeria' }
    ],
    milestones: [
      { target: 100, achieved: 100, label: '100 Scholarships', completed: true },
      { target: 250, achieved: 234, label: '250 Students Goal', completed: false },
      { target: 500, achieved: 234, label: '500 Students Target', completed: false }
    ]
  },
  'climate': {
    icon: Leaf,
    name: 'Climate Action',
    color: 'emerald',
    totalImpact: {
      primary: { value: 1567, unit: 'trees', label: 'Trees Planted' },
      secondary: { value: 89, unit: 'tons CO₂', label: 'Carbon Offset' }
    },
    recentActivity: [
      { action: 'Reforestation project', amount: '50 trees', time: '1 hour ago', location: 'Amazon Basin' },
      { action: 'Urban tree planting', amount: '25 trees', time: '4 hours ago', location: 'São Paulo' },
      { action: 'Mangrove restoration', amount: '30 trees', time: '7 hours ago', location: 'Philippines' }
    ],
    milestones: [
      { target: 1000, achieved: 1000, label: '1K Trees Planted', completed: true },
      { target: 2000, achieved: 1567, label: '2K Trees Goal', completed: false },
      { target: 5000, achieved: 1567, label: '5K Trees Vision', completed: false }
    ]
  }
};

export default function CauseImpactTracker({ 
  poolId = 'ocean-cleanup', 
  userContribution = 0,
  className = '' 
}: CauseImpactTrackerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'milestones'>('overview');
  const [animateNumbers, setAnimateNumbers] = useState(false);
  
  const causeData = CAUSE_IMPACTS[poolId as keyof typeof CAUSE_IMPACTS] || CAUSE_IMPACTS['ocean-cleanup'];
  const IconComponent = causeData.icon;

  useEffect(() => {
    setAnimateNumbers(true);
  }, []);

  const getColorClasses = (color: string) => {
    const colors = {
      blue: {
        bg: 'bg-blue-500/20',
        border: 'border-blue-500/30',
        text: 'text-blue-400',
        accent: 'text-blue-300'
      },
      green: {
        bg: 'bg-green-500/20',
        border: 'border-green-500/30',
        text: 'text-green-400',
        accent: 'text-green-300'
      },
      purple: {
        bg: 'bg-purple-500/20',
        border: 'border-purple-500/30',
        text: 'text-purple-400',
        accent: 'text-purple-300'
      },
      emerald: {
        bg: 'bg-emerald-500/20',
        border: 'border-emerald-500/30',
        text: 'text-emerald-400',
        accent: 'text-emerald-300'
      }
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  const colorClasses = getColorClasses(causeData.color);

  return (
    <div className={`cause-impact-tracker ${className}`}>
      {/* Header */}
      <div className={`${colorClasses.bg} ${colorClasses.border} border rounded-xl p-6 mb-6`}>
        <div className="flex items-center gap-4 mb-4">
          <div className={`p-3 ${colorClasses.bg} rounded-full`}>
            <IconComponent className={`w-6 h-6 ${colorClasses.text}`} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{causeData.name} Impact</h2>
            <p className="text-gray-300">Real-time impact from your lottery pool</p>
          </div>
          <div className="ml-auto">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Globe className="w-4 h-4" />
              <span>Live Updates</span>
            </div>
          </div>
        </div>

        {/* Impact Stats */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="text-center">
            <div className={`text-3xl font-bold ${colorClasses.text} ${animateNumbers ? 'animate-pulse' : ''}`}>
              {causeData.totalImpact.primary.value.toLocaleString()}
            </div>
            <div className="text-lg font-medium text-white">
              {causeData.totalImpact.primary.unit}
            </div>
            <div className="text-sm text-gray-400">
              {causeData.totalImpact.primary.label}
            </div>
          </div>
          
          <div className="text-center">
            <div className={`text-3xl font-bold ${colorClasses.text} ${animateNumbers ? 'animate-pulse' : ''}`}>
              {causeData.totalImpact.secondary.value.toLocaleString()}
            </div>
            <div className="text-lg font-medium text-white">
              {causeData.totalImpact.secondary.unit}
            </div>
            <div className="text-sm text-gray-400">
              {causeData.totalImpact.secondary.label}
            </div>
          </div>
        </div>

        {/* User Contribution */}
        {userContribution > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="text-center">
              <div className="text-sm text-gray-400 mb-1">Your Contribution</div>
              <div className={`text-lg font-semibold ${colorClasses.accent}`}>
                ~{Math.round(userContribution * 0.2 * causeData.totalImpact.primary.value / 1000)} {causeData.totalImpact.primary.unit}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex justify-center mb-6">
        <div className="bg-gray-800/50 rounded-lg p-1 border border-gray-700">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'activity', label: 'Live Activity', icon: TrendingUp },
            { id: 'milestones', label: 'Milestones', icon: Target }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-md transition-all duration-200 flex items-center gap-2 ${
                activeTab === tab.id
                  ? `${colorClasses.bg} ${colorClasses.text}`
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Impact Visualization */}
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Impact Over Time</h3>
            <div className="space-y-4">
              {causeData.milestones.map((milestone, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">{milestone.label}</span>
                    <span className={milestone.completed ? colorClasses.text : 'text-gray-400'}>
                      {milestone.achieved}/{milestone.target}
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-1000 ${
                        milestone.completed ? colorClasses.bg.replace('/20', '') : colorClasses.bg
                      }`}
                      style={{ width: `${Math.min((milestone.achieved / milestone.target) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Social Proof */}
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Community Impact</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">47</div>
                <div className="text-sm text-gray-400">Pool Members</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">$2,840</div>
                <div className="text-sm text-gray-400">Total Raised</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">20%</div>
                <div className="text-sm text-gray-400">Goes to Cause</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Recent Impact Activity</h3>
          {causeData.recentActivity.map((activity, index) => (
            <div key={index} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium text-white">{activity.action}</div>
                  <div className={`text-lg font-semibold ${colorClasses.text}`}>{activity.amount}</div>
                  <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                    <MapPin className="w-3 h-3" />
                    {activity.location}
                  </div>
                </div>
                <div className="text-sm text-gray-400">{activity.time}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'milestones' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Achievement Milestones</h3>
          {causeData.milestones.map((milestone, index) => (
            <div key={index} className={`rounded-lg p-4 border ${
              milestone.completed 
                ? `${colorClasses.bg} ${colorClasses.border}` 
                : 'bg-gray-800/50 border-gray-700'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {milestone.completed ? (
                    <Award className={`w-5 h-5 ${colorClasses.text}`} />
                  ) : (
                    <Target className="w-5 h-5 text-gray-400" />
                  )}
                  <div>
                    <div className={`font-medium ${milestone.completed ? colorClasses.text : 'text-white'}`}>
                      {milestone.label}
                    </div>
                    <div className="text-sm text-gray-400">
                      {milestone.achieved.toLocaleString()} / {milestone.target.toLocaleString()}
                    </div>
                  </div>
                </div>
                {milestone.completed && (
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${colorClasses.bg} ${colorClasses.text}`}>
                    Completed
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}