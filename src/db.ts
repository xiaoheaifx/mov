/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { Movie, User, Admin, AuthSession } from './types.js';

// We dynamically load @netlify/blobs to avoid runtime errors if not on Netlify
let getStore: any = null;
let blobsInitialized = false;

async function initBlobs() {
  if (blobsInitialized) return;
  blobsInitialized = true;
  try {
    const blobsModule = await import('@netlify/blobs');
    getStore = blobsModule.getStore;
  } catch (e) {
    console.log('Netlify Blobs not available natively in this environment, using local fallback.');
  }
}

// Check if running on Netlify using available environment variables
function isNetlify(): boolean {
  return !!(
    process.env.NETLIFY || 
    process.env.NETLIFY_LOCAL || 
    process.env.NETLIFY_BLOBS_TOKEN ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.AWS_LAMBDA_FUNCTION_VERSION ||
    process.env.AWS_EXECUTION_ENV
  );
}

const LOCAL_DB_PATH = path.join(process.cwd(), 'data', 'db.json');

// Memory cache + local file-based database for fallback / local development
interface LocalDBStructure {
  users: Record<string, User>;
  admins: Record<string, Admin>;
  sessions: Record<string, AuthSession>;
  movies: Record<string, Movie>;
}

// Initial placeholder Movies to make the app interactive and delightful
const INITIAL_MOVIES: Record<string, Movie> = {
  '1': {
    id: '1',
    title: '大雄兔 (Big Buck Bunny)',
    coverUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&q=80',
    description: '一只巨大的兔子遭到了三只无赖地松鼠的挑衅，它决定用智慧也一些巧妙的陷阱做出反击。这是一部经典的开源三维动画电影。',
    genre: '动画 / 喜剧',
    duration: '10 分钟',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    streamValid: true,
    streamCheckTime: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  '2': {
    id: '2',
    title: '钢铁之泪 (Tears of Steel)',
    coverUrl: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=800&q=80',
    description: '发生在阿姆斯特丹的一部科幻电影。一群科学工作者试图通过旧技术拯救世界，防止巨型机器人的入侵，包含令人炫目的粒子特效。',
    genre: '科幻 / 动作',
    duration: '12 分钟',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    streamValid: true,
    streamCheckTime: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  '3': {
    id: '3',
    title: '辛特尔 (Sintel)',
    coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&q=80',
    description: '一个年轻的女孩辛特尔收养了一只受伤的小龙，并成了形影不离的好友。然而小龙某天被一只恶龙抓走，她踏上了漫长的寻找与救赎旅程。',
    genre: '奇幻 / 冒险',
    duration: '15 分钟',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    streamValid: true,
    streamCheckTime: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  '4': {
    id: '4',
    title: '测试 m3u8 直播源 (M3U8 Live)',
    coverUrl: 'https://images.unsplash.com/photo-1542204172-e7052809f852?w=800&q=80',
    description: '一个稳定的 HTTP Live Streaming (HLS) 视频流，包含点播与直播源测试，用于演示网站的 m3u8 兼容播放器和自适应流媒体功能。',
    genre: '演示 / 视频流',
    duration: '24小时直播',
    streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    streamValid: true,
    streamCheckTime: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
};

let localDBCache: LocalDBStructure = {
  users: {},
  admins: {},
  sessions: {},
  movies: INITIAL_MOVIES
};

// Seed the admin account in memory (always, even on Netlify)
function seedAdminAccount() {
  const adminUsername = process.env.ADMIN_USERNAME || 'xiaohe';
  let adminHash = process.env.ADMIN_PASSWORD_HASH;
  if (!adminHash) {
    const plainPassword = process.env.ADMIN_PASSWORD || 'xiaohe@5200';
    const salt = bcrypt.genSaltSync(10);
    adminHash = bcrypt.hashSync(plainPassword, salt);
  }
  localDBCache.admins[adminUsername] = {
    username: adminUsername,
    passwordHash: adminHash,
    role: 'admin',
    createdAt: new Date().toISOString()
  };
}

// Ensure data folder and file exist for local fallback
function initLocalDB() {
  // Always seed the admin account in memory, even on Netlify
  seedAdminAccount();

  // Skip local file operations on Netlify (read-only filesystem)
  if (isNetlify()) {
    return;
  }

  try {
    const dir = path.dirname(LOCAL_DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e) {
    // Silently fail on read-only filesystems
    return;
  }
  
  if (fs.existsSync(LOCAL_DB_PATH)) {
    try {
      const content = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
      const loaded = JSON.parse(content);
      localDBCache = {
        users: loaded.users || {},
        admins: loaded.admins || {},
        sessions: loaded.sessions || {},
        movies: loaded.movies && Object.keys(loaded.movies).length > 0 ? loaded.movies : INITIAL_MOVIES
      };
    } catch (e) {
      console.error('Error reading local db file, resetting to basic defaults.', e);
    }
  }
  
  saveLocalDB();
}

function saveLocalDB() {
  try {
    const dir = path.dirname(LOCAL_DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(localDBCache, null, 2), 'utf-8');
  } catch (e) {
    // Silently fail on read-only filesystems (Netlify)
  }
}

// Database helper functions supporting both modes
export async function getCollection<T extends keyof LocalDBStructure>(collection: T): Promise<LocalDBStructure[T]> {
  await initBlobs();
  if (isNetlify() && getStore && process.env.SITE_ID) {
    try {
      const store = getStore({ name: 'xiaohe-movies', siteID: process.env.SITE_ID });
      const data = await store.get(collection, { type: 'json' });
      if (data) {
        return data as LocalDBStructure[T];
      }
    } catch (e) {
      console.error(`Netlify Blobs fetching failed for ${collection}, using memory cache:`, e);
    }
  }
  
  // Ensure local DB is initialized and return cache
  if (Object.keys(localDBCache.admins).length === 0) {
    initLocalDB();
  }
  return localDBCache[collection];
}

export async function setCollection<T extends keyof LocalDBStructure>(collection: T, data: LocalDBStructure[T]): Promise<void> {
  // Update cache
  localDBCache[collection] = data;
  
  await initBlobs();
  if (isNetlify() && getStore && process.env.SITE_ID) {
    try {
      const store = getStore({ name: 'xiaohe-movies', siteID: process.env.SITE_ID });
      await store.setJSON(collection, data);
      return;
    } catch (e) {
      console.error(`Netlify Blobs setting failed for ${collection}, using local file fallback:`, e);
    }
  }
  
  // Skip local file save on Netlify
  if (!isNetlify()) {
    initLocalDB();
    saveLocalDB();
  }
}

// Seeding standard initial DB setup on module load
// Completely skip on serverless environments to avoid filesystem errors
// Database will be lazily initialized when getCollection/setCollection is called