import React from 'react';
import { Button } from '@/shared/components/ui/Button';
import { TrendingUp } from 'lucide-react';
import Link from 'next/link';

interface YieldStrategyCTAProps {
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  asLink?: boolean;
  href?: string;
}

export function YieldStrategyCTA({ 
  className = '', 
  variant = 'default', 
  asLink = false,
  href = '/vaults'
}: YieldStrategyCTAProps) {
  const button = (
    <Button 
      variant={variant}
      className={className}
    >
      <TrendingUp className="w-4 h-4 mr-2" />
      Vault Strategy
    </Button>
  );

  if (asLink) {
    return (
      <Link href={href}>
        {button}
      </Link>
    );
  }

  return button;
}
