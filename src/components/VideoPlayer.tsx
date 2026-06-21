/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, Minimize, Tv, Subtitles, PictureInPicture2, Gauge } from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  title?: string;
  subtitle?: string;
}

type AspectRatio = 'auto' | '16/9' | '4/3' | '21/9';

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function VideoPlayer({ src, title, subtitle }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('auto');
  const [isHlsLoaded, setIsHlsLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize Hls.js or Native video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setErrorMessage(null);
    setIsPlaying(false);
    setCurrentTime(0);

    const isM3U8 = src.includes('.m3u8') || src.includes('m3u8');

    let hls: Hls | null = null;

    if (isM3U8) {
      if (Hls.isSupported()) {
        hls = new Hls({
          maxMaxBufferLength: 10,
          enableWorker: true,
        });
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsHlsLoaded(true);
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS.js Error:', data);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                setErrorMessage('网络连接失败，正在尝试重连...');
                hls?.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                setErrorMessage('媒体解码失败，正在尝试恢复...');
                hls?.recoverMediaError();
                break;
              default:
                setErrorMessage('播放流发生未知错误');
                break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
      } else {
        setErrorMessage('您的浏览器不支持 HLS (.m3u8) 视频流播放');
      }
    } else {
      video.src = src;
    }

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const onDurationChange = () => setDuration(video.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onRateChange = () => setPlaybackRate(video.playbackRate);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ratechange', onRateChange);

    return () => {
      if (hls) {
        hls.destroy();
      }
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ratechange', onRateChange);
    };
  }, [src]);

  // Fullscreen change listener
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Auto-hide controls
  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    if (isPlaying) {
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      resetControlsTimer();
    } else {
      setShowControls(true);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    }
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [isPlaying]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(err => {
        console.error('Play request failed:', err);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const time = parseFloat(e.target.value);
    video.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const vol = parseFloat(e.target.value);
    video.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !isMuted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted && volume === 0) {
      video.volume = 0.5;
      setVolume(0.5);
    }
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen().catch(err => {
        console.error('Fullscreen failed:', err);
      });
    }
  };

  const togglePip = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.error('PiP failed:', err);
    }
  };

  const setSpeed = (rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs === Infinity) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    const mStr = m.toString().padStart(2, '0');
    const sStr = s.toString().padStart(2, '0');
    if (h > 0) {
      return `${h}:${mStr}:${sStr}`;
    }
    return `${mStr}:${sStr}`;
  };

  const getAspectRatioStyle = (): React.CSSProperties => {
    if (aspectRatio === 'auto') return { width: '100%', height: '100%' };
    const map: Record<string, string> = { '16/9': '16/9', '4/3': '4/3', '21/9': '21/9' };
    return { aspectRatio: map[aspectRatio] || '16/9', width: '100%', height: 'auto', maxHeight: '80vh' };
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedProgress = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      id="video-container"
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl bg-black text-white group shadow-2xl"
      onMouseMove={resetControlsTimer}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <div
        className="flex items-center justify-center transition-all duration-300 w-full overflow-hidden bg-black mx-auto"
        style={getAspectRatioStyle()}
      >
        <video
          id="xiaohe-video-element"
          ref={videoRef}
          className="w-full h-full transition-all"
          style={{
            objectFit: aspectRatio === 'auto' ? 'contain' : 'fill',
            aspectRatio: aspectRatio === 'auto' ? 'auto' : aspectRatio,
          }}
          playsInline
          onClick={togglePlay}
          crossOrigin="anonymous"
        >
          {subtitle && <track kind="subtitles" src={subtitle} srcLang="zh" label="中文字幕" default />}
        </video>
      </div>

      {/* Center play button overlay */}
      {!isPlaying && !errorMessage && (
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/20"
          onClick={togglePlay}
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-600/90 hover:bg-blue-500 flex items-center justify-center transition-all hover:scale-110 shadow-2xl shadow-blue-600/30">
            <Play className="w-8 h-8 sm:w-10 sm:h-10 text-white fill-white ml-1" />
          </div>
        </div>
      )}

      {/* Title overlay */}
      {title && showControls && (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 pointer-events-none">
          <h3 className="text-white font-bold text-sm sm:text-base truncate">{title}</h3>
        </div>
      )}

      {/* Error overlay */}
      {errorMessage && (
        <div id="video-error-overlay" className="absolute inset-0 bg-neutral-900/95 flex flex-col items-center justify-center text-center p-6 z-10">
          <Tv className="w-12 h-12 text-blue-500 mb-3 animate-pulse" />
          <h3 className="font-semibold text-lg text-white mb-2">视频播放失败</h3>
          <p className="text-sm text-neutral-400 max-w-md">{errorMessage}</p>
          <button
            id="video-retry-btn"
            onClick={() => {
              const v = videoRef.current;
              if (v) {
                v.load();
                setErrorMessage(null);
              }
            }}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors cursor-pointer"
          >
            重试加载
          </button>
        </div>
      )}

      {/* Controls bar */}
      <div
        className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 sm:p-4 flex flex-col gap-2 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Progress bar */}
        <div className="flex items-center gap-2 w-full">
          <span className="text-[10px] sm:text-xs font-mono text-neutral-300 w-10 text-right">{formatTime(currentTime)}</span>
          <div className="flex-1 relative h-1 group/progress">
            <div className="absolute inset-0 bg-neutral-600 rounded-full">
              <div className="absolute inset-y-0 left-0 bg-neutral-500 rounded-full" style={{ width: `${bufferedProgress}%` }} />
            </div>
            <div className="absolute inset-y-0 left-0 bg-blue-500 rounded-full" style={{ width: `${progress}%` }}>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-400 rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-lg" />
            </div>
            <input
              id="video-progress-slider"
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <span className="text-[10px] sm:text-xs font-mono text-neutral-300 w-10">
            {duration === Infinity || isNaN(duration) ? 'LIVE' : formatTime(duration)}
          </span>
        </div>

        {/* Controls buttons */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={togglePlay} className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer" title={isPlaying ? '暂停' : '播放'}>
              {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5 text-white fill-white" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 text-white fill-white" />}
            </button>

            <button onClick={() => { if (videoRef.current) videoRef.current.currentTime = 0; }} className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer" title="重新播放">
              <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-300" />
            </button>

            <div className="flex items-center gap-1 sm:gap-2">
              <button onClick={toggleMute} className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer" title={isMuted ? '取消静音' : '静音'}>
                {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-300" />}
              </button>
              <input
                id="video-volume-slider"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-12 sm:w-16 h-1 rounded bg-neutral-600 appearance-none accent-blue-500 cursor-pointer"
              />
            </div>

            <span className="text-[10px] sm:text-xs text-neutral-400 hidden sm:inline">
              {isHlsLoaded ? 'HLS' : 'MP4'}
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Subtitle toggle */}
            <button onClick={() => {}} className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer" title="字幕">
              <Subtitles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-300" />
            </button>

            {/* Speed control */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer flex items-center gap-0.5"
                title="播放速度"
              >
                <Gauge className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-300" />
                <span className="text-[10px] text-neutral-400 hidden sm:inline">{playbackRate}x</span>
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-neutral-900/95 backdrop-blur-sm border border-neutral-700 rounded-xl overflow-hidden shadow-xl z-20">
                  {PLAYBACK_SPEEDS.map(speed => (
                    <button
                      key={speed}
                      onClick={() => setSpeed(speed)}
                      className={`block w-full text-left px-4 py-2 text-xs whitespace-nowrap hover:bg-white/10 transition-colors cursor-pointer ${
                        playbackRate === speed ? 'text-blue-400 font-bold' : 'text-neutral-300'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Aspect ratio controls */}
            <div className="hidden sm:flex items-center bg-white/10 rounded-lg p-0.5">
              {(['auto', '16/9', '4/3', '21/9'] as AspectRatio[]).map(ratio => (
                <button
                  key={ratio}
                  onClick={() => setAspectRatio(ratio)}
                  className={`text-[10px] font-medium px-1.5 py-1 rounded cursor-pointer transition-colors ${
                    aspectRatio === ratio ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  {ratio === 'auto' ? '默认' : ratio}
                </button>
              ))}
            </div>

            {/* PiP */}
            <button onClick={togglePip} className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer hidden sm:flex" title="画中画">
              <PictureInPicture2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-300" />
            </button>

            {/* Fullscreen */}
            <button onClick={toggleFullscreen} className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer" title="全屏">
              {isFullscreen ? <Minimize className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-300" /> : <Maximize className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-300" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}