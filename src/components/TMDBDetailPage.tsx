import React, { useState, useEffect } from 'react';
import { Star, Play, Calendar, Clock, Film, Tv, Users, Globe, DollarSign, Building2, Award, ArrowLeft, Tag, Languages } from 'lucide-react';
import { TMDBMovie, TMDBMovieDetail } from '../types.js';

interface TMDBDetailPageProps {
  item: TMDBMovie;
  getImageUrl: (path: string | null, size?: string) => string;
  onBack: () => void;
  onPlay: (item: TMDBMovie) => void;
}

export default function TMDBDetailPage({ item, getImageUrl, onBack, onPlay }: TMDBDetailPageProps) {
  const [detail, setDetail] = useState<TMDBMovieDetail | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 overflow-y-auto">
      {/* Backdrop header */}
      <div className="relative h-[300px] sm:h-[400px] lg:h-[500px] overflow-hidden">
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

        {/* Play button overlay */}
        <div className="absolute bottom-6 left-6 z-10">
          <button
            onClick={() => onPlay(item)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-base font-bold transition-colors cursor-pointer shadow-lg shadow-blue-600/30"
          >
            <Play className="w-5 h-5 fill-white" /> 立即播放
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-32 relative z-10">
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
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${mediaType === 'tv' ? 'bg-purple-600' : 'bg-blue-600'} text-white`}>
                {mediaType === 'tv' ? '电视剧' : '电影'}
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

            {/* Budget / Revenue */}
            {(budget || revenue) && (
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-3 text-xs text-neutral-500 dark:text-slate-400">
                {budget && budget > 0 && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    预算: {formatCurrency(budget)}
                  </span>
                )}
                {revenue && revenue > 0 && (
                  <span className="flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" />
                    票房: {formatCurrency(revenue)}
                  </span>
                )}
              </div>
            )}
          </div>
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

            {/* Production Companies */}
            {companies.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-purple-500" /> 制作公司
                </h3>
                <div className="flex flex-wrap gap-4">
                  {companies.map(c => (
                    <div key={c.id} className="flex items-center gap-2 text-sm text-neutral-600 dark:text-slate-300">
                      {c.logo_path && (
                        <img src={getImageUrl(c.logo_path, 'w92')} alt={c.name} className="h-6 object-contain bg-neutral-100 dark:bg-slate-800 rounded px-1" />
                      )}
                      <span>{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Languages */}
            {languages.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                  <Languages className="w-5 h-5 text-indigo-500" /> 语言
                </h3>
                <div className="flex flex-wrap gap-2">
                  {languages.map(l => (
                    <span key={l.iso_639_1} className="px-3 py-1 bg-neutral-100 dark:bg-slate-800 text-neutral-600 dark:text-slate-300 rounded-full text-xs">
                      {l.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Trailer */}
            {trailer && (
              <div>
                <a
                  href={`https://www.youtube.com/watch?v=${trailer.key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" /> 观看预告片
                </a>
              </div>
            )}

            {/* Similar */}
            {similar.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-rose-500" /> 相似推荐
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {similar.map(s => (
                    <div key={s.id} className="group cursor-pointer">
                      <img
                        src={getImageUrl(s.poster_path, 'w185')}
                        alt={s.title || s.name}
                        className="w-full aspect-[2/3] rounded-lg object-cover mb-1.5 shadow-sm group-hover:shadow-md transition-shadow"
                        loading="lazy"
                      />
                      <p className="text-xs text-neutral-700 dark:text-slate-300 line-clamp-1 group-hover:text-blue-500 transition-colors">
                        {s.title || s.name}
                      </p>
                      {s.vote_average > 0 && (
                        <p className="text-[10px] text-yellow-500">★ {s.vote_average.toFixed(1)}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}