import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Play, Star, Info } from 'lucide-react';

interface CarouselItem {
  id: number;
  title: string;
  overview: string;
  backdropPath: string | null;
  posterPath: string | null;
  voteAverage: number;
  releaseDate: string;
  mediaType: string;
}

interface HeroCarouselProps {
  items: CarouselItem[];
  onPlay: (item: CarouselItem) => void;
  onDetail: (item: CarouselItem) => void;
  loading?: boolean;
}

export default function HeroCarousel({ items, onPlay, onDetail, loading }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goToNext = useCallback(() => {
    if (items.length === 0) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % items.length);
      setIsTransitioning(false);
    }, 400);
  }, [items.length]);

  const goToPrev = useCallback(() => {
    if (items.length === 0) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(prev => (prev - 1 + items.length) % items.length);
      setIsTransitioning(false);
    }, 400);
  }, [items.length]);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(goToNext, 6000);
    return () => clearInterval(timer);
  }, [items.length, goToNext]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToPrev();
      if (e.key === 'ArrowRight') goToNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goToNext, goToPrev]);

  if (loading) {
    return (
      <div className="relative w-full h-[420px] sm:h-[500px] lg:h-[560px] bg-neutral-200 animate-pulse overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-200 via-neutral-300 to-neutral-200" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="relative w-full h-[350px] sm:h-[420px] overflow-hidden bg-gradient-to-br from-red-700 via-red-600 to-orange-500">
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#f5f5f5] via-transparent to-transparent" />
        <div className="absolute bottom-16 left-8 sm:left-12 lg:left-16 max-w-lg">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2.5 py-0.5 bg-white/20 text-white text-xs font-bold rounded-md backdrop-blur-sm">小何影视</span>
            <span className="text-white/70 text-sm">欢迎回来</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-3 leading-tight">
            发现精彩影视
          </h1>
          <p className="text-white/80 text-sm sm:text-base line-clamp-2 mb-5 leading-relaxed">
            浏览片库中的精选影片，享受极速观影体验。
          </p>
        </div>
      </div>
    );
  }

  const current = items[currentIndex];

  return (
    <div className="relative w-full h-[420px] sm:h-[500px] lg:h-[560px] overflow-hidden group">
      {/* Background image with transition */}
      <div className="absolute inset-0 transition-opacity duration-500">
        <img
          src={current.backdropPath
            ? `https://image.tmdb.org/t/p/w1280${current.backdropPath}`
            : 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAwIiBoZWlnaHQ9IjU2MCIgdmlld0JveD0iMCAwIDEwMDAgNTYwIj48cmVjdCB3aWR0aD0iMTAwMCIgaGVpZ2h0PSI1NjAiIGZpbGw9IiMxZTI5M2IiLz48L3N2Zz4='
          }
          alt={current.title}
          className={`w-full h-full object-cover transition-all duration-700 ${isTransitioning ? 'opacity-50 scale-105' : 'opacity-100 scale-100'}`}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </div>

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#f5f5f5] via-transparent to-white/30" />

      {/* Content */}
      <div className="absolute inset-0 flex items-center">
        <div className="px-8 sm:px-12 lg:px-16 max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-0.5 bg-red-600/10 text-red-600 text-[10px] font-bold rounded-md uppercase tracking-wider">
              {current.mediaType === 'tv' ? '剧集' : '电影'}
            </span>
            {current.releaseDate && (
              <span className="text-gray-500 text-sm">{current.releaseDate.split('-')[0]}</span>
            )}
            <span className="flex items-center gap-1 text-amber-500 text-sm">
              <Star className="w-3.5 h-3.5 fill-amber-500" />
              {Math.round((current.voteAverage || 0) * 10) / 10}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-neutral-900 mb-3 leading-tight transition-all duration-500">
            {current.title}
          </h1>

          <p className="text-gray-600 text-sm sm:text-base line-clamp-2 mb-5 leading-relaxed">
            {current.overview}
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onPlay(current)}
              className="flex items-center gap-2 px-6 sm:px-8 py-2.5 sm:py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-500 transition-all text-sm sm:text-base shadow-lg shadow-red-600/20 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-white" /> 立即播放
            </button>
            <button
              onClick={() => onDetail(current)}
              className="flex items-center gap-2 px-6 sm:px-8 py-2.5 sm:py-3 bg-white/80 text-neutral-900 font-bold rounded-lg hover:bg-white transition-all text-sm sm:text-base border border-gray-200 cursor-pointer"
            >
              <Info className="w-5 h-5" /> 更多信息
            </button>
          </div>
        </div>
      </div>

      {/* Navigation arrows */}
      {items.length > 1 && (
        <>
          <button
            onClick={goToPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-neutral-700" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
            aria-label="Next slide"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-neutral-700" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {items.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setIsTransitioning(true);
                setTimeout(() => {
                  setCurrentIndex(index);
                  setIsTransitioning(false);
                }, 200);
              }}
              className={`rounded-full transition-all duration-300 cursor-pointer ${
                index === currentIndex
                  ? 'w-8 h-2 bg-red-600'
                  : 'w-2 h-2 bg-gray-400 hover:bg-gray-600'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}