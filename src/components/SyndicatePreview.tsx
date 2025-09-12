"use client";

import React, { useState } from 'react';
import { Users, Heart, Target, Share2, Copy, Check, Sparkles } from 'lucide-react';

interface SyndicatePreviewProps {
  formData: {
    name: string;
    description: string;
    cause: string;
    causePercentage: number;
    maxMembers: number;
    minTicketsPerMember: number;
  };
  memberPreview: Array<{ id: number; avatar: string; name: string }>;
  impactPreview: { totalRaised: number; causesSupported: number };
}

export default function SyndicatePreview({ formData, memberPreview, impactPreview }: SyndicatePreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const shareText = `Join my "${formData.name}" syndicate! We're pooling resources for lottery tickets while supporting ${formData.cause}. Together we can win big and make a difference!`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${formData.name} Syndicate`,
          text: shareText,
          url: window.location.href
        });
      } catch (err) {
        // DEBUG: console.log('Share cancelled');
      }
    } else {
      // Fallback to clipboard
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Syndicate Card Preview */}
      <div className="bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-xl p-6 border border-purple-500/30">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-white mb-2">{formData.name}</h3>
            <p className="text-gray-300 text-sm">{formData.description}</p>
          </div>
          <div className="bg-purple-600 rounded-full p-2">
            <Users className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* Cause Badge */}
        <div className="flex items-center gap-2 mb-4">
          <Heart className="w-4 h-4 text-red-400" />
          <span className="text-sm text-gray-300">Supporting: {formData.cause}</span>
          <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs">
            {formData.causePercentage}% to cause
          </span>
        </div>

        {/* Member Preview */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-gray-400">Members ({memberPreview.length}/{formData.maxMembers})</span>
          </div>
          <div className="flex -space-x-2">
            {memberPreview.slice(0, 6).map((member) => (
              <div
                key={member.id}
                className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-gray-800"
                title={member.name}
              >
                {member.avatar}
              </div>
            ))}
            {formData.maxMembers > 6 && (
              <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white text-xs border-2 border-gray-800">
                +{formData.maxMembers - 6}
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-lg font-bold text-white">{formData.maxMembers}</div>
            <div className="text-xs text-gray-400">Max Members</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-white">{formData.minTicketsPerMember}</div>
            <div className="text-xs text-gray-400">Min Tickets</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-400">${impactPreview.totalRaised.toFixed(0)}</div>
            <div className="text-xs text-gray-400">Est. Impact</div>
          </div>
        </div>

        {/* Share Button */}
        <button
          onClick={handleShare}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              Copied to Clipboard!
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4" />
              Share Syndicate
            </>
          )}
        </button>
      </div>

      {/* Impact Visualization */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-yellow-400" />
          <h4 className="font-semibold text-white">Potential Impact</h4>
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Estimated cause contribution:</span>
            <span className="font-bold text-green-400">${impactPreview.totalRaised.toFixed(2)}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Member winnings share:</span>
            <span className="font-bold text-blue-400">{100 - formData.causePercentage}%</span>
          </div>
          
          <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-500"
              style={{ width: `${formData.causePercentage}%` }}
            />
          </div>
          
          <div className="text-xs text-gray-400 text-center">
            {formData.causePercentage}% to {formData.cause} • {100 - formData.causePercentage}% to members
          </div>
        </div>
      </div>
    </div>
  );
}