"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { 
  Share2, 
  Copy, 
  Check, 
  Twitter, 
  Facebook, 
  Linkedin, 
  MessageSquare
} from "lucide-react";

interface SocialShareProps {
  url: string;
  title: string;
  description: string;
  className?: string;
}

export default function SocialShare({ 
  url, 
  title, 
  description,
  className = ""
}: SocialShareProps) {
  const [isCopying, setIsCopying] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleCopy = async () => {
    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    } finally {
      setIsCopying(false);
    }
  };

  const handleShare = async (platform: string) => {
    const shareData = {
      title,
      text: description,
      url
    };

    try {
      switch (platform) {
        case 'native':
          if (navigator.share) {
            await navigator.share(shareData);
          } else {
            handleCopy();
          }
          break;
        case 'twitter':
          window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, '_blank');
          break;
        case 'facebook':
          window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
          break;
        case 'linkedin':
          window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
          break;
        default:
          handleCopy();
      }
    } catch (error) {
      console.error('Error sharing:', error);
      handleCopy(); // Fallback to copy
    }
  };

  return (
    <div className={`relative ${className}`}>
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
      >
        <Share2 className="w-4 h-4" />
        Share
      </Button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-2 z-50">
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => handleShare('native')}
              className="p-2"
              title="Share"
            >
              <Share2 className="w-4 h-4" />
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => handleShare('twitter')}
              className="p-2 text-blue-400 hover:text-blue-300"
              title="Share on Twitter"
            >
              <Twitter className="w-4 h-4" />
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => handleShare('facebook')}
              className="p-2 text-blue-600 hover:text-blue-500"
              title="Share on Facebook"
            >
              <Facebook className="w-4 h-4" />
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => handleShare('linkedin')}
              className="p-2 text-blue-700 hover:text-blue-600"
              title="Share on LinkedIn"
            >
              <Linkedin className="w-4 h-4" />
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleCopy}
              className="p-2"
              title={isCopied ? "Copied!" : "Copy Link"}
            >
              {isCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          
          <div className="absolute bottom-0 right-4 w-3 h-3 bg-gray-800 border-r border-b border-gray-700 transform rotate-45 translate-y-1/2"></div>
        </div>
      )}
    </div>
  );
}