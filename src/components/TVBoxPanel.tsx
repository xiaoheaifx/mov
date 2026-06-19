import React, { useState } from 'react';
import { Link, Search, Loader2, Tv, X, Play } from 'lucide-react';
import { TVBoxSite, TVBoxVideoItem, TVBoxVideoDetail } from '../types.js';

interface TVBoxPanelProps {
  sites: TVBoxSite[];
  onParseUrl: (url: string) => Promise<void>;
  onSearch: (siteUrl: string, keyword: string) => Promise<void>;
  onGetDetail: (siteUrl: string, vodId: string) => Promise<TVBoxVideoDetail | null>;
  onPlayVideo: (detail: TVBoxVideoDetail) => void;
  loading: boolean;
  parseError: string | null;
  searchResults: TVBoxVideoItem[];
  searchLoading: boolean;
}

export default function TVBoxPanel({
  sites,
  onParseUrl,
  onSearch,
  onGetDetail,
  onPlayVideo,
  loading,
  parseError,
  searchResults,
  searchLoading
}: TVBoxPanelProps) {
  const [inputUrl, setInputUrl] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedSite, setSelectedSite] = useState<TVBoxSite | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleParse = async () => {
    if (!inputUrl.trim()) return;
    await onParseUrl(inputUrl.trim());
  };

  const handleSearch = async () => {
    if (!selectedSite || !searchKeyword.trim()) return;
    await onSearch(selectedSite.api, searchKeyword.trim());
  };

  const handleItemClick = async (item: TVBoxVideoItem) => {
    if (!selectedSite) return;
    const detail = await onGetDetail(selectedSite.api, String(item.vod_id));
    if (detail) {
      onPlayVideo(detail);
    }
  };

  const httpSites = sites.filter(s => s.type === 0 || s.type === 1);

  return (
    <div className="bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-neutral-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-600/10 flex items-center justify-center">
            <Tv className="w-5 h-5 text-purple-500" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-neutral-900 dark:text-white">TVBox 影视源</h3>
            <p className="text-xs text-neutral-500 dark:text-slate-400">
              {sites.length > 0 ? `已加载 ${sites.length} 个站点` : '输入接口地址搜索更多影视资源'}
            </p>
          </div>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className={`w-5 h-5 text-neutral-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 sm:px-5 pb-5 space-y-4 border-t border-neutral-100 dark:border-slate-800 pt-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="url"
                value={inputUrl}
                onChange={e => setInputUrl(e.target.value)}
                placeholder="输入TVBox接口地址 (JSON URL)"
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                onKeyDown={e => e.key === 'Enter' && handleParse()}
              />
            </div>
            <button
              onClick={handleParse}
              disabled={loading || !inputUrl.trim()}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-neutral-300 dark:disabled:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
              解析
            </button>
          </div>

          {parseError && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-sm text-rose-600 dark:text-rose-400">
              <X className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {parseError}
            </div>
          )}

          {httpSites.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {httpSites.map(site => (
                  <button
                    key={site.key}
                    onClick={() => setSelectedSite(site)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      selectedSite?.key === site.key
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-neutral-100 dark:bg-slate-800 text-neutral-700 dark:text-slate-300 hover:bg-neutral-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {site.name}
                  </button>
                ))}
              </div>

              {selectedSite && (
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      value={searchKeyword}
                      onChange={e => setSearchKeyword(e.target.value)}
                      placeholder={`在 ${selectedSite.name} 中搜索...`}
                      className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                      onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    />
                  </div>
                  <button
                    onClick={handleSearch}
                    disabled={searchLoading || !searchKeyword.trim()}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-300 dark:disabled:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    搜索
                  </button>
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {searchResults.map(item => (
                    <div
                      key={item.vod_id}
                      onClick={() => handleItemClick(item)}
                      className="group cursor-pointer"
                    >
                      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-neutral-200 dark:bg-slate-800 mb-2">
                        <img
                          src={item.vod_pic}
                          alt={item.vod_name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-10 h-10 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-lg">
                            <Play className="w-4 h-4 fill-white ml-0.5" />
                          </div>
                        </div>
                        {item.vod_remarks && (
                          <span className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-md">
                            {item.vod_remarks}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-1 group-hover:text-blue-500 transition-colors">
                        {item.vod_name}
                      </h4>
                      <p className="text-xs text-neutral-500 dark:text-slate-400 line-clamp-1">
                        {item.type_name} {item.vod_year && `· ${item.vod_year}`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {sites.length > 0 && httpSites.length === 0 && (
            <p className="text-sm text-neutral-500 dark:text-slate-400 text-center py-4">
              该接口中的站点均为 Spider 类型，暂不支持在线搜索。请尝试其他包含 CMS 采集站的接口。
            </p>
          )}
        </div>
      )}
    </div>
  );
}