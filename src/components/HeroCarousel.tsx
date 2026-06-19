import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Play, Star } from 'lucide-react';
import { TMDBMovie } from '../types.js';

interface HeroCarouselProps {
  items: TMDBMovie[];
  getImageUrl: (path: string | null, size?: string) => string;
  onItemClick: (item: TMDBMovie) => void;
  loading?: boolean;
}

export default function HeroCarousel({ items, getImageUrl, onItemClick, loading }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goToNext = useCallback(() => {
    if (items.length === 0) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % items.length);
      setIsTransitioning(false);
    }, 300);
  }, [items.length]);

  const goToPrev = useCallback(() => {
    if (items.length === 0) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(prev => (prev - 1 + items.length) % items.length);
      setIsTransitioning(false);
    }, 300);
  }, [items.length]);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(goToNext, 6000);
    return () => clearInterval(timer);
  }, [items.length, goToNext]);

  if (loading) {
    return (
      <div className="relative w-full h-[420px] sm:h-[500px] bg-neutral-900 animate-pulse rounded-2xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900" />
      </div>
    );
  }

  if (items.length === 0) return null;

  const current = items[currentIndex];
  const backdropUrl = getImageUrl(current.backdrop_path, 'w1280');
  const title = current.title || current.name || '';
  const date = current.release_date || current.first_air_date || '';
  const mediaType = current.media_type || (current.first_air_date ? 'tv' : 'movie');

  return (
    <div className="relative w-full h-[420px] sm:h-[500px] rounded-2xl overflow-hidden group">
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
      >
        <img
          src={backdropUrl}
          alt={title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

      <div className={`absolute bottom-0 left-0 right-0 p-6 sm:p-10 transition-all duration-300 ${isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2.5 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-md uppercase">
              {mediaType === 'tv' ? '电视剧' : '电影'}
            </span>
            {date && (
              <span className="text-neutral-300 text-sm">{date.split('-')[0]}</span>
            )}
            {current.vote_average > 0 && (
              <span className="flex items-center gap-1 text-yellow-400 text-sm">
                <Star className="w-3.5 h-3.5 fill-yellow-400" />
                {current.vote_average.toFixed(1)}
              </span>
            )}
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-3 leading-tight line-clamp-2">
            {title}
          </h2>

          <p className="text-neutral-300 text-sm sm:text-base line-clamp-2 mb-5 leading-relaxed">
            {current.overview || '暂无简介'}
          </p>

          <button
            onClick={() => onItemClick(current)}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm transition-all hover:scale-105 shadow-lg shadow-blue-900/30 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            查看详情
          </button>
        </div>
      </div>

      <button
        onClick={goToPrev}
        className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer backdrop-blur-sm"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={goToNext}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer backdrop-blur-sm"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      <div className="absolute bottom-3 right-6 flex items-center gap-1.5">
        {items.slice(0, Math.min(items.length, 8)).map((_, i) => (
          <button
            key={i}
            onClick={() => {
              setIsTransitioning(true);
              setTimeout(() => {
                setCurrentIndex(i);
                setIsTransitioning(false);
              }, 300);
            }}
            className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
              i === currentIndex ? 'w-8 bg-blue-500' : 'w-4 bg-white/40 hover:bg-white/60'
            }`}
          />
        ))}
      </div>
    </div>
  );
}