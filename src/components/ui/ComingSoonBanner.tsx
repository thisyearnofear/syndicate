'use client';

import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComingSoonBannerProps {
  title: string;
  description?: string;
  className?: string;
  variant?: 'warning' | 'info';
  showOnlyInDev?: boolean;
}

const isDev = process.env.NEXT_PUBLIC_ENVIRONMENT === 'development';
const showBanners = process.env.NEXT_PUBLIC_SHOW_FEATURE_BANNERS === 'true';

export function ComingSoonBanner({
  title,
  description,
  className,
  variant = 'warning',
  showOnlyInDev = true,
}: ComingSoonBannerProps) {
  // Only show if feature banners are enabled and we're in dev
  if (!showBanners || (showOnlyInDev && !isDev)) {
    return null;
  }

  const variantStyles = {
    warning: 'bg-amber-900/20 border-amber-700 text-amber-100',
    info: 'bg-blue-900/20 border-blue-700 text-blue-100',
  };

  const iconColor = {
    warning: 'text-amber-400',
    info: 'text-blue-400',
  };

  return (
    <div
      className={cn(
        'border rounded-lg p-4 flex items-start gap-3',
        variantStyles[variant],
        className
      )}
      role="status"
      aria-label="Coming soon notice"
    >
      <AlertCircle className={cn('h-5 w-5 mt-0.5 flex-shrink-0', iconColor[variant])} />
      <div className="flex-1">
        <h3 className="font-semibold text-sm mb-1">{title}</h3>
        {description && <p className="text-sm opacity-90">{description}</p>}
      </div>
    </div>
  );
}
