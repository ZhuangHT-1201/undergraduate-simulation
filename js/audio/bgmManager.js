const DEFAULT_VOLUME = 0.5;

/**
 * 音频管理器：
 * - 预创建 3 首 BGM 的 InnerAudioContext，避免场景切换反复创建
 * - 通过 playBgm(bgmName) 统一切换，播放前先停止其它 BGM，杜绝重叠
 * - 对外兼容旧的 play(scene) 调用方式
 */
export default class BgmManager {
  constructor(config) {
    this.config = config || { enabled: true };
    this.muted = false;
    this.volume = DEFAULT_VOLUME;
    this.currentBgmName = '';
    this.currentScene = '';
    this.audioMap = {};
    this.tapAudio = null;
    this.sceneToBgm = {
      menu: 'main',
      create_role: 'main',
      school: 'main',
      major: 'main',
      gallery: 'end',
      achievements: 'end',
      cg_gallery: 'end',
      cg_playback: 'end',
      bgm_gallery: 'main',
      credits: 'main',
      settings: 'main',
      play: 'game',
      inventory: 'game',
      run_log: 'game',
      relations: 'game',
      ending: 'end',
      ending_playback: 'end',
    };
    this.createAudioContexts();
  }

  createAudioContexts() {
    if (!wx.createInnerAudioContext) return;
    const bgmFiles = {
      main: 'audio/bgm_main.mp3',
      game: 'audio/bgm_game.mp3',
      end: 'audio/bgm_end.mp3',
    };
    Object.keys(bgmFiles).forEach((bgmName) => {
      const audio = wx.createInnerAudioContext();
      audio.src = bgmFiles[bgmName];
      audio.loop = true;
      audio.volume = this.volume;
      this.audioMap[bgmName] = audio;
    });
    if (wx.createInnerAudioContext) {
      this.tapAudio = wx.createInnerAudioContext();
      this.tapAudio.src = 'audio/ui_tap.mp3';
      this.tapAudio.volume = Math.min(0.16, this.volume * 0.24);
    }
  }

  playBgm(bgmName, force = false) {
    if (!this.config.enabled || this.muted) return;
    const nextAudio = this.audioMap[bgmName];
    if (!nextAudio) return;
    if (this.currentBgmName === bgmName) {
      if (!force) return;
      nextAudio.stop();
      if (typeof nextAudio.seek === 'function') nextAudio.seek(0);
    } else {
      // 切换前停止其他所有 BGM，避免重叠播放。
      Object.keys(this.audioMap).forEach((name) => {
        if (name !== bgmName) this.audioMap[name].stop();
      });
    }

    nextAudio.volume = this.volume;
    nextAudio.play();
    this.currentBgmName = bgmName;
  }

  play(scene) {
    this.currentScene = scene;
    const bgmName = this.sceneToBgm[scene] || 'main';
    this.playBgm(bgmName);
  }

  stop() {
    Object.keys(this.audioMap).forEach((name) => {
      this.audioMap[name].stop();
    });
    this.currentBgmName = '';
    this.currentScene = '';
  }

  playTap() {
    if (this.muted || !this.tapAudio) return;
    try {
      this.tapAudio.stop();
      if (typeof this.tapAudio.seek === 'function') this.tapAudio.seek(0);
      this.tapAudio.volume = Math.min(0.16, Math.max(0.025, this.volume * 0.24));
      this.tapAudio.play();
    } catch (e) {
      // Ignore audio failures; haptic and visual feedback remain available.
    }
  }

  setVolume(v) {
    const next = Math.max(0, Math.min(1, Number(v)));
    this.volume = next;
    Object.keys(this.audioMap).forEach((name) => {
      this.audioMap[name].volume = next;
    });
    if (this.tapAudio) this.tapAudio.volume = Math.min(0.16, Math.max(0.025, next * 0.24));
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this.stop();
      return this.muted;
    }
    if (this.currentScene) this.play(this.currentScene);
    return this.muted;
  }
}
