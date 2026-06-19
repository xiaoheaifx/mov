import React, { useState, useEffect } from 'react';
import { X, Star, Play, Calendar, Clock, Film, Tv, Users } from 'lucide-react';
import { TMDBMovie, TMDBMovieDetail } from '../types.js';

interface TMDBDetailModalProps {
  item: TMDBMovie | null;
  getImageUrl: (path: string | null, size?: string) => string;
  onClose: () => void;
}

export default function TMDBDetailModal({ item, getImageUrl, onClose }: TMDBDetailModalProps) {
  const [detail, setDetail] = useState<TMDBMovieDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!item) {
      setDetail(null);
      return;
    }

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

  if (!item) return null;

  const title = detail?.title || detail?.name || item.title || item.name || '';
  const backdropUrl = getImageUrl(detail?.backdrop_path || item.backdrop_path, 'w780');
  const posterUrl = getImageUrl(detail?.poster_path || item.poster_path, 'w342');
  const date = detail?.release_date || detail?.first_air_date || item.release_date || item.first_air_date || '';
  const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
  const overview = detail?.overview || item.overview || '';
  const genres = detail?.genres?.map(g => g.name).join(' / ') || '';
  const runtime = detail?.runtime;
  const seasons = detail?.number_of_seasons;
  const rating = detail?.vote_average || item.vote_average || 0;
  const cast = detail?.credits?.cast?.slice(0, 6) || [];
  const trailer = detail?.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
  const similar = detail?.similar?.results?.slice(0, 6) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4 sm:p-8" onClick={onClose}>
      <div
        className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-2xl my-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative h-56 sm:h-72 overflow-hidden">
          <img
            src={backdropUrl}
            alt={title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-slate-900 via-black/30 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors cursor-pointer backdrop-blur-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative px-6 sm:px-8 pb-8 -mt-20">
          <div className="flex gap-5">
            <img
              src={posterUrl}
              alt={title}
              className="w-28 sm:w-32 aspect-[2/3] rounded-xl object-cover shadow-xl border-2 border-white dark:border-slate-800 flex-shrink-0"
            />
            <div className="flex-1 pt-2">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-md uppercase">
                  {mediaType === 'tv' ? '电视剧' : '电影'}
                </span>
                {rating > 0 && (
                  <span className="flex items-center gap-1 text-yellow-500 text-sm font-bold">
                    <Star className="w-3.5 h-3.5 fill-yellow-500" />
                    {rating.toFixed(1)}
                  </span>
                )}
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white leading-tight">
                {title}
              </h2>
              <div className="flex items-center gap-3 mt-2 text-sm text-neutral-500 dark:text-slate-400">
                {date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {date}
                  </span>
                )}
                {runtime && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {runtime} 分钟
                  </span>
                )}
                {seasons && (
                  <span className="flex items-center gap-1">
                    <Tv className="w-3.5 h-3.5" />
                    {seasons} 季
                  </span>
                )}
              </div>
              {genres && (
                <p className="mt-2 text-sm text-neutral-600 dark:text-slate-300">{genres}</p>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-neutral-500">加载详情...</span>
            </div>
          ) : (
            <>
              {overview && (
                <div className="mt-6">
                  <h3 className="font-bold text-neutral-900 dark:text-white mb-2">剧情简介</h3>
                  <p className="text-sm text-neutral-600 dark:text-slate-300 leading-relaxed">{overview}</p>
                </div>
              )}

              {cast.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-bold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" /> 主要演员
                  </h3>
                  <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                    {cast.map(c => (
                      <div key={c.id} className="flex-shrink-0 w-16 text-center">
                        <img
                          src={getImageUrl(c.profile_path, 'w185')}
                          alt={c.name}
                          className="w-14 h-14 rounded-full object-cover mx-auto mb-1.5 bg-neutral-200 dark:bg-slate-700"
                          loading="lazy"
                        />
                        <p className="text-[10px] font-medium text-neutral-700 dark:text-slate-300 line-clamp-1">{c.name}</p>
                        <p className="text-[9px] text-neutral-400 line-clamp-1">{c.character}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {trailer && (
                <div className="mt-6">
                  <a
                    href={`https://www.youtube.com/watch?v=${trailer.key}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-medium transition-colors"
                  >
                    <Play className="w-4 h-4 fill-white" /> 观看预告片
                  </a>
                </div>
              )}

              {similar.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-bold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                    <Film className="w-4 h-4" /> 相似推荐
                  </h3>
                  <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                    {similar.map(s => (
                      <div key={s.id} className="flex-shrink-0 w-24">
                        <img
                          src={getImageUrl(s.poster_path, 'w185')}
                          alt={s.title || s.name}
                          className="w-24 aspect-[2/3] rounded-lg object-cover mb-1"
                          loading="lazy"
                        />
                        <p className="text-[10px] text-neutral-700 dark:text-slate-300 line-clamp-1">{s.title || s.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}