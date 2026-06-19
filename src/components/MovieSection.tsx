import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Star, Loader2 } from 'lucide-react';
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
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  return (
    <section className="relative">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-blue-500">{icon}</span>}
          <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {viewAll && (
            <button
              onClick={viewAll}
              className="text-sm text-blue-500 hover:text-blue-400 font-medium cursor-pointer transition-colors"
            >
              查看全部
            </button>
          )}
          <button
            onClick={() => scroll('left')}
            className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-slate-800 hover:bg-neutral-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-slate-800 hover:bg-neutral-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
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
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item) => {
            const posterUrl = getImageUrl(item.poster_path, 'w342');
            const title = item.title || item.name || '';
            const date = item.release_date || item.first_air_date || '';
            const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');

            return (
              <div
                key={item.id}
                onClick={() => onItemClick(item)}
                className="flex-shrink-0 w-[150px] sm:w-[170px] group cursor-pointer"
              >
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-neutral-200 dark:bg-slate-800 mb-2.5">
                  <img
                    src={posterUrl}
                    alt={title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-10 h-10 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 ml-0.5">
                        <path d="M4.5 3.75a.75.75 0 0 0-1.125.65v15.2a.75.75 0 0 0 1.125.65l13.5-7.6a.75.75 0 0 0 0-1.3l-13-7.6Z" />
                      </svg>
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
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-1 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
                  {title}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">
                  {date ? date.split('-')[0] : ''}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}