import { CurrentJackpot } from "@/components/jackpot-components/CurrentJackpot";
import { Countdown } from "@/components/jackpot-components/Countdown";
import { useState } from "react";

export default function Hero() {
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  const handleBuyTickets = () => {
    setShowPurchaseModal(true);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-8 md:py-16 px-4">
      {/* MOBILE-FIRST: Jackpot-first hero with prominent positioning */}
      <div className="text-center space-y-6 max-w-4xl mx-auto">
        {/* ENHANCEMENT FIRST: Prominent jackpot section above the fold */}
        <div className="space-y-4">
          <h1 className="text-3xl md:text-5xl lg:text-7xl font-black bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent leading-tight">
            <span className="block">WIN $921K+</span>
            <span className="block text-2xl md:text-3xl lg:text-4xl text-white/80">
              Jackpot Growing Live!
            </span>
          </h1>

          {/* URGENCY: Live countdown and excitement elements */}
          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-2xl p-6 border-2 border-yellow-400/30 backdrop-blur-md">
            <div className="text-center">
              <div className="text-sm text-yellow-200/80 mb-2 uppercase tracking-wide font-semibold">
                ⏰ Next Draw In
              </div>
              <div className="text-2xl md:text-3xl font-mono text-white font-bold mb-4">
                {/* ENHANCEMENT FIRST: Integrate real countdown component */}
                <Countdown />
              </div>
              <div className="text-xs text-yellow-300/80">
                🎉 1,247 tickets sold today • 47 active syndicates
              </div>
            </div>

            {/* ENHANCEMENT FIRST: Enhanced CurrentJackpot with prominence */}
            <div className="flex justify-center mt-6">
              <div className="w-full max-w-md">
                <CurrentJackpot />
              </div>
            </div>
          </div>

          {/* CONVERSION: Primary CTA - Buy Tickets Now */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={handleBuyTickets}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 px-8 rounded-xl text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 w-full sm:w-auto"
            >
              🎫 Buy Tickets Now - $1 Each
            </button>
            <button className="border-2 border-purple-500/50 hover:border-purple-400 text-purple-300 hover:text-purple-200 font-semibold py-4 px-8 rounded-xl text-lg hover:bg-purple-500/10 transition-all duration-200 w-full sm:w-auto">
              👥 Create Syndicate
            </button>
          </div>

          {/* MOBILE: Emotional hook with social proof */}
          <div className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto leading-relaxed text-center">
            <span className="font-semibold text-yellow-300">
              Join thousands winning together!
            </span>{" "}
            Pool resources with friends, multiply your odds, and automatically
            support causes you care about.
            <span className="block mt-2 text-sm text-gray-300">
              "Won $15K with my gaming crew - half went to ocean cleanup!" -
              @CryptoDave
            </span>
          </div>
        </div>

        {/* ENHANCEMENT FIRST: Keep existing brand identity but reposition below jackpot */}
        <div className="space-y-4 mt-12">
          <h2 className="text-2xl md:text-4xl font-bold flex items-center justify-center gap-2 mx-auto">
            <span className="bg-gradient-to-r from-purple-400 via-blue-500 to-green-400 bg-clip-text text-transparent">
              Syndicate
            </span>
            <span className="text-2xl">🎯</span>
          </h2>
          <div className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Social lottery coordination on{" "}
            <span className="text-purple-400 font-semibold">Solana</span>,{" "}
            <span className="text-blue-400 font-semibold">Base</span> &{" "}
            <span className="text-red-400 font-semibold">Avalanche</span>
          </div>
        </div>

        {/* ENHANCEMENT FIRST: Enhanced features section with better mobile layout */}
        <div className="max-w-4xl mx-auto space-y-6 mt-12">
          <p className="text-base md:text-lg text-gray-400 leading-relaxed text-center">
            Transform social connections into financial impact. Pool resources
            with your community, dramatically increase your collective chances
            of winning, and automatically distribute portions to causes you care
            about.
          </p>

          {/* MOBILE-OPTIMIZED: Stacked cards for better touch interaction */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl p-6 border border-gray-700/50 backdrop-blur-md hover:bg-gray-800/70 transition-all duration-200">
              <div className="text-3xl mb-3 mx-auto w-12 h-12 flex items-center justify-center bg-purple-500/20 rounded-lg">
                🤝
              </div>
              <h3 className="text-xl font-semibold text-white mb-3 text-center">
                Social Coordination
              </h3>
              <p className="text-gray-400 text-sm text-center leading-relaxed">
                Pool resources with like-minded individuals across multiple
                chains
              </p>
            </div>

            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl p-6 border border-gray-700/50 backdrop-blur-md hover:bg-gray-800/70 transition-all duration-200">
              <div className="text-3xl mb-3 mx-auto w-12 h-12 flex items-center justify-center bg-blue-500/20 rounded-lg">
                🌊
              </div>
              <h3 className="text-xl font-semibold text-white mb-3 text-center">
                Cause-Based Impact
              </h3>
              <p className="text-gray-400 text-sm text-center leading-relaxed">
                Automatically distribute winnings to ocean cleanup, food aid,
                and more
              </p>
            </div>

            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl p-6 border border-gray-700/50 backdrop-blur-md hover:bg-gray-800/70 transition-all duration-200">
              <div className="text-3xl mb-3 mx-auto w-12 h-12 flex items-center justify-center bg-green-500/20 rounded-lg">
                🌉
              </div>
              <h3 className="text-xl font-semibold text-white mb-3 text-center">
                Multi-Chain Support
              </h3>
              <p className="text-gray-400 text-sm text-center leading-relaxed">
                Connect Solana, NEAR, Base & Avalanche wallets for seamless
                cross-chain lottery participation
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* PURCHASE MODAL: Simple overlay for immediate conversion */}
      {showPurchaseModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Buy Tickets</h3>
              <button
                onClick={() => setShowPurchaseModal(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-sm text-gray-400 mb-2">Choose Amount</div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 5, 10].map((amount) => (
                    <button
                      key={amount}
                      className="bg-gray-800 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
              </div>
              <button className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
                Connect Wallet & Buy
              </button>
              <div className="text-xs text-gray-400 text-center">
                $1 per ticket • 1 in 1.4M odds • Supports ocean cleanup
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
