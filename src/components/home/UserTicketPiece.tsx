"use client";

import { PuzzlePiece } from '@/shared/components/premium/PuzzlePiece';
import { CompactStack, CompactFlex } from '@/shared/components/premium/CompactLayout';
import { CountUpText } from '@/shared/components/ui/CountUpText';
import { Button } from '@/shared/components/ui/Button';

interface UserTicketInfo {
  ticketsPurchased?: number;
  winningsClaimable?: number | string;
  hasWon?: boolean;
}

/**
  * MODULAR: User Ticket Information Piece
  */
export function UserTicketPiece({ userTicketInfo, claimWinnings, isClaimingWinnings }: {
  userTicketInfo: UserTicketInfo | null;
  claimWinnings: () => Promise<void | string>;
  isClaimingWinnings: boolean;
}) {
  if (!userTicketInfo) {
    return (
      <PuzzlePiece variant="secondary" size="md" shape="organic">
        <CompactStack spacing="sm" align="center">
          <span className="text-3xl transition-transform duration-300 hover:scale-125">🎫</span>
          <p className="text-sm text-center text-gray-400 leading-relaxed">Connect wallet to view your tickets</p>
        </CompactStack>
      </PuzzlePiece>
    );
  }

  const handleClaimWinnings = async () => {
    try {
      await claimWinnings();
    } catch (error) {
      console.error('Failed to claim winnings:', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  return (
    <PuzzlePiece variant="primary" size="md" shape="organic" glow>
      <CompactStack spacing="sm">
        <CompactFlex align="center" gap="sm">
          <span className="text-2xl transition-transform duration-300 hover:scale-125">🎫</span>
          <h3 className="font-bold text-lg md:text-xl lg:text-2xl leading-tight tracking-tight text-white">Your Tickets</h3>
        </CompactFlex>

        <div className="glass p-4 rounded-xl hover-scale transition-all duration-300">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="hover-lift transition-all duration-300">
              <CountUpText
                value={userTicketInfo.ticketsPurchased ?? 0}
                className="text-2xl font-black text-blue-400 drop-shadow-[0_0_20px_rgba(59,130,246,0.6)]"
              />
              <p className="text-xs text-gray-400 leading-relaxed mt-1">Tickets Owned</p>
            </div>
            <div className="hover-lift transition-all duration-300">
              <CountUpText
                value={parseFloat(String(userTicketInfo.winningsClaimable ?? '0'))}
                prefix="$"
                className="text-2xl font-black text-green-400 drop-shadow-[0_0_20px_rgba(34,197,94,0.6)]"
              />
              <p className="text-xs text-gray-400 leading-relaxed mt-1">Winnings</p>
            </div>
          </div>
        </div>

        {userTicketInfo.hasWon && (
          <div className="glass-premium p-4 rounded-xl border border-yellow-400/30 animate-pulse shadow-premium">
            <CompactStack spacing="xs" align="center">
              <span className="text-3xl animate-bounce transition-transform duration-300 hover:scale-125">🏆</span>
              <p className="text-sm font-bold text-yellow-400 text-center leading-relaxed drop-shadow-[0_0_20px_rgba(250,204,21,0.6)]">
                Congratulations! You won!
              </p>
              {parseFloat(String(userTicketInfo.winningsClaimable ?? '0')) > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleClaimWinnings}
                  disabled={isClaimingWinnings}
                  className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 hover:from-yellow-500 hover:via-orange-600 hover:to-red-600 text-white font-black shadow-2xl hover:shadow-yellow-500/30 border border-yellow-400/30 animate-float hover-lift transition-all duration-300"
                >
                  {isClaimingWinnings ? "Claiming..." : "⚡ Claim Winnings"}
                </Button>
              )}
            </CompactStack>
          </div>
        )}
      </CompactStack>
    </PuzzlePiece>
  );
}