'use client';

import { FormEvent, useState } from 'react';
import { Mail, Send } from 'lucide-react';

import { Button } from '@/shared/components/ui/Button';
import { CompactCard } from '@/shared/components/premium/CompactLayout';
import { useToast } from '@/shared/components/ui/Toast';
import { trackEvent } from '@/services/analytics/client';

export function VaultWaitlistCard() {
  const { addToast } = useToast();
  const [email, setEmail] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [interest, setInterest] = useState('Product updates');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/vaults/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          walletAddress: walletAddress || null,
          source: 'vaults-page',
          interest,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to join waitlist');
      }

      await trackEvent({
        eventName: 'vault_waitlist_submit',
        properties: {
          hasWalletAddress: Boolean(walletAddress),
          interest,
          persisted: data?.persisted ?? false,
        },
      });

      addToast({
        type: 'success',
        title: 'Added to waitlist',
        message: 'We will reach out with vault testing updates.',
      });

      setEmail('');
      setWalletAddress('');
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Could not submit',
        message: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CompactCard variant="glass" padding="lg" className="border border-emerald-500/20 bg-emerald-500/[0.04]">
      <div className="flex items-center gap-2 text-white">
        <Mail className="h-5 w-5 text-emerald-300" />
        <h2 className="text-xl font-bold">Join Vault Beta</h2>
      </div>

      <p className="mt-2 text-sm leading-6 text-slate-300">
        Share your email to join early vault testing. We will prioritize users who can test real
        deposit and feedback flows this week.
      </p>

      <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
        />
        <input
          type="text"
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
          placeholder="Wallet address (optional)"
          className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
        />
        <select
          value={interest}
          onChange={(e) => setInterest(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
        >
          <option>Product updates</option>
          <option>Deposit flow testing</option>
          <option>UX interviews</option>
          <option>Both testing and interviews</option>
        </select>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600"
        >
          <Send className="mr-2 h-4 w-4" />
          {isSubmitting ? 'Submitting...' : 'Join Waitlist'}
        </Button>
      </form>
    </CompactCard>
  );
}
