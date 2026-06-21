import React from 'react';
import { Star, Loader2, Play } from 'lucide-react';
import { TMDBMovie } from '../types.js';

interface MovieSectionProps {
  title: string;
  icon?: React.ReactNode;
  items: TMDBMovie[];
  getImageUrl: (path: string | null, size?: string) => string;
  onItemClick: (item: TMDBMovie) => void;
  loading?: boolean;
  viewAll?: () => void;
}

export default function MovieSection({ title, icon, items, getImageUrl, onItemClick, loading, viewAll }: MovieSectionProps) {
  const displayItems = items.slice(0, 12);

  return (
    <section className="relative">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-blue-500">{icon}</span>}
          <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white">{title}</h2>
        </div>
        {viewAll && (
          <button
            onClick={viewAll}
            className="text-sm text-blue-500 hover:text-blue-400 font-medium cursor-pointer transition-colors"
          >
            查看全部
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="ml-3 text-neutral-500 dark:text-slate-400">加载中...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-neutral-400 dark:text-slate-500">
          暂无数据
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {displayItems.map((item) => {
            const posterUrl = getImageUrl(item.poster_path, 'w342');
            const title = item.title || item.name || '';
            const date = item.release_date || item.first_air_date || '';
            const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');

            return (
              <div
                key={item.id}
                onClick={() => onItemClick(item)}
                className="group cursor-pointer"
              >
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-neutral-200 dark:bg-slate-800 mb-2 shadow-md group-hover:shadow-xl transition-shadow">
                  <img
                    src={posterUrl}
                    alt={title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-10 h-10 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-lg shadow-blue-600/30">
                      <Play className="w-4 h-4 fill-white ml-0.5" />
                    </div>
                  </div>
                  {item.vote_average > 0 && (
                    <span className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm text-yellow-400 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                      <Star className="w-2.5 h-2.5 fill-yellow-400" />
                      {item.vote_average.toFixed(1)}
                    </span>
                  )}
                  <span className="absolute top-2 left-2 bg-blue-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase">
                    {mediaType === 'tv' ? '剧' : '影'}
                  </span>
                </div>
                <h3 className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white line-clamp-1 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
                  {title}
                </h3>
                <p className="text-[10px] sm:text-xs text-neutral-500 dark:text-slate-400 mt-0.5">
                  {date ? date.split('-')[0] : ''}
                  {item.vote_average > 0 && <span className="ml-1 text-yellow-500">★ {item.vote_average.toFixed(1)}</span>}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}