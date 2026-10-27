"""Generate original non-vocal SYNTHETIC demo sound beds, not field recordings.

No external samples or voices are used. Each mono PCM loop is ten seconds at
16kHz, under 400KB. Regenerate with `python3 scripts/prepare-city-audio.py`.
Real Taichung recordings require a separately authorized/licensed sound library.
"""
from pathlib import Path
import math
import random
import struct
import wave

RATE = 16000
SECONDS = 10
ROOT = Path(__file__).resolve().parents[1] / 'apps/hub/public/audio'


def generate(kind: str, seed: int) -> list[float]:
    rng = random.Random(seed)
    samples = []
    low = 0.0
    for i in range(RATE * SECONDS):
        t = i / RATE
        noise = rng.uniform(-1, 1)
        low = 0.97 * low + 0.03 * noise
        if kind == 'sea':
            wave_cycle = 0.3 + 0.7 * (0.5 + 0.5 * math.sin(2*math.pi*t/5))
            value = (low*3 + noise*0.07) * wave_cycle
        elif kind == 'rain':
            value = noise*0.18 + low*0.5 + math.sin(2*math.pi*147*t)*max(0, 1-((t*7)%1)*20)*0.035
        elif kind == 'birds':
            phase = t % 2.5
            chirp = math.exp(-((phase-0.55)/0.12)**2) + 0.7*math.exp(-((phase-0.95)/0.1)**2)
            value = 0.18*chirp*math.sin(2*math.pi*(1750*t+30*math.sin(t*18))) + low*0.2
        elif kind == 'train':
            pulse = math.exp(-((t % 0.7)/0.045)**2)
            value = low*1.3 + noise*pulse*0.09 + math.sin(2*math.pi*92*t)*0.045
        elif kind == 'bell':
            phase = t % 5
            envelope = math.exp(-phase*1.6)
            value = envelope*(math.sin(2*math.pi*523.2*t)*0.22 + math.sin(2*math.pi*1046.4*t)*0.055) + low*0.12
        else:  # An abstract market rhythm; no intelligible dialogue or sampled speech.
            pulse = max(0, 1-((t*2)%1)*15)
            value = low*1.8 + pulse*math.sin(2*math.pi*360*t)*0.07 + noise*0.018
        envelope = min(1.0, t/0.06, (SECONDS-t)/0.06)
        samples.append(value*max(0,envelope))
    return samples


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    for seed, kind in enumerate(['market','sea','birds','rain','train','bell'], start=117):
        values = generate(kind, seed)
        peak = max(abs(x) for x in values)
        pcm = b''.join(struct.pack('<h', round(x/peak*21000)) for x in values)
        path = ROOT / f'city-{kind}.wav'
        with wave.open(str(path),'wb') as audio:
            audio.setnchannels(1)
            audio.setsampwidth(2)
            audio.setframerate(RATE)
            audio.writeframes(pcm)
        print(path.name, path.stat().st_size, 'bytes; synthetic, not field recording')


if __name__ == '__main__':
    main()
