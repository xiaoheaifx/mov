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
    // Video Source Management API (Admin)
    // ==========================================

    if (path === '/admin/video-sources' && method === 'GET') {
      const auth = await adminAuthMiddleware(event);
      if (auth.error) return auth.error;

      const videoSources = await getCollection('videoSources');
      return { statusCode: 200, body: JSON.stringify(Object.values(videoSources)) };
    }

    if (path === '/admin/video-sources' && method === 'POST') {
      const auth = await adminAuthMiddleware(event);
      if (auth.error) return auth.error;

      const { name, key, api, detail } = body;
      if (!name || !key || !api) {
        return { statusCode: 400, body: JSON.stringify({ error: '名称、Key和API地址为必填项' }) };
      }

      const id = 'vs_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
      const videoSources = await getCollection('videoSources');

      const newSource: any = {
        id,
        name,
        key,
        api,
        detail: detail || '',
        type: 0,
        searchable: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      videoSources[id] = newSource;
      await setCollection('videoSources', videoSources);

      return { statusCode: 200, body: JSON.stringify({ success: true, videoSource: newSource }) };
    }

    if (path.match(/^\/admin\/video-sources\/[^/]+$/) && method === 'PUT') {
      const auth = await adminAuthMiddleware(event);
      if (auth.error) return auth.error;

      const id = path.split('/')[3];
      const { name, key, api, detail } = body;

      const videoSources = await getCollection('videoSources');
      const existing = videoSources[id];

      if (!existing) {
        return { statusCode: 404, body: JSON.stringify({ error: '视频源未找到' }) };
      }

      const updated: any = {
        ...existing,
        name: name ?? existing.name,
        key: key ?? existing.key,
        api: api ?? existing.api,
        detail: detail ?? existing.detail,
        updatedAt: new Date().toISOString()
      };

      videoSources[id] = updated;
      await setCollection('videoSources', videoSources);

      return { statusCode: 200, body: JSON.stringify({ success: true, videoSource: updated }) };
    }

    if (path.match(/^\/admin\/video-sources\/[^/]+$/) && method === 'DELETE') {
      const auth = await adminAuthMiddleware(event);
      if (auth.error) return auth.error;

      const id = path.split('/')[3];
      const videoSources = await getCollection('videoSources');

      if (!videoSources[id]) {
        return { statusCode: 404, body: JSON.stringify({ error: '视频源未找到' }) };
      }

      delete videoSources[id];
      await setCollection('videoSources', videoSources);

      return { statusCode: 200, body: JSON.stringify({ success: true, message: '视频源已删除' }) };
    }

    // ==========================================
    // Video Source Public API (for browsing)
    // ==========================================

    if (path === '/video-sources' && method === 'GET') {
      const videoSources = await getCollection('videoSources');
      const safeSources = Object.values(videoSources).map(({ api, detail, ...rest }) => ({
        ...rest,
        api: api,
        detail: detail || ''
      }));
      return { statusCode: 200, body: JSON.stringify(safeSources) };
    }

    // ==========================================
    // Video Source Search & Detail API (Public)
    // ==========================================

    if (path === '/video-sources/search' && method === 'GET') {
      const keyword = event.queryStringParameters?.wd as string;
      const sourceId = event.queryStringParameters?.sourceId as string;
      if (!keyword || !sourceId) {
        return { statusCode: 400, body: JSON.stringify({ error: '请提供搜索关键词和视频源ID' }) };
      }

      const videoSources = await getCollection('videoSources');
      const source = videoSources[sourceId];
      if (!source) {
        return { statusCode: 404, body: JSON.stringify({ error: '视频源不存在' }) };
      }

      try {
        const searchUrl = `${source.api}?ac=videolist&wd=${encodeURIComponent(keyword)}`;
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
        return { statusCode: 502, body: JSON.stringify({ error: '搜索失败: ' + (e.message || '网络错误') }) };
      }
    }

    if (path === '/video-sources/detail' && method === 'GET') {
      const sourceId = event.queryStringParameters?.sourceId as string;
      const vodId = event.queryStringParameters?.ids as string;
      if (!sourceId || !vodId) {
        return { statusCode: 400, body: JSON.stringify({ error: '请提供视频源ID和影片ID' }) };
      }

      const videoSources = await getCollection('videoSources');
      const source = videoSources[sourceId];
      if (!source) {
        return { statusCode: 404, body: JSON.stringify({ error: '视频源不存在' }) };
      }

      try {
        const detailUrl = source.detail
          ? `${source.detail}?ac=videolist&ids=${vodId}`
          : `${source.api}?ac=videolist&ids=${vodId}`;
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
        return { statusCode: 502, body: JSON.stringify({ error: '获取详情失败: ' + (e.message || '网络错误') }) };
      }
    }

    if (path === '/video-sources/all-search' && method === 'GET') {
      const keyword = event.queryStringParameters?.wd as string;
      if (!keyword) {
        return { statusCode: 400, body: JSON.stringify({ error: '请提供搜索关键词' }) };
      }

      const videoSources = await getCollection('videoSources');
      const allSources = Object.values(videoSources);
      const results: any[] = [];

      const searchPromises = allSources.map(async (source: any) => {
        try {
          const searchUrl = `${source.api}?ac=videolist&wd=${encodeURIComponent(keyword)}`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const apiRes = await fetch(searchUrl, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
          clearTimeout(timeout);

          if (!apiRes.ok) return;
          const data = await apiRes.json();
          if (data.list && Array.isArray(data.list)) {
            data.list.forEach((item: any) => {
              results.push({
                ...item,
                sourceKey: source.key,
                sourceName: source.name,
                sourceId: source.id
              });
            });
          }
        } catch {
          // Silently skip failed sources
        }
      });

      await Promise.allSettled(searchPromises);
      return { statusCode: 200, body: JSON.stringify({ list: results, total: results.length }) };
    }

    // ==========================================
    // TV Live Stream Sources Management
    // ==========================================

    // GET /admin/live-sources - List all live sources
    if (path === '/admin/live-sources' && method === 'GET') {
      const auth = await adminAuthMiddleware(event);
      if (auth.error) return auth.error;

      const liveSources = await getCollection('liveSources');
      return { statusCode: 200, body: JSON.stringify(Object.values(liveSources)) };
    }

    // POST /admin/live-sources - Add live source
    if (path === '/admin/live-sources' && method === 'POST') {
      const auth = await adminAuthMiddleware(event);
      if (auth.error) return auth.error;

      const { name, type, url, group } = body;
      if (!name || !type || !url) {
        return { statusCode: 400, body: JSON.stringify({ error: '名称、类型和URL为必填项' }) };
      }

      const liveSources = await getCollection('liveSources');
      const id = `live_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const newSource: any = {
        id,
        name,
        type, // 'm3u' or 'txt'
        url,
        group: group || '',
        channels: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      liveSources[id] = newSource;
      await setCollection('liveSources', liveSources);

      return { statusCode: 200, body: JSON.stringify({ success: true, liveSource: newSource }) };
    }

    // PUT /admin/live-sources/:id - Update live source
    if (path.match(/^\/admin\/live-sources\/[^/]+$/) && method === 'PUT') {
      const auth = await adminAuthMiddleware(event);
      if (auth.error) return auth.error;

      const id = path.split('/')[3];
      const { name, type, url, group } = body;

      const liveSources = await getCollection('liveSources');
      const existing = liveSources[id];

      if (!existing) {
        return { statusCode: 404, body: JSON.stringify({ error: '直播源未找到' }) };
      }

      const updated: any = {
        ...existing,
        name: name ?? existing.name,
        type: type ?? existing.type,
        url: url ?? existing.url,
        group: group ?? existing.group,
        updatedAt: new Date().toISOString()
      };

      liveSources[id] = updated;
      await setCollection('liveSources', liveSources);

      return { statusCode: 200, body: JSON.stringify({ success: true, liveSource: updated }) };
    }

    // DELETE /admin/live-sources/:id - Delete live source
    if (path.match(/^\/admin\/live-sources\/[^/]+$/) && method === 'DELETE') {
      const auth = await adminAuthMiddleware(event);
      if (auth.error) return auth.error;

      const id = path.split('/')[3];
      const liveSources = await getCollection('liveSources');

      if (!liveSources[id]) {
        return { statusCode: 404, body: JSON.stringify({ error: '直播源未找到' }) };
      }

      delete liveSources[id];
      await setCollection('liveSources', liveSources);

      return { statusCode: 200, body: JSON.stringify({ success: true, message: '直播源已删除' }) };
    }

    // GET /live-sources - Public API to get all live sources
    if (path === '/live-sources' && method === 'GET') {
      const liveSources = await getCollection('liveSources');
      return { statusCode: 200, body: JSON.stringify(Object.values(liveSources)) };
    }

    // POST /live-sources/parse - Parse M3U or TXT live source
    if (path === '/live-sources/parse' && method === 'POST') {
      const { url, type } = body;
      if (!url) {
        return { statusCode: 400, body: JSON.stringify({ error: '请提供直播源URL' }) };
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        
        const res = await fetch(url, { 
          signal: controller.signal,
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        clearTimeout(timeout);

        if (!res.ok) {
          return { statusCode: 502, body: JSON.stringify({ error: `直播源请求失败: HTTP ${res.status}` }) };
        }

        const content = await res.text();
        const channels: any[] = [];

        if (type === 'm3u' || content.startsWith('#EXTM3U')) {
          // Parse M3U format
          const lines = content.split('\n');
          let currentChannel: any = null;

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('#EXTINF:')) {
              // Parse channel info
              const nameMatch = trimmed.match(/,(.+)$/);
              const groupMatch = trimmed.match(/group-title="([^"]*)"/);
              const logoMatch = trimmed.match(/tvg-logo="([^"]*)"/);
              
              currentChannel = {
                name: nameMatch ? nameMatch[1].trim() : '未知频道',
                group: groupMatch ? groupMatch[1] : '',
                logo: logoMatch ? logoMatch[1] : '',
                url: ''
              };
            } else if (trimmed && !trimmed.startsWith('#') && currentChannel) {
              currentChannel.url = trimmed;
              channels.push(currentChannel);
              currentChannel = null;
            }
          }
        } else {
          // Parse TXT format (group,#genre# and channel,url)
          const lines = content.split('\n');
          let currentGroup = '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed.includes(',#genre#')) {
              currentGroup = trimmed.replace(',#genre#', '').trim();
            } else if (trimmed.includes(',')) {
              const parts = trimmed.split(',');
              if (parts.length >= 2) {
                channels.push({
                  name: parts[0].trim(),
                  group: currentGroup,
                  url: parts.slice(1).join(',').trim(),
                  logo: ''
                });
              }
            }
          }
        }

        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            channels,
            total: channels.length
          })
        };
      } catch (e: any) {
        return { statusCode: 502, body: JSON.stringify({ error: `直播源解析失败: ${e.message || '网络错误'}` }) };
      }
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
        // Fix URL encoding for Chinese characters
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(url);
        } catch (urlErr) {
          // Try to encode the URL properly
          try {
            const encodedUrl = encodeURI(url);
            parsedUrl = new URL(encodedUrl);
          } catch (encodeErr) {
            return { statusCode: 400, body: JSON.stringify({ error: '接口地址格式不正确，请检查URL是否有效' }) };
          }
        }
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        
        // Use more browser-like headers to avoid being blocked
        const apiRes = await fetch(parsedUrl.toString(), { 
          signal: controller.signal, 
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Referer': parsedUrl.origin
          },
          redirect: 'follow'
        });
        clearTimeout(timeout);
        
        if (!apiRes.ok) {
          return { statusCode: 502, body: JSON.stringify({ error: `TVBox接口请求失败: HTTP ${apiRes.status} ${apiRes.statusText}` }) };
        }
        
        let config: any;
        try {
          const text = await apiRes.text();
          // Clean up BOM, whitespace, and try to extract JSON
          let cleanText = text.trim().replace(/^\uFEFF/, '');
          
          // Try to find JSON in the response (handle cases where there's extra content)
          const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            cleanText = jsonMatch[0];
          }
          
          config = JSON.parse(cleanText);
        } catch (parseErr: any) {
          return { statusCode: 502, body: JSON.stringify({ error: `TVBox配置JSON解析失败: ${parseErr.message}。请确认接口地址返回的是有效的JSON格式。` }) };
        }

        if (!config.sites || !Array.isArray(config.sites)) {
          return { statusCode: 502, body: JSON.stringify({ error: 'TVBox配置格式不正确，缺少sites字段。请确认这是有效的TVBox接口地址。' }) };
        }

        // Filter and categorize sites
        const allSites = config.sites.map((s: any) => ({
          key: s.key,
          name: s.name,
          type: s.type,
          api: s.api,
          detail: s.ext || '',
          searchable: s.searchable ?? 1,
          quickSearch: s.quickSearch ?? 1,
          filterable: s.filterable ?? 1
        }));

        // Only include CMS sites (type 0 or 1) that support searching
        const cmsSites = config.sites.filter((s: any) => 
          (s.type === 0 || s.type === 1) && 
          s.api && 
          (s.searchable === undefined || s.searchable === 1)
        ).map((s: any) => ({
          key: s.key,
          name: s.name,
          type: s.type,
          api: s.api,
          detail: s.ext || '',
          searchable: s.searchable ?? 1,
          quickSearch: s.quickSearch ?? 1,
          filterable: s.filterable ?? 1
        }));

        // Count Spider sites for info
        const spiderCount = config.sites.filter((s: any) => s.type === 3 || s.type === 4).length;

        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            spider: config.spider || '',
            sites: allSites,
            cmsSites,
            spiderCount,
            wallpaper: config.wallpaper || ''
          })
        };
      } catch (e: any) {
        return { statusCode: 502, body: JSON.stringify({ error: `TVBox接口解析失败: ${e.message || '网络错误'}。请检查接口地址是否有效，或接口服务器是否可访问。` }) };
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