"use client";

import { useState, useEffect } from "react";
import { Users, Trophy, Heart, Award, Calendar } from "lucide-react";
import type { SyndicateActivity } from "@/domains/lottery/types";

interface SocialFeedItem {
  id: string;
  syndicateId: string;
  syndicateName: string;
  syndicateCause: string;
  action: SyndicateActivity;
  user?: {
    name: string;
    avatar: string;
  };
  timestamp: string;
}

interface SocialFeedProps {
  className?: string;
}

export default function SocialFeed({ className = "" }: SocialFeedProps) {
  const [feedItems, setFeedItems] = useState<SocialFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching social feed data
    const mockFeedItems: SocialFeedItem[] = [
      {
        id: "1",
        syndicateId: "ocean-warriors",
        syndicateName: "Ocean Warriors",
        syndicateCause: "Ocean Cleanup",
        action: {
          type: "join",
          count: 5,
          timeframe: "just now"
        },
        user: {
          name: "Alex Johnson",
          avatar: "AJ"
        },
        timestamp: "2023-06-15T14:30:00Z"
      },
      {
        id: "2",
        syndicateId: "climate-action",
        syndicateName: "Climate Action",
        syndicateCause: "Climate Action",
        action: {
          type: "tickets",
          count: 20,
          timeframe: "5 minutes ago",
          amount: 20
        },
        user: {
          name: "Sam Rivera",
          avatar: "SR"
        },
        timestamp: "2023-06-15T14:25:00Z"
      },
      {
        id: "3",
        syndicateId: "education-first",
        syndicateName: "Education First",
        syndicateCause: "Education Access",
        action: {
          type: "win",
          count: 1,
          timeframe: "1 hour ago",
          amount: 5000
        },
        timestamp: "2023-06-15T13:30:00Z"
      },
      {
        id: "4",
        syndicateId: "food-security",
        syndicateName: "Food Security",
        syndicateCause: "Food Security",
        action: {
          type: "donation",
          count: 1,
          timeframe: "2 hours ago",
          amount: 1200
        },
        timestamp: "2023-06-15T12:30:00Z"
      },
      {
        id: "5",
        syndicateId: "ocean-warriors",
        syndicateName: "Ocean Warriors",
        syndicateCause: "Ocean Cleanup",
        action: {
          type: "join",
          count: 12,
          timeframe: "3 hours ago"
        },
        timestamp: "2023-06-15T11:30:00Z"
      }
    ];

    // Simulate API delay
    setTimeout(() => {
      setFeedItems(mockFeedItems);
      setLoading(false);
    }, 800);
  }, []);

  const getActionIcon = (type: SyndicateActivity["type"]) => {
    switch (type) {
      case "join": return <Users className="w-4 h-4 text-blue-400" />;
      case "tickets": return <Trophy className="w-4 h-4 text-yellow-400" />;
      case "win": return <Award className="w-4 h-4 text-green-400" />;
      case "donation": return <Heart className="w-4 h-4 text-red-400" />;
      default: return <Calendar className="w-4 h-4 text-gray-400" />;
    }
  };

  const getActionText = (action: SyndicateActivity, syndicateName: string, user?: { name: string }) => {
    switch (action.type) {
      case "join":
        return user 
          ? `${user.name} joined ${syndicateName} with ${action.count} friends`
          : `${action.count} new members joined ${syndicateName}`;
      case "tickets":
        return `${action.count} tickets purchased for ${syndicateName}`;
      case "win":
        return `${syndicateName} won $${action.amount?.toLocaleString()}!`;
      case "donation":
        return `${syndicateName} donated $${action.amount?.toLocaleString()} to ${syndicateName.split(' ')[0]}`;
      default:
        return `${action.count} ${action.type} in ${syndicateName}`;
    }
  };

  const getActionColor = (type: SyndicateActivity["type"]) => {
    switch (type) {
      case "join": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "tickets": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "win": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "donation": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  if (loading) {
    return (
      <div className={`space-y-3 ${className}`}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-premium p-4 rounded-xl animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-700"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-700 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {feedItems.map((item) => (
        <div 
          key={item.id} 
          className="glass-premium p-4 rounded-xl border border-white/20 hover:border-white/30 transition-all duration-300 hover-lift"
        >
          <div className="flex items-start gap-3">
            {item.user ? (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {item.user.avatar}
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {item.syndicateName.charAt(0)}
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm leading-relaxed">
                {getActionText(item.action, item.syndicateName, item.user)}
              </p>
              
              <div className="flex items-center gap-2 mt-2">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getActionColor(item.action.type)}`}>
                  {getActionIcon(item.action.type)}
                  {item.action.type.charAt(0).toUpperCase() + item.action.type.slice(1)}
                </span>
                <span className="text-xs text-gray-500">{item.action.timeframe}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
      
      <style jsx>{`
        .glass-premium {
          background: linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
          backdrop-filter: blur(12px);
        }
        .hover-lift {
          transition: transform 0.2s ease-in-out;
        }
        .hover-lift:hover {
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}