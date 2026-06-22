import React, { useState, useEffect } from 'react';
import { Star, Play, Calendar, Clock, Film, Tv, Users, Globe, DollarSign, Building2, Award, ArrowLeft, Tag, Languages, Loader2, MonitorPlay, List, Volume2, ChevronRight } from 'lucide-react';
import { TMDBMovie, TMDBMovieDetail, VideoSource, VideoSourcePlayLine, VideoSourceEpisode } from '../types.js';
import VideoPlayer from './VideoPlayer.js';

interface TMDBDetailPageProps {
  item: TMDBMovie;
  getImageUrl: (path: string | null, size?: string) => string;
  onBack: () => void;
}

function parsePlayLines(vodPlayFrom: string, vodPlayUrl: string): VideoSourcePlayLine[] {
  if (!vodPlayUrl) return [];
  const sources = vodPlayFrom ? vodPlayFrom.split('$$$') : ['默认线路'];
  const urlGroups = vodPlayUrl.split('$$$');
  
  return sources.map((source, index) => {
    const urlStr = urlGroups[index] || '';
    const episodes: VideoSourceEpisode[] = [];
    
    urlStr.split('#').forEach(ep => {
      const parts = ep.split('$');
      if (parts.length >= 2) {
        episodes.push({ name: parts[0].trim(), url: parts[1].trim() });
      }
    });
    
    return { source: source.trim(), episodes };
  }).filter(line => line.episodes.length > 0);
}

function isDirectVideoUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes('.m3u8') || lower.includes('.mp4') || lower.includes('.flv') || lower.includes('.mkv') || lower.includes('.webm') || lower.includes('.mov');
}

function getQualityTag(name: string): { label: string; color: string } {
  const n = name.toLowerCase();
  if (n.includes('4k') || n.includes('ultra')) return { label: '4K', color: 'bg-purple-600' };
  if (n.includes('1080') || n.includes('hd') || n.includes('蓝光') || n.includes('bluray')) return { label: 'HD', color: 'bg-blue-600' };
  if (n.includes('720') || n.includes('抢先') || n.includes('ts') || n.includes('枪版') || n.includes('cam')) return { label: '抢先版', color: 'bg-orange-500' };
  if (n.includes('正片') || n.includes('全集') || n.includes('完结')) return { label: '正片', color: 'bg-green-600' };
  if (n.includes('预告') || n.includes('trailer')) return { label: '预告', color: 'bg-yellow-600' };
  return { label: '', color: '' };
}

export default function TMDBDetailPage({ item, getImageUrl, onBack }: TMDBDetailPageProps) {
  const [detail, setDetail] = useState<TMDBMovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [playLines, setPlayLines] = useState<VideoSourcePlayLine[]>([]);
  const [selectedLine, setSelectedLine] = useState(0);
  const [selectedEpisode, setSelectedEpisode] = useState(0);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [currentEpName, setCurrentEpName] = useState<string>('');
  const [showPlayer, setShowPlayer] = useState(false);
  const [videoSources, setVideoSources] = useState<VideoSource[]>([]);
  const [searchingSources, setSearchingSources] = useState(false);
  const [sourceResults, setSourceResults] = useState<Array<{ sourceName: string; sourceId: string; lines: VideoSourcePlayLine[] }>>([]);
  const [activeSourceId, setActiveSourceId] = useState<string>('');

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
        const endpoint = mediaType === 'tv' ? `/api/tmdb/tv/${item.id}` : `/api/tmdb/movie/${item.id}`;
        const res = await fetch(endpoint);
        if (res.ok) {
          const data = await res.json();
          setDetail(data);
        }
      } catch (e) {
        console.error('Failed to fetch detail:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [item]);

  useEffect(() => {
    if (!detail) return;
    const title = detail?.title || detail?.name || item.title || item.name || '';
    if (!title) return;
    searchVideoSources(title);
  }, [detail]);

  const searchVideoSources = async (keyword: string) => {
    setSearchingSources(true);
    setSourceResults([]);
    try {
      console.log(`[TMDBDetailPage] Starting search for: "${keyword}"`);
      const vsRes = await fetch('/api/video-sources');
      if (!vsRes.ok) {
        console.error('[TMDBDetailPage] Failed to fetch video sources:', vsRes.status, vsRes.statusText);
        return;
      }
      const sources: VideoSource[] = await vsRes.json();
      setVideoSources(sources);
      console.log(`[TMDBDetailPage] Found ${sources.length} video sources:`, sources.map(s => ({ id: s.id, name: s.name, api: s.api })));

      if (sources.length === 0) {
        console.log('[TMDBDetailPage] No video sources configured');
        return;
      }

      const results: Array<{ sourceName: string; sourceId: string; lines: VideoSourcePlayLine[] }> = [];
      
      for (const source of sources) {
        try {
          console.log(`[TMDBDetailPage] Searching source: ${source.name} (${source.id})`);
          const searchUrl = `/api/video-sources/search?sourceId=${encodeURIComponent(source.id)}&wd=${encodeURIComponent(keyword)}`;
          console.log(`[TMDBDetailPage] Search URL: ${searchUrl}`);
          
          const searchRes = await fetch(searchUrl);
          if (!searchRes.ok) {
            console.warn(`[TMDBDetailPage] Search failed for ${source.name}: HTTP ${searchRes.status}`);
            const errorText = await searchRes.text();
            console.warn(`[TMDBDetailPage] Error response:`, errorText);
            continue;
          }
          const data = await searchRes.json();
          console.log(`[TMDBDetailPage] Source ${source.name} search result:`, JSON.stringify(data).substring(0, 500));
          
          if (data.list && data.list.length > 0) {
            const firstItem = data.list[0];
            const vodId = firstItem.vod_id;
            console.log(`[TMDBDetailPage] Found match in ${source.name}: ${firstItem.vod_name} (ID: ${vodId})`);
            
            const detailRes = await fetch(`/api/video-sources/detail?sourceId=${encodeURIComponent(source.id)}&ids=${vodId}`);
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              if (detailData.list && detailData.list.length > 0) {
                const vod = detailData.list[0];
                console.log(`[TMDBDetailPage] Detail data for ${vod.vod_name}:`, {
                  play_from: vod.vod_play_from,
                  play_url_preview: vod.vod_play_url?.substring(0, 200) + '...'
                });
                const lines = parsePlayLines(vod.vod_play_from || '', vod.vod_play_url || '');
                console.log(`[TMDBDetailPage] Parsed ${lines.length} lines from ${source.name}:`, lines.map(l => ({ source: l.source, episodes: l.episodes.length })));
                if (lines.length > 0) {
                  results.push({
                    sourceName: source.name,
                    sourceId: source.id,
                    lines
                  });
                }
              } else {
                console.log(`[TMDBDetailPage] No detail data found for ${vodId}`);
              }
            } else {
              console.warn(`[TMDBDetailPage] Detail request failed: HTTP ${detailRes.status}`);
            }
          } else {
            console.log(`[TMDBDetailPage] No matches found in ${source.name}`);
          }
        } catch (err) {
          console.error(`[TMDBDetailPage] Error searching source ${source.name}:`, err);
        }
      }

      console.log(`[TMDBDetailPage] Total results: ${results.length}`);
      setSourceResults(results);
      if (results.length > 0) {
        setActiveSourceId(results[0].sourceId);
        setPlayLines(results[0].lines);
        setSelectedLine(0);
        setSelectedEpisode(0);
      }
    } catch (e) {
      console.error('[TMDBDetailPage] Error searching video sources:', e);
    } finally {
      setSearchingSources(false);
    }
  };

  const switchSource = (sourceId: string) => {
    const result = sourceResults.find(r => r.sourceId === sourceId);
    if (result) {
      setActiveSourceId(sourceId);
      setPlayLines(result.lines);
      setSelectedLine(0);
      setSelectedEpisode(0);
      setCurrentUrl('');
      setCurrentEpName('');
      setShowPlayer(false);
    }
  };

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

  const title = detail?.title || detail?.name || item.title || item.name || '';
  const backdropUrl = getImageUrl(detail?.backdrop_path || item.backdrop_path, 'w1280');
  const posterUrl = getImageUrl(detail?.poster_path || item.poster_path, 'w500');
  const date = detail?.release_date || detail?.first_air_date || item.release_date || item.first_air_date || '';
  const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
  const overview = detail?.overview || item.overview || '';
  const tagline = detail?.tagline || '';
  const genres = detail?.genres || [];
  const runtime = detail?.runtime;
  const seasons = detail?.number_of_seasons;
  const episodes = detail?.number_of_episodes;
  const rating = detail?.vote_average || item.vote_average || 0;
  const voteCount = detail?.vote_count || 0;
  const status = detail?.status || '';
  const budget = detail?.budget;
  const revenue = detail?.revenue;
  const cast = detail?.credits?.cast?.slice(0, 12) || [];
  const director = detail?.credits?.crew?.find(c => c.job === 'Director');
  const writers = detail?.credits?.crew?.filter(c => c.department === 'Writing' || c.job === 'Writer' || c.job === 'Screenplay').slice(0, 3) || [];
  const trailer = detail?.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
  const similar = detail?.similar?.results?.slice(0, 6) || [];
  const companies = detail?.production_companies?.slice(0, 4) || [];
  const countries = detail?.production_countries || [];
  const languages = detail?.spoken_languages || [];

  const formatCurrency = (amount?: number) => {
    if (!amount) return null;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  };

  const isTV = mediaType === 'tv';
  const currentEpisodes = playLines[selectedLine]?.episodes || [];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Video Player Area */}
      {showPlayer && currentUrl && (
        <div className="bg-black">
          <div className="max-w-6xl mx-auto">
            {isDirectVideoUrl(currentUrl) ? (
              <div className="aspect-video">
                <VideoPlayer src={currentUrl} title={`${title} - ${currentEpName}`} />
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
                <span className="text-sm font-medium truncate">{title}</span>
                {currentEpName && (
                  <>
                    <span className="text-neutral-500">-</span>
                    <span className="text-sm text-blue-400">{currentEpName}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedEpisode < currentEpisodes.length - 1 && (
                  <button
                    onClick={handlePlayNext}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  >
                    下一集 <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop header */}
      <div className={`relative overflow-hidden ${showPlayer ? 'h-48' : 'h-[300px] sm:h-[400px] lg:h-[500px]'}`}>
        <img
          src={backdropUrl}
          alt={title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-slate-950 via-white/70 dark:via-slate-950/70 to-black/30" />
        
        {/* Back button */}
        <button
          onClick={onBack}
          className="absolute top-6 left-6 z-10 inline-flex items-center gap-2 px-4 py-2 bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white rounded-full text-sm font-medium transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> 返回
        </button>
      </div>

      {/* Content */}
      <div className={`max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 ${showPlayer ? '-mt-16' : '-mt-32'} relative z-10`}>
        <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
          {/* Poster */}
          <div className="flex-shrink-0 mx-auto sm:mx-0">
            <img
              src={posterUrl}
              alt={title}
              className="w-40 sm:w-56 aspect-[2/3] rounded-2xl object-cover shadow-2xl border-4 border-white dark:border-slate-800"
            />
          </div>

          {/* Info */}
          <div className="flex-1 pt-2 sm:pt-4 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-3">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${isTV ? 'bg-purple-600' : 'bg-blue-600'} text-white`}>
                {isTV ? '电视剧' : '电影'}
              </span>
              {status && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                  {status}
                </span>
              )}
              {rating > 0 && (
                <span className="flex items-center gap-1 px-2.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-xs font-bold">
                  <Star className="w-3 h-3 fill-yellow-500" />
                  {rating.toFixed(1)}
                  {voteCount > 0 && <span className="text-yellow-500/60 font-normal">({voteCount.toLocaleString()}票)</span>}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white leading-tight">
              {title}
            </h1>

            {tagline && (
              <p className="mt-2 text-sm sm:text-base text-neutral-500 dark:text-slate-400 italic">"{tagline}"</p>
            )}

            {/* Meta info row */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3 text-sm text-neutral-500 dark:text-slate-400">
              {date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {date}
                </span>
              )}
              {runtime && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {runtime} 分钟
                </span>
              )}
              {seasons && (
                <span className="flex items-center gap-1">
                  <Tv className="w-4 h-4" />
                  {seasons} 季{episodes ? ` / ${episodes} 集` : ''}
                </span>
              )}
              {countries.length > 0 && (
                <span className="flex items-center gap-1">
                  <Globe className="w-4 h-4" />
                  {countries.map(c => c.name).join(' / ')}
                </span>
              )}
            </div>

            {/* Genres */}
            {genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4 justify-center sm:justify-start">
                {genres.map(g => (
                  <span key={g.id} className="px-3 py-1 bg-neutral-100 dark:bg-slate-800 text-neutral-700 dark:text-slate-300 rounded-full text-xs font-medium">
                    {g.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ==========================================
            PLAY AREA - Source Selector + Episodes
            ========================================== */}
        <div className="mt-8">
          {/* Searching indicator */}
          {searchingSources && (
            <div className="bg-neutral-50 dark:bg-slate-900 rounded-2xl p-8 border border-neutral-200 dark:border-slate-800 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="text-sm text-neutral-500 dark:text-slate-400">正在搜索视频源，请稍候...</span>
            </div>
          )}

          {/* No sources found */}
          {!searchingSources && sourceResults.length === 0 && videoSources.length === 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-2xl p-6 border border-amber-200 dark:border-amber-800 text-center">
              <MonitorPlay className="w-10 h-10 text-amber-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-amber-800 dark:text-amber-300 mb-2">暂无可用视频源</h3>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                请先在管理后台添加个人视频源（支持CMS采集站API），添加后即可在此播放影片。
              </p>
            </div>
          )}

          {/* Sources exist but no matches */}
          {!searchingSources && sourceResults.length === 0 && videoSources.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-2xl p-6 border border-blue-200 dark:border-blue-800 text-center">
              <Film className="w-10 h-10 text-blue-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 mb-2">未找到匹配资源</h3>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                已搜索 {videoSources.length} 个视频源，但未找到本片资源。请尝试添加更多视频源。
              </p>
            </div>
          )}

          {/* Source results available */}
          {sourceResults.length > 0 && (
            <div className="bg-neutral-50 dark:bg-slate-900 rounded-2xl border border-neutral-200 dark:border-slate-800 overflow-hidden">
              {/* Source tabs header */}
              <div className="px-4 sm:px-6 py-4 border-b border-neutral-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2 mb-3">
                  <MonitorPlay className="w-5 h-5 text-blue-500" /> 播放源
                  <span className="text-xs font-normal text-neutral-400">（共 {sourceResults.length} 个源可用）</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {sourceResults.map(sr => (
                    <button
                      key={sr.sourceId}
                      onClick={() => switchSource(sr.sourceId)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                        activeSourceId === sr.sourceId
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                          : 'bg-neutral-100 dark:bg-slate-800 text-neutral-700 dark:text-slate-300 hover:bg-neutral-200 dark:hover:bg-slate-700 border border-neutral-200 dark:border-slate-700'
                      }`}
                    >
                      {sr.sourceName}
                      <span className="ml-1 text-xs opacity-70">({sr.lines.reduce((a, l) => a + l.episodes.length, 0)})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Line tabs + Episodes */}
              {playLines.length > 0 && (
                <div className="px-4 sm:px-6 py-4 space-y-4">
                  {/* Line tabs */}
                  {playLines.length > 1 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Volume2 className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-bold text-neutral-700 dark:text-slate-300">线路选择</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {playLines.map((line, li) => (
                          <button
                            key={li}
                            onClick={() => { setSelectedLine(li); setSelectedEpisode(0); setCurrentUrl(''); setShowPlayer(false); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                              selectedLine === li
                                ? 'bg-green-600 text-white shadow-sm'
                                : 'bg-white dark:bg-slate-800 text-neutral-600 dark:text-slate-400 border border-neutral-200 dark:border-slate-700 hover:border-green-400'
                            }`}
                          >
                            {line.source}
                            <span className="ml-1 opacity-60">({line.episodes.length})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Episodes Grid */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <List className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-bold text-neutral-700 dark:text-slate-300">
                        {isTV ? '选集播放' : '播放列表'}
                      </span>
                      <span className="text-xs text-neutral-400">共 {currentEpisodes.length} 集</span>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                      {currentEpisodes.map((ep, ei) => {
                        const qTag = getQualityTag(ep.name);
                        const isActive = selectedEpisode === ei && showPlayer;
                        return (
                          <button
                            key={ei}
                            onClick={() => handlePlayEpisode(selectedLine, ei)}
                            className={`relative px-2 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer truncate group ${
                              isActive
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                                : 'bg-white dark:bg-slate-800 text-neutral-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-700 border border-neutral-200 dark:border-slate-700 hover:border-blue-400'
                            }`}
                            title={ep.name}
                          >
                            {qTag.label && (
                              <span className={`absolute -top-1.5 -right-1 text-[8px] px-1 py-0 rounded text-white ${qTag.color} leading-tight`}>
                                {qTag.label}
                              </span>
                            )}
                            <span className="block truncate">{ep.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-neutral-500">加载详情...</span>
          </div>
        ) : (
          <div className="mt-8 space-y-8 pb-12">
            {/* Overview */}
            {overview && (
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                  <Film className="w-5 h-5 text-blue-500" /> 剧情简介
                </h3>
                <p className="text-sm sm:text-base text-neutral-600 dark:text-slate-300 leading-relaxed max-w-3xl">
                  {overview}
                </p>
              </div>
            )}

            {/* Director & Writers */}
            {(director || writers.length > 0) && (
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" /> 创作团队
                </h3>
                <div className="flex flex-wrap gap-4 text-sm">
                  {director && (
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-500 dark:text-slate-400">导演:</span>
                      <span className="font-semibold text-neutral-900 dark:text-white">{director.name}</span>
                    </div>
                  )}
                  {writers.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-500 dark:text-slate-400">编剧:</span>
                      <span className="font-semibold text-neutral-900 dark:text-white">
                        {writers.map(w => w.name).join(' / ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cast */}
            {cast.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-500" /> 主要演员
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {cast.map(c => (
                    <div key={c.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-neutral-50 dark:hover:bg-slate-800/50 transition-colors">
                      <img
                        src={getImageUrl(c.profile_path, 'w185')}
                        alt={c.name}
                        className="w-12 h-12 rounded-full object-cover bg-neutral-200 dark:bg-slate-700 flex-shrink-0"
                        loading="lazy"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{c.name}</p>
                        <p className="text-xs text-neutral-500 dark:text-slate-400 truncate">{c.character}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trailer */}
            {trailer && (
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                  <Play className="w-5 h-5 text-red-500" /> 预告片
                </h3>
                <div className="aspect-video rounded-2xl overflow-hidden shadow-lg max-w-2xl">
                  <iframe
                    src={`https://www.youtube.com/embed/${trailer.key}`}
                    className="w-full h-full"
                    allowFullScreen
                    allow="autoplay; encrypted-media"
                    title="Trailer"
                  />
                </div>
              </div>
            )}

            {/* Similar */}
            {similar.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                  <Film className="w-5 h-5 text-purple-500" /> 相似推荐
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {similar.map(s => (
                    <div key={s.id} className="group cursor-pointer">
                      <div className="aspect-[2/3] rounded-xl overflow-hidden bg-neutral-200 dark:bg-slate-800 mb-1">
                        <img
                          src={getImageUrl(s.poster_path, 'w342')}
                          alt={s.title || s.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      </div>
                      <p className="text-xs font-medium text-neutral-900 dark:text-white line-clamp-1">{s.title || s.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Production Info */}
            {(companies.length > 0 || budget || revenue) && (
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-cyan-500" /> 制作信息
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {companies.length > 0 && (
                    <div>
                      <span className="text-xs text-neutral-500 dark:text-slate-400">制作公司</span>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">{companies.map(c => c.name).join(' / ')}</p>
                    </div>
                  )}
                  {formatCurrency(budget) && (
                    <div>
                      <span className="text-xs text-neutral-500 dark:text-slate-400">预算</span>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">{formatCurrency(budget)}</p>
                    </div>
                  )}
                  {formatCurrency(revenue) && (
                    <div>
                      <span className="text-xs text-neutral-500 dark:text-slate-400">票房</span>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">{formatCurrency(revenue)}</p>
                    </div>
                  )}
                  {languages.length > 0 && (
                    <div>
                      <span className="text-xs text-neutral-500 dark:text-slate-400">语言</span>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">{languages.map(l => l.name).join(' / ')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}