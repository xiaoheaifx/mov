import React, { useState, useEffect } from 'react';
import { Search, Loader2, Play, AlertCircle } from 'lucide-react';
import { VideoSource, VideoSourcePlayLine } from '../types';

interface SearchResultData {
  sourceName: string;
  sourceId: string;
  vodId: string;
  vodName: string;
  vodPic: string;
  vodYear: string;
  vodArea: string;
  vodRemarks: string;
  vodContent?: string;
  vodDirector?: string;
  vodActor?: string;
  typeName?: string;
  playLines: VideoSourcePlayLine[];
}

interface SearchPageProps {
  onBack: () => void;
  onPlayVideo: (result: SearchResultData) => void;
  getImageUrl: (path: string | null, size?: string) => string;
}

export default function SearchPage({ onBack, onPlayVideo, getImageUrl }: SearchPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultData[]>([]);
  const [searching, setSearching] = useState(false);
  const [videoSources, setVideoSources] = useState<VideoSource[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load video sources on mount
  useEffect(() => {
    const loadSources = async () => {
      try {
        const res = await fetch('/api/video-sources', { credentials: 'include' });
        if (res.ok) {
          const sources = await res.json();
          setVideoSources(sources);
        }
      } catch (e) {
        console.error('Failed to load video sources:', e);
      }
    };
    loadSources();
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    setSearchResults([]);
    setError(null);

    try {
      const sources = videoSources.length > 0 ? videoSources : [];
      
      if (sources.length === 0) {
        setError('请先在后台管理添加个人视频源');
        setSearching(false);
        return;
      }

      const allResults: SearchResultData[] = [];

      // Search each video source
      for (const source of sources) {
        try {
          // Search for videos
          const searchUrl = `/api/video-sources/search?sourceId=${encodeURIComponent(source.id)}&wd=${encodeURIComponent(searchQuery)}`;
          const searchRes = await fetch(searchUrl, { credentials: 'include' });
          
          if (!searchRes.ok) continue;
          
          const searchData = await searchRes.json();
          
          if (searchData.list && searchData.list.length > 0) {
            for (const item of searchData.list) {
              // Get detail for play URLs
              const detailRes = await fetch(
                `/api/video-sources/detail?sourceId=${encodeURIComponent(source.id)}&ids=${item.vod_id}`,
                { credentials: 'include' }
              );
              
              if (detailRes.ok) {
                const detailData = await detailRes.json();
                if (detailData.list && detailData.list.length > 0) {
                  const vod = detailData.list[0];
                  const playLines = parsePlayLines(vod.vod_play_from || '', vod.vod_play_url || '');
                  
                  allResults.push({
                    sourceName: source.name,
                    sourceId: source.id,
                    vodId: item.vod_id,
                    vodName: item.vod_name,
                    vodPic: item.vod_pic || '',
                    vodYear: item.vod_year || '',
                    vodArea: item.vod_area || '',
                    vodRemarks: item.vod_remarks || '',
                    vodContent: vod.vod_content || '',
                    vodDirector: vod.vod_director || '',
                    vodActor: vod.vod_actor || '',
                    typeName: vod.type_name || '',
                    playLines
                  });
                }
              }
            }
          }
        } catch (e) {
          console.error(`Error searching source ${source.name}:`, e);
        }
      }

      setSearchResults(allResults);
      
      if (allResults.length === 0) {
        setError('未找到匹配的影片，请尝试其他关键词');
      }
    } catch (e) {
      setError('搜索失败，请稍后重试');
      console.error('Search error:', e);
    } finally {
      setSearching(false);
    }
  };

  const parsePlayLines = (playFrom: string, playUrl: string): VideoSourcePlayLine[] => {
    if (!playFrom || !playUrl) return [];
    
    const fromArr = playFrom.split('$$$').filter(Boolean);
    const urlArr = playUrl.split('$$$').filter(Boolean);
    
    return fromArr.map((source, index) => {
      const episodes = urlArr[index]
        ? urlArr[index].split('#').filter(Boolean).map(ep => {
            const parts = ep.split('$');
            return {
              name: parts[0] || `第${index + 1}集`,
              url: parts[1] || parts[0] || ''
            };
          })
        : [];
      
      return { source, episodes };
    });
  };

  const handlePlayResult = (result: SearchResultData) => {
    onPlayVideo(result);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] dark:bg-neutral-950">
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
            <h1 className="text-lg font-bold dark:text-white">搜索影片</h1>
          </div>
          
          {/* Search Input */}
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              placeholder="输入影片名称、演员、导演..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 px-4 py-3 bg-neutral-100 dark:bg-neutral-800 border-0 rounded-xl text-sm font-semibold text-neutral-900 dark:text-white placeholder-neutral-400"
            />
            <button
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-300 text-white rounded-xl text-sm font-bold cursor-pointer transition-colors flex items-center gap-2"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              搜索
            </button>
          </div>
          
          {/* Source count */}
          <div className="mt-2 text-xs text-neutral-500">
            已加载 {videoSources.length} 个视频源
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <AlertCircle className="w-12 h-12 text-neutral-400" />
            <p className="text-neutral-500">{error}</p>
          </div>
        )}

        {searching && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-3 text-neutral-500">搜索中...</span>
          </div>
        )}

        {!searching && searchResults.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {searchResults.map((result, index) => (
              <div
                key={`${result.sourceId}-${result.vodId}-${index}`}
                className="group cursor-pointer"
                onClick={() => handlePlayResult(result)}
              >
                <div className="aspect-[2/3] rounded-xl overflow-hidden bg-neutral-200 dark:bg-neutral-800 mb-2 relative">
                  {result.vodPic ? (
                    <img
                      src={result.vodPic}
                      alt={result.vodName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-400">
                      <Play className="w-8 h-8" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                        <Play className="w-6 h-6 text-white ml-1" />
                      </div>
                    </div>
                  </div>
                  {result.vodRemarks && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-md">
                      {result.vodRemarks}
                    </div>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">
                  {result.vodName}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  {result.vodYear && (
                    <span className="text-[10px] text-neutral-400">{result.vodYear}</span>
                  )}
                  {result.vodArea && (
                    <span className="text-[10px] text-neutral-400">{result.vodArea}</span>
                  )}
                </div>
                <div className="mt-1 text-[10px] text-blue-600 font-medium">
                  {result.sourceName}
                </div>
                {result.playLines.length > 0 && (
                  <div className="mt-1 text-[10px] text-neutral-400">
                    {result.playLines.length} 线路 · {result.playLines[0].episodes.length} 集
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!searching && searchResults.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Search className="w-16 h-16 text-neutral-300 dark:text-neutral-700" />
            <p className="text-neutral-400">输入关键词搜索影片</p>
            <p className="text-xs text-neutral-400">仅搜索已添加视频源中的内容</p>
          </div>
        )}
      </div>
    </div>
  );
}