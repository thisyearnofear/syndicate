import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not available');

const projectDir = new URL('.', import.meta.url).pathname;
const audioDir = join(projectDir, 'assets', 'audio');
await mkdir(audioDir, { recursive: true });

const headers = {
  'xi-api-key': apiKey,
  'content-type': 'application/json',
};

async function requestAudio(url, body, label) {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${label} failed (${response.status}): ${detail.slice(0, 500)}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

const voiceId = process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';
const voiceSettings = {
  stability: 0.68,
  similarity_boost: 0.78,
  style: 0.18,
  use_speaker_boost: true,
};

const narration = [
  ['vo-01-hook.mp3', 'This is Season of Tickets. In this social Megapot game, the last seat standing wins.'],
  ['vo-02-rule.mp3', 'A crew pools real lottery entries. When someone leaves, their seat becomes the next contest.'],
  ['vo-03-game.mp3', 'The live season board turns tickets into a shared strategy: crew up, fund the pot, and call it.'],
  ['vo-04-proof.mp3', 'Here, two mainnet purchases produced three scored tickets and a three USDC crew chest.'],
  ['vo-05-ladder.mp3', 'The ladder and feed make every move visible: seats, events, and the moment the pot is called.'],
  ['vo-06-auction.mp3', 'To exit, a player bids a bigger discount back to the crew. The auction only moves forward, and late bids extend the clock.'],
  ['vo-07-receipts.mp3', 'Nothing is assumed. Real Base receipts are decoded, confirmed, and checked before settlement can continue.'],
  ['vo-08-reveal.mp3', 'Then the chest opens. One player exits, one ticket returns as a bonus, and survivor shares renormalize.'],
  ['vo-09-end.mp3', 'Season of Tickets: a social layer for Megapot, built for the Inco Summer Game Jam. Crew up. Call the pot.'],
];

for (const [filename, text] of narration) {
  const output = join(audioDir, filename);
  const audio = await requestAudio(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      text,
      model_id: 'eleven_multilingual_v2',
      output_format: 'mp3_44100_128',
      voice_settings: voiceSettings,
    },
    filename,
  );
  await writeFile(output, audio);
  console.log(`wrote ${filename} (${audio.length} bytes)`);
}

const music = await requestAudio(
  'https://api.elevenlabs.io/v1/music',
  {
    prompt: 'Instrumental dark-electronic game-show score for a 60-second onchain game demo. Start with a tense analog pulse and sparse sub bass, add clipped synth percussion and rising arpeggios through the auction, then resolve into a warm confident chord sequence for the receipt reveal and end card. Modern, cinematic, energetic, precise, no vocals, no lyrics, no artist references, clean mix with space for spoken narration.',
    music_length_ms: 60000,
    model_id: 'music_v1',
    force_instrumental: true,
  },
  'music',
);
await writeFile(join(audioDir, 'season-score.mp3'), music);
console.log(`wrote season-score.mp3 (${music.length} bytes)`);
