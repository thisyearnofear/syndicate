"use client";

import { getLpPoolTotal } from "@/lib/contract";
import { useEffect, useState, useRef } from "react";
import { useJackpotStats } from "@/hooks/useMegapot";
import { motion, AnimatePresence } from "framer-motion";

export function CurrentJackpot() {
  const [contractAmount, setContractAmount] = useState<number | undefined>(
    undefined
  );
  const [previousAmount, setPreviousAmount] = useState<number | undefined>(
    undefined
  );
  const [isGrowing, setIsGrowing] = useState(false);
  const [displayAmount, setDisplayAmount] = useState<number>(0);
  const [dataSource, setDataSource] = useState<"contract" | "api" | "loading">(
    "loading"
  );
  const [particles, setParticles] = useState<
    Array<{
      id: number;
      x: number;
      y: number;
      size: number;
      velocityX: number;
      velocityY: number;
      opacity: number;
    }>
  >([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Use Megapot hook for API data with fallback to contract
  const {
    jackpotStats,
    loading: apiLoading,
    error: apiError,
    timeRemaining,
  } = useJackpotStats(false);

  // DELIGHT: Enhanced particle system for growing animation
  useEffect(() => {
    if (isGrowing && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const newParticles = Array.from({ length: 12 }, (_, i) => ({
        id: Date.now() + i,
        x: rect.width / 2 + (Math.random() - 0.5) * rect.width * 0.6,
        y: rect.height / 2 + (Math.random() - 0.5) * rect.height * 0.6,
        size: Math.random() * 6 + 2,
        velocityX: (Math.random() - 0.5) * 200,
        velocityY: (Math.random() - 0.5) * 200 - 100, // Slight upward bias
        opacity: Math.random() * 0.7 + 0.3,
      }));
      setParticles(newParticles);

      // DELIGHT: Play success sound on significant growth
      if (
        previousAmount &&
        contractAmount &&
        contractAmount - previousAmount > 1000
      ) {
        if (!audioRef.current) {
          audioRef.current = new Audio("/sounds/jackpot-grow.mp3"); // Add sound file
        }
        audioRef.current?.play().catch(() => {}); // Graceful error handling
      }
    }
  }, [isGrowing, contractAmount, previousAmount]);

  // DELIGHT: Animate particles
  useEffect(() => {
    if (particles.length > 0) {
      const animationFrame = requestAnimationFrame(() => {
        setParticles((prevParticles) =>
          prevParticles
            .map((particle) => ({
              ...particle,
              x: particle.x + particle.velocityX * 0.016, // 60fps
              y: particle.y + particle.velocityY * 0.016,
              velocityY: particle.velocityY + 300 * 0.016, // Gravity
              opacity: Math.max(0, particle.opacity - 0.02),
              size: Math.max(0, particle.size - 0.1),
            }))
            .filter((particle) => particle.opacity > 0 && particle.size > 0)
        );
      });
      return () => cancelAnimationFrame(animationFrame);
    }
  }, [particles]);

  useEffect(() => {
    const fetchContractAmount = async () => {
      try {
        const newAmount = await getLpPoolTotal(); // Use correct lpPoolTotal function
        if (newAmount !== undefined) {
          setContractAmount(newAmount);

          // DELIGHT: Enhanced growing animation with particles and sound
          if (previousAmount !== undefined && newAmount > previousAmount) {
            setIsGrowing(true);
            setTimeout(() => setIsGrowing(false), 3000); // Extended for more delight
          }

          setPreviousAmount(newAmount);
          setDataSource("contract");
        }
      } catch (error) {
        console.error("Error fetching contract jackpot amount:", error);
        setDataSource("loading");
      }
    };

    // Try API first, fallback to contract
    if (jackpotStats && !apiLoading && !apiError) {
      const apiAmount = parseFloat(jackpotStats.prizeUsd);
      if (!isNaN(apiAmount)) {
        setContractAmount(apiAmount);
        if (previousAmount !== undefined && apiAmount > previousAmount) {
          setIsGrowing(true);
          setTimeout(() => setIsGrowing(false), 3000);
        }
        setPreviousAmount(apiAmount);
        setDataSource("api");
        return;
      }
    }

    // Fallback to contract if API fails or no data
    fetchContractAmount();

    // Update every 30 seconds
    const interval = setInterval(() => {
      if (dataSource === "api" && jackpotStats) {
        // Refresh API data
        window.location.reload(); // Simple refresh for now
      } else {
        fetchContractAmount();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [jackpotStats, apiLoading, apiError, previousAmount, dataSource]);

  // DELIGHT: Enhanced animated counter effect with easing
  useEffect(() => {
    if (contractAmount !== undefined) {
      const startAmount = previousAmount || 0;
      const endAmount = contractAmount;
      const duration = isGrowing ? 3000 : 2000; // Longer animation when growing
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Enhanced easing function for more delight - elastic bounce
        const easeOutElastic = 1 - Math.pow(2, -10 * progress);

        const currentAmount =
          startAmount + (endAmount - startAmount) * easeOutElastic;
        setDisplayAmount(currentAmount);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    }
  }, [contractAmount, previousAmount, isGrowing]);

  // Format amount with proper suffixes for excitement
  const formatPrizeAmount = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    } else {
      return `$${amount.toFixed(0)}`;
    }
  };

  const formattedAmount =
    contractAmount !== undefined
      ? formatPrizeAmount(displayAmount)
      : "Loading...";

  // DELIGHT: Urgency indicator for low time remaining
  const getUrgencyIndicator = () => {
    if (timeRemaining && timeRemaining.isExpired) {
      return <span className="text-red-400 animate-pulse">🔥 DRAW NOW!</span>;
    }
    if (timeRemaining && timeRemaining.hours < 1) {
      return (
        <span className="text-orange-400 animate-pulse">⚡ Almost Time!</span>
      );
    }
    return null;
  };

  return (
    <div
      ref={containerRef}
      className={`relative bg-gradient-to-br from-purple-900/80 to-blue-900/80 rounded-2xl px-4 sm:px-6 py-4 sm:py-6 border-2 border-purple-500/30 backdrop-blur-md transition-all duration-500 hover:shadow-2xl hover:shadow-purple-500/20 overflow-hidden ${
        isGrowing
          ? "scale-105 border-green-400 shadow-lg shadow-green-400/30 animate-pulse ring-2 ring-green-400/30"
          : "hover:scale-[1.02] hover:ring-2 hover:ring-purple-400/30"
      }`}
      style={{ minHeight: "120px" }}
    >
      <div className="text-center relative z-10">
        {/* DELIGHT: Enhanced animated background particles when growing */}
        <AnimatePresence>
          {isGrowing && (
            <motion.div
              className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {particles.map((particle) => (
                <motion.div
                  key={particle.id}
                  className="absolute rounded-full bg-green-400"
                  style={{
                    left: particle.x,
                    top: particle.y,
                    width: particle.size,
                    height: particle.size,
                    opacity: particle.opacity,
                  }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{
                    x: particle.velocityX * 16,
                    y: particle.velocityY * 16,
                    scale: 1,
                    opacity: particle.opacity,
                  }}
                  transition={{
                    duration: 1.5,
                    ease: "easeOut",
                  }}
                />
              ))}
              {/* DELIGHT: Sparkle effects */}
              <motion.div
                className="absolute inset-0"
                animate={{
                  background: [
                    "radial-gradient(circle at 20% 80%, rgba(34, 197, 94, 0.3) 0%, transparent 50%)",
                    "radial-gradient(circle at 80% 20%, rgba(34, 197, 94, 0.3) 0%, transparent 50%)",
                    "radial-gradient(circle at 40% 40%, rgba(34, 197, 94, 0.3) 0%, transparent 50%)",
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatType: "reverse",
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-xs sm:text-sm text-purple-200/80 mb-1 sm:mb-2 flex items-center justify-center gap-1 sm:gap-2 relative z-10">
          <span className="inline-flex items-center gap-1">
            Current Jackpot
            {dataSource === "api" && (
              <motion.span
                className="text-xs bg-green-500/20 text-green-300 px-1 py-0.5 rounded-full"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                whileHover={{ scale: 1.1 }}
              >
                LIVE
              </motion.span>
            )}
            {getUrgencyIndicator()}
          </span>
          {isGrowing && (
            <motion.span
              className="text-green-400"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.6, repeat: Infinity }}
            >
              ↗
            </motion.span>
          )}
        </div>

        <div
          className={`text-2xl sm:text-3xl md:text-4xl font-black transition-all duration-500 relative z-10 ${
            isGrowing
              ? "text-green-400 drop-shadow-lg [text-shadow:_0_0_20px_rgba(34,197,94,0.5)]"
              : "text-white"
          }`}
        >
          {contractAmount !== undefined ? (
            <motion.span
              className="inline-flex items-baseline gap-1"
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              whileHover={{ scale: 1.05 }}
            >
              {formattedAmount}
              {dataSource === "contract" && (
                <span className="text-xs text-gray-400 ml-1">via Contract</span>
              )}
            </motion.span>
          ) : (
            <motion.span
              className="animate-pulse text-gray-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              Calculating Prize...
            </motion.span>
          )}
        </div>

        {/* DELIGHT: Enhanced growing celebration with confetti and urgency */}
        <AnimatePresence>
          {isGrowing && (
            <motion.div
              className="text-xs sm:text-sm text-green-300 mt-2 font-medium relative z-10"
              initial={{ scale: 0.8, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 10 }}
              transition={{ duration: 0.4 }}
            >
              <span className="animate-bounce inline-block mr-1">🎉</span>
              Jackpot Growing! Buy Tickets Now!
              {timeRemaining && timeRemaining.hours < 6 && (
                <span className="ml-2 bg-red-500/20 text-red-300 px-2 py-1 rounded-full text-xs animate-pulse">
                  {timeRemaining.hours}h left!
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {apiError && (
          <motion.div
            className="text-xs text-yellow-400 mt-1 relative z-10"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            Using contract data (API temporarily unavailable)
          </motion.div>
        )}
      </div>

      {/* DELIGHT: Enhanced particles rendering with Framer Motion */}
      <AnimatePresence>
        {particles.length > 0 && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {particles.map((particle) => (
              <motion.div
                key={particle.id}
                className="absolute rounded-full bg-gradient-to-r from-green-400 to-emerald-400"
                style={{
                  left: particle.x,
                  top: particle.y,
                  width: particle.size,
                  height: particle.size,
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  x: [0, particle.velocityX * 16],
                  y: [0, particle.velocityY * 16],
                  scale: [0, 1.5, 0],
                  opacity: [0, particle.opacity, 0],
                }}
                transition={{
                  duration: 1.5,
                  ease: "easeOut",
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
