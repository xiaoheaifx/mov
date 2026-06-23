import React, { useState } from 'react';
import { ChevronLeft, Play, Loader2, AlertCircle } from 'lucide-react';
import { VideoSourcePlayLine, VideoSourceEpisode } from '../types';
import VideoPlayer from './VideoPlayer.js';

interface VideoSourcePlayPageProps {
  onBack: () => void;
  vodName: string;
  vodPic?: string;
  vodYear?: string;
  vodArea?: string;
  vodRemarks?: string;
  vodContent?: string;
  vodDirector?: string;
  vodActor?: string;
  typeName?: string;
  playLines: VideoSourcePlayLine[];
  sourceName: string;
  getImageUrl: (path: string | null, size?: string) => string;
}

function isDirectVideoUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes('.m3u8') || lower.includes('.mp4') || lower.includes('.flv') || lower.includes('.mkv') || lower.includes('.webm') || lower.includes('.mov');
}

export default function VideoSourcePlayPage({
  onBack,
  vodName,
  vodPic,
  vodYear,
  vodArea,
  vodRemarks,
  vodContent,
  vodDirector,
  vodActor,
  typeName,
  playLines,
  sourceName,
  getImageUrl
}: VideoSourcePlayPageProps) {
  const [selectedLine, setSelectedLine] = useState(0);
  const [selectedEpisode, setSelectedEpisode] = useState(0);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [currentEpName, setCurrentEpName] = useState<string>('');
  const [showPlayer, setShowPlayer] = useState(false);

  const handlePlayEpisode = (lineIndex: number, epIndex: number) => {
    setSelectedLine(lineIndex);
    setSelectedEpisode(epIndex);
    const url = playLines[lineIndex]?.episodes[epIndex]?.url || '';
    const name = playLines[lineIndex]?.episodes[epIndex]?.name || '';
    setCurrentUrl(url);
    setCurrentEpName(name);
    setShowPlayer(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePlayNext = () => {
    const episodes = playLines[selectedLine]?.episodes || [];
    if (selectedEpisode < episodes.length - 1) {
      handlePlayEpisode(selectedLine, selectedEpisode + 1);
    }
  };

  const handlePlayPrev = () => {
    if (selectedEpisode > 0) {
      handlePlayEpisode(selectedLine, selectedEpisode - 1);
    }
  };

  const switchLine = (lineIndex: number) => {
    setSelectedLine(lineIndex);
    setSelectedEpisode(0);
    setCurrentUrl('');
    setCurrentEpName('');
    setShowPlayer(false);
  };

  const currentEpisodes = playLines[selectedLine]?.episodes || [];

  return (
    <div className="min-h-screen bg-[#f5f5f5] dark:bg-neutral-950">
      {/* Video Player Area */}
      {showPlayer && currentUrl && (
        <div className="bg-black">
          <div className="max-w-6xl mx-auto">
            {isDirectVideoUrl(currentUrl) ? (
              <div className="aspect-video">
                <VideoPlayer src={currentUrl} title={`${vodName} - ${currentEpName}`} />
              </div>
            ) : (
              <div className="aspect-video">
                <iframe
                  src={currentUrl}
                  className="w-full h-full"
                  allowFullScreen
                  allow="autoplay; encrypted-media; fullscreen"
                  referrerPolicy="no-referrer"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
                />
              </div>
            )}
            {/* Player info bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-neutral-900 text-white">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-medium truncate">{vodName}</span>
                {currentEpName && (
                  <>
                    <span className="text-neutral-500">-</span>
                    <span className="text-sm text-blue-400">{currentEpName}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedEpisode > 0 && (
                  <button
                    onClick={handlePlayPrev}
                    className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  >
                    上一集
                  </button>
                )}
                {selectedEpisode < currentEpisodes.length - 1 && (
                  <button
                    onClick={handlePlayNext}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  >
                    下一集
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl cursor-pointer"
            >
              ←
            </button>
            <h1 className="text-lg font-bold dark:text-white">影片详情</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Player and Episodes */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick play button if no player shown */}
            {!showPlayer && playLines.length > 0 && playLines[0].episodes.length > 0 && (
              <button
                onClick={() => handlePlayEpisode(0, 0)}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-2xl p-6 flex items-center justify-center gap-3 cursor-pointer transition-all shadow-lg hover:shadow-xl"
              >
                <Play className="w-8 h-8 fill-white" />
                <div className="text-left">
                  <div className="text-lg font-bold">立即播放</div>
                  <div className="text-sm text-blue-100">{playLines[0].episodes[0].name}</div>
                </div>
              </button>
            )}

            {/* Episode Selection */}
            {playLines.length > 0 && (
              <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800">
                {/* Line Tabs */}
                {playLines.length > 1 && (
                  <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                    {playLines.map((line, index) => (
                      <button
                        key={index}
                        onClick={() => switchLine(index)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
                          selectedLine === index
                            ? 'bg-blue-600 text-white'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                        }`}
                      >
                        {line.source}
                      </button>
                    ))}
                  </div>
                )}

                {/* Episodes Grid */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                    选集 ({currentEpisodes.length})
                  </h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                    {currentEpisodes.map((ep, epIndex) => (
                      <button
                        key={epIndex}
                        onClick={() => handlePlayEpisode(selectedLine, epIndex)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          selectedEpisode === epIndex && showPlayer
                            ? 'bg-blue-600 text-white'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                        }`}
                      >
                        {ep.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {playLines.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <AlertCircle className="w-12 h-12 text-neutral-400" />
                <p className="text-neutral-500">暂无可用播放线路</p>
              </div>
            )}
          </div>

          {/* Right: Movie Info */}
          <div className="space-y-6">
            {/* Poster */}
            {vodPic && (
              <div className="aspect-[2/3] rounded-2xl overflow-hidden bg-neutral-200 dark:bg-neutral-800">
                <img
                  src={vodPic}
                  alt={vodName}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            )}

            {/* Info Card */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 space-y-4">
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{vodName}</h2>
              
              {typeName && (
                <span className="inline-block bg-blue-600/10 text-blue-600 dark:text-blue-400 text-xs font-bold px-2.5 py-1 rounded-lg">
                  {typeName}
                </span>
              )}

              <div className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
                {vodYear && (
                  <p><span className="font-medium text-neutral-900 dark:text-white">年份：</span>{vodYear}</p>
                )}
                {vodArea && (
                  <p><span className="font-medium text-neutral-900 dark:text-white">地区：</span>{vodArea}</p>
                )}
                {vodRemarks && (
                  <p><span className="font-medium text-neutral-900 dark:text-white">备注：</span>{vodRemarks}</p>
                )}
                {vodDirector && (
                  <p><span className="font-medium text-neutral-900 dark:text-white">导演：</span>{vodDirector}</p>
                )}
                {vodActor && (
                  <p><span className="font-medium text-neutral-900 dark:text-white">演员：</span>{vodActor}</p>
                )}
                <p><span className="font-medium text-neutral-900 dark:text-white">来源：</span>{sourceName}</p>
              </div>

              {vodContent && (
                <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-2">简介</h3>
                  <p
                    className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: vodContent }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}