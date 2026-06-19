/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';
import { getCollection, setCollection } from './src/db.js';
import { Movie, User, Admin, AuthSession } from './src/types.js';

const app = express();
const PORT = 3000;

// Enable JSON bodies parsing
app.use(express.json());

// Tiny self-contained cookie-parsing middleware
app.use((req, res, next) => {
  const cookieHeader = req.headers.cookie;
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
  (req as any).cookies = cookies;
  next();
});

// Helper to generate cookies securely
function setSessionCookie(res: express.Response, name: string, token: string, maxAgeSec: number = 86400 * 30) {
  res.setHeader(
    'Set-Cookie',
    `${name}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${maxAgeSec}; SameSite=Strict`
  );
}

function clearSessionCookie(res: express.Response, name: string) {
  res.setHeader(
    'Set-Cookie',
    `${name}=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict`
  );
}

// ==========================================
// Ordinary Viewer Authentication API
// ==========================================

// POST /api/auth/login - Viewer log-in
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名和密码' });
    }

    const users = await getCollection('users');
    const user = users[username];

    if (!user) {
      return res.status(401).json({ error: '观众账号不存在，请联系管理员为您开通' });
    }

    const matches = bcrypt.compareSync(password, user.passwordHash);
    if (!matches) {
      return res.status(401).json({ error: '密码错误' });
    }

    // Create session
    const token = 'viewer_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const sessions = await getCollection('sessions');
    
    sessions[token] = {
      token,
      username,
      role: 'viewer',
      expiresAt: new Date(Date.now() + 86400000 * 30).toISOString() // 30 days
    };
    await setCollection('sessions', sessions);

    // Set HTTP-only cookie
    setSessionCookie(res, 'viewer_session', token);

    res.json({
      success: true,
      user: {
        username: user.username,
        role: 'viewer'
      }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal Server Error' });
  }
});

// POST /api/auth/logout - Viewer logout
app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = (req as any).cookies?.viewer_session;
    if (token) {
      const sessions = await getCollection('sessions');
      delete sessions[token];
      await setCollection('sessions', sessions);
    }
    clearSessionCookie(res, 'viewer_session');
    res.json({ success: true, message: '已成功登出' });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal Server Error' });
  }
});

// GET /api/auth/me - Get current logged-in user profile
app.get('/api/auth/me', async (req, res) => {
  try {
    const viewerToken = (req as any).cookies?.viewer_session;
    const adminToken = (req as any).cookies?.admin_session;

    // First check if logged in as admin/streamer
    if (adminToken) {
      const sessions = await getCollection('sessions');
      const session = sessions[adminToken];
      if (session && (session.role === 'admin' || session.role === 'streamer')) {
        return res.json({
          loggedIn: true,
          user: {
            username: session.username,
            role: session.role
          }
        });
      }
    }

    // Check ordinary viewer
    if (viewerToken) {
      const sessions = await getCollection('sessions');
      const session = sessions[viewerToken];
      if (session && session.role === 'viewer') {
        return res.json({
          loggedIn: true,
          user: {
            username: session.username,
            role: 'viewer'
          }
        });
      }
    }

    res.json({ loggedIn: false });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal Server Error' });
  }
});

// ==========================================
// Movies List Public & Detail Endpoint
// ==========================================

// GET /api/movies - Ordinary movie roster (Without streamUrl to avoid link leak)
app.get('/api/movies', async (req, res) => {
  try {
    const moviesRecord = await getCollection('movies');
    // Map movies list to omit the secret streamUrl for unsigned clients
    const safeMovies = Object.values(moviesRecord).map(({ streamUrl, ...rest }) => rest);
    res.json(safeMovies);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal Server Error' });
  }
});

// GET /api/movies/:id - Get detailed movie info
app.get('/api/movies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const moviesRecord = await getCollection('movies');
    const movie = moviesRecord[id];

    if (!movie) {
      return res.status(404).json({ error: '电影不存在' });
    }

    // Check credentials: Is logged in as viewer OR admin/streamer?
    const viewerToken = (req as any).cookies?.viewer_session;
    const adminToken = (req as any).cookies?.admin_session;
    
    let isAuthorized = false;
    const sessions = await getCollection('sessions');

    if (adminToken && sessions[adminToken] && (sessions[adminToken].role === 'admin' || sessions[adminToken].role === 'streamer')) {
      isAuthorized = true;
    } else if (viewerToken && sessions[viewerToken] && sessions[viewerToken].role === 'viewer') {
      isAuthorized = true;
    }

    if (isAuthorized) {
      // User is authorised: return with the video stream URL
      return res.json({ ...movie, loggedIn: true });
    } else {
      // Not logged in: output everything EXCEPT stream url
      const { streamUrl, ...safeMovie } = movie;
      return res.json({ ...safeMovie, loggedIn: false });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal Server Error' });
  }
});

// ==========================================
// Authorization Middlewares for Admins
// ==========================================

const adminAuthMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const adminToken = (req as any).cookies?.admin_session;
    if (!adminToken) {
      return res.status(401).json({ error: '您尚未登录管理员或直播员账号' });
    }

    const sessions = await getCollection('sessions');
    const session = sessions[adminToken];

    if (!session || (session.role !== 'admin' && session.role !== 'streamer')) {
      return res.status(401).json({ error: '管理员会话无效或已过期' });
    }

    // Bind authenticated payload
    (req as any).adminUser = {
      username: session.username,
      role: session.role
    };

    next();
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal Server Error' });
  }
};

const superadminOnlyMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const adminUser = (req as any).adminUser;
  if (!adminUser || adminUser.role !== 'admin') {
    return res.status(403).json({ error: '该操作仅超级管理员(Admin)有权访问' });
  }
  next();
};

// ==========================================
// Administrative API Endpoints
// ==========================================

// POST /api/admin/login - Backend Log-In
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '请输入管理员账号和密码' });
    }

    const admins = await getCollection('admins');
    const adminAccount = admins[username];

    if (!adminAccount) {
      return res.status(401).json({ error: '管理员或直播员账号不存在' });
    }

    const matches = bcrypt.compareSync(password, adminAccount.passwordHash);
    if (!matches) {
      return res.status(401).json({ error: '密码错误' });
    }

    // Set session in store
    const token = 'admin_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const sessions = await getCollection('sessions');
    
    sessions[token] = {
      token,
      username,
      role: adminAccount.role,
      expiresAt: new Date(Date.now() + 86400000 * 3).toISOString() // 3 days
    };
    await setCollection('sessions', sessions);

    // Set cookie
    setSessionCookie(res, 'admin_session', token);

    res.json({
      success: true,
      user: {
        username: adminAccount.username,
        role: adminAccount.role
      }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal Server Error' });
  }
});

// POST /api/admin/logout - Logs admin profile out
app.post('/api/admin/logout', async (req, res) => {
  try {
    const token = (req as any).cookies?.admin_session;
    if (token) {
      const sessions = await getCollection('sessions');
      delete sessions[token];
      await setCollection('sessions', sessions);
    }
    clearSessionCookie(res, 'admin_session');
    res.json({ success: true, message: '管理后台退出登录成功' });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal Server Error' });
  }
});

// --- ADMIN MOVIES ENDPOINTS (Both Admin and Streamer can read/manipulate movies) ---

// GET /api/admin/movies - List all movies (with secret streams)
app.get('/api/admin/movies', adminAuthMiddleware, async (req, res) => {
  try {
    const moviesRecord = await getCollection('movies');
    res.json(Object.values(moviesRecord));
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal Server Error' });
  }
});

// POST /api/admin/movies - Insert movie item
app.post('/api/admin/movies', adminAuthMiddleware, async (req, res) => {
  try {
    const { title, coverUrl, description, genre, duration, streamUrl } = req.body;
    if (!title || !streamUrl) {
      return res.status(400).json({ error: '电影标题与播放源为必填项' });
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

    res.json({ success: true, movie: newMovie });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal Server Error' });
  }
});

// PUT /api/admin/movies/:id - Edit specific movie
app.put('/api/admin/movies/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, coverUrl, description, genre, duration, streamUrl } = req.body;

    const moviesRecord = await getCollection('movies');
    const existingMovie = moviesRecord[id];

    if (!existingMovie) {
      return res.status(404).json({ error: '电影未找到' });
    }

    const updatedMovie: Movie = {
      ...existingMovie,
      title: title ?? existingMovie.title,
      coverUrl: coverUrl ?? existingMovie.coverUrl,
      description: description ?? existingMovie.description,
      genre: genre ?? existingMovie.genre,
      duration: duration ?? existingMovie.duration,
      streamUrl: streamUrl ?? existingMovie.streamUrl,
      // If the secret URL was updated, reset validity check results
      streamValid: streamUrl !== existingMovie.streamUrl ? null : existingMovie.streamValid,
      streamCheckTime: streamUrl !== existingMovie.streamUrl ? null : existingMovie.streamCheckTime,
      updatedAt: new Date().toISOString()
    };

    moviesRecord[id] = updatedMovie;
    await setCollection('movies', moviesRecord);

    res.json({ success: true, movie: updatedMovie });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal Server Error' });
  }
});

// DELETE /api/admin/movies/:id - Delete item
app.delete('/api/admin/movies/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const moviesRecord = await getCollection('movies');
    
    if (!moviesRecord[id]) {
      return res.status(404).json({ error: '电影未找到' });
    }

    delete moviesRecord[id];
    await setCollection('movies', moviesRecord);

    res.json({ success: true, message: '电影已成功删除' });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal Server Error' });
  }
});

// POST /api/admin/check-stream - Validate movie url stream
app.post('/api/admin/check-stream', adminAuthMiddleware, async (req, res) => {
  try {
    const { url, movieId } = req.body;
    if (!url) {
      return res.status(400).json({ error: '未提供视频源 URL' });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let valid = false;
    let statusCode = 0;
    let statusText = 'Unknown Error';
    let contentType = '';

    try {
      // Fetch with Range: bytes=0-1 as standard practice for checking giant video hosts
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Range': 'bytes=0-1'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      statusCode = response.status;
      statusText = response.statusText;
      contentType = response.headers.get('content-type') || '';
      
      // Standard video responses: OK 200, Partial Content 206 are positive results
      valid = response.ok || statusCode === 206 || (statusCode >= 200 && statusCode < 400);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      statusText = fetchError.name === 'AbortError' ? '连接超时 (5秒)' : (fetchError.message || '请求失败');
    }

    const checkTime = new Date().toISOString();

    // If movieId is provided, save check results back to the database automatically!
    if (movieId) {
      const movies = await getCollection('movies');
      if (movies[movieId]) {
        movies[movieId].streamValid = valid;
        movies[movieId].streamCheckTime = checkTime;
        await setCollection('movies', movies);
      }
    }

    res.json({
      valid,
      statusCode,
      statusText,
      contentType,
      checkedAt: checkTime
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal Server Error' });
  }
});

// --- USER MANAGEMENT ENDPOINTS (Viewer Accounts - Superadmin ONLY) ---

// GET /api/admin/users - List spectators
app.get('/api/admin/users', adminAuthMiddleware, superadminOnlyMiddleware, async (req, res) => {
  try {
    const usersRecord = await getCollection('users');
    // Sanitize viewer accounts by omitting hashes
    const sanitizedUsers = Object.values(usersRecord).map(({ passwordHash, ...rest }) => rest);
    res.json(sanitizedUsers);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal Server Error' });
  }
});

// POST /api/admin/users - Admin register new viewer (No client sign-ups)
app.post('/api/admin/users', adminAuthMiddleware, superadminOnlyMiddleware, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '用户名与密码均为必填项' });
    }

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3) {
      return res.status(400).json({ error: '用户名长度须至少3位字符' });
    }

    const usersRecord = await getCollection('users');
    if (usersRecord[trimmedUsername]) {
      return res.status(400).json({ error: '此用户名已被注册' });
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

    res.json({
      success: true,
      message: '普通观众账号创建成功',
      user: {
        username: trimmedUsername,
        role: 'viewer',
        createdAt: newUser.createdAt
      }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal Server Error' });
  }
});

// DELETE /api/admin/users - Erase spectator account
app.delete('/api/admin/users', adminAuthMiddleware, superadminOnlyMiddleware, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: '未提供欲删除的用户名' });
    }

    const usersRecord = await getCollection('users');
    if (!usersRecord[username]) {
      return res.status(404).json({ error: '观众账号不存在' });
    }

    delete usersRecord[username];
    await setCollection('users', usersRecord);

    res.json({ success: true, message: `观众账号 ${username} 已成功注销删除` });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal Server Error' });
  }
});

// --- STREAMERS MANAGEMENT ENDPOINTS (Streamer Accounts - Superadmin ONLY) ---

// GET /api/admin/streamers - List streamer members
app.get('/api/admin/streamers', adminAuthMiddleware, superadminOnlyMiddleware, async (req, res) => {
  try {
    const adminsRecord = await getCollection('admins');
    // Only display streamer entries, omitting admin entries and hashing info for privacy
    const streamers = Object.values(adminsRecord)
      .filter(item => item.role === 'streamer')
      .map(({ passwordHash, ...rest }) => rest);
    res.json(streamers);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal Server Error' });
  }
});

// POST /api/admin/streamers - Admin registers new streamers (Cannot self-register either)
app.post('/api/admin/streamers', adminAuthMiddleware, superadminOnlyMiddleware, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '用户名与密码均为必填项' });
    }

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3) {
      return res.status(400).json({ error: '用户名长度须至少3位字符' });
    }

    const adminsRecord = await getCollection('admins');
    if (adminsRecord[trimmedUsername]) {
      return res.status(400).json({ error: '此用户名已存在于后台管理员或直播员系统' });
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

    res.json({
      success: true,
      message: '直播员账号创建成功',
      streamer: {
        username: trimmedUsername,
        role: 'streamer',
        createdAt: newStreamer.createdAt
      }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal Server Error' });
  }
});

// DELETE /api/admin/streamers - Remove streamers profile
app.delete('/api/admin/streamers', adminAuthMiddleware, superadminOnlyMiddleware, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: '未提供欲删除的直播员用户名' });
    }

    const adminsRecord = await getCollection('admins');
    const target = adminsRecord[username];
    if (!target) {
      return res.status(404).json({ error: '后台账号不存在' });
    }

    if (target.role === 'admin') {
      return res.status(403).json({ error: '禁止注销超级管理员(Admin)账号' });
    }

    delete adminsRecord[username];
    await setCollection('admins', adminsRecord);

    res.json({ success: true, message: `直播员账号 ${username} 已被注销删除` });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal Server Error' });
  }
});

// ==========================================
// 98dou Poster API Proxy (Chinese movie posters)
// ==========================================

app.get('/api/poster/search', async (req, res) => {
  try {
    const name = req.query.name as string;
    if (!name) return res.status(400).json({ error: '请提供影视名称' });
    const apiUrl = `https://api.98dou.cn/api/img/yshaibao?act=search&name=${encodeURIComponent(name)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const apiRes = await fetch(apiUrl, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
    clearTimeout(timeout);
    if (!apiRes.ok) return res.status(502).json({ error: `海报API请求失败: HTTP ${apiRes.status}` });
    const data = await apiRes.json();
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: '海报搜索失败: ' + e.message });
  }
});

// ==========================================
// TMDB API Proxy (for China accessibility)
// ==========================================

const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

async function tmdbFetch(endpoint: string, params: Record<string, string> = {}): Promise<any> {
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

app.get('/api/tmdb/trending', async (req, res) => {
  try {
    const mediaType = (req.query.media_type as string) || 'all';
    const timeWindow = (req.query.time_window as string) || 'week';
    const page = (req.query.page as string) || '1';
    const data = await tmdbFetch(`/trending/${mediaType}/${timeWindow}`, { page });
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: 'TMDB API 请求失败: ' + e.message });
  }
});

app.get('/api/tmdb/movie/now_playing', async (req, res) => {
  try {
    const page = (req.query.page as string) || '1';
    const data = await tmdbFetch('/movie/now_playing', { page });
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: 'TMDB API 请求失败: ' + e.message });
  }
});

app.get('/api/tmdb/movie/popular', async (req, res) => {
  try {
    const page = (req.query.page as string) || '1';
    const data = await tmdbFetch('/movie/popular', { page });
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: 'TMDB API 请求失败: ' + e.message });
  }
});

app.get('/api/tmdb/tv/popular', async (req, res) => {
  try {
    const page = (req.query.page as string) || '1';
    const data = await tmdbFetch('/tv/popular', { page });
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: 'TMDB API 请求失败: ' + e.message });
  }
});

app.get('/api/tmdb/tv/top_rated', async (req, res) => {
  try {
    const page = (req.query.page as string) || '1';
    const data = await tmdbFetch('/tv/top_rated', { page });
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: 'TMDB API 请求失败: ' + e.message });
  }
});

app.get('/api/tmdb/search', async (req, res) => {
  try {
    const query = req.query.query as string;
    const page = (req.query.page as string) || '1';
    if (!query) return res.status(400).json({ error: '请提供搜索关键词' });
    const data = await tmdbFetch('/search/multi', { query, page });
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: 'TMDB API 请求失败: ' + e.message });
  }
});

app.get('/api/tmdb/movie/:id', async (req, res) => {
  try {
    const data = await tmdbFetch(`/movie/${req.params.id}`, { append_to_response: 'credits,videos,similar' });
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: 'TMDB API 请求失败: ' + e.message });
  }
});

app.get('/api/tmdb/tv/:id', async (req, res) => {
  try {
    const data = await tmdbFetch(`/tv/${req.params.id}`, { append_to_response: 'credits,videos,similar' });
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: 'TMDB API 请求失败: ' + e.message });
  }
});

app.get('/api/tmdb/image/*', async (req, res) => {
  try {
    const imagePath = req.params[0];
    const tmdbUrl = `${TMDB_IMAGE_BASE}/${imagePath}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const imgRes = await fetch(tmdbUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!imgRes.ok) return res.status(imgRes.status).send('Image fetch failed');
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    res.send(buffer);
  } catch (e: any) {
    res.status(502).json({ error: '图片代理获取失败: ' + e.message });
  }
});

// ==========================================
// TVBox Interface Support
// ==========================================

interface TVBoxSite {
  key: string;
  name: string;
  type: number;
  api: string;
  searchable?: number;
  quickSearch?: number;
  filterable?: number;
}

interface TVBoxConfig {
  spider?: string;
  sites: TVBoxSite[];
  wallpaper?: string;
}

app.post('/api/tvbox/parse', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: '请提供TVBox接口地址' });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const configRes = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    clearTimeout(timeout);

    if (!configRes.ok) {
      return res.status(502).json({ error: `获取TVBox配置失败: HTTP ${configRes.status}` });
    }

    let config: TVBoxConfig;
    try {
      const text = await configRes.text();
      config = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: 'TVBox配置JSON解析失败，请检查接口地址是否正确' });
    }

    if (!config.sites || !Array.isArray(config.sites)) {
      return res.status(502).json({ error: 'TVBox配置格式不正确，缺少sites字段' });
    }

    const httpSites = config.sites.filter(s => s.type === 0 || s.type === 1);
    const allSites = config.sites.map(s => ({
      key: s.key,
      name: s.name,
      type: s.type,
      api: s.api,
      searchable: s.searchable ?? 1,
      quickSearch: s.quickSearch ?? 1,
      filterable: s.filterable ?? 1
    }));

    res.json({
      success: true,
      spider: config.spider || '',
      sites: allSites,
      httpSites,
      wallpaper: config.wallpaper || ''
    });
  } catch (e: any) {
    res.status(502).json({ error: '解析TVBox接口失败: ' + e.message });
  }
});

app.get('/api/tvbox/categories', async (req, res) => {
  try {
    const siteUrl = req.query.url as string;
    if (!siteUrl) return res.status(400).json({ error: '请提供站点地址' });

    const apiUrl = siteUrl.endsWith('/')
      ? `${siteUrl}api.php/provide/vod/?ac=list`
      : `${siteUrl}/api.php/provide/vod/?ac=list`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const dataRes = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    clearTimeout(timeout);
    const data = await dataRes.json();
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: '获取分类失败: ' + e.message });
  }
});

app.get('/api/tvbox/list', async (req, res) => {
  try {
    const siteUrl = req.query.url as string;
    const t = req.query.t as string;
    const pg = (req.query.pg as string) || '1';
    if (!siteUrl) return res.status(400).json({ error: '请提供站点地址' });

    let apiUrl = siteUrl.endsWith('/')
      ? `${siteUrl}api.php/provide/vod/?ac=videolist`
      : `${siteUrl}/api.php/provide/vod/?ac=videolist`;
    if (t) apiUrl += `&t=${encodeURIComponent(t)}`;
    apiUrl += `&pg=${pg}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const dataRes = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    clearTimeout(timeout);
    const data = await dataRes.json();
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: '获取列表失败: ' + e.message });
  }
});

app.get('/api/tvbox/detail', async (req, res) => {
  try {
    const siteUrl = req.query.url as string;
    const ids = req.query.ids as string;
    if (!siteUrl || !ids) return res.status(400).json({ error: '请提供站点地址和影片ID' });

    const apiUrl = siteUrl.endsWith('/')
      ? `${siteUrl}api.php/provide/vod/?ac=detail&ids=${ids}`
      : `${siteUrl}/api.php/provide/vod/?ac=detail&ids=${ids}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const dataRes = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    clearTimeout(timeout);
    const data = await dataRes.json();
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: '获取详情失败: ' + e.message });
  }
});

app.get('/api/tvbox/search', async (req, res) => {
  try {
    const siteUrl = req.query.url as string;
    const wd = req.query.wd as string;
    const pg = (req.query.pg as string) || '1';
    if (!siteUrl || !wd) return res.status(400).json({ error: '请提供站点地址和搜索关键词' });

    const apiUrl = siteUrl.endsWith('/')
      ? `${siteUrl}api.php/provide/vod/?ac=detail&wd=${encodeURIComponent(wd)}&pg=${pg}`
      : `${siteUrl}/api.php/provide/vod/?ac=detail&wd=${encodeURIComponent(wd)}&pg=${pg}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const dataRes = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    clearTimeout(timeout);
    const data = await dataRes.json();
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: '搜索失败: ' + e.message });
  }
});

// ==========================================
// Vite Dev Server / Static Assets Assembly
// ==========================================

async function startServer() {
  // Vite server integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[xiaohe影视] Full-stack Server successfully initialized on port ${PORT}`);
  });
}

startServer();