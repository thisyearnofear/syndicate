import { CurrentJackpot } from "@/components/jackpot-components/CurrentJackpot";

export default function Hero() {
  return (
    <div className="text-center space-y-8 my-16">
      <div className="space-y-4">
        <h1 className="text-5xl md:text-7xl font-bold flex items-center justify-center gap-4">
          <span className="bg-gradient-to-r from-purple-400 via-blue-500 to-green-400 bg-clip-text text-transparent">
            Syndicate
          </span>
          <span className="text-4xl">🎯</span>
        </h1>
        <div className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
          Social lottery coordination on <span className="text-blue-400 font-semibold">Base</span> & <span className="text-red-400 font-semibold">Avalanche</span>
        </div>
        
        {/* ENHANCEMENT FIRST: Enhanced Hero with prominent megapot integration */}
        <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-lg p-6 border border-purple-500/30 max-w-2xl mx-auto">
          <div className="text-xl text-purple-200 mb-3 font-semibold">🎰 Megapot Lottery - Live Now!</div>
          <div className="text-gray-300 mb-4">
            Buy individual tickets or create syndicates with friends. Every ticket supports causes you care about.
          </div>
          {/* ENHANCEMENT FIRST: Reusing existing CurrentJackpot component */}
          <div className="flex justify-center">
            <CurrentJackpot />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        <p className="text-lg text-gray-400 leading-relaxed">
          Transform social connections into financial impact. Pool resources with your community,
          dramatically increase your collective chances of winning, and automatically distribute
          portions to causes you care about.
        </p>

        <div className="grid md:grid-cols-3 gap-6 mt-8">
          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <div className="text-2xl mb-2">🤝</div>
            <h3 className="text-lg font-semibold text-white mb-2">Social Coordination</h3>
            <p className="text-gray-400 text-sm">Pool resources with like-minded individuals across multiple chains</p>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <div className="text-2xl mb-2">🌊</div>
            <h3 className="text-lg font-semibold text-white mb-2">Cause-Based Impact</h3>
            <p className="text-gray-400 text-sm">Automatically distribute winnings to ocean cleanup, food aid, and more</p>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <div className="text-2xl mb-2">⚡</div>
            <h3 className="text-lg font-semibold text-white mb-2">Cross-Chain Native</h3>
            <p className="text-gray-400 text-sm">Purchase tickets on Base from any chain using NEAR chain signatures</p>
          </div>
        </div>
      </div>
    </div>
  );
}
