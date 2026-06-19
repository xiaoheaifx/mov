/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Play, Film, Clock, ShieldCheck, ShieldAlert, Sparkles } from 'lucide-react';
import { Movie } from '../types.js';

interface MovieCardProps {
  key?: string;
  movie: Movie;
  onClick: (id: string) => void;
  showAdminStatus?: boolean; // Toggled inside admin consoles to show stream checks
}

export default function MovieCard({ movie, onClick, showAdminStatus = false }: MovieCardProps) {
  const getValidityBadge = () => {
    if (movie.streamValid === true) {
      return (
        <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20">
          <ShieldCheck className="w-3 h-3" /> 源有效
        </span>
      );
    } else if (movie.streamValid === false) {
      return (
        <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-rose-500/20">
          <ShieldAlert className="w-3 h-3" /> 源无效
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700">
        未检测源
      </span>
    );
  };

  return (
    <div 
      id={`movie-card-${movie.id}`}
      onClick={() => onClick(movie.id)}
      className="group flex flex-col bg-white border border-neutral-200 rounded-2xl overflow-hidden hover:shadow-2xl hover:shadow-blue-900/10 hover:border-neutral-300 dark:bg-slate-905 dark:border-slate-800/80 dark:hover:shadow-blue-900/15 dark:hover:border-slate-700 transition-all duration-300 cursor-pointer h-full"
    >
      {/* Cover image wrap */}
      <div className="relative aspect-[16/10] overflow-hidden bg-neutral-200 dark:bg-slate-950">
        <img
          id={`movie-cover-${movie.id}`}
          src={movie.coverUrl}
          alt={movie.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent opacity-85 group-hover:opacity-95 transition-opacity" />
        
        {/* Play micro overlay icon */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-300">
            <Play className="w-5 h-5 fill-white ml-0.5" />
          </div>
        </div>

        {/* Genre badge top-right */}
        <span id={`genre-badge-${movie.id}`} className="absolute top-3 right-3 bg-white/90 backdrop-blur-md text-neutral-700 font-semibold text-[10px] px-2.5 py-1 rounded-md tracking-wider border border-neutral-200 dark:bg-slate-900/90 dark:text-slate-200 dark:border-slate-800">
          {movie.genre}
        </span>
      </div>

      {/* Core detailed area */}
      <div className="p-4 flex flex-col flex-1 gap-2.5">
        <div className="flex items-start justify-between gap-2">
          <h3 id={`movie-title-${movie.id}`} className="font-bold text-neutral-900 dark:text-white line-clamp-1 text-base group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
            {movie.title}
          </h3>
          {movie.genre?.includes('直播') && (
            <span className="flex items-center gap-0.5 text-xs text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" /> LIVE
            </span>
          )}
        </div>

        <p id={`movie-desc-${movie.id}`} className="text-xs text-neutral-500 dark:text-slate-400 line-clamp-2 leading-relaxed flex-1">
          {movie.description}
        </p>

        {/* Info indicators row */}
        <div className="flex items-center justify-between border-t border-neutral-100 dark:border-slate-805/80 pt-3 text-[11px] text-neutral-400 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-neutral-300 dark:text-slate-500" />
            {movie.duration}
          </span>
          {showAdminStatus && getValidityBadge()}
        </div>
      </div>
    </div>
  );
}