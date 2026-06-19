/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, Settings, Tv } from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  title?: string;
}

type AspectRatio = 'auto' | '16/9' | '4/3';

export default function VideoPlayer({ src, title }: VideoPlayerProps) {
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
          enableWorker: true
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
                setErrorMessage('网络由于连接失败或CORS拦截无法加载直播源。');
                hls?.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                setErrorMessage('媒体解码失败。');
                hls?.recoverMediaError();
                break;
              default:
                setErrorMessage('播放流发生未知错误。');
                break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native safari HLS
        video.src = src;
      } else {
        setErrorMessage('您的浏览器不支持 HLS (.m3u8) 视频流播放。');
      }
    } else {
      // Standard video file (MP4, WebM, etc.)
      video.src = src;
    }

    // Handlers
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDurationChange = () => setDuration(video.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);

    return () => {
      if (hls) {
        hls.destroy();
      }
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [src]);

  // Actions
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

  // Determine aspect ratio class / inline style for object-fit and Container
  const getAspectRatioStyle = (): React.CSSProperties => {
    if (aspectRatio === 'auto') return { width: '100%', height: '100%' };
    return { aspectRatio: aspectRatio === '16/9' ? '16/9' : '4/3', width: '100%', height: 'auto' };
  };

  return (
    <div id="video-container" ref={containerRef} className="relative w-full overflow-hidden rounded-xl bg-black text-white group shadow-2xl">
      {/* Video element wrapper enforcing aspect-ratio scaling inside standard borders */}
      <div 
        className="flex items-center justify-center transition-all duration-300 w-full overflow-hidden bg-black mx-auto"
        style={getAspectRatioStyle()}
      >
        <video
          id="xiaohe-video-element"
          ref={videoRef}
          className="w-full h-full object-cover transition-all"
          style={{ 
            objectFit: aspectRatio === 'auto' ? 'contain' : 'fill',
            aspectRatio: aspectRatio === 'auto' ? 'auto' : (aspectRatio === '16/9' ? '16/9' : '4/3')
          }}
          playsInline
          onClick={togglePlay}
        />
      </div>

      {/* Error state display overlay */}
      {errorMessage && (
        <div id="video-error-overlay" className="absolute inset-0 bg-neutral-900/90 flex flex-col items-center justify-center text-center p-6 z-10 transition-opacity">
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
            重试加载视频源
          </button>
        </div>
      )}

      {/* Simple overlay controller panel */}
      <div id="video-controls-bar" className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 flex flex-col gap-3 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300">
        
        {/* Timeline Progress Slider */}
        <div className="flex items-center gap-3 w-full">
          <span className="text-xs font-mono text-neutral-300">{formatTime(currentTime)}</span>
          <input
            id="video-progress-slider"
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-1.5 rounded bg-neutral-600 appearance-none cursor-pointer accent-blue-500 hover:h-2"
          />
          <span className="text-xs font-mono text-neutral-300">
            {duration === Infinity || isNaN(duration) ? 'LIVE' : formatTime(duration)}
          </span>
        </div>

        {/* Buttons Controls Section */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            {/* Play Button */}
            <button
              id="video-toggle-play"
              onClick={togglePlay}
              className="p-1.5 hover:bg-neutral-800 rounded-full transition-colors cursor-pointer"
              title={isPlaying ? '暂停' : '播放'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 text-white fill-white" />
              ) : (
                <Play className="w-5 h-5 text-white fill-white" />
              )}
            </button>

            {/* Reload Screen */}
            <button
              id="video-rewind"
              onClick={() => {
                if (videoRef.current) videoRef.current.currentTime = 0;
              }}
              className="p-1.5 hover:bg-neutral-800 rounded-full transition-colors cursor-pointer"
              title="重新播放"
            >
              <RotateCcw className="w-4 h-4 text-neutral-300" />
            </button>

            {/* Volume controller */}
            <div className="flex items-center gap-2">
              <button
                id="video-toggle-mute"
                onClick={toggleMute}
                className="p-1.5 hover:bg-neutral-800 rounded-full transition-colors cursor-pointer"
                title={isMuted ? '取消静音' : '静音'}
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-rose-500" />
                ) : (
                  <Volume2 className="w-4 h-4 text-neutral-300" />
                )}
              </button>
              <input
                id="video-volume-slider"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 rounded bg-neutral-600 appearance-none accent-blue-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Aspect ratio controls dropdown container */}
            <div className="flex items-center bg-neutral-800/80 rounded-lg p-0.5 border border-neutral-700/50">
              <span className="text-xs px-2 text-neutral-400 font-sans hidden sm:inline">画幅比例</span>
              
              <button
                id="ratio-btn-auto"
                onClick={() => setAspectRatio('auto')}
                className={`text-[10px] font-medium px-2 py-1 rounded cursor-pointer transition-colors ${
                  aspectRatio === 'auto' ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:text-white'
                }`}
              >
                默认
              </button>
              
              <button
                id="ratio-btn-16-9"
                onClick={() => setAspectRatio('16/9')}
                className={`text-[10px] font-medium px-2 py-1 rounded cursor-pointer transition-colors ${
                  aspectRatio === '16/9' ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:text-white'
                }`}
              >
                16:9
              </button>
              
              <button
                id="ratio-btn-4-3"
                onClick={() => setAspectRatio('4/3')}
                className={`text-[10px] font-medium px-2 py-1 rounded cursor-pointer transition-colors ${
                  aspectRatio === '4/3' ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:text-white'
                }`}
              >
                4:3
              </button>
            </div>

            {/* Fullscreen control */}
            <button
              id="video-toggle-fullscreen"
              onClick={toggleFullscreen}
              className="p-1.5 hover:bg-neutral-800 rounded-full transition-colors cursor-pointer"
              title="全屏模式"
            >
              <Maximize className="w-4 h-4 text-neutral-300" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
