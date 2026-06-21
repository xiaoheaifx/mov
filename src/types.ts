/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Movie {
  id: string;
  title: string;
  coverUrl: string;
  description: string;
  genre: string;
  duration: string;
  streamUrl: string;
  streamValid?: boolean | null;
  streamCheckTime?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  username: string;
  passwordHash: string;
  createdAt: string;
  role: 'viewer';
}

export interface Admin {
  username: string;
  passwordHash: string;
  role: 'admin' | 'streamer';
  createdAt: string;
}

export interface AuthSession {
  token: string;
  username: string;
  role: 'viewer' | 'admin' | 'streamer';
  expiresAt: string;
}

export interface StreamCheckResponse {
  valid: boolean;
  statusCode: number;
  statusText: string;
  checkedAt: string;
}

export interface TMDBMovie {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  media_type?: string;
  popularity: number;
}

export interface TMDBMovieDetail {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  tagline?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count?: number;
  release_date?: string;
  first_air_date?: string;
  status?: string;
  runtime?: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
  budget?: number;
  revenue?: number;
  genres: Array<{ id: number; name: string }>;
  production_companies?: Array<{ id: number; name: string; logo_path: string | null }>;
  production_countries?: Array<{ iso_3166_1: string; name: string }>;
  spoken_languages?: Array<{ iso_639_1: string; name: string }>;
  credits?: {
    cast: Array<{ id: number; name: string; character: string; profile_path: string | null; order?: number }>;
    crew: Array<{ id: number; name: string; job: string; department?: string; profile_path: string | null }>;
  };
  videos?: {
    results: Array<{ id: string; key: string; name: string; site: string; type: string }>;
  };
  similar?: {
    results: TMDBMovie[];
  };
  recommendations?: {
    results: TMDBMovie[];
  };
}

export interface TMDBResponse {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

export interface TVBoxSite {
  key: string;
  name: string;
  type: number;
  api: string;
  detail?: string;
  searchable?: number;
  quickSearch?: number;
  filterable?: number;
}

export interface TVBoxParseResult {
  success: boolean;
  spider: string;
  sites: TVBoxSite[];
  httpSites: TVBoxSite[];
  wallpaper: string;
}

export interface TVBoxVideoItem {
  vod_id: string | number;
  vod_name: string;
  vod_pic: string;
  vod_remarks: string;
  vod_year: string;
  vod_area: string;
  type_name: string;
  vod_play_url?: string;
}

export interface TVBoxVideoDetail {
  vod_id: string | number;
  vod_name: string;
  vod_pic: string;
  vod_content: string;
  vod_remarks: string;
  vod_year: string;
  vod_area: string;
  vod_director: string;
  vod_actor: string;
  type_name: string;
  vod_play_from: string;
  vod_play_url: string;
}

export interface TVBoxListResponse {
  code?: number;
  msg?: string;
  page: string | number;
  pagecount: string | number;
  limit: string | number;
  total: string | number;
  list: TVBoxVideoItem[];
}

export interface TVBoxDetailResponse {
  code?: number;
  msg?: string;
  list: TVBoxVideoDetail[];
}

export interface PosterSearchResult {
  vod_id?: string | number;
  vod_name?: string;
  vod_pic?: string;
  type_name?: string;
  vod_year?: string;
  vod_area?: string;
  vod_remarks?: string;
  vod_content?: string;
  vod_director?: string;
  vod_actor?: string;
  vod_play_url?: string;
}

export interface PosterSearchResponse {
  code?: number;
  msg?: string;
  list?: PosterSearchResult[];
  total?: number | string;
}

export interface VideoSource {
  id: string;
  name: string;
  key: string;
  api: string;
  detail?: string;
  type?: number;
  searchable?: number;
  createdAt: string;
  updatedAt: string;
}

export interface VideoSourceEpisode {
  name: string;
  url: string;
}

export interface VideoSourcePlayLine {
  source: string;
  episodes: VideoSourceEpisode[];
}

export interface VideoSourcePlayResult {
  vod_id: string | number;
  vod_name: string;
  vod_pic: string;
  type_name: string;
  vod_year: string;
  vod_area: string;
  vod_remarks: string;
  vod_content: string;
  vod_director: string;
  vod_actor: string;
  lines: VideoSourcePlayLine[];
}

export interface VideoSourceSearchItem {
  vod_id: string | number;
  vod_name: string;
  vod_pic: string;
  type_name: string;
  vod_remarks: string;
  vod_year: string;
  sourceKey: string;
  sourceName: string;
}