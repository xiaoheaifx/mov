import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import bcrypt from 'bcryptjs';
import { getCollection, setCollection } from '../../src/db.js';
import { Movie, User, Admin, AuthSession } from '../../src/types.js';

// Cookie parsing helper
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      const name = parts.shift()?.trim();
      if (name) {
        cookies[name] = decodeURIComponent(parts.join('='));
      }
    });
  }
  return cookies;
}

// Session cookie helpers
function setSessionCookie(name: string, token: string, maxAgeSec: number = 86400 * 30): string {
  return `${name}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${maxAgeSec}; SameSite=Strict`;
}

function clearSessionCookie(name: string): string {
  return `${name}=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict`;
}

// TMDB API helper
const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

async function tmdbFetch(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY 环境变量未设置。请在 Netlify 环境变量中配置有效的 TMDB API Key。');
  }
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  url.searchParams.set('language', 'zh-CN');
  url.searchParams.set('region', 'CN');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`TMDB API error: ${res.status}`);
    return await res.json();
  } catch (e: any) {
    clearTimeout(timeout);
    throw e;
  }
}

// Admin auth middleware
async function adminAuthMiddleware(event: HandlerEvent): Promise<{ error?: any; adminUser?: any }> {
  const cookies = parseCookies(event.headers.cookie);
  const adminToken = cookies?.admin_session;
  
  if (!adminToken) {
    return { error: { statusCode: 401, body: JSON.stringify({ error: '您尚未登录管理员或直播员账号' }) } };
  }

  const sessions = await getCollection('sessions');
  const session = sessions[adminToken];

  if (!session || (session.role !== 'admin' && session.role !== 'streamer')) {
    return { error: { statusCode: 401, body: JSON.stringify({ error: '管理员会话无效或已过期' }) } };
  }

  return { adminUser: { username: session.username, role: session.role } };
}

// Main handler
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const path = event.path.replace(/^\/\.netlify\/functions\/api/, '').replace(/^\/api/, '');
  const method = event.httpMethod;
  const cookies = parseCookies(event.headers.cookie);
  
  let body: any = {};
  if (event.body && method !== 'GET') {
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      body = {};
    }
  }

  try {
    // ==========================================
    // Viewer Authentication API
    // ==========================================
    
    if (path === '/auth/login' && method === 'POST') {
      const { username, password } = body;
      if (!username || !password) {
        return { statusCode: 400, body: JSON.stringify({ error: '请输入用户名和密码' }) };
      }

      const users = await getCollection('users');
      const user = users[username];

      if (!user) {
        return { statusCode: 401, body: JSON.stringify({ error: '观众账号不存在，请联系管理员为您开通' }) };
      }

      const matches = bcrypt.compareSync(password, user.passwordHash);
      if (!matches) {
        return { statusCode: 401, body: JSON.stringify({ error: '密码错误' }) };
      }

      const token = 'viewer_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const sessions = await getCollection('sessions');
      
      sessions[token] = {
        token,
        username,
        role: 'viewer',
        expiresAt: new Date(Date.now() + 86400000 * 30).toISOString()
      };
      await setCollection('sessions', sessions);

      return {
        statusCode: 200,
        headers: { 'Set-Cookie': setSessionCookie('viewer_session', token) },
        body: JSON.stringify({
          success: true,
          user: { username: user.username, role: 'viewer' }
        })
      };
    }

    if (path === '/auth/logout' && method === 'POST') {
      const token = cookies?.viewer_session;
      if (token) {
        const sessions = await getCollection('sessions');
        delete sessions[token];
        await setCollection('sessions', sessions);
      }
      return {
        statusCode: 200,
        headers: { 'Set-Cookie': clearSessionCookie('viewer_session') },
        body: JSON.stringify({ success: true, message: '已成功登出' })
      };
    }

    if (path === '/auth/me' && method === 'GET') {
      const viewerToken = cookies?.viewer_session;
      const adminToken = cookies?.admin_session;

      if (adminToken) {
        const sessions = await getCollection('sessions');
        const session = sessions[adminToken];
        if (session && (session.role === 'admin' || session.role === 'streamer')) {
          return {
            statusCode: 200,
            body: JSON.stringify({
              loggedIn: true,
              user: { username: session.username, role: session.role }
            })
          };
        }
      }

      if (viewerToken) {
        const sessions = await getCollection('sessions');
        const session = sessions[viewerToken];
        if (session && session.role === 'viewer') {
          return {
            statusCode: 200,
            body: JSON.stringify({
              loggedIn: true,
              user: { username: session.username, role: 'viewer' }
            })
          };
        }
      }

      return { statusCode: 200, body: JSON.stringify({ loggedIn: false }) };
    }

    // ==========================================
    // Movies API
    // ==========================================
    
    if (path === '/movies' && method === 'GET') {
      const moviesRecord = await getCollection('movies');
      const safeMovies = Object.values(moviesRecord).map(({ streamUrl, ...rest }) => rest);
      return { statusCode: 200, body: JSON.stringify(safeMovies) };
    }

    if (path.match(/^\/movies\/[^/]+$/) && method === 'GET') {
      const id = path.split('/')[2];
      const moviesRecord = await getCollection('movies');
      const movie = moviesRecord[id];

      if (!movie) {
        return { statusCode: 404, body: JSON.stringify({ error: '电影不存在' }) };
      }

      const viewerToken = cookies?.viewer_session;
      const adminToken = cookies?.admin_session;
      
      let isAuthorized = false;
      const sessions = await getCollection('sessions');

      if (adminToken && sessions[adminToken] && (sessions[adminToken].role === 'admin' || sessions[adminToken].role === 'streamer')) {
        isAuthorized = true;
      } else if (viewerToken && sessions[viewerToken] && sessions[viewerToken].role === 'viewer') {
        isAuthorized = true;
      }

      if (isAuthorized) {
        return { statusCode: 200, body: JSON.stringify({ ...movie, loggedIn: true }) };
      } else {
        const { streamUrl, ...safeMovie } = movie;
        return { statusCode: 200, body: JSON.stringify({ ...safeMovie, loggedIn: false }) };
      }
    }

    // ==========================================
    // Admin Authentication API
    // ==========================================
    
    if (path === '/admin/login' && method === 'POST') {
      const { username, password } = body;
      if (!username || !password) {
        return { statusCode: 400, body: JSON.stringify({ error: '请输入管理员账号和密码' }) };
      }

      const admins = await getCollection('admins');
      const adminAccount = admins[username];

      if (!adminAccount) {
        return { statusCode: 401, body: JSON.stringify({ error: '管理员或直播员账号不存在' }) };
      }

      const matches = bcrypt.compareSync(password, adminAccount.passwordHash);
      if (!matches) {
        return { statusCode: 401, body: JSON.stringify({ error: '密码错误' }) };
      }

      const token = 'admin_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const sessions = await getCollection('sessions');
      
      sessions[token] = {
        token,
        username,
        role: adminAccount.role,
        expiresAt: new Date(Date.now() + 86400000 * 3).toISOString()
      };
      await setCollection('sessions', sessions);

      return {
        statusCode: 200,
        headers: { 'Set-Cookie': setSessionCookie('admin_session', token, 86400 * 3) },
        body: JSON.stringify({
          success: true,
          user: { username: adminAccount.username, role: adminAccount.role }
        })
      };
    }

    if (path === '/admin/logout' && method === 'POST') {
      const token = cookies?.admin_session;
      if (token) {
        const sessions = await getCollection('sessions');
        delete sessions[token];
        await setCollection('sessions', sessions);
      }
      return {
        statusCode: 200,
        headers: { 'Set-Cookie': clearSessionCookie('admin_session') },
        body: JSON.stringify({ success: true, message: '管理后台退出登录成功' })
      };
    }

    // ==========================================
    // Admin Movies API
    // ==========================================
    
    if (path === '/admin/movies' && method === 'GET') {
      const auth = await adminAuthMiddleware(event);
      if (auth.error) return auth.error;
      
      const moviesRecord = await getCollection('movies');
      return { statusCode: 200, body: JSON.stringify(Object.values(moviesRecord)) };
    }

    if (path === '/admin/movies' && method === 'POST') {
      const auth = await adminAuthMiddleware(event);
      if (auth.error) return auth.error;
      
      const { title, coverUrl, description, genre, duration, streamUrl } = body;
      if (!title || !streamUrl) {
        return { statusCode: 400, body: JSON.stringify({ error: '电影标题与播放源为必填项' }) };
      }

      const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
      const moviesRecord = await getCollection('movies');

      const newMovie: Movie = {
        id,
        title,
        coverUrl: coverUrl || 'https://images.unsplash.com/photo-1542204172-e7052809f852?w=800&q=80',
        description: description || '无电影简介',
        genre: genre || '未分类',
        duration: duration || '未知时长',
        streamUrl,
        streamValid: null,
        streamCheckTime: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      moviesRecord[id] = newMovie;
      await setCollection('movies', moviesRecord);

      return { statusCode: 200, body: JSON.stringify({ success: true, movie: newMovie }) };
    }

    if (path.match(/^\/admin\/movies\/[^/]+$/) && method === 'PUT') {
      const auth = await adminAuthMiddleware(event);
      if (auth.error) return auth.error;
      
      const id = path.split('/')[3];
      const { title, coverUrl, description, genre, duration, streamUrl } = body;

      const moviesRecord = await getCollection('movies');
      const existingMovie = moviesRecord[id];

      if (!existingMovie) {
        return { statusCode: 404, body: JSON.stringify({ error: '电影未找到' }) };
      }

      const updatedMovie: Movie = {
        ...existingMovie,
        title: title ?? existingMovie.title,
        coverUrl: coverUrl ?? existingMovie.coverUrl,
        description: description ?? existingMovie.description,
        genre: genre ?? existingMovie.genre,
        duration: duration ?? existingMovie.duration,
        streamUrl: streamUrl ?? existingMovie.streamUrl,
        streamValid: streamUrl !== existingMovie.streamUrl ? null : existingMovie.streamValid,
        streamCheckTime: streamUrl !== existingMovie.streamUrl ? null : existingMovie.streamCheckTime,
        updatedAt: new Date().toISOString()
      };

      moviesRecord[id] = updatedMovie;
      await setCollection('movies', moviesRecord);

      return { statusCode: 200, body: JSON.stringify({ success: true, movie: updatedMovie }) };
    }

    if (path.match(/^\/admin\/movies\/[^/]+$/) && method === 'DELETE') {
      const auth = await adminAuthMiddleware(event);
      if (auth.error) return auth.error;
      
      const id = path.split('/')[3];
      const moviesRecord = await getCollection('movies');
      
      if (!moviesRecord[id]) {
        return { statusCode: 404, body: JSON.stringify({ error: '电影未找到' }) };
      }

      delete moviesRecord[id];
      await setCollection('movies', moviesRecord);

      return { statusCode: 200, body: JSON.stringify({ success: true, message: '电影已成功删除' }) };
    }

    if (path === '/admin/check-stream' && method === 'POST') {
      const auth = await adminAuthMiddleware(event);
      if (auth.error) return auth.error;
      
      const { url, movieId } = body;
      if (!url) {
        return { statusCode: 400, body: JSON.stringify({ error: '未提供视频源 URL' }) };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      let valid = false;
      let statusCode = 0;
      let statusText = 'Unknown Error';
      let contentType = '';

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Range': 'bytes=0-1' },
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        
        statusCode = response.status;
        statusText = response.statusText;
        contentType = response.headers.get('content-type') || '';
        
        valid = response.ok || statusCode === 206 || (statusCode >= 200 && statusCode < 400);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        statusText = fetchError.name === 'AbortError' ? '连接超时 (5秒)' : (fetchError.message || '请求失败');
      }

      const checkTime = new Date().toISOString();

      if (movieId) {
        const movies = await getCollection('movies');
        if (movies[movieId]) {
          movies[movieId].streamValid = valid;
          movies[movieId].streamCheckTime = checkTime;
          await setCollection('movies', movies);
        }
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ valid, statusCode, statusText, contentType, checkedAt: checkTime })
      };
    }

    // ==========================================
    // User Management API (Superadmin only)
    // ==========================================
    
    if (path === '/admin/users' && method === 'GET') {
      const auth = await adminAuthMiddleware(event);
      if (auth.error) return auth.error;
      if (auth.adminUser?.role !== 'admin') {
        return { statusCode: 403, body: JSON.stringify({ error: '该操作仅超级管理员(Admin)有权访问' }) };
      }
      
      const usersRecord = await getCollection('users');
      const sanitizedUsers = Object.values(usersRecord).map(({ passwordHash, ...rest }) => rest);
      return { statusCode: 200, body: JSON.stringify(sanitizedUsers) };
    }

    if (path === '/admin/users' && method === 'POST') {
      const auth = await adminAuthMiddleware(event);
      if (auth.error) return auth.error;
      if (auth.adminUser?.role !== 'admin') {
        return { statusCode: 403, body: JSON.stringify({ error: '该操作仅超级管理员(Admin)有权访问' }) };
      }
      
      const { username, password } = body;
      if (!username || !password) {
        return { statusCode: 400, body: JSON.stringify({ error: '用户名与密码均为必填项' }) };
      }

      const trimmedUsername = username.trim();
      if (trimmedUsername.length < 3) {
        return { statusCode: 400, body: JSON.stringify({ error: '用户名长度须至少3位字符' }) };
      }

      const usersRecord = await getCollection('users');
      if (usersRecord[trimmedUsername]) {
        return { statusCode: 400, body: JSON.stringify({ error: '此用户名已被注册' }) };
      }

      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(password, salt);

      const newUser: User = {
        username: trimmedUsername,
        passwordHash,
        createdAt: new Date().toISOString(),
        role: 'viewer'
      };

      usersRecord[trimmedUsername] = newUser;
      await setCollection('users', usersRecord);

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: '普通观众账号创建成功',
          user: { username: trimmedUsername, role: 'viewer', createdAt: newUser.createdAt }
        })
      };
    }

    if (path === '/admin/users' && method === 'DELETE') {
      const auth = await adminAuthMiddleware(event);
      if (auth.error) return auth.error;
      if (auth.adminUser?.role !== 'admin') {
        return { statusCode: 403, body: JSON.stringify({ error: '该操作仅超级管理员(Admin)有权访问' }) };
      }
      
      const { username } = body;
      if (!username) {
        return { statusCode: 400, body: JSON.stringify({ error: '未提供欲删除的用户名' }) };
      }

      const usersRecord = await getCollection('users');
      if (!usersRecord[username]) {
        return { statusCode: 404, body: JSON.stringify({ error: '观众账号不存在' }) };
      }

      delete usersRecord[username];
      await setCollection('users', usersRecord);

      return { statusCode: 200, body: JSON.stringify({ success: true, message: `观众账号 ${username} 已成功注销删除` }) };
    }

    // ==========================================
    // Streamers Management API (Superadmin only)
    // ==========================================
    
    if (path === '/admin/streamers' && method === 'GET') {
      const auth = await adminAuthMiddleware(event);
      if (auth.error) return auth.error;
      if (auth.adminUser?.role !== 'admin') {
        return { statusCode: 403, body: JSON.stringify({ error: '该操作仅超级管理员(Admin)有权访问' }) };
      }
      
      const adminsRecord = await getCollection('admins');
      const streamers = Object.values(adminsRecord)
        .filter(item => item.role === 'streamer')
        .map(({ passwordHash, ...rest }) => rest);
      return { statusCode: 200, body: JSON.stringify(streamers) };
    }

    if (path === '/admin/streamers' && method === 'POST') {
      const auth = await adminAuthMiddleware(event);
      if (auth.error) return auth.error;
      if (auth.adminUser?.role !== 'admin') {
        return { statusCode: 403, body: JSON.stringify({ error: '该操作仅超级管理员(Admin)有权访问' }) };
      }
      
      const { username, password } = body;
      if (!username || !password) {
        return { statusCode: 400, body: JSON.stringify({ error: '用户名与密码均为必填项' }) };
      }

      const trimmedUsername = username.trim();
      if (trimmedUsername.length < 3) {
        return { statusCode: 400, body: JSON.stringify({ error: '用户名长度须至少3位字符' }) };
      }

      const adminsRecord = await getCollection('admins');
      if (adminsRecord[trimmedUsername]) {
        return { statusCode: 400, body: JSON.stringify({ error: '此用户名已存在于后台管理员或直播员系统' }) };
      }

      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(password, salt);

      const newStreamer: Admin = {
        username: trimmedUsername,
        passwordHash,
        role: 'streamer',
        createdAt: new Date().toISOString()
      };

      adminsRecord[trimmedUsername] = newStreamer;
      await setCollection('admins', adminsRecord);

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: '直播员账号创建成功',
          streamer: { username: trimmedUsername, role: 'streamer', createdAt: newStreamer.createdAt }
        })
      };
    }

    if (path === '/admin/streamers' && method === 'DELETE') {
      const auth = await adminAuthMiddleware(event);
      if (auth.error) return auth.error;
      if (auth.adminUser?.role !== 'admin') {
        return { statusCode: 403, body: JSON.stringify({ error: '该操作仅超级管理员(Admin)有权访问' }) };
      }
      
      const { username } = body;
      if (!username) {
        return { statusCode: 400, body: JSON.stringify({ error: '未提供欲删除的直播员用户名' }) };
      }

      const adminsRecord = await getCollection('admins');
      if (!adminsRecord[username] || adminsRecord[username].role !== 'streamer') {
        return { statusCode: 404, body: JSON.stringify({ error: '直播员账号不存在' }) };
      }

      delete adminsRecord[username];
      await setCollection('admins', adminsRecord);

      return { statusCode: 200, body: JSON.stringify({ success: true, message: `直播员账号 ${username} 已成功删除` }) };
    }

    // ==========================================
    // Health Check (Diagnostic)
    // ==========================================
    
    if (path === '/health' && method === 'GET') {
      const hasKey = !!TMDB_API_KEY;
      const keyPreview = hasKey ? TMDB_API_KEY.substring(0, 4) + '...' + TMDB_API_KEY.substring(TMDB_API_KEY.length - 4) : '(empty)';
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'ok',
          function: 'api',
          tmdb_api_key: {
            present: hasKey,
            preview: keyPreview,
            length: TMDB_API_KEY.length
          },
          admin_username: process.env.ADMIN_USERNAME || 'xiaohe',
          admin_password_hash_set: !!process.env.ADMIN_PASSWORD_HASH,
          admin_password_set: !!process.env.ADMIN_PASSWORD,
          node_version: process.version,
          env_keys: Object.keys(process.env).filter(k => k.startsWith('TMDB') || k.startsWith('ADMIN') || k.startsWith('VITE'))
        })
      };
    }

    // ==========================================
    // TMDB API Proxy
    // ==========================================
    
    if (path === '/tmdb/trending' && method === 'GET') {
      try {
        const mediaType = (event.queryStringParameters?.media_type as string) || 'all';
        const timeWindow = (event.queryStringParameters?.time_window as string) || 'week';
        const page = (event.queryStringParameters?.page as string) || '1';
        const data = await tmdbFetch(`/trending/${mediaType}/${timeWindow}`, { page });
        return { statusCode: 200, body: JSON.stringify(data) };
      } catch (e: any) {
        return { statusCode: 200, body: JSON.stringify({ results: [], error: e.message }) };
      }
    }

    if (path === '/tmdb/movie/now_playing' && method === 'GET') {
      try {
        const page = (event.queryStringParameters?.page as string) || '1';
        const data = await tmdbFetch('/movie/now_playing', { page });
        return { statusCode: 200, body: JSON.stringify(data) };
      } catch (e: any) {
        return { statusCode: 200, body: JSON.stringify({ results: [], error: e.message }) };
      }
    }

    if (path === '/tmdb/movie/popular' && method === 'GET') {
      try {
        const page = (event.queryStringParameters?.page as string) || '1';
        const data = await tmdbFetch('/movie/popular', { page });
        return { statusCode: 200, body: JSON.stringify(data) };
      } catch (e: any) {
        return { statusCode: 200, body: JSON.stringify({ results: [], error: e.message }) };
      }
    }

    if (path === '/tmdb/tv/popular' && method === 'GET') {
      try {
        const page = (event.queryStringParameters?.page as string) || '1';
        const data = await tmdbFetch('/tv/popular', { page });
        return { statusCode: 200, body: JSON.stringify(data) };
      } catch (e: any) {
        return { statusCode: 200, body: JSON.stringify({ results: [], error: e.message }) };
      }
    }

    if (path === '/tmdb/tv/top_rated' && method === 'GET') {
      try {
        const page = (event.queryStringParameters?.page as string) || '1';
        const data = await tmdbFetch('/tv/top_rated', { page });
        return { statusCode: 200, body: JSON.stringify(data) };
      } catch (e: any) {
        return { statusCode: 200, body: JSON.stringify({ results: [], error: e.message }) };
      }
    }

    if (path === '/tmdb/search' && method === 'GET') {
      try {
        const query = event.queryStringParameters?.query as string;
        const page = (event.queryStringParameters?.page as string) || '1';
        if (!query) return { statusCode: 400, body: JSON.stringify({ error: '请提供搜索关键词' }) };
        const data = await tmdbFetch('/search/multi', { query, page });
        return { statusCode: 200, body: JSON.stringify(data) };
      } catch (e: any) {
        return { statusCode: 200, body: JSON.stringify({ results: [], error: e.message }) };
      }
    }

    // Movie/TV detail endpoints
    if (path.match(/^\/tmdb\/movie\/\d+$/) && method === 'GET') {
      try {
        const id = path.split('/')[3];
        const data = await tmdbFetch(`/movie/${id}`, { append_to_response: 'credits,videos,similar' });
        return { statusCode: 200, body: JSON.stringify(data) };
      } catch (e: any) {
        return { statusCode: 200, body: JSON.stringify({ error: e.message }) };
      }
    }

    if (path.match(/^\/tmdb\/tv\/\d+$/) && method === 'GET') {
      try {
        const id = path.split('/')[3];
        const data = await tmdbFetch(`/tv/${id}`, { append_to_response: 'credits,videos,similar' });
        return { statusCode: 200, body: JSON.stringify(data) };
      } catch (e: any) {
        return { statusCode: 200, body: JSON.stringify({ error: e.message }) };
      }
    }

    // Discover endpoints for genre/region filtering
    if (path === '/tmdb/discover/movie' && method === 'GET') {
      try {
        const params: Record<string, string> = {};
        const page = event.queryStringParameters?.page as string;
        const withGenres = event.queryStringParameters?.with_genres as string;
        const withOriginalLanguage = event.queryStringParameters?.with_original_language as string;
        const region = event.queryStringParameters?.region as string;
        const sortBy = event.queryStringParameters?.sort_by as string;
        const year = event.queryStringParameters?.year as string;
        if (page) params.page = page;
        if (withGenres) params.with_genres = withGenres;
        if (withOriginalLanguage) params.with_original_language = withOriginalLanguage;
        if (region) params.region = region;
        if (sortBy) params.sort_by = sortBy;
        if (year) params.year = year;
        const data = await tmdbFetch('/discover/movie', params);
        return { statusCode: 200, body: JSON.stringify(data) };
      } catch (e: any) {
        return { statusCode: 200, body: JSON.stringify({ results: [], error: e.message }) };
      }
    }

    if (path === '/tmdb/discover/tv' && method === 'GET') {
      try {
        const params: Record<string, string> = {};
        const page = event.queryStringParameters?.page as string;
        const withGenres = event.queryStringParameters?.with_genres as string;
        const withOriginalLanguage = event.queryStringParameters?.with_original_language as string;
        const sortBy = event.queryStringParameters?.sort_by as string;
        if (page) params.page = page;
        if (withGenres) params.with_genres = withGenres;
        if (withOriginalLanguage) params.with_original_language = withOriginalLanguage;
        if (sortBy) params.sort_by = sortBy;
        const data = await tmdbFetch('/discover/tv', params);
        return { statusCode: 200, body: JSON.stringify(data) };
      } catch (e: any) {
        return { statusCode: 200, body: JSON.stringify({ results: [], error: e.message }) };
      }
    }

    // Genre list endpoints
    if (path === '/tmdb/genre/movie/list' && method === 'GET') {
      try {
        const data = await tmdbFetch('/genre/movie/list');
        return { statusCode: 200, body: JSON.stringify(data) };
      } catch (e: any) {
        return { statusCode: 200, body: JSON.stringify({ genres: [], error: e.message }) };
      }
    }

    if (path === '/tmdb/genre/tv/list' && method === 'GET') {
      try {
        const data = await tmdbFetch('/genre/tv/list');
        return { statusCode: 200, body: JSON.stringify(data) };
      } catch (e: any) {
        return { statusCode: 200, body: JSON.stringify({ genres: [], error: e.message }) };
      }
    }

    // ==========================================
    // TVBox API Proxy
    // ==========================================
    
    if (path === '/tvbox/parse' && method === 'POST') {
      const { url } = body;
      if (!url) return { statusCode: 400, body: JSON.stringify({ error: '请提供TVBox接口地址' }) };
      
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const apiRes = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
        clearTimeout(timeout);
        
        if (!apiRes.ok) {
          return { statusCode: 502, body: JSON.stringify({ error: `TVBox接口请求失败: HTTP ${apiRes.status}` }) };
        }
        
        const data = await apiRes.json();
        return { statusCode: 200, body: JSON.stringify(data) };
      } catch (e: any) {
        return { statusCode: 502, body: JSON.stringify({ error: 'TVBox接口解析失败: ' + (e.message || '网络错误') }) };
      }
    }

    if (path === '/tvbox/search' && method === 'GET') {
      const siteUrl = event.queryStringParameters?.url as string;
      const keyword = event.queryStringParameters?.wd as string;
      if (!siteUrl || !keyword) return { statusCode: 400, body: JSON.stringify({ error: '请提供站点URL和搜索关键词' }) };
      
      try {
        const searchUrl = `${siteUrl}?ac=videolist&wd=${encodeURIComponent(keyword)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const apiRes = await fetch(searchUrl, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
        clearTimeout(timeout);
        
        if (!apiRes.ok) {
          return { statusCode: 502, body: JSON.stringify({ error: `搜索请求失败: HTTP ${apiRes.status}` }) };
        }
        
        const data = await apiRes.json();
        return { statusCode: 200, body: JSON.stringify(data) };
      } catch (e: any) {
        return { statusCode: 502, body: JSON.stringify({ error: '搜索请求失败: ' + (e.message || '网络错误') }) };
      }
    }

    if (path === '/tvbox/detail' && method === 'GET') {
      const siteUrl = event.queryStringParameters?.url as string;
      const vodId = event.queryStringParameters?.ids as string;
      if (!siteUrl || !vodId) return { statusCode: 400, body: JSON.stringify({ error: '请提供站点URL和影片ID' }) };
      
      try {
        const detailUrl = `${siteUrl}?ac=videolist&ids=${vodId}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const apiRes = await fetch(detailUrl, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
        clearTimeout(timeout);
        
        if (!apiRes.ok) {
          return { statusCode: 502, body: JSON.stringify({ error: `详情请求失败: HTTP ${apiRes.status}` }) };
        }
        
        const data = await apiRes.json();
        return { statusCode: 200, body: JSON.stringify(data) };
      } catch (e: any) {
        return { statusCode: 502, body: JSON.stringify({ error: '详情请求失败: ' + (e.message || '网络错误') }) };
      }
    }

    // ==========================================
    // Poster Search API (98dou)
    // ==========================================
    
    if (path === '/poster/search' && method === 'GET') {
      const name = event.queryStringParameters?.name || '';
      if (!name) return { statusCode: 400, body: JSON.stringify({ error: '请提供搜索名称' }) };
      
      try {
        const apiUrl = `https://98dou.cn/api.php/provide/vod/?ac=detail&wd=${encodeURIComponent(name)}`;
        const apiRes = await fetch(apiUrl);
        if (!apiRes.ok) return { statusCode: 502, body: JSON.stringify({ error: `海报API请求失败: HTTP ${apiRes.status}` }) };
        const data = await apiRes.json();
        return { statusCode: 200, body: JSON.stringify(data) };
      } catch (e: any) {
        return { statusCode: 502, body: JSON.stringify({ error: '海报搜索失败: ' + e.message }) };
      }
    }

    // Default: 404
    return { statusCode: 404, body: JSON.stringify({ error: 'API 路由未找到' }) };

  } catch (e: any) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || 'Internal Server Error' }) };
  }
};