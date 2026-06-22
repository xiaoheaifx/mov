/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Film, 
  Search, 
  Filter, 
  LogIn, 
  LogOut, 
  User, 
  Users, 
  Plus, 
  Trash2, 
  Edit, 
  ChevronLeft, 
  Calendar, 
  Loader2, 
  RefreshCw, 
  Play, 
  Sliders, 
  AlertCircle, 
  TrendingUp, 
  Layers, 
  Tv, 
  Laptop,
  Flame,
  UserCheck,
  Sparkles,
  Sun,
  Moon,
  Clock,
  Star,
  Globe,
  Bomb,
  Rocket,
  Skull,
  Zap
} from 'lucide-react';
import { Movie, TMDBMovie, TVBoxSite, TVBoxVideoItem, TVBoxVideoDetail, PosterSearchResult, VideoSource, LiveSource, LiveChannel } from './types.js';
import MovieCard from './components/MovieCard.js';
import VideoPlayer from './components/VideoPlayer.js';
import HeroCarousel from './components/HeroCarousel.js';
import MovieSection from './components/MovieSection.js';
import TVBoxPanel from './components/TVBoxPanel.js';
import TMDBDetailModal from './components/TMDBDetailModal.js';
import TMDBDetailPage from './components/TMDBDetailPage.js';

type PageRoute = 'home' | 'movie-detail' | 'detail' | 'viewer-login' | 'admin-login' | 'admin-dashboard' | 'tvbox-play' | 'movies' | 'tv' | 'anime' | 'variety' | 'live';

function TMDBDetailRoute({ tmdbId, getImageUrl, tmdbCache, onBack }: {
  tmdbId: string;
  getImageUrl: (path: string | null, size?: string) => string;
  tmdbCache: Record<string, TMDBMovie>;
  onBack: () => void;
}) {
  const [item, setItem] = useState<TMDBMovie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tmdbId) {
      setLoading(false);
      return;
    }
    
    // Check cache first
    if (tmdbCache[tmdbId]) {
      setItem(tmdbCache[tmdbId]);
      setLoading(false);
      return;
    }

    // Fetch from API if not in cache
    const fetchMovie = async () => {
      setLoading(true);
      setError(null);
      try {
        // Try movie first
        const movieRes = await fetch(`/api/tmdb/movie/${tmdbId}`);
        if (movieRes.ok) {
          const data = await movieRes.json();
          const movieItem: TMDBMovie = {
            id: data.id,
            title: data.title,
            name: data.name,
            overview: data.overview || '',
            poster_path: data.poster_path,
            backdrop_path: data.backdrop_path,
            vote_average: data.vote_average || 0,
            release_date: data.release_date,
            first_air_date: data.first_air_date,
            media_type: 'movie',
            popularity: data.popularity || 0,
          };
          setItem(movieItem);
          // Cache the result
          tmdbCache[tmdbId] = movieItem;
          setLoading(false);
          return;
        }
      } catch (e) {
        console.error('Failed to fetch movie:', e);
      }

      // Try TV if movie fails
      try {
        const tvRes = await fetch(`/api/tmdb/tv/${tmdbId}`);
        if (tvRes.ok) {
          const data = await tvRes.json();
          const tvItem: TMDBMovie = {
            id: data.id,
            title: data.title,
            name: data.name,
            overview: data.overview || '',
            poster_path: data.poster_path,
            backdrop_path: data.backdrop_path,
            vote_average: data.vote_average || 0,
            release_date: data.release_date,
            first_air_date: data.first_air_date,
            media_type: 'tv',
            popularity: data.popularity || 0,
          };
          setItem(tvItem);
          // Cache the result
          tmdbCache[tmdbId] = tvItem;
          setLoading(false);
          return;
        }
      } catch (e) {
        console.error('Failed to fetch TV:', e);
      }

      // If both fail, show error
      setError('无法加载影片信息');
      setLoading(false);
    };

    fetchMovie();
  }, [tmdbId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="ml-3 text-neutral-500">加载影片详情...</span>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <AlertCircle className="w-12 h-12 text-rose-500" />
        <h3 className="text-lg font-bold text-neutral-900 dark:text-white">{error || '影片未找到'}</h3>
        <button onClick={onBack} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm cursor-pointer">返回首页</button>
      </div>
    );
  }

  return (
    <TMDBDetailPage
      item={item}
      getImageUrl={getImageUrl}
      onBack={onBack}
    />
  );
}

export default function App() {
  // Navigation Routing States
  const [currentRoute, setCurrentRoute] = useState<PageRoute>('home');
  const [activeMovieId, setActiveMovieId] = useState<string | null>(null);

  // Auth Context Global States
  const [currentUser, setCurrentUser] = useState<{ username: string; role: 'viewer' | 'admin' | 'streamer' } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Display List States
  const [movies, setMovies] = useState<Movie[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [moviesLoading, setMoviesLoading] = useState(false);
  
  // Dashboard management arrays
  const [adminMovies, setAdminMovies] = useState<Movie[]>([]);
  const [adminUsers, setAdminUsers] = useState<Array<{ username: string; createdAt: string; role: 'viewer' }>>([]);
  const [adminStreamers, setAdminStreamers] = useState<Array<{ username: string; createdAt: string; role: 'streamer' }>>([]);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashActiveTab, setDashActiveTab] = useState<'video-sources' | 'movies' | 'users' | 'streamers' | 'tvbox' | 'live-sources'>('video-sources');

  // Search, Filters & View Options
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('全部');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchInputValue, setSearchInputValue] = useState('');

  // Interactive UI Modal States
  const [movieModalOpen, setMovieModalOpen] = useState(false);
  const [editingMovie, setEditingMovie] = useState<Movie | null>(null);
  
  // Movie Form State
  const [movieForm, setMovieForm] = useState({
    title: '',
    duration: '',
    genre: '',
    coverUrl: '',
    description: '',
    streamUrl: ''
  });

  // Admin and ordinary account lists adding
  const [newViewerName, setNewViewerName] = useState('');
  const [newViewerPass, setNewViewerPass] = useState('');
  const [newStreamerName, setNewStreamerName] = useState('');
  const [newStreamerPass, setNewStreamerPass] = useState('');

  // Notification notification feedback lines
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Theme state (default light)
  const [isDark, setIsDark] = useState(false);

  // TMDB API Data States
  const [tmdbTrending, setTmdbTrending] = useState<TMDBMovie[]>([]);
  const [tmdbNowPlaying, setTmdbNowPlaying] = useState<TMDBMovie[]>([]);
  const [tmdbPopular, setTmdbPopular] = useState<TMDBMovie[]>([]);
  const [tmdbTvPopular, setTmdbTvPopular] = useState<TMDBMovie[]>([]);
  const [tmdbTvTopRated, setTmdbTvTopRated] = useState<TMDBMovie[]>([]);
  const [tmdbTrendingLoading, setTmdbTrendingLoading] = useState(true);
  const [tmdbNowPlayingLoading, setTmdbNowPlayingLoading] = useState(true);
  const [tmdbPopularLoading, setTmdbPopularLoading] = useState(true);
  const [tmdbTvPopularLoading, setTmdbTvPopularLoading] = useState(true);
  const [tmdbTvTopRatedLoading, setTmdbTvTopRatedLoading] = useState(true);
  const [tmdbSearchResults, setTmdbSearchResults] = useState<TMDBMovie[]>([]);
  const [tmdbSearchLoading, setTmdbSearchLoading] = useState(false);
  const [tmdbSearchQuery, setTmdbSearchQuery] = useState('');
  const [tmdbChineseMovies, setTmdbChineseMovies] = useState<TMDBMovie[]>([]);
  const [tmdbChineseMoviesLoading, setTmdbChineseMoviesLoading] = useState(true);
  const [tmdbChineseAnime, setTmdbChineseAnime] = useState<TMDBMovie[]>([]);
  const [tmdbChineseAnimeLoading, setTmdbChineseAnimeLoading] = useState(true);
  const [tmdbActionMovies, setTmdbActionMovies] = useState<TMDBMovie[]>([]);
  const [tmdbActionMoviesLoading, setTmdbActionMoviesLoading] = useState(true);
  const [tmdbScifiMovies, setTmdbScifiMovies] = useState<TMDBMovie[]>([]);
  const [tmdbScifiMoviesLoading, setTmdbScifiMoviesLoading] = useState(true);
  const [tmdbHorrorMovies, setTmdbHorrorMovies] = useState<TMDBMovie[]>([]);
  const [tmdbHorrorMoviesLoading, setTmdbHorrorMoviesLoading] = useState(true);
  const [detailPageItem, setDetailPageItem] = useState<TMDBMovie | null>(null);
  const [detailTmdbId, setDetailTmdbId] = useState<string>('');
  const tmdbCacheRef = React.useRef<Record<string, TMDBMovie>>({});
  const [tmdbSelectedMovie, setTmdbSelectedMovie] = useState<TMDBMovie | null>(null);

  // TVBox States
  const [tvboxSites, setTvboxSites] = useState<TVBoxSite[]>([]);
  const [tvboxCmsSites, setTvboxCmsSites] = useState<TVBoxSite[]>([]);
  const [tvboxSpiderSites, setTvboxSpiderSites] = useState<TVBoxSite[]>([]);
  const [tvboxCmsCount, setTvboxCmsCount] = useState<number>(0);
  const [tvboxSpiderCount, setTvboxSpiderCount] = useState<number>(0);
  const [tvboxLoading, setTvboxLoading] = useState(false);
  const [tvboxParseError, setTvboxParseError] = useState<string | null>(null);
  const [tvboxSearchResults, setTvboxSearchResults] = useState<TVBoxVideoItem[]>([]);
  const [tvboxSearchLoading, setTvboxSearchLoading] = useState(false);
  const [tvboxPlayingDetail, setTvboxPlayingDetail] = useState<TVBoxVideoDetail | null>(null);
  const [tvboxPlayUrl, setTvboxPlayUrl] = useState<string>('');
  const [tvboxPlayName, setTvboxPlayName] = useState<string>('');

  // Live Stream Sources States
  const [liveSources, setLiveSources] = useState<LiveSource[]>([]);
  const [liveSourceLoading, setLiveSourceLoading] = useState(false);
  const [liveSourceForm, setLiveSourceForm] = useState({ name: '', type: 'm3u' as 'm3u' | 'txt', url: '', group: '' });
  const [editingLiveSource, setEditingLiveSource] = useState<LiveSource | null>(null);
  const [liveSourceModalOpen, setLiveSourceModalOpen] = useState(false);
  const [liveChannels, setLiveChannels] = useState<LiveChannel[]>([]);
  const [liveParseLoading, setLiveParseLoading] = useState(false);
  const [liveParseError, setLiveParseError] = useState<string | null>(null);
  const [selectedLiveChannel, setSelectedLiveChannel] = useState<LiveChannel | null>(null);

  // Video Source States
  const [videoSources, setVideoSources] = useState<VideoSource[]>([]);
  const [videoSourceLoading, setVideoSourceLoading] = useState(false);
  const [videoSourceForm, setVideoSourceForm] = useState({ name: '', key: '', api: '', detail: '' });
  const [editingVideoSource, setEditingVideoSource] = useState<VideoSource | null>(null);
  const [videoSourceModalOpen, setVideoSourceModalOpen] = useState(false);

  // Login mode toggle
  const [loginMode, setLoginMode] = useState<'viewer' | 'admin'>('viewer');

  // Poster Search States (98dou API)
  const [posterSearchResults, setPosterSearchResults] = useState<PosterSearchResult[]>([]);
  const [posterSearchLoading, setPosterSearchLoading] = useState(false);

  // TMDB Image URL helper - direct TMDB URLs for Netlify compatibility
  const getTmdbImageUrl = (path: string | null, size: string = 'w500'): string => {
    if (!path) return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMzAwIiB2aWV3Qm94PSIwIDAgMjAwIDMwMCI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIzMDAiIGZpbGw9IiMxZTI5M2IiLz48dGV4dCB4PSIxMDAiIHk9IjE1MCIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2YjcyODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPuWbvueJh+WKoOi9veWksei0pTwvdGV4dD48L3N2Zz4=';
    return `https://image.tmdb.org/t/p/${size}${path}`;
  };

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      setIsDark(true);
    }
  }, []);

  // Hash-based simple Router Listener
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (!hash || hash === '#/' || hash === '#home') {
        setCurrentRoute('home');
        setActiveMovieId(null);
        setDetailPageItem(null);
      } else if (hash.startsWith('#/movie/')) {
        const id = hash.replace('#/movie/', '');
        setActiveMovieId(id);
        setCurrentRoute('movie-detail');
      } else if (hash === '#/login') {
        setCurrentRoute('viewer-login');
      } else if (hash === '#/admin/login') {
        setCurrentRoute('admin-login');
      } else if (hash === '#/admin/dashboard') {
        setCurrentRoute('admin-dashboard');
      } else if (hash === '#/movies') {
        setCurrentRoute('movies');
      } else if (hash === '#/tv') {
        setCurrentRoute('tv');
      } else if (hash === '#/anime') {
        setCurrentRoute('anime');
      } else if (hash === '#/variety') {
        setCurrentRoute('variety');
      } else if (hash === '#/live') {
        setCurrentRoute('live');
      } else if (hash === '#/tvbox/play') {
        setCurrentRoute('tvbox-play');
      } else if (hash.startsWith('#/detail/')) {
        const id = hash.replace('#/detail/', '');
        setDetailTmdbId(id);
        setCurrentRoute('detail');
      } else if (hash === '#/detail') {
        setCurrentRoute('home');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Sync profile details on page initialization
  const fetchUserProfile = async () => {
    try {
      setAuthLoading(true);
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.loggedIn && data.user) {
        setCurrentUser(data.user);
      } else {
        setCurrentUser(null);
      }
    } catch (e) {
      console.error('Failed to resolve profile status:', e);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

  // Load Movies catalog
  const loadMovies = async () => {
    try {
      setMoviesLoading(true);
      const res = await fetch('/api/movies');
      if (res.ok) {
        const data = await res.json();
        setMovies(data);
      }
    } catch (err) {
      console.error('Error listing public movies:', err);
    } finally {
      setMoviesLoading(false);
    }
  };

  useEffect(() => {
    loadMovies();
  }, []);

  // Load TMDB Data
  useEffect(() => {
    const fetchTmdb = async (endpoint: string): Promise<TMDBMovie[]> => {
      try {
        const res = await fetch(endpoint);
        if (res.ok) {
          const data = await res.json();
          return data.results || [];
        }
        return [];
      } catch {
        return [];
      }
    };

    const loadAllTmdb = async () => {
      setTmdbTrendingLoading(true);
      setTmdbNowPlayingLoading(true);
      setTmdbPopularLoading(true);
      setTmdbTvPopularLoading(true);
      setTmdbTvTopRatedLoading(true);
      setTmdbChineseMoviesLoading(true);
      setTmdbChineseAnimeLoading(true);
      setTmdbActionMoviesLoading(true);
      setTmdbScifiMoviesLoading(true);
      setTmdbHorrorMoviesLoading(true);

      const [
        trending, nowPlaying, popular, tvPopular, tvTopRated,
        chineseMovies, chineseAnime, actionMovies, scifiMovies, horrorMovies
      ] = await Promise.all([
        fetchTmdb('/api/tmdb/trending?media_type=all&time_window=week'),
        fetchTmdb('/api/tmdb/movie/now_playing'),
        fetchTmdb('/api/tmdb/movie/popular'),
        fetchTmdb('/api/tmdb/tv/popular'),
        fetchTmdb('/api/tmdb/tv/top_rated'),
        fetchTmdb('/api/tmdb/discover/movie?with_original_language=zh&sort_by=popularity.desc'),
        fetchTmdb('/api/tmdb/discover/tv?with_genres=16&with_original_language=zh&sort_by=popularity.desc'),
        fetchTmdb('/api/tmdb/discover/movie?with_genres=28&sort_by=popularity.desc'),
        fetchTmdb('/api/tmdb/discover/movie?with_genres=878&sort_by=popularity.desc'),
        fetchTmdb('/api/tmdb/discover/movie?with_genres=27&sort_by=popularity.desc'),
      ]);

      setTmdbTrending(trending);
      setTmdbNowPlaying(nowPlaying);
      setTmdbPopular(popular);
      setTmdbTvPopular(tvPopular);
      setTmdbTvTopRated(tvTopRated);
      setTmdbChineseMovies(chineseMovies);
      setTmdbChineseAnime(chineseAnime);
      setTmdbActionMovies(actionMovies);
      setTmdbScifiMovies(scifiMovies);
      setTmdbHorrorMovies(horrorMovies);
      setTmdbTrendingLoading(false);
      setTmdbNowPlayingLoading(false);
      setTmdbPopularLoading(false);
      setTmdbTvPopularLoading(false);
      setTmdbTvTopRatedLoading(false);
      setTmdbChineseMoviesLoading(false);
      setTmdbChineseAnimeLoading(false);
      setTmdbActionMoviesLoading(false);
      setTmdbScifiMoviesLoading(false);
      setTmdbHorrorMoviesLoading(false);
    };

    loadAllTmdb();
  }, []);

  // TVBox handlers
  const handleTvboxParse = async (url: string) => {
    setTvboxLoading(true);
    setTvboxParseError(null);
    try {
      const res = await fetch('/api/tvbox/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (data.success) {
        setTvboxSites(data.sites || []);
        setTvboxCmsSites(data.cmsSites || []);
        setTvboxSpiderSites(data.spiderSites || []);
        setTvboxCmsCount(data.cmsCount || 0);
        setTvboxSpiderCount(data.spiderCount || 0);
        const cmsCount = data.cmsSites?.length || 0;
        const spiderCount = data.spiderSites?.length || 0;
        const totalCount = data.sites?.length || 0;
        if (cmsCount > 0 || spiderCount > 0) {
          showToast(`成功解析 ${totalCount} 个站点：${cmsCount} 个CMS采集站，${spiderCount} 个Spider扩展站`, 'success');
        } else {
          showToast(`成功解析 ${totalCount} 个站点`, 'success');
        }
      } else {
        setTvboxParseError(data.error || '解析失败');
      }
    } catch (e) {
      setTvboxParseError('网络请求失败');
    } finally {
      setTvboxLoading(false);
    }
  };

  const handleTvboxSearch = async (siteUrl: string, keyword: string) => {
    setTvboxSearchLoading(true);
    setTvboxSearchResults([]);
    try {
      const res = await fetch(`/api/tvbox/search?url=${encodeURIComponent(siteUrl)}&wd=${encodeURIComponent(keyword)}`);
      if (res.ok) {
        const data = await res.json();
        setTvboxSearchResults(data.list || []);
        if (!data.list || data.list.length === 0) {
          showToast('未找到相关影片', 'error');
        }
      }
    } catch (e) {
      showToast('搜索请求失败', 'error');
    } finally {
      setTvboxSearchLoading(false);
    }
  };

  const handleTvboxGetDetail = async (siteUrl: string, vodId: string): Promise<TVBoxVideoDetail | null> => {
    try {
      const res = await fetch(`/api/tvbox/detail?url=${encodeURIComponent(siteUrl)}&ids=${vodId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.list && data.list.length > 0) {
          return data.list[0];
        }
      }
    } catch (e) {
      showToast('获取详情失败', 'error');
    }
    return null;
  };

  const handleTvboxPlay = (detail: TVBoxVideoDetail) => {
    setTvboxPlayingDetail(detail);
    const playUrls = detail.vod_play_url?.split('#').filter(Boolean) || [];
    const firstPlay = playUrls[0];
    const streamUrl = firstPlay ? firstPlay.split('$')[1] || firstPlay : '';
    const firstName = firstPlay ? firstPlay.split('$')[0] || '第1集' : '';
    setTvboxPlayUrl(streamUrl);
    setTvboxPlayName(firstName);
    navigateTo('#/tvbox/play');
  };

  // Video Source CRUD handlers
  const loadVideoSources = async () => {
    setVideoSourceLoading(true);
    try {
      const res = await fetch('/api/admin/video-sources', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setVideoSources(data);
      } else {
        console.error('Failed to load video sources:', res.status, res.statusText);
      }
    } catch (err) {
      console.error('Error loading video sources:', err);
    } finally {
      setVideoSourceLoading(false);
    }
  };

  const handleVideoSourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoSourceForm.name || !videoSourceForm.key || !videoSourceForm.api) {
      showToast('名称、Key和API地址为必填项', 'error');
      return;
    }

    try {
      const isEditing = !!editingVideoSource;
      const url = isEditing ? `/api/admin/video-sources/${editingVideoSource.id}` : '/api/admin/video-sources';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(videoSourceForm),
        credentials: 'include'
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(isEditing ? '视频源更新成功' : '视频源添加成功', 'success');
        setVideoSourceModalOpen(false);
        setEditingVideoSource(null);
        setVideoSourceForm({ name: '', key: '', api: '', detail: '' });
        loadVideoSources();
      } else {
        showToast(data.error || '操作失败', 'error');
      }
    } catch (err) {
      showToast('网络请求失败', 'error');
    }
  };

  const handleDeleteVideoSource = async (id: string, name: string) => {
    if (!confirm(`确定要删除视频源"${name}"吗？`)) return;
    try {
      const res = await fetch(`/api/admin/video-sources/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('视频源已删除', 'success');
        loadVideoSources();
      } else {
        showToast(data.error || '删除失败', 'error');
      }
    } catch (err) {
      showToast('网络请求失败', 'error');
    }
  };

  const startEditVideoSource = (source: VideoSource) => {
    setEditingVideoSource(source);
    setVideoSourceForm({
      name: source.name,
      key: source.key,
      api: source.api,
      detail: source.detail || ''
    });
    setVideoSourceModalOpen(true);
  };

  // Live Stream Sources CRUD handlers
  const loadLiveSources = async () => {
    setLiveSourceLoading(true);
    try {
      const res = await fetch('/api/admin/live-sources', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setLiveSources(data);
      } else {
        console.error('Failed to load live sources:', res.status, res.statusText);
      }
    } catch (err) {
      console.error('Error loading live sources:', err);
    } finally {
      setLiveSourceLoading(false);
    }
  };

  const handleLiveSourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveSourceForm.name || !liveSourceForm.type || !liveSourceForm.url) {
      showToast('名称、类型和URL为必填项', 'error');
      return;
    }

    try {
      const isEditing = !!editingLiveSource;
      const url = isEditing ? `/api/admin/live-sources/${editingLiveSource.id}` : '/api/admin/live-sources';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(liveSourceForm),
        credentials: 'include'
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(isEditing ? '直播源更新成功' : '直播源添加成功', 'success');
        setLiveSourceModalOpen(false);
        setEditingLiveSource(null);
        setLiveSourceForm({ name: '', type: 'm3u', url: '', group: '' });
        loadLiveSources();
      } else {
        showToast(data.error || '操作失败', 'error');
      }
    } catch (err) {
      showToast('网络请求失败', 'error');
    }
  };

  const handleDeleteLiveSource = async (id: string, name: string) => {
    if (!confirm(`确定要删除直播源"${name}"吗？`)) return;
    try {
      const res = await fetch(`/api/admin/live-sources/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('直播源已删除', 'success');
        loadLiveSources();
      } else {
        showToast(data.error || '删除失败', 'error');
      }
    } catch (err) {
      showToast('网络请求失败', 'error');
    }
  };

  const startEditLiveSource = (source: LiveSource) => {
    setEditingLiveSource(source);
    setLiveSourceForm({
      name: source.name,
      type: source.type,
      url: source.url,
      group: source.group || ''
    });
    setLiveSourceModalOpen(true);
  };

  const handleParseLiveSource = async (url: string, type: 'm3u' | 'txt') => {
    setLiveParseLoading(true);
    setLiveParseError(null);
    setLiveChannels([]);
    try {
      const res = await fetch('/api/live-sources/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, type })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLiveChannels(data.channels);
        showToast(`解析成功，共 ${data.total} 个频道`, 'success');
      } else {
        setLiveParseError(data.error || '解析失败');
        showToast(data.error || '解析失败', 'error');
      }
    } catch (err) {
      setLiveParseError('网络请求失败');
      showToast('网络请求失败', 'error');
    } finally {
      setLiveParseLoading(false);
    }
  };

  // Fetch full details of single selected movie
  useEffect(() => {
    if (activeMovieId && currentRoute === 'movie-detail') {
      const fetchDetail = async () => {
        try {
          const res = await fetch(`/api/movies/${activeMovieId}`);
          if (res.ok) {
            const data = await res.json();
            setSelectedMovie(data);
          } else {
            showToast('电影信息未找到', 'error');
            navigateTo('/');
          }
        } catch (err) {
          console.error('Error fetching detail:', err);
        }
      };
      fetchDetail();
    } else {
      setSelectedMovie(null);
    }
  }, [activeMovieId, currentRoute, currentUser]);

  // Handle active admin tab changing
  useEffect(() => {
    if (currentRoute === 'admin-dashboard' && currentUser) {
      // If streamer logged in, force tabs back to movies management (streamers can't manage users/streamers)
      if (currentUser.role === 'streamer') {
        setDashActiveTab('movies');
      }
      refreshDashboardData();
    }
  }, [currentRoute, dashActiveTab, currentUser]);

  const refreshDashboardData = async () => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'streamer')) return;

    try {
      setDashLoading(true);
      if (dashActiveTab === 'video-sources') {
        await loadVideoSources();
      } else if (dashActiveTab === 'live-sources' && currentUser.role === 'admin') {
        await loadLiveSources();
      } else if (dashActiveTab === 'movies') {
        const res = await fetch('/api/admin/movies');
        if (res.ok) setAdminMovies(await res.json());
      } else if (dashActiveTab === 'users' && currentUser.role === 'admin') {
        const res = await fetch('/api/admin/users');
        if (res.ok) setAdminUsers(await res.json());
      } else if (dashActiveTab === 'streamers' && currentUser.role === 'admin') {
        const res = await fetch('/api/admin/streamers');
        if (res.ok) setAdminStreamers(await res.json());
      }
    } catch (error) {
      console.error('Failed to load administrative dashboard tab content:', error);
    } finally {
      setDashLoading(false);
    }
  };

  // Toast notifications helpers
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  // Navigation router shortcuts
  const navigateTo = (hash: string) => {
    window.location.hash = hash;
  };

  const navigateToDetail = (item: TMDBMovie) => {
    tmdbCacheRef.current[String(item.id)] = item;
    setDetailPageItem(item);
    window.location.hash = '#/detail/' + item.id;
  };

  // TMDB Search handler
  const handleTmdbSearch = async (query: string) => {
    setTmdbSearchLoading(true);
    setTmdbSearchQuery(query);
    try {
      const res = await fetch(`/api/tmdb/search?query=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        // Filter results to only include movies and TV shows
        const filteredResults = (data.results || [])
          .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv' || item.title || item.name)
          .map((item: any) => ({
            ...item,
            media_type: item.media_type || (item.first_air_date ? 'tv' : 'movie')
          }));
        setTmdbSearchResults(filteredResults);
      } else {
        setTmdbSearchResults([]);
      }
    } catch (e) {
      console.error('Search failed:', e);
      setTmdbSearchResults([]);
    } finally {
      setTmdbSearchLoading(false);
    }
  };

  // Spectator login submission handler
  const handleViewerLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const username = fd.get('username') as string;
    const password = fd.get('password') as string;

    if (!username || !password) {
      showToast('请输入用户名与密码！', 'error');
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        showToast(`欢迎回来，${username}！成功以观众身份登录。`, 'success');
        setCurrentUser(data.user);
        
        // Return back to movie if logging in on invitation
        if (activeMovieId) {
          navigateTo(`#/movie/${activeMovieId}`);
        } else {
          navigateTo('#/');
        }
      } else {
        showToast(data.error || '登录失败，请检查您的凭证。', 'error');
      }
    } catch (err) {
      showToast('联络服务器登录超时，请重试。', 'error');
    }
  };

  // Administrator login submission handler
  const handleAdminLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const username = fd.get('username') as string;
    const password = fd.get('password') as string;

    if (!username || !password) {
      showToast('请输入后台管理员或是直播员账号和密码', 'error');
      return;
    }

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(`登陆成功！已接入后台终端：${username} (${data.user.role === 'admin' ? '超级管理员' : '直播员'})`, 'success');
        setCurrentUser(data.user);
        navigateTo('#/admin/dashboard');
      } else {
        showToast(data.error || '接入失败，请确认您的登录凭证！', 'error');
      }
    } catch (err) {
      showToast('无法连接远程验证服务', 'error');
    }
  };

  // Universal Log-off
  const handleLogout = async () => {
    try {
      const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'streamer';
      const endpoint = isAdmin ? '/api/admin/logout' : '/api/auth/logout';
      const res = await fetch(endpoint, { method: 'POST' });
      
      if (res.ok) {
        showToast('已安全退出登录，账号会话已清除。', 'success');
        setCurrentUser(null);
        navigateTo('#/');
        loadMovies(); // reload catalog to hide stream items if loaded
      }
    } catch (err) {
      showToast('退出账号发生了某些技术故障。', 'error');
    }
  };

  // Movie Creation or Update
  const handleMovieSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movieForm.title || !movieForm.streamUrl) {
      showToast('电影名称与视频源 URL 为必填项！', 'error');
      return;
    }

    try {
      const isEditing = !!editingMovie;
      const url = isEditing ? `/api/admin/movies/${editingMovie.id}` : '/api/admin/movies';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(movieForm)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(isEditing ? '电影参数更新成功' : '电影发布已加入片库！', 'success');
        setMovieModalOpen(false);
        setEditingMovie(null);
        setMovieForm({ title: '', duration: '', genre: '', coverUrl: '', description: '', streamUrl: '' });
        refreshDashboardData();
        loadMovies();
      } else {
        showToast(data.error || '保存电影时失败，请重试', 'error');
      }
    } catch (err) {
      showToast('操作网络超时，请检查您的服务器连接。', 'error');
    }
  };

  // Open Edit Dialog modal
  const startEditMovie = (movie: Movie) => {
    setEditingMovie(movie);
    setMovieForm({
      title: movie.title,
      duration: movie.duration,
      genre: movie.genre,
      coverUrl: movie.coverUrl,
      description: movie.description,
      streamUrl: movie.streamUrl
    });
    setMovieModalOpen(true);
  };

  // Deletes movie object from index
  const deleteMovie = async (id: string, name: string) => {
    if (!confirm(`您确定要彻底删除电影《${name}》吗？删除操作无法撤销。`)) return;

    try {
      const res = await fetch(`/api/admin/movies/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('电影已成功移除', 'success');
        refreshDashboardData();
        loadMovies();
      } else {
        showToast(data.error || '电影删除失败', 'error');
      }
    } catch (err) {
      showToast('请求超时，请重试。', 'error');
    }
  };

  // Stream valid trigger checks
  const checkMovieStream = async (movieId: string, url: string) => {
    showToast('正在检测视频流中，由于建立远端连接请稍候 (最长5秒)...', 'success');
    try {
      const res = await fetch('/api/admin/check-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, movieId })
      });
      const data = await res.json();
      
      if (res.ok) {
        if (data.valid) {
          showToast(`检测通过！播放源可访问 [状态码:${data.statusCode} ${data.contentType}]`, 'success');
        } else {
          showToast(`检测失败：该视频流无法接入 [原因:${data.statusText}]`, 'error');
        }
        refreshDashboardData();
      } else {
        showToast(data.error || '检查流媒体线路出现某些异常。', 'error');
      }
    } catch (error) {
      showToast('发起流校验出错。', 'error');
    }
  };

  // Add Specator account
  const addViewerAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newViewerName || !newViewerPass) {
      showToast('请完整输入观众的用户名与口令参数！', 'error');
      return;
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newViewerName, password: newViewerPass })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(`观众账号【${newViewerName}】已由管理员手动发布开通。`, 'success');
        setNewViewerName('');
        setNewViewerPass('');
        refreshDashboardData();
      } else {
        showToast(data.error || '创建观众账号失败', 'error');
      }
    } catch (error) {
      showToast('开通失败：网络延迟严重。', 'error');
    }
  };

  // Remove spectator profile
  const deleteViewerAccount = async (username: string) => {
    if (!confirm(`确定要彻底注销观众账号【${username}】吗？删除后此普通观众将无法进入电影播放页。`)) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(`账号 ${username} 已经全线注销下架。`, 'success');
        refreshDashboardData();
      } else {
        showToast(data.error || '注销失败', 'error');
      }
    } catch (error) {
      showToast('网络堵塞，请重试。', 'error');
    }
  };

  // Add streamer profile
  const addStreamerAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStreamerName || !newStreamerPass) {
      showToast('请完整输入直播员的名字与接入密码！', 'error');
      return;
    }

    try {
      const res = await fetch('/api/admin/streamers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newStreamerName, password: newStreamerPass })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(`直播员【${newStreamerName}】建档成功，已被纳入后台团队。`, 'success');
        setNewStreamerName('');
        setNewStreamerPass('');
        refreshDashboardData();
      } else {
        showToast(data.error || '添加直播员档案失败', 'error');
      }
    } catch (error) {
      showToast('服务端通信遇到障碍。', 'error');
    }
  };

  // Remove streamer profile
  const deleteStreamerAccount = async (username: string) => {
    if (!confirm(`确定要注销并清空直播员工作账号【${username}】吗？下架后该直播员将无法再登录电影管理控制台。`)) return;

    try {
      const res = await fetch('/api/admin/streamers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(`直播员成员账号 ${username} 已自管理后台切断和删除。`, 'success');
        refreshDashboardData();
      } else {
        showToast(data.error || '注销直播员失败', 'error');
      }
    } catch (error) {
      showToast('发送注销申请发生网络故障。', 'error');
    }
  };

  // Movie genres catalog extract
  const genres = ['全部', ...Array.from(new Set(movies.map(m => m.genre || '未分类')))];

  // Filter movies
  const filteredMovies = movies.filter(movie => {
    const matchesSearch = movie.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          movie.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGenre = selectedGenre === '全部' || movie.genre === selectedGenre;
    return matchesSearch && matchesGenre;
  });

  return (
    <div id="xiaohe-application-root" className="min-h-screen bg-[#f5f5f5] font-sans text-neutral-900 flex flex-col">
      
      {/* Dynamic Floating Toast Feedback Panel */}
      {notification && (
        <div 
          id="global-toast-notification"
          className={`fixed top-20 right-6 z-50 p-4 rounded-xl shadow-2xl border flex items-center gap-3 max-w-md animate-bounce ${
            notification.type === 'success' 
              ? 'bg-white text-green-700 border-green-200' 
              : 'bg-white text-red-700 border-red-200'
          }`}
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* Main App Navigation Header */}
      <header id="app-nav-header" className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200 transition-all duration-300">
        <div className="max-w-[1800px] mx-auto px-8 sm:px-12 lg:px-16 h-16 flex items-center justify-between">
          
          {/* Brand Logo */}
          <div 
            id="brand-logo" 
            onClick={() => navigateTo('#/')} 
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            <span className="text-2xl font-black text-red-600 tracking-tighter">
              小何<span className="text-neutral-900">影视</span>
            </span>
          </div>

          {/* Center Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <button onClick={() => navigateTo('#/')} className={`text-lg font-semibold transition-colors ${currentRoute === 'home' ? 'text-red-600' : 'text-neutral-900 hover:text-red-600'}`}>首页</button>
            <button onClick={() => navigateTo('#/movies')} className={`text-lg font-medium transition-colors ${currentRoute === 'movies' ? 'text-red-600' : 'text-gray-500 hover:text-neutral-900'}`}>电影</button>
            <button onClick={() => navigateTo('#/tv')} className={`text-lg font-medium transition-colors ${currentRoute === 'tv' ? 'text-red-600' : 'text-gray-500 hover:text-neutral-900'}`}>剧集</button>
            <button onClick={() => navigateTo('#/anime')} className={`text-lg font-medium transition-colors ${currentRoute === 'anime' ? 'text-red-600' : 'text-gray-500 hover:text-neutral-900'}`}>动漫</button>
            <button onClick={() => navigateTo('#/variety')} className={`text-lg font-medium transition-colors ${currentRoute === 'variety' ? 'text-red-600' : 'text-gray-500 hover:text-neutral-900'}`}>综艺</button>
            <button onClick={() => navigateTo('#/live')} className={`text-lg font-medium transition-colors ${currentRoute === 'live' ? 'text-red-600' : 'text-gray-500 hover:text-neutral-900'}`}>电视直播</button>
          </nav>

          {/* Right Controls */}
          <nav className="flex items-center gap-3">
            {/* Search */}
            <button 
              onClick={() => setShowSearchModal(true)}
              className="p-2 text-gray-400 hover:text-neutral-900 transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
            
            {/* Theme Toggle */}
            <button
              onClick={() => {
                const newDark = !isDark;
                setIsDark(newDark);
                localStorage.setItem('theme', newDark ? 'dark' : 'light');
                if (newDark) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              }}
              className="p-2 text-gray-400 hover:text-neutral-900 transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            
            {authLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-red-500" />
            ) : currentUser ? (
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-md flex items-center justify-center font-bold text-xs text-white ${
                  currentUser.role === 'admin' ? 'bg-red-600' : 'bg-blue-600'
                }`}>
                  {currentUser.username.substring(0, 2).toUpperCase()}
                </div>
                {(currentUser.role === 'admin' || currentUser.role === 'streamer') && (
                  <button 
                    onClick={() => navigateTo('#/admin/dashboard')}
                    className="text-xs px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded transition-all"
                  >
                    管理
                  </button>
                )}
                <button onClick={handleLogout} className="p-1 text-gray-400 hover:text-neutral-900 transition-colors">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigateTo('#/login')}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded transition-all"
              >
                登录
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Main Core Body Views Router wrapper */}
      <main id="app-routes-container" className="flex-1 w-full bg-[#f5f5f5] pt-16">
        
        {/* ====================================
            VIEW: HOME (Modern Light Layout)
            ==================================== */}
        {currentRoute === 'home' && (
          <div id="route-home" className="animate-fade-in">

            {/* Hero Carousel - Auto-rotating Slideshow */}
            <HeroCarousel
              items={
                tmdbTrendingLoading
                  ? []
                  : tmdbTrending.slice(0, 8).map(item => ({
                      id: item.id,
                      title: item.title || item.name || '未知',
                      overview: item.overview || '暂无简介',
                      backdropPath: item.backdrop_path,
                      posterPath: item.poster_path,
                      voteAverage: item.vote_average,
                      releaseDate: item.release_date || item.first_air_date || '',
                      mediaType: item.media_type || '',
                    }))
              }
              onPlay={(item) => {
                const tmdbMatch = tmdbTrending.find(m => m.id === item.id);
                if (tmdbMatch) { navigateToDetail(tmdbMatch); }
              }}
              onDetail={(item) => {
                const tmdbMatch = tmdbTrending.find(m => m.id === item.id);
                if (tmdbMatch) { navigateToDetail(tmdbMatch); }
              }}
              loading={tmdbTrendingLoading}
            />

            {/* Main Content + Right Sidebar */}
            <div className="relative z-10 pb-16">
              <div className="flex gap-8 px-8 sm:px-12 lg:px-16">
                
                {/* Left Main Content */}
                <div className="flex-1 min-w-0 space-y-8 sm:space-y-12">

                  {/* 正在热映 */}
                  <MovieSection
                    title="正在热映"
                    icon={<Film className="w-5 h-5" />}
                    items={tmdbNowPlaying}
                    getImageUrl={getTmdbImageUrl}
                    onItemClick={(item) => { navigateToDetail(item); }}
                    loading={tmdbNowPlayingLoading}
                  />

                  {/* 热门电影 */}
                  <MovieSection
                    title="热门电影"
                    icon={<Flame className="w-5 h-5" />}
                    items={tmdbPopular}
                    getImageUrl={getTmdbImageUrl}
                    onItemClick={(item) => { navigateToDetail(item); }}
                    loading={tmdbPopularLoading}
                  />

                  {/* 华语电影 */}
                  <MovieSection
                    title="华语电影"
                    icon={<Globe className="w-5 h-5" />}
                    items={tmdbChineseMovies}
                    getImageUrl={getTmdbImageUrl}
                    onItemClick={(item) => { navigateToDetail(item); }}
                    loading={tmdbChineseMoviesLoading}
                  />

                  {/* 动作电影 */}
                  <MovieSection
                    title="动作电影"
                    icon={<Bomb className="w-5 h-5" />}
                    items={tmdbActionMovies}
                    getImageUrl={getTmdbImageUrl}
                    onItemClick={(item) => { navigateToDetail(item); }}
                    loading={tmdbActionMoviesLoading}
                  />

                  {/* 科幻电影 */}
                  <MovieSection
                    title="科幻电影"
                    icon={<Rocket className="w-5 h-5" />}
                    items={tmdbScifiMovies}
                    getImageUrl={getTmdbImageUrl}
                    onItemClick={(item) => { navigateToDetail(item); }}
                    loading={tmdbScifiMoviesLoading}
                  />

                  {/* 恐怖电影 */}
                  <MovieSection
                    title="恐怖电影"
                    icon={<Skull className="w-5 h-5" />}
                    items={tmdbHorrorMovies}
                    getImageUrl={getTmdbImageUrl}
                    onItemClick={(item) => { navigateToDetail(item); }}
                    loading={tmdbHorrorMoviesLoading}
                  />

                  {/* 热门剧集 */}
                  <MovieSection
                    title="热门剧集"
                    icon={<Tv className="w-5 h-5" />}
                    items={tmdbTvPopular}
                    getImageUrl={getTmdbImageUrl}
                    onItemClick={(item) => { navigateToDetail(item); }}
                    loading={tmdbTvPopularLoading}
                  />

                  {/* 国产动漫 */}
                  <MovieSection
                    title="国产动漫"
                    icon={<Zap className="w-5 h-5" />}
                    items={tmdbChineseAnime}
                    getImageUrl={getTmdbImageUrl}
                    onItemClick={(item) => { navigateToDetail(item); }}
                    loading={tmdbChineseAnimeLoading}
                  />

                  {/* 高分推荐 */}
                  <MovieSection
                    title="高分推荐"
                    icon={<Star className="w-5 h-5" />}
                    items={tmdbTvTopRated}
                    getImageUrl={getTmdbImageUrl}
                    onItemClick={(item) => { navigateToDetail(item); }}
                    loading={tmdbTvTopRatedLoading}
                  />

                  {/* TMDB Data Unavailable Notice */}
                  {!tmdbTrendingLoading && tmdbTrending.length === 0 && tmdbPopular.length === 0 && tmdbNowPlaying.length === 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
                      <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                      <h3 className="text-lg font-bold text-amber-800 mb-2">TMDB 数据暂未加载</h3>
                      <p className="text-sm text-amber-600">
                        TMDB 电影数据需要配置有效的 API Key。请在 Netlify 环境变量中设置 <code className="bg-amber-100 px-1.5 py-0.5 rounded text-amber-800 font-mono text-xs">TMDB_API_KEY</code>。
                      </p>
                      <p className="text-xs text-amber-500 mt-2">
                        免费申请地址：<a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" className="underline">themoviedb.org/settings/api</a>
                      </p>
                    </div>
                  )}

                </div>

                {/* Right Sidebar */}
                <aside className="hidden xl:block w-72 flex-shrink-0 space-y-6">
                  
                  {/* Most Watched */}
                  {tmdbPopular.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                      <h3 className="text-base font-bold text-neutral-900 mb-3 flex items-center gap-2">
                        <Flame className="w-4 h-4 text-red-500" /> 最多观看
                      </h3>
                      <div className="space-y-3">
                        {tmdbPopular.slice(0, 5).map((item, idx) => (
                          <div
                            key={item.id}
                            onClick={() => { navigateToDetail(item); }}
                            className="flex gap-3 cursor-pointer group"
                          >
                            <span className="text-lg font-black text-gray-300 w-6 text-center">{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-neutral-900 truncate group-hover:text-red-600 transition-colors">{item.title || item.name}</p>
                              <p className="text-xs text-gray-400">{(item.release_date || item.first_air_date || '').split('-')[0]}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recently Updated */}
                  {tmdbNowPlaying.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                      <h3 className="text-base font-bold text-neutral-900 mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-500" /> 最近更新
                      </h3>
                      <div className="space-y-3">
                        {tmdbNowPlaying.slice(0, 5).map((item, idx) => (
                          <div
                            key={item.id}
                            onClick={() => { navigateToDetail(item); }}
                            className="flex gap-3 cursor-pointer group"
                          >
                            <span className="text-lg font-black text-gray-300 w-6 text-center">{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-neutral-900 truncate group-hover:text-blue-600 transition-colors">{item.title || item.name}</p>
                              <p className="text-xs text-gray-400">{(item.release_date || item.first_air_date || '').split('-')[0]}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top Rated */}
                  {tmdbTvTopRated.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                      <h3 className="text-base font-bold text-neutral-900 mb-3 flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500" /> 高分排行
                      </h3>
                      <div className="space-y-3">
                        {tmdbTvTopRated.slice(0, 5).map((item, idx) => (
                          <div
                            key={item.id}
                            onClick={() => { navigateToDetail(item); }}
                            className="flex gap-3 cursor-pointer group"
                          >
                            <span className="text-lg font-black text-gray-300 w-6 text-center">{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-neutral-900 truncate group-hover:text-yellow-600 transition-colors">{item.title || item.name}</p>
                              <p className="text-xs text-gray-400">⭐ {item.vote_average?.toFixed(1)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 片库影片 sidebar */}
                  {movies.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                      <h3 className="text-base font-bold text-neutral-900 mb-3 flex items-center gap-2">
                        <Film className="w-4 h-4 text-green-500" /> 片库影片
                      </h3>
                      <div className="space-y-3">
                        {movies.slice(0, 5).map((item, idx) => (
                          <div
                            key={item.id}
                            onClick={() => navigateTo(`#/movie/${item.id}`)}
                            className="flex gap-3 cursor-pointer group"
                          >
                            <span className="text-lg font-black text-gray-300 w-6 text-center">{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-neutral-900 truncate group-hover:text-green-600 transition-colors">{item.title}</p>
                              <p className="text-xs text-gray-400">{item.genre}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </aside>

              </div>
            </div>
          </div>
        )}

        {/* ====================================
            VIEW: CATEGORY PAGES (电影 / 剧集 / 动漫 / 综艺)
            ==================================== */}
        {['movies', 'tv', 'anime', 'variety'].includes(currentRoute) && (
          <div id="route-category" className="animate-fade-in px-8 sm:px-12 lg:px-16 py-6 space-y-8">
            <div className="flex items-center gap-3">
              <button onClick={() => navigateTo('#/')} className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 font-bold cursor-pointer transition-colors">
                <ChevronLeft className="w-4 h-4" /> 返回主页
              </button>
              <span className="text-neutral-300">/</span>
              <h1 className="text-xl font-bold text-neutral-900">
                {currentRoute === 'movies' ? '电影' : currentRoute === 'tv' ? '剧集' : currentRoute === 'anime' ? '动漫' : '综艺'}
              </h1>
            </div>

            {/* Category sub-navigation */}
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { key: 'movies', label: '电影' },
                { key: 'tv', label: '剧集' },
                { key: 'anime', label: '动漫' },
                { key: 'variety', label: '综艺' },
              ].map(cat => (
                <button
                  key={cat.key}
                  onClick={() => navigateTo(`#/${cat.key}`)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                    currentRoute === cat.key
                      ? 'bg-red-600 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Movies Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {(currentRoute === 'movies'
                ? [...tmdbPopular, ...tmdbNowPlaying]
                : currentRoute === 'tv'
                ? [...tmdbTvPopular, ...tmdbTvTopRated]
                : currentRoute === 'anime'
                ? tmdbTrending.filter(m => m.media_type === 'tv' && (m.genre_ids || []).includes(16))
                : tmdbTrending.filter(m => m.media_type !== 'movie')
              )
                .filter((item, i, arr) => arr.findIndex(x => x.id === item.id) === i)
                .map((item) => (
                  <div
                    key={item.id}
                    onClick={() => { navigateToDetail(item); }}
                    className="group cursor-pointer"
                  >
                    <div className="relative aspect-[2/3] bg-gray-200 rounded-xl overflow-hidden shadow-md mb-2">
                      <img
                        src={getTmdbImageUrl(item.poster_path, 'w342')}
                        alt={item.title || item.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                        <Play className="w-10 h-10 text-white fill-white opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100" />
                      </div>
                      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-md">
                        {Math.round((item.vote_average || 0) * 10)}%
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-neutral-900 truncate group-hover:text-red-600 transition-colors">{item.title || item.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{(item.release_date || item.first_air_date || '').split('-')[0]}</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ====================================
            VIEW: TMDB DETAIL PAGE (Standalone Route)
            ==================================== */}
        {currentRoute === 'detail' && (
          <TMDBDetailRoute
            tmdbId={detailTmdbId}
            getImageUrl={getTmdbImageUrl}
            tmdbCache={tmdbCacheRef.current}
            onBack={() => { setDetailPageItem(null); navigateTo('#/'); }}
          />
        )}

        {/* ====================================
            VIEW: MOVIE DETAIL (Player Page)
            ==================================== */}
        {currentRoute === 'movie-detail' && (
          <div id="route-movie-detail" className="space-y-8 animate-fade-in text-left">
            
            {/* Back to Home Link bar */}
            <button
              id="back-home-button"
              onClick={() => navigateTo('#/')}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 font-bold cursor-pointer py-1 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> 返回主页
            </button>

            {selectedMovie ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Area: Display Player container OR login prompts block */}
                <div className="lg:col-span-2 space-y-6">
                  {selectedMovie.loggedIn && selectedMovie.streamUrl ? (
                    <div className="bg-slate-900/50 p-4 sm:p-6 rounded-2xl border border-slate-800 shadow-2xl space-y-4">
                      
                      <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                          <h2 className="font-bold text-lg text-white">电影在线播放器</h2>
                        </div>
                        <div className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded font-mono font-bold tracking-widest uppercase border border-blue-500/20">
                          VIP STREAM BUFFERING
                        </div>
                      </div>

                      {/* Video player canvas mounting */}
                      <VideoPlayer src={selectedMovie.streamUrl} title={selectedMovie.title} />

                      {/* Video tips row */}
                      <div className="flex items-start gap-2 bg-blue-600/5 p-3.5 rounded-2xl border border-blue-500/15 text-xs text-blue-400">
                        <Sliders className="w-4 h-4 flex-shrink-0 text-blue-500" />
                        <div className="space-y-0.5 leading-relaxed">
                          <p className="font-bold text-slate-205">画幅拉伸调节指南</p>
                          <p className="text-slate-400">
                            通过播放器右下角的“画幅比例”控件，可以针对不同的电影比例进行实时画幅重塑切换，有效拉伸或收缩视频高度。点击可直接激活全屏沉浸播放。
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Forbidden player blocked view */
                    <div id="player-forbidden-mask" className="relative p-8 py-20 rounded-2xl border border-neutral-205 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-center shadow-xl flex flex-col items-center justify-center gap-5 overflow-hidden">
                      {/* Artistic blurred background cover to create movie shape feeling */}
                      <div 
                        className="absolute inset-0 opacity-5 blur-xl select-none pointer-events-none transform scale-110"
                        style={{ backgroundImage: `url(${selectedMovie.coverUrl})`, backgroundPosition: 'center', backgroundSize: 'cover' }}
                      />
                      
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shadow-lg transform -rotate-6">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                          <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
                        </svg>
                      </div>

                      <div className="space-y-2 max-w-sm relative z-10">
                        <h3 className="text-xl font-bold text-neutral-900 dark:text-white">您目前处于未登录状态</h3>
                        <p className="text-sm text-neutral-500 leading-relaxed">
                          为了维护本站独家极速线路的私密性，电影播放器仅对已登录观众开放。请点击下方按钮登录您的专属账号。
                        </p>
                      </div>

                      <button
                        id="forbidden-redirect-btn"
                        onClick={() => navigateTo('#/login')}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-500/20 flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <LogIn className="w-4 h-4" /> 登录后立即观看
                      </button>

                      <div className="text-[11px] text-neutral-400 mt-2 max-w-sm leading-relaxed">
                        普通观众账号不由用户自行注册开通。如果您尚未拥有密码，请向超级管理员索要分发的特许账号！
                      </div>
                    </div>
                  )}

                  {/* Comment Scratchpad (No actual backend schema requested, implemented beautifully locally for completeness and feeling of rich app) */}
                  <div className="bg-white dark:bg-neutral-900 border border-neutral-200/40 dark:border-neutral-800/80 p-6 rounded-2xl space-y-4">
                    <h3 className="font-bold text-base dark:text-white">本片影片概述</h3>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed font-sans">
                      {selectedMovie.description}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800 pt-4">
                      <span className="text-[11px] bg-neutral-100 dark:bg-neutral-800 text-neutral-500 px-3 py-1.5 rounded-lg font-medium">
                        类型标签：{selectedMovie.genre}
                      </span>
                      <span className="text-[11px] bg-neutral-100 dark:bg-neutral-800 text-neutral-500 px-3 py-1.5 rounded-lg font-medium">
                        影片时长：{selectedMovie.duration}
                      </span>
                      <span className="text-[11px] bg-neutral-100 dark:bg-neutral-800 text-neutral-500 px-3 py-1.5 rounded-lg font-medium">
                        收录时间：{new Date(selectedMovie.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Area: Movie Poster Card details */}
                <div className="space-y-6">
                  <div className="bg-white dark:bg-neutral-900 border border-neutral-200/40 dark:border-neutral-800/80 p-5 rounded-2xl space-y-4">
                    <div className="relative aspect-[16/11] overflow-hidden rounded-xl bg-neutral-100">
                      <img
                        src={selectedMovie.coverUrl}
                        alt={selectedMovie.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div>
                      <h1 className="font-black text-xl text-neutral-900 dark:text-white tracking-tight">{selectedMovie.title}</h1>
                      <div className="flex gap-2.5 items-center mt-2.5">
                        <span className="text-xs bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded font-semibold whitespace-nowrap">
                          {selectedMovie.genre}
                        </span>
                        <span className="text-xs text-neutral-400 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" /> {selectedMovie.duration}
                        </span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-neutral-100 dark:border-neutral-850 space-y-3 text-xs leading-relaxed">
                      <div className="flex justify-between items-center text-neutral-500">
                        <span>首播年份：</span>
                        <span className="font-semibold text-neutral-850 dark:text-white">2026年首映</span>
                      </div>
                      <div className="flex justify-between items-center text-neutral-500">
                        <span>数字原画：</span>
                        <span className="font-semibold text-neutral-850 dark:text-white">4K UHD超高清</span>
                      </div>
                      <div className="flex justify-between items-center text-neutral-500">
                        <span>音軌源：</span>
                        <span className="font-semibold text-neutral-850 dark:text-white">多声道 HLS / AAC</span>
                      </div>
                      <div className="flex justify-between items-center text-neutral-500">
                        <span>状态安全：</span>
                        <span className="font-semibold text-emerald-500">网络防泄防盗链</span>
                      </div>
                    </div>
                  </div>

                  {/* Fast recommendations panel */}
                  <div className="bg-white dark:bg-neutral-900 border border-neutral-200/40 dark:border-neutral-800/80 p-5 rounded-2xl space-y-3.5">
                    <h3 className="font-bold text-sm tracking-tight dark:text-white">影迷正在热播影片</h3>
                    <div className="space-y-3">
                      {movies.filter(m => m.id !== activeMovieId).slice(0, 3).map(m => (
                        <div 
                          key={m.id}
                          onClick={() => navigateTo(`#/movie/${m.id}`)}
                          className="flex items-center gap-3 cursor-pointer group hover:bg-neutral-50 dark:hover:bg-neutral-950 p-1.5 rounded-xl transition-all"
                        >
                          <img
                            src={m.coverUrl}
                            alt={m.title}
                            className="w-16 h-10 object-cover rounded-lg"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-semibold text-neutral-950 dark:text-white group-hover:text-blue-500 truncate">{m.title}</h4>
                            <p className="text-[10px] text-neutral-400 mt-0.5 truncate">{m.genre} / {m.duration}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="text-center py-20 flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="text-sm text-neutral-400">正在调取影片元数据终端，请稍等...</span>
              </div>
            )}
          </div>
        )}

        {/* ====================================
            VIEW: SPECTATOR AUTHENTICATION LOGIN
            ==================================== */}
        {currentRoute === 'viewer-login' && (
          <div id="route-viewer-login" className="max-w-md mx-auto py-12 animate-fade-in text-left">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-205 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
              
              {/* Login type tabs */}
              <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1">
                <button
                  onClick={() => setLoginMode('viewer')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                    loginMode === 'viewer'
                      ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400'
                  }`}
                >
                  普通观众登录
                </button>
                <button
                  onClick={() => setLoginMode('admin')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                    loginMode === 'admin'
                      ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400'
                  }`}
                >
                  管理员/直播员登录
                </button>
              </div>

              {loginMode === 'viewer' ? (
                <>
                  <div className="text-center space-y-1.5">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-2">
                      <User className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-black dark:text-white tracking-tight">普通观众登录</h2>
                    <p className="text-xs text-neutral-500">接入小河私密多比例极速放映终端</p>
                  </div>

                  <div className="bg-blue-500/5 p-4 rounded-2xl border border-blue-500/15 leading-relaxed text-xs text-blue-800 dark:text-blue-300">
                    <p className="font-bold flex items-center gap-1.5 mb-1 text-blue-600 dark:text-blue-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                      特许授权账号分发通告
                    </p>
                    <p className="text-neutral-500 dark:text-neutral-400">
                      普通观众账号<strong>不由观众自行注册</strong>。为了保证站点在海外节点服务器的缓冲带宽顺畅，目前新账号只能由<strong>超级管理员</strong>在管理后台手动创建分发。请向您的客服或推荐人索要特许账户（用户名+密码）直接登录！
                    </p>
                  </div>

                  <form id="viewer-login-form" onSubmit={handleViewerLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <label htmlFor="viewer-user" className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">特许用户名 / 手机号</label>
                      <input
                        id="viewer-user"
                        name="username"
                        type="text"
                        required
                        placeholder="输入分配的用户名..."
                        className="w-full px-4 py-2.5 bg-neutral-100 dark:bg-neutral-950 text-sm border-0 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-neutral-900 dark:text-white font-semibold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="viewer-pass" className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 font-sans">登录密码</label>
                      <input
                        id="viewer-pass"
                        name="password"
                        type="password"
                        required
                        placeholder="请输入安全开通密码..."
                        className="w-full px-4 py-2.5 bg-neutral-100 dark:bg-neutral-950 text-sm border-0 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-neutral-900 dark:text-white font-sans"
                      />
                    </div>

                    <button
                      id="viewer-login-submit"
                      type="submit"
                      className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 font-bold text-white text-sm rounded-xl cursor-pointer transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-1.5"
                    >
                      确认进入点播系统
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <div className="text-center space-y-1.5">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 mb-2">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    </div>
                    <h2 className="text-2xl font-black dark:text-white tracking-tight">管理员/直播员登录</h2>
                    <p className="text-xs text-neutral-500">进入后台影视内容与用户管理系统</p>
                  </div>

                  <div className="bg-red-500/5 p-4 rounded-2xl border border-red-500/15 leading-relaxed text-xs text-red-800 dark:text-red-300">
                    <p className="font-bold flex items-center gap-1.5 mb-1 text-red-600 dark:text-red-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                      后台管理权限验证
                    </p>
                    <p className="text-neutral-500 dark:text-neutral-400">
                      此区域仅限<strong>管理员</strong>或<strong>受权直播员</strong>登录。管理员拥有全部权限（管理影片、创建用户、管理直播员），直播员仅可管理影片内容。
                    </p>
                  </div>

                  <form id="admin-login-form" onSubmit={handleAdminLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <label htmlFor="admin-user" className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">管理员账户 / 直播员工号</label>
                      <input
                        id="admin-user"
                        name="username"
                        type="text"
                        required
                        placeholder="输入管理员或直播员用户名..."
                        className="w-full px-4 py-2.5 bg-neutral-100 dark:bg-neutral-950 text-sm border-0 focus:ring-2 focus:ring-red-500/20 rounded-xl text-neutral-900 dark:text-white font-semibold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="admin-pass" className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 font-sans">后台验证密码</label>
                      <input
                        id="admin-pass"
                        name="password"
                        type="password"
                        required
                        placeholder="输入后台安全密码..."
                        className="w-full px-4 py-2.5 bg-neutral-100 dark:bg-neutral-950 text-sm border-0 focus:ring-2 focus:ring-red-500/20 rounded-xl text-neutral-900 dark:text-white font-sans"
                      />
                    </div>

                    <button
                      id="admin-login-submit"
                      type="submit"
                      className="w-full py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 font-bold text-white text-sm rounded-xl cursor-pointer transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-1.5"
                    >
                      进入后台管理控制台
                    </button>
                  </form>
                </>
              )}

              <div className="text-center pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <button 
                  onClick={() => navigateTo('#/')}
                  className="text-xs font-semibold text-neutral-400 hover:text-blue-500"
                >
                  取消，返回大厅浏览
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ====================================
            VIEW: LIVE TV
            ==================================== */}
        {currentRoute === 'live' && (
          <div id="route-live" className="space-y-6 animate-fade-in text-left">
            <button
              onClick={() => navigateTo('#/')}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 font-bold cursor-pointer py-1 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> 返回主页
            </button>

            <div className="space-y-4">
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">电视直播</h1>
              
              {liveSources.length === 0 ? (
                <div className="bg-neutral-50 dark:bg-neutral-900 rounded-2xl p-8 text-center border border-neutral-200 dark:border-neutral-800">
                  <p className="text-neutral-400">暂无电视直播源，请先在后台管理添加直播源</p>
                  <button
                    onClick={() => navigateTo('#/admin/dashboard')}
                    className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl"
                  >
                    前往后台管理
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {liveSources.map(source => (
                    <div key={source.id} className="bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-950">
                        <h2 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            source.type === 'm3u' 
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                              : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                          }`}>
                            {source.type.toUpperCase()}
                          </span>
                          {source.name}
                          {source.group && <span className="text-xs text-neutral-400">({source.group})</span>}
                        </h2>
                      </div>
                      
                      <div className="p-4">
                        {source.channels && source.channels.length > 0 ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                            {source.channels.map((channel, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  setSelectedLiveChannel(channel);
                                  setTvboxPlayUrl(channel.url);
                                  setTvboxPlayName(channel.name);
                                }}
                                className={`p-3 rounded-xl text-xs font-semibold text-center transition-all cursor-pointer ${
                                  selectedLiveChannel?.url === channel.url
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-750'
                                }`}
                              >
                                {channel.name}
                                {channel.group && (
                                  <div className="text-[10px] opacity-70 mt-0.5">{channel.group}</div>
                                )}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-neutral-400 text-sm">
                            暂无频道数据，请点击解析加载频道
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live TV Player */}
            {tvboxPlayUrl && (
              <div className="bg-slate-900/50 p-4 sm:p-6 rounded-2xl border border-slate-800 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <h2 className="font-bold text-lg text-white">{tvboxPlayName || '正在播放'}</h2>
                  </div>
                  <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded font-mono font-bold tracking-widest uppercase border border-green-500/20">
                    LIVE TV
                  </span>
                </div>
                <div className="aspect-video">
                  <VideoPlayer src={tvboxPlayUrl} title={tvboxPlayName || '电视直播'} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ====================================
            VIEW: TVBOX PLAY
            ==================================== */}
        {currentRoute === 'tvbox-play' && tvboxPlayingDetail && (
          <div id="route-tvbox-play" className="space-y-6 animate-fade-in text-left">
            <button
              onClick={() => navigateTo('#/')}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 font-bold cursor-pointer py-1 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> 返回主页
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                {(() => {
                  const playUrls = tvboxPlayingDetail.vod_play_url?.split('#').filter(Boolean) || [];
                  return tvboxPlayUrl ? (
                    <div className="bg-slate-900/50 p-4 sm:p-6 rounded-2xl border border-slate-800 shadow-2xl space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                          <h2 className="font-bold text-lg text-white">{tvboxPlayingDetail.vod_name}</h2>
                          {tvboxPlayName && <span className="text-sm text-blue-400">{tvboxPlayName}</span>}
                        </div>
                        <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded font-mono font-bold tracking-widest uppercase border border-purple-500/20">
                          TVBOX SOURCE
                        </span>
                      </div>
                      <div className="aspect-video">
                        <VideoPlayer src={tvboxPlayUrl} title={`${tvboxPlayingDetail.vod_name} - ${tvboxPlayName}`} />
                      </div>
                      {playUrls.length > 1 && (
                        <div className="space-y-2">
                          <h3 className="text-sm font-bold text-white">选集 ({playUrls.length})</h3>
                          <div className="flex flex-wrap gap-2">
                            {playUrls.map((ep, idx) => {
                              const parts = ep.split('$');
                              const epName = parts[0] || `第${idx + 1}集`;
                              const epUrl = parts[1] || ep;
                              const isActive = tvboxPlayName === epName || (!tvboxPlayName && idx === 0);
                              return (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    setTvboxPlayUrl(epUrl);
                                    setTvboxPlayName(epName);
                                  }}
                                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer ${
                                    isActive
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white'
                                  }`}
                                >
                                  {epName}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-8 rounded-2xl text-center">
                      <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
                      <h3 className="font-bold text-lg dark:text-white">无法获取播放地址</h3>
                      <p className="text-sm text-neutral-500 mt-2">该影片暂无可用的播放源</p>
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-4">
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
                  <img
                    src={tvboxPlayingDetail.vod_pic}
                    alt={tvboxPlayingDetail.vod_name}
                    className="w-full aspect-[2/3] object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 space-y-3">
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{tvboxPlayingDetail.vod_name}</h2>
                  {tvboxPlayingDetail.type_name && (
                    <span className="inline-block bg-blue-600/10 text-blue-600 dark:text-blue-400 text-xs font-bold px-2.5 py-1 rounded-lg">
                      {tvboxPlayingDetail.type_name}
                    </span>
                  )}
                  {tvboxPlayingDetail.vod_remarks && (
                    <p className="text-sm text-neutral-500">{tvboxPlayingDetail.vod_remarks}</p>
                  )}
                  {tvboxPlayingDetail.vod_year && (
                    <p className="text-sm text-neutral-500">年份：{tvboxPlayingDetail.vod_year}</p>
                  )}
                  {tvboxPlayingDetail.vod_area && (
                    <p className="text-sm text-neutral-500">地区：{tvboxPlayingDetail.vod_area}</p>
                  )}
                  {tvboxPlayingDetail.vod_director && (
                    <p className="text-sm text-neutral-500">导演：{tvboxPlayingDetail.vod_director}</p>
                  )}
                  {tvboxPlayingDetail.vod_actor && (
                    <p className="text-sm text-neutral-500">演员：{tvboxPlayingDetail.vod_actor}</p>
                  )}
                  {tvboxPlayingDetail.vod_content && (
                    <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                      <p className="text-sm text-neutral-600 dark:text-slate-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: tvboxPlayingDetail.vod_content }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================
            VIEW: BACKEND WORKER LOGIN
            ==================================== */}
        {currentRoute === 'admin-login' && (
          <div id="route-admin-login" className="max-w-md mx-auto py-12 animate-fade-in text-left">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-205 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
              
              <div className="text-center space-y-1.5">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 mb-2">
                  <Laptop className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-black dark:text-white tracking-tight">后台发布端验证</h2>
                <p className="text-xs text-neutral-500">超级管理员与直播编辑成员登录入口</p>
              </div>

              <form id="admin-login-form" onSubmit={handleAdminLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="admin-user" className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">后台管理账号</label>
                  <input
                    id="admin-user"
                    name="username"
                    type="text"
                    required
                    placeholder="例如: admin / streamer_x"
                    className="w-full px-4 py-2.5 bg-neutral-100 dark:bg-neutral-950 text-sm border-0 focus:ring-2 focus:ring-blue-550/20 rounded-xl text-neutral-900 dark:text-white font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="admin-pass" className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 font-sans">校验口令</label>
                  <input
                    id="admin-pass"
                    name="password"
                    type="password"
                    required
                    placeholder="输入该账号密码..."
                    className="w-full px-4 py-2.5 bg-neutral-100 dark:bg-neutral-950 text-sm border-0 focus:ring-2 focus:ring-blue-550/20 rounded-xl text-neutral-900 dark:text-white font-sans"
                  />
                </div>

                <button
                  id="admin-login-submit"
                  type="submit"
                  className="w-full py-3 bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white font-bold text-sm rounded-xl cursor-pointer transition-all hover:opacity-90 flex items-center justify-center gap-1.5"
                >
                  安全校验并进入后台
                </button>
              </form>

              <div className="text-center pt-2">
                <button 
                  onClick={() => navigateTo('#/')}
                  className="text-xs font-semibold text-neutral-400 hover:text-blue-500"
                >
                  取消，返回主放映厅
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ==========================================================
            VIEW: BACKEND CONTROL ROOM (Dashboard Admin / Streamer)
            ========================================================== */}
        {currentRoute === 'admin-dashboard' && (
          <div id="route-admin-dashboard" className="space-y-8 animate-fade-in text-left">
            
            {/* Guardian redirection wrapper */}
            {(!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'streamer')) ? (
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 p-8 rounded-2xl text-center max-w-md mx-auto space-y-4 shadow-lg pr-4">
                <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
                <h3 className="font-bold text-lg dark:text-white">系统鉴权拦截</h3>
                <p className="text-sm text-neutral-500">
                  当前路由属于限制特许后台管理面板。您的会话不存在或是非管理团队成员。
                </p>
                <button 
                  onClick={() => navigateTo('#/admin/login')}
                  className="px-5 py-2.5 bg-neutral-950 dark:bg-white dark:text-neutral-950 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  往安全验证页
                </button>
              </div>
            ) : (
              /* Active Dashboard body */
              <div className="space-y-6">
                
                {/* Dashboard top hero block */}
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200/40 dark:border-neutral-800/80 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                  <div className="space-y-1">
                    <h2 className="text-xl sm:text-2xl font-black dark:text-white tracking-tight flex items-center gap-2">
                      <span>工作后台控制中心</span>
                      <span className="text-xs px-2.5 py-0.5 bg-blue-500/10 text-blue-500 rounded-full font-sans uppercase font-bold tracking-widest hidden sm:inline-block">
                        {currentUser.role === 'admin' ? 'SuperAdmin Terminal' : 'Streamer Panel'}
                      </span>
                    </h2>
                    <p className="text-xs text-neutral-400 leading-none">
                      工作身份：<strong>{currentUser.username}</strong> ({currentUser.role === 'admin' ? '超级管理员' : '直播员'}) · 极速电影、观众和团队发布
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      id="dash-refresh-btn"
                      onClick={refreshDashboardData}
                      className="px-3.5 py-2 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-150 dark:hover:bg-neutral-800 border-0 rounded-xl text-xs sm:text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                      title="重载当前Tab表格数据"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${dashLoading ? 'animate-spin' : ''}`} /> 同步刷新
                    </button>
                    
                    {/* Add movie popup button (Admin / Streamer can do this) */}
                    {dashActiveTab === 'movies' && (
                      <button
                        id="add-movie-btn"
                        onClick={() => {
                          setEditingMovie(null);
                          setMovieForm({ title: '', duration: '', genre: '', coverUrl: '', description: '', streamUrl: '' });
                          setMovieModalOpen(true);
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow shadow-blue-500/10 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> 新增电影
                      </button>
                    )}
                  </div>
                </div>

                {/* Left Side menu tabs Selection */}
                <div className="flex items-center gap-1 border-b border-neutral-250 dark:border-neutral-800/80 pb-px">
                  <button
                    id="tab-video-sources-control"
                    onClick={() => setDashActiveTab('video-sources')}
                    className={`px-5 py-3 text-xs sm:text-sm font-semibold border-b-2 cursor-pointer transition-colors ${
                      dashActiveTab === 'video-sources'
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                        : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400'
                    }`}
                  >
                    📡 个人视频源 ({videoSources.length})
                  </button>

                  {/* Super admin tabs */}
                  {currentUser.role === 'admin' && (
                    <>
                      <button
                        id="tab-live-sources-control"
                        onClick={() => setDashActiveTab('live-sources')}
                        className={`px-5 py-3 text-xs sm:text-sm font-semibold border-b-2 cursor-pointer transition-colors ${
                          dashActiveTab === 'live-sources'
                            ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                            : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400'
                        }`}
                      >
                         电视直播源管理
                      </button>

                      <button
                        id="tab-tvbox-control"
                        onClick={() => setDashActiveTab('tvbox')}
                        className={`px-5 py-3 text-xs sm:text-sm font-semibold border-b-2 cursor-pointer transition-colors ${
                          dashActiveTab === 'tvbox'
                            ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                            : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400'
                        }`}
                      >
                         TVBox接口管理
                      </button>

                      <button
                        id="tab-users-control"
                        onClick={() => setDashActiveTab('users')}
                        className={`px-5 py-3 text-xs sm:text-sm font-semibold border-b-2 cursor-pointer transition-colors ${
                          dashActiveTab === 'users'
                            ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                            : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400'
                        }`}
                      >
                        👥 一般观众账号管理
                      </button>
                    </>
                  )}
                </div>

                {/* Render corresponding tables */}
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200/40 dark:border-neutral-800/80 rounded-2xl p-4 sm:p-6 shadow-sm overflow-hidden min-h-[300px] flex flex-col justify-between">
                  
                  {dashLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                      <span className="text-xs text-neutral-400">正在与后台同步数据库读写流中...</span>
                    </div>
                  ) : (
                    <>
                      {/* Sub-tab 0: Personal Video Sources */}
                      {dashActiveTab === 'video-sources' && (
                        <div id="dash-video-sources-tab-content" className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-sm dark:text-white">个人视频源列表</h3>
                            <button
                              onClick={() => {
                                setEditingVideoSource(null);
                                setVideoSourceForm({ name: '', key: '', api: '', detail: '' });
                                setVideoSourceModalOpen(true);
                              }}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow shadow-blue-500/10 cursor-pointer"
                            >
                              <Plus className="w-4 h-4" /> 添加视频源
                            </button>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs sm:text-xs">
                              <thead>
                                <tr className="border-b border-neutral-100 dark:border-neutral-800 text-neutral-400 font-bold tracking-wide">
                                  <th className="py-3 px-2">名称</th>
                                  <th className="py-3 px-2">Key</th>
                                  <th className="py-3 px-2 hidden md:table-cell font-mono">API地址</th>
                                  <th className="py-3 px-2 hidden sm:table-cell">Detail地址</th>
                                  <th className="py-3 px-2 text-right">管理操作</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-850">
                                {videoSources.map(source => (
                                  <tr key={source.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-950/40 transition-colors">
                                    <td className="py-3 px-2">
                                      <div className="font-bold text-neutral-950 dark:text-white truncate max-w-[120px] sm:max-w-xs">{source.name}</div>
                                      <div className="text-[10px] text-neutral-400 mt-0.5">{new Date(source.createdAt).toLocaleDateString()}</div>
                                    </td>
                                    <td className="py-3 px-2">
                                      <span className="inline-block bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 px-2 py-0.5 rounded font-mono text-[10px]">
                                        {source.key}
                                      </span>
                                    </td>
                                    <td className="py-3 px-2 hidden md:table-cell font-mono text-neutral-400 max-w-[200px] truncate">
                                      {source.api}
                                    </td>
                                    <td className="py-3 px-2 hidden sm:table-cell text-neutral-400 max-w-[150px] truncate">
                                      {source.detail || '-'}
                                    </td>
                                    <td className="py-3 px-2 text-right">
                                      <div className="inline-flex items-center gap-1">
                                        <button
                                          onClick={() => startEditVideoSource(source)}
                                          className="p-1 text-blue-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded cursor-pointer"
                                          title="编辑视频源"
                                        >
                                          <Edit className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteVideoSource(source.id, source.name)}
                                          className="p-1 text-rose-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded cursor-pointer"
                                          title="删除视频源"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                                {videoSources.length === 0 && (
                                  <tr>
                                    <td colSpan={5} className="py-8 text-center text-neutral-400 italic">
                                      暂无个人视频源，请点击右上角添加。支持MoonTV格式，填写名称、Key、API地址即可。
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Sub-tab 1: Live Stream Sources Management */}
                      {dashActiveTab === 'live-sources' && currentUser.role === 'admin' && (
                        <div id="dash-live-sources-tab-content" className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-sm dark:text-white">电视直播源列表</h3>
                            <button
                              onClick={() => {
                                setEditingLiveSource(null);
                                setLiveSourceForm({ name: '', type: 'm3u', url: '', group: '' });
                                setLiveSourceModalOpen(true);
                              }}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow shadow-blue-500/10 cursor-pointer"
                            >
                              <Plus className="w-4 h-4" /> 添加直播源
                            </button>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs sm:text-xs">
                              <thead>
                                <tr className="border-b border-neutral-100 dark:border-neutral-800 text-neutral-400 font-bold tracking-wide">
                                  <th className="py-3 px-2">名称</th>
                                  <th className="py-3 px-2">类型</th>
                                  <th className="py-3 px-2 hidden md:table-cell font-mono">URL地址</th>
                                  <th className="py-3 px-2 hidden sm:table-cell">分组</th>
                                  <th className="py-3 px-2 text-right">管理操作</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-850">
                                {liveSources.map(source => (
                                  <tr key={source.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-950/40 transition-colors">
                                    <td className="py-3 px-2 font-semibold text-neutral-900 dark:text-white">{source.name}</td>
                                    <td className="py-3 px-2">
                                      <span className={`inline-block px-2 py-0.5 rounded font-medium text-xs ${
                                        source.type === 'm3u' 
                                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                                          : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                      }`}>
                                        {source.type.toUpperCase()}
                                      </span>
                                    </td>
                                    <td className="py-3 px-2 hidden md:table-cell font-mono text-neutral-400 max-w-[200px] truncate">{source.url}</td>
                                    <td className="py-3 px-2 hidden sm:table-cell text-neutral-500">{source.group || '-'}</td>
                                    <td className="py-3 px-2 text-right">
                                      <div className="inline-flex items-center gap-1">
                                        <button
                                          onClick={() => startEditLiveSource(source)}
                                          className="p-1 text-blue-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded cursor-pointer"
                                          title="编辑直播源"
                                        >
                                          <Edit className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteLiveSource(source.id, source.name)}
                                          className="p-1 text-rose-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded cursor-pointer"
                                          title="删除直播源"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                                {liveSources.length === 0 && (
                                  <tr>
                                    <td colSpan={5} className="py-8 text-center text-neutral-400 italic">
                                      暂无电视直播源，请点击右上角添加。支持M3U和TXT格式，支持IPV4和IPV6。
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Sub-tab 2: Users spectators Management */}
                      {dashActiveTab === 'users' && currentUser.role === 'admin' && (
                        <div id="dash-users-tab-content" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                          {/* Left user creator form */}
                          <div className="bg-neutral-50 dark:bg-neutral-950 p-5 rounded-2xl border border-neutral-200/50 dark:border-neutral-850 text-left space-y-4 h-fit">
                            <h3 className="font-bold text-sm tracking-tight flex items-center gap-1 dark:text-white">
                              <Plus className="w-4 h-4 text-blue-500" /> 手动注册普通观众账号
                            </h3>
                            <p className="text-[11px] text-neutral-400">
                              由于本放映站点处于私密限制运行环境，观众均需要通过您的客服或管理员团队在此手动核批后分发账号密码进行登录观影操作。
                            </p>
                            
                            <form onSubmit={addViewerAccount} className="space-y-3">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase">观众用户名/手机号</label>
                                <input
                                  type="text"
                                  placeholder="输入分配的唯一观众用户名..."
                                  value={newViewerName}
                                  onChange={e => setNewViewerName(e.target.value)}
                                  className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase">设置登录密码</label>
                                <input
                                  type="password"
                                  placeholder="输入初始密码口令..."
                                  value={newViewerPass}
                                  onChange={e => setNewViewerPass(e.target.value)}
                                  className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs"
                                />
                              </div>

                              <button
                                type="submit"
                                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1"
                              >
                                <UserCheck className="w-3.5 h-3.5" /> 确认开通普通观众
                              </button>
                            </form>
                          </div>

                          {/* Right user viewers table */}
                          <div className="lg:col-span-2 space-y-4">
                            <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-bold mb-1">
                              <span>已开通普通观众列表 ({adminUsers.length})</span>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="border-b border-neutral-100 dark:border-neutral-800 text-neutral-400 font-bold">
                                    <th className="py-2.5 px-2">观众手机/用户名</th>
                                    <th className="py-2.5 px-2">会话类型角色</th>
                                    <th className="py-2.5 px-2">注册签发时间</th>
                                    <th className="py-2.5 px-2 text-right">后台操作</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-850">
                                  {adminUsers.map(u => (
                                    <tr key={u.username} className="hover:bg-neutral-50 dark:hover:bg-neutral-950/20">
                                      <td className="py-2.5 px-2 font-semibold text-neutral-900 dark:text-white">
                                        {u.username}
                                      </td>
                                      <td className="py-2.5 px-2">
                                        <span className="bg-blue-500/10 text-blue-500 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                          viewer 观众
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-2 text-neutral-400">
                                        {new Date(u.createdAt).toLocaleString()}
                                      </td>
                                      <td className="py-2.5 px-2 text-right">
                                        <button
                                          onClick={() => deleteViewerAccount(u.username)}
                                          className="p-1 text-rose-500 hover:bg-rose-500/10 rounded cursor-pointer"
                                          title="彻底注销此账号"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                  {adminUsers.length === 0 && (
                                    <tr>
                                      <td colSpan={4} className="py-8 text-center text-neutral-400 italic">
                                        当前暂无普通观众注册。
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>

                        </div>
                      )}

                      {/* Sub-tab 3: TVBox Interface Management */}
                      {dashActiveTab === 'tvbox' && currentUser.role === 'admin' && (
                        <div id="dash-tvbox-tab-content" className="space-y-6">
                          <TVBoxPanel
                            sites={tvboxSites}
                            cmsSites={tvboxCmsSites}
                            spiderSites={tvboxSpiderSites}
                            cmsCount={tvboxCmsCount}
                            spiderCount={tvboxSpiderCount}
                            onParseUrl={handleTvboxParse}
                            onSearch={handleTvboxSearch}
                            onGetDetail={handleTvboxGetDetail}
                            onPlayVideo={handleTvboxPlay}
                            loading={tvboxLoading}
                            parseError={tvboxParseError}
                            searchResults={tvboxSearchResults}
                            searchLoading={tvboxSearchLoading}
                          />
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* Dashboard Footer description help panel */}
                  <div className="text-[10px] text-neutral-400 border-t border-neutral-100 dark:border-neutral-800/60 pt-4 mt-6 text-left flex flex-col sm:flex-row justify-between gap-2">
                    <span>系统状态: 数据库连接加密正常 · Netlify Blobs 全线待命安全挂载</span>
                    <span>超级管理员口令或账户变更支持通过环境变量 ADMIN_USERNAME 和 ADMIN_PASSWORD_HASH 热部署</span>
                  </div>

                </div>

              </div>
            )}
          </div>
        )}

      </main>

      {/* ==========================================================
          SEARCH MODAL: TMDB Movie Search
          ========================================================== */}
      {showSearchModal && (
        <div className="fixed inset-0 z-55 flex items-start justify-center bg-black/65 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl w-full max-w-2xl p-6 space-y-5 text-left shadow-2xl animate-zoom-in my-8 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-neutral-150 dark:border-neutral-800 pb-3">
              <h3 className="text-lg font-black dark:text-white tracking-tight">搜索影片</h3>
              <button
                onClick={() => {
                  setShowSearchModal(false);
                  setSearchInputValue('');
                  setTmdbSearchResults([]);
                }}
                className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full cursor-pointer text-neutral-400 hover:text-rose-500 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="输入影片名称、演员、导演..."
                value={searchInputValue}
                onChange={(e) => setSearchInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchInputValue.trim()) {
                    handleTmdbSearch(searchInputValue.trim());
                  }
                }}
                className="flex-1 px-4 py-2.5 bg-neutral-100 dark:bg-neutral-950 border-0 rounded-xl text-sm font-semibold text-neutral-900 dark:text-white placeholder-neutral-400"
              />
              <button
                onClick={() => searchInputValue.trim() && handleTmdbSearch(searchInputValue.trim())}
                disabled={tmdbSearchLoading}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-300 text-white rounded-xl text-sm font-bold cursor-pointer transition-colors flex items-center gap-2"
              >
                {tmdbSearchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                搜索
              </button>
            </div>

            {tmdbSearchResults.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {tmdbSearchResults.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      navigateTo(`#/detail/${item.id}`);
                      setShowSearchModal(false);
                      setSearchInputValue('');
                      setTmdbSearchResults([]);
                    }}
                    className="group cursor-pointer text-left"
                  >
                    <div className="aspect-[2/3] rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 mb-2">
                      <img
                        src={getTmdbImageUrl(item.poster_path, 'w300')}
                        alt={item.title || item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                    <p className="text-xs font-semibold text-neutral-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">
                      {item.title || item.name}
                    </p>
                    <p className="text-[10px] text-neutral-400">
                      {item.release_date || item.first_air_date || '未知'}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {tmdbSearchLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="ml-2 text-sm text-neutral-500">搜索中...</span>
              </div>
            )}

            {!tmdbSearchLoading && tmdbSearchResults.length === 0 && searchInputValue && (
              <div className="text-center py-12 text-neutral-400">
                <p className="text-sm">输入关键词开始搜索</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================================
          MODAL COMPONENT: ADD/EDIT MOVIE DETAILS POPUP
          ========================================================== */}
      {movieModalOpen && (
        <div id="movie-form-modal" className="fixed inset-0 z-55 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-210 dark:border-neutral-800 rounded-3xl w-full max-w-lg p-6 space-y-5 text-left shadow-2xl animate-zoom-in my-8 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-neutral-150 dark:border-neutral-800 pb-3">
              <h3 className="text-lg font-black dark:text-white tracking-tight">
                {editingMovie ? `编辑影片《${editingMovie.title}》` : '新增电影/直播源'}
              </h3>
              <button
                id="close-modal-x"
                onClick={() => setMovieModalOpen(false)}
                className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full cursor-pointer text-neutral-400 hover:text-rose-500 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleMovieSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-neutral-500 uppercase">电影标题</label>
                  <input
                    type="text"
                    required
                    placeholder="例如: 钢铁之泪"
                    value={movieForm.title}
                    onChange={e => setMovieForm({ ...movieForm, title: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-950 border-0 rounded-xl text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-neutral-500 uppercase">分类标签</label>
                  <input
                    type="text"
                    placeholder="分类 (如: 科幻 / 喜剧)"
                    value={movieForm.genre}
                    onChange={e => setMovieForm({ ...movieForm, genre: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-950 border-0 rounded-xl text-xs sm:text-sm text-neutral-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-neutral-500 uppercase">影片时长</label>
                  <input
                    type="text"
                    placeholder="如: 120 分钟 或 直播"
                    value={movieForm.duration}
                    onChange={e => setMovieForm({ ...movieForm, duration: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-950 border-0 rounded-xl text-xs sm:text-sm text-neutral-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-neutral-500 uppercase">封面大图 URL</label>
                  <input
                    type="url"
                    placeholder="HTTPS 绝对图片链接"
                    value={movieForm.coverUrl}
                    onChange={e => setMovieForm({ ...movieForm, coverUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-950 border-0 rounded-xl text-xs sm:text-sm font-mono text-neutral-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-500 uppercase">播放源视频流 URL (支持 mp4 或 m3u8)</label>
                <input
                  type="text"
                  required
                  placeholder="可播放 MP4 或是 Live M3U8"
                  value={movieForm.streamUrl}
                  onChange={e => setMovieForm({ ...movieForm, streamUrl: e.target.value })}
                  className="w-full px-3 py-2.5 bg-neutral-100 dark:bg-neutral-950 border-0 rounded-xl text-xs sm:text-sm font-mono text-blue-600 dark:text-blue-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-500 uppercase">内容核心梗概</label>
                <textarea
                  rows={3}
                  placeholder="填写电影的核心剧情、年份、参演情况等简短描述..."
                  value={movieForm.description}
                  onChange={e => setMovieForm({ ...movieForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-950 border-0 rounded-xl text-xs sm:text-sm leading-relaxed text-neutral-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-neutral-150 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setMovieModalOpen(false)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-600 dark:text-neutral-300 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1"
                >
                  确认保存发布
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Video Source Form Modal */}
      {videoSourceModalOpen && (
        <div id="video-source-form-modal" className="fixed inset-0 z-55 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-210 dark:border-neutral-800 rounded-3xl w-full max-w-md p-6 space-y-5 text-left shadow-2xl animate-zoom-in my-8">
            <div className="flex items-center justify-between border-b border-neutral-150 dark:border-neutral-800 pb-3">
              <h3 className="text-lg font-black dark:text-white tracking-tight">
                {editingVideoSource ? '编辑视频源' : '添加个人视频源'}
              </h3>
              <button
                onClick={() => setVideoSourceModalOpen(false)}
                className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full cursor-pointer text-neutral-400 hover:text-rose-500 transition-colors"
              >
                
              </button>
            </div>

            <form onSubmit={handleVideoSourceSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-500 uppercase">视频源名称</label>
                <input
                  type="text"
                  required
                  placeholder="例如: 量子资源"
                  value={videoSourceForm.name}
                  onChange={e => setVideoSourceForm({ ...videoSourceForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-neutral-100 dark:bg-neutral-950 border-0 rounded-xl text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-500 uppercase">Key标识</label>
                <input
                  type="text"
                  required
                  placeholder="例如: liangzi"
                  value={videoSourceForm.key}
                  onChange={e => setVideoSourceForm({ ...videoSourceForm, key: e.target.value })}
                  className="w-full px-3 py-2.5 bg-neutral-100 dark:bg-neutral-950 border-0 rounded-xl text-xs sm:text-sm font-mono text-neutral-900 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-500 uppercase">API地址</label>
                <input
                  type="url"
                  required
                  placeholder="https://example.com/api.php/provide/vod/"
                  value={videoSourceForm.api}
                  onChange={e => setVideoSourceForm({ ...videoSourceForm, api: e.target.value })}
                  className="w-full px-3 py-2.5 bg-neutral-100 dark:bg-neutral-950 border-0 rounded-xl text-xs sm:text-sm font-mono text-blue-600 dark:text-blue-400"
                />
                <p className="text-[10px] text-neutral-400 mt-1">支持MoonTV格式的API地址，如: https://api.com/api.php/provide/vod/</p>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-500 uppercase">Detail地址 (选填)</label>
                <input
                  type="url"
                  placeholder="留空则使用API地址"
                  value={videoSourceForm.detail}
                  onChange={e => setVideoSourceForm({ ...videoSourceForm, detail: e.target.value })}
                  className="w-full px-3 py-2.5 bg-neutral-100 dark:bg-neutral-950 border-0 rounded-xl text-xs sm:text-sm font-mono text-neutral-600 dark:text-neutral-400"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-neutral-150 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setVideoSourceModalOpen(false)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-600 dark:text-neutral-300 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  {editingVideoSource ? '保存修改' : '添加视频源'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Source Form Modal */}
      {liveSourceModalOpen && (
        <div id="live-source-form-modal" className="fixed inset-0 z-55 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-210 dark:border-neutral-800 rounded-3xl w-full max-w-md p-6 space-y-5 text-left shadow-2xl animate-zoom-in my-8">
            <div className="flex items-center justify-between border-b border-neutral-150 dark:border-neutral-800 pb-3">
              <h3 className="text-lg font-black dark:text-white tracking-tight">
                {editingLiveSource ? '编辑直播源' : '添加电视直播源'}
              </h3>
              <button
                onClick={() => setLiveSourceModalOpen(false)}
                className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full cursor-pointer text-neutral-400 hover:text-rose-500 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleLiveSourceSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-500 uppercase">直播源名称</label>
                <input
                  type="text"
                  required
                  placeholder="例如: 央视卫视直播"
                  value={liveSourceForm.name}
                  onChange={e => setLiveSourceForm({ ...liveSourceForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-neutral-100 dark:bg-neutral-950 border-0 rounded-xl text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-500 uppercase">直播源类型</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLiveSourceForm({ ...liveSourceForm, type: 'm3u' })}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer transition-colors ${
                      liveSourceForm.type === 'm3u'
                        ? 'bg-blue-600 text-white'
                        : 'bg-neutral-100 dark:bg-neutral-950 text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    M3U格式
                  </button>
                  <button
                    type="button"
                    onClick={() => setLiveSourceForm({ ...liveSourceForm, type: 'txt' })}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer transition-colors ${
                      liveSourceForm.type === 'txt'
                        ? 'bg-blue-600 text-white'
                        : 'bg-neutral-100 dark:bg-neutral-950 text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    TXT格式
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-500 uppercase">直播源URL地址</label>
                <input
                  type="url"
                  required
                  placeholder="https://example.com/live.m3u 或 https://example.com/live.txt"
                  value={liveSourceForm.url}
                  onChange={e => setLiveSourceForm({ ...liveSourceForm, url: e.target.value })}
                  className="w-full px-3 py-2.5 bg-neutral-100 dark:bg-neutral-950 border-0 rounded-xl text-xs sm:text-sm font-mono text-blue-600 dark:text-blue-400"
                />
                <p className="text-[10px] text-neutral-400 mt-1">支持M3U和TXT格式，支持IPV4和IPV6地址</p>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-500 uppercase">分组名称 (选填)</label>
                <input
                  type="text"
                  placeholder="例如: 央视, 卫视, 地方"
                  value={liveSourceForm.group}
                  onChange={e => setLiveSourceForm({ ...liveSourceForm, group: e.target.value })}
                  className="w-full px-3 py-2.5 bg-neutral-100 dark:bg-neutral-950 border-0 rounded-xl text-xs sm:text-sm text-neutral-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-neutral-150 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setLiveSourceModalOpen(false)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-600 dark:text-neutral-300 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  {editingLiveSource ? '保存修改' : '添加直播源'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Brand Footer */}
      <footer id="app-footer" className="bg-white dark:bg-neutral-900 border-t border-neutral-200/50 dark:border-neutral-800/80 py-4 transition-colors mt-auto text-center">
        <p className="text-xs text-neutral-400">xiaohe影视 © 2026</p>
      </footer>

    </div>
  );
}