import { SeasonRoundReplay } from '@/components/season/SeasonRoundReplay';

export default async function SeasonRoundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SeasonRoundReplay roundId={id} />;
}
