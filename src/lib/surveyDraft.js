/**
 * 本地草稿（draft）/ 待补交队列（pending）管理
 *
 * 解决两个问题：
 *  1. 中途刷新 / 浏览器崩溃 → 凭参与者 ID 恢复到上次答到的位置
 *  2. 断网时提交失败 → 数据先落本机，恢复网络后自动补交
 *
 * ⚠️ 重要：草稿必须连 imageTracker（每道题的图片分配）一起存。
 * 本平台的街景图片是运行时随机分配的，如果只恢复答案、重新随机图片，
 * data 里的 "image_3" 会映射到另一张图，造成 shown_images 与答案错位，
 * 且事后无法发现。所以恢复时要用草稿的分配结果覆盖回去。
 *
 * 存储结构：
 *  svi_draft_v1:{projectId}:{userId}   → { schemaVersion, savedAt, currentPageNo, data, imageTracker, uiState }
 *  svi_pending_v1:{projectId}:{userId} → { schemaVersion, savedAt, payload }
 */

import { deploymentConfig } from '../config/deploymentConfig';

// 问卷结构变化时递增，旧草稿会自动失效，避免用旧结构套新题
const SCHEMA_VERSION = 1;

const PROJECT_ID = (deploymentConfig && deploymentConfig.id) || 'default';
const DRAFT_PREFIX = `svi_draft_v1:${PROJECT_ID}:`;
const PENDING_PREFIX = `svi_pending_v1:${PROJECT_ID}:`;

// 未答完的草稿保留 7 天
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// 已答完但未成功入库的数据保留 14 天（比草稿长，避免断网用户白答）
export const PENDING_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const isBrowser =
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

// localStorage 在 Safari 无痕模式或被禁用时会直接抛异常，这里先探测一次
export const hasLocalStorage = (() => {
  if (!isBrowser) return false;
  try {
    const probe = '__svi_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch (e) {
    return false;
  }
})();

function readJSON(key) {
  if (!hasLocalStorage) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[surveyDraft] 本地缓存读取失败，已忽略:', key, e);
    return null;
  }
}

function writeJSON(key, value) {
  if (!hasLocalStorage) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    // 超配额 / 隐私模式：静默降级为"不缓存"，不能影响答题
    console.warn('[surveyDraft] 本地缓存写入失败:', key, e);
    return false;
  }
}

function removeKey(key) {
  if (!hasLocalStorage) return;
  try {
    window.localStorage.removeItem(key);
  } catch (e) {
    /* ignore */
  }
}

/**
 * 归一化参与者 ID。
 * 中文输入法下极易产出全角数字（１００３）和全角/首尾空格，
 * 若不归一化，"1003" 与 "１００３" 会成为两个 key：
 * 草稿恢复失败、覆盖失效、数据库出现同一人两条记录。
 */
export function normalizeUserId(raw) {
  if (raw === null || raw === undefined) return '';
  return String(raw)
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ')
    .trim();
}

export function draftKey(userId) {
  return DRAFT_PREFIX + normalizeUserId(userId);
}

export function pendingKey(userId) {
  return PENDING_PREFIX + normalizeUserId(userId);
}

/** 保存未完成作答快照 */
export function saveDraft(userId, snapshot) {
  const uid = normalizeUserId(userId);
  if (!uid || !snapshot) return false;
  return writeJSON(draftKey(uid), {
    schemaVersion: SCHEMA_VERSION,
    savedAt: Date.now(),
    currentPageNo: snapshot.currentPageNo,
    data: snapshot.data || {},
    imageTracker: snapshot.imageTracker || {},
    uiState: snapshot.uiState,
  });
}

/** 读取草稿；过期或结构版本不符会被自动清除并返回 null */
export function loadDraft(userId) {
  const uid = normalizeUserId(userId);
  if (!uid) return null;
  const draft = readJSON(draftKey(uid));
  if (!draft) return null;
  if (draft.schemaVersion !== SCHEMA_VERSION) {
    removeKey(draftKey(uid));
    return null;
  }
  if (!draft.savedAt || Date.now() - draft.savedAt > DRAFT_TTL_MS) {
    removeKey(draftKey(uid));
    return null;
  }
  return draft;
}

export function clearDraft(userId) {
  const uid = normalizeUserId(userId);
  if (!uid) return;
  removeKey(draftKey(uid));
}

/** 保存"已答完但未成功入库"的完整提交数据 */
export function savePending(userId, payload) {
  const uid = normalizeUserId(userId);
  if (!uid || !payload) return false;
  return writeJSON(pendingKey(uid), {
    schemaVersion: SCHEMA_VERSION,
    savedAt: Date.now(),
    payload,
  });
}

export function clearPending(userId) {
  const uid = normalizeUserId(userId);
  if (!uid) return;
  removeKey(pendingKey(uid));
}

export function loadPending(userId) {
  const uid = normalizeUserId(userId);
  if (!uid) return null;
  const record = readJSON(pendingKey(uid));
  if (!record || record.schemaVersion !== SCHEMA_VERSION || !record.payload) return null;
  if (record.savedAt && Date.now() - record.savedAt > PENDING_TTL_MS) {
    removeKey(pendingKey(uid));
    return null;
  }
  return record;
}

/**
 * 列出所有待补交记录（用于进入页面时静默重试）。
 * 先收集 key 再处理，避免边遍历边删除导致漏项。
 */
export function listPending() {
  const result = [];
  if (!hasLocalStorage) return result;

  const keys = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.indexOf(PENDING_PREFIX) === 0) keys.push(key);
    }
  } catch (e) {
    console.warn('[surveyDraft] 枚举本地缓存失败:', e);
    return result;
  }

  const now = Date.now();
  keys.forEach((key) => {
    const record = readJSON(key);
    if (!record || record.schemaVersion !== SCHEMA_VERSION || !record.payload) {
      removeKey(key);
      return;
    }
    if (record.savedAt && now - record.savedAt > PENDING_TTL_MS) {
      removeKey(key);
      return;
    }
    result.push({
      userId: key.slice(PENDING_PREFIX.length),
      payload: record.payload,
      savedAt: record.savedAt,
    });
  });

  return result;
}
