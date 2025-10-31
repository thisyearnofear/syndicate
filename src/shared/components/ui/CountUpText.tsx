/**
 * COUNT UP TEXT COMPONENT
 * 
 * Core Principles Applied:
 * - DRY: Single source of truth for count-up animations
 * - MODULAR: Reusable component
 * - PERFORMANT: Optimized animation with cleanup
 * - CLEAN: Clear interface and props
 */

import { useState, useEffect } from 'react';

export interface CountUpTextProps {
    value: number;
    duration?: number;
    prefix?: string;
    suffix?: string;
    className?: string;
    enableHover?: boolean;
}

export function CountUpText({
    value,
    duration = 2000,
    prefix = '',
    suffix = '',
    className = '',
    enableHover = false,
}: CountUpTextProps) {
    const [count, setCount] = useState(0);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        let startTime: number;
        let animationFrame: number;

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);

            setCount(Math.floor(progress * value));

            if (progress < 1) {
                animationFrame = requestAnimationFrame(animate);
            }
        };

        animationFrame = requestAnimationFrame(animate);

        return () => {
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
            }
        };
    }, [value, duration]);

    const hoverProps = enableHover
        ? {
            onMouseEnter: () => setIsHovered(true),
            onMouseLeave: () => setIsHovered(false),
        }
        : {};

    const hoverClasses = enableHover && isHovered
        ? 'scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'
        : '';

    return (
        <span
            className={`font-mono font-bold transition-all duration-300 ${hoverClasses} ${className}`}
            {...hoverProps}
        >
            {prefix}
            {count.toLocaleString()}
            {suffix}
        </span>
    );
}