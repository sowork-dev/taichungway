import type { HowlOptions } from 'howler';
import { DISTRICTS, SOUND_BEDS, serializeMix, type MixEntry } from './postcard-data';

export interface AudioClip {
  play(): number;
  stop(): unknown;
  unload(): unknown;
  loop(value: boolean): unknown;
  volume(): number;
  volume(value: number): unknown;
  fade(from: number, to: number, duration: number): unknown;
}
export type AudioStatus = { state: 'loading' | 'ready' | 'starting' | 'playing' | 'stopped' | 'error'; message: string };
type Track = AudioStatus & { id: string; volume: number; sound?: AudioClip; generation: number; requested: boolean; timeout?: ReturnType<typeof setTimeout>; releaseTimer?: ReturnType<typeof setTimeout> };

/** Howler lifecycle adapter. Only the UI's play gesture calls play(). */
export class PostcardAudio {
  private tracks = new Map<string, Track>();
  private disposed = false;
  constructor(private factory: (options: HowlOptions) => AudioClip, private changed: () => void) {}

  status(id: string): AudioStatus {
    const track = this.tracks.get(id);
    return track ? { state: track.state, message: track.message } : { state: 'stopped', message: '尚未播放' };
  }

  select(mix: readonly MixEntry[]): void {
    if (this.disposed) return;
    if (mix.length) serializeMix(mix);
    for (const [id, track] of this.tracks) {
      if (!mix.some(entry => entry.id === id)) { this.release(track); this.tracks.delete(id); }
    }
    for (const entry of mix) {
      let track = this.tracks.get(entry.id);
      if (!track) {
        track = { ...entry, state: 'loading', message: '載入合成音檔中', requested: false, generation: 0 };
        this.tracks.set(entry.id, track);
        this.prepare(track);
      } else if (entry.volume !== track.volume) {
        track.volume = entry.volume;
        if (track.sound && track.state === 'playing') track.sound.fade(track.sound.volume(), entry.volume / 100, 200);
      }
    }
    this.changed();
  }

  private release(track: Track): void {
    track.generation++;
    track.requested = false;
    clearTimeout(track.timeout);
    clearTimeout(track.releaseTimer);
    track.timeout = undefined;
    track.releaseTimer = undefined;
    const sound = track.sound;
    track.sound = undefined;
    if (sound) { sound.stop(); sound.unload(); }
  }

  private fail(track: Track, message: string): void {
    this.release(track);
    track.state = 'error';
    track.message = message;
    if (!this.disposed) this.changed();
  }

  private prepare(track: Track): void {
    const district = DISTRICTS.find(d => d.id === track.id)!;
    const generation = ++track.generation;
    const current = () => !this.disposed && this.tracks.get(track.id) === track && track.generation === generation;
    track.state = 'loading';
    track.message = '載入合成音檔中';
    try {
      track.sound = this.factory({
        src: [SOUND_BEDS[district.bed].src], html5: false, preload: true, autoplay: false, loop: true, volume: 0,
        onload: () => {
          if (!current()) return;
          if (track.state === 'loading') { track.state = 'ready'; track.message = '已就緒・按播放才會出聲'; this.changed(); }
        },
        onloaderror: () => { if (current()) this.fail(track, '音檔載入失敗，請按「播放／重試」再試。'); },
        onplayerror: () => { if (current()) this.fail(track, '播放失敗，請確認裝置聲音與瀏覽器權限，再按「播放／重試」。'); },
        onplay: () => {
          if (!current() || !track.requested || !track.sound) return;
          clearTimeout(track.timeout);
          track.sound.fade(0, track.volume / 100, 200);
          track.state = 'playing';
          track.message = '正在循環播放';
          this.changed();
        },
      });
    } catch {
      this.fail(track, '音訊初始化失敗，請按「播放／重試」再試。');
    }
  }

  play(): void {
    if (this.disposed) return;
    for (const track of this.tracks.values()) {
      if (track.state === 'playing' || track.state === 'starting') continue;
      if (track.releaseTimer) this.release(track);
      if (!track.sound) this.prepare(track);
      if (!track.sound) continue;
      track.requested = true;
      track.state = 'starting';
      track.message = '等待音訊啟動';
      try {
        track.sound.loop(true);
        track.sound.volume(0);
        track.sound.play();
        // A returned sound ID is not a successful playback event.
        track.timeout = setTimeout(() => {
          if (track.requested && track.state === 'starting') this.fail(track, '音訊啟動逾時，請按「播放／重試」再試。');
        }, 12_000);
      } catch { this.fail(track, '播放失敗，請按「播放／重試」再試。'); }
    }
    this.changed();
  }

  stop(immediate = false): void {
    for (const track of this.tracks.values()) {
      track.requested = false;
      clearTimeout(track.timeout);
      if (!immediate && track.state === 'playing' && track.sound) {
        track.sound.fade(track.sound.volume(), 0, 200);
        track.releaseTimer = setTimeout(() => this.release(track), 200);
      } else this.release(track);
      track.state = 'stopped';
      track.message = '已停止・按播放重新開始';
    }
    if (!this.disposed) this.changed();
  }

  dispose(): void {
    this.disposed = true;
    this.stop(true);
    this.tracks.clear();
  }
}
