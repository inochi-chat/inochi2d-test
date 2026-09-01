/* =========================================================
   Inochi2D Payload Module
   ---------------------------------------------------------
   Inochi2D のモデル / モーションデータを読み込んで
   JavaScript で扱える Payload に変換する。
   担当:
   - .inp / .inx のモデル bytes → Puppet Payload
   - JSON / ArrayBuffer / Uint8Array の処理
   - motion JSON の読み込み
   - Payload の基本検証
   - UTF-8 / JSON 抽出
   非担当:
   - Runtime
   - パラメータ適用
   - アニメーション再生
   - 口パク
   - 瞬き
   - 視線
   - 表情
   - Physics
   - Camera
   ========================================================= */
const DEFAULT_TEXT_DECODER =
  typeof TextDecoder !== 'undefined'
    ? new TextDecoder('utf-8')
    : null;
/* ---------------------------------------------------------
   共通
   --------------------------------------------------------- */
const toUint8Array = (value) => {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (
    typeof ArrayBuffer !== 'undefined' &&
    ArrayBuffer.isView(value)
  ) {
    return new Uint8Array(
      value.buffer,
      value.byteOffset,
      value.byteLength,
    );
  }
  throw new TypeError(
    'Expected Uint8Array, ArrayBuffer, or ArrayBuffer view.',
  );
};
const decodeUtf8 = (bytes) => {
  if (!DEFAULT_TEXT_DECODER) {
    throw new Error(
      'TextDecoder is not available in this environment.',
    );
  }
  return DEFAULT_TEXT_DECODER.decode(bytes);
};
const isPlainObject = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value);
const tryParseJson = (text) => {
  if (typeof text !== 'string') {
    return null;
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
};
/* ---------------------------------------------------------
   JSON の候補を探す
   --------------------------------------------------------- */
const findJsonObject = (text) => {
  if (typeof text !== 'string') {
    return null;
  }
  const direct = tryParseJson(text);
  if (direct !== null) {
    return direct;
  }
  /*
   * INP の周辺データなどに余分な bytes がある場合を
   * 考慮して、最初の { / [ から JSON を探す。
   */
  const objectStart = text.indexOf('{');
  const arrayStart = text.indexOf('[');
  let start = -1;
  if (
    objectStart >= 0 &&
    arrayStart >= 0
  ) {
    start = Math.min(
      objectStart,
      arrayStart,
    );
  } else if (objectStart >= 0) {
    start = objectStart;
  } else if (arrayStart >= 0) {
    start = arrayStart;
  }
  if (start < 0) {
    return null;
  }
  /*
   * JSONDecoder が扱える候補を、
   * 後ろから少しずつ広げて探す。
   */
  for (
    let end = text.length;
    end > start;
    end--
  ) {
    const candidate = text.slice(
      start,
      end,
    );
    const parsed =
      tryParseJson(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
};
/* ---------------------------------------------------------
   Puppet Payload 検証
   --------------------------------------------------------- */
const validatePuppetPayload = (
  payload,
) => {
  if (!isPlainObject(payload)) {
    throw new Error(
      'Invalid Inochi2D puppet payload: expected an object.',
    );
  }
  /*
   * 現在のモデルで確認できている基本構造:
   *
   * meta
   * physics
   * nodes
   * param
   * automation
   * animations
   *
   * ただし古い / 新しい形式で一部が存在しない
   * 可能性があるため、ここでは param だけを
   * 強制せず、payload 自体が object なら許可する。
   */
  return payload;
};
/* ---------------------------------------------------------
   Payload の候補キー
   --------------------------------------------------------- */
const getPayloadKeys = (
  payload,
) => {
  if (!isPlainObject(payload)) {
    return [];
  }
  return Object.keys(payload);
};
/* ---------------------------------------------------------
   モデル bytes → Puppet Payload
   --------------------------------------------------------- */
export const decodePuppetPayload = (
  modelBytes,
) => {
  /*
   * すでに object の場合。
   */
  if (isPlainObject(modelBytes)) {
    return validatePuppetPayload(
      modelBytes,
    );
  }
  /*
   * 文字列 JSON の場合。
   */
  if (typeof modelBytes === 'string') {
    const parsed =
      findJsonObject(modelBytes);
    if (parsed === null) {
      throw new Error(
        'Could not decode Inochi2D puppet payload from string.',
      );
    }
    return validatePuppetPayload(
      parsed,
    );
  }
  const bytes =
    toUint8Array(modelBytes);
  /*
   * UTF-8 JSON として直接読める形式。
   */
  const text = decodeUtf8(bytes);
  const parsed =
    findJsonObject(text);
  if (parsed !== null) {
    return validatePuppetPayload(
      parsed,
    );
  }
  /*
   * NULL padding を除去して再試行。
   *
   * Inochi データを調べる際に
   * "Param #0\0" のような NULL が入っている
   * ケースがあったため、Payload 全体の抽出でも
   * 念のため対応する。
   */
  const withoutNull =
    text.replace(/\u0000/g, '');
  const parsedWithoutNull =
    findJsonObject(withoutNull);
  if (parsedWithoutNull !== null) {
    return validatePuppetPayload(
      parsedWithoutNull,
    );
  }
  throw new Error(
    'Could not decode Inochi2D puppet payload from model bytes.',
  );
};
/* ---------------------------------------------------------
   Fetch helper
   --------------------------------------------------------- */
export const fetchBytes = async (
  url,
  {
    fetchImpl =
      typeof fetch === 'function'
        ? fetch
        : null,
  } = {},
) => {
  if (!fetchImpl) {
    throw new Error(
      'fetch is not available in this environment.',
    );
  }
  if (!url) {
    throw new Error(
      'A URL is required.',
    );
  }
  const response =
    await fetchImpl(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch "${url}" (${response.status} ${response.statusText}).`,
    );
  }
  return new Uint8Array(
    await response.arrayBuffer(),
  );
};
/* ---------------------------------------------------------
   JSON URL 読み込み
   --------------------------------------------------------- */
export const loadJsonPayload = async (
  url,
  {
    fetchImpl =
      typeof fetch === 'function'
        ? fetch
        : null,
  } = {},
) => {
  if (!fetchImpl) {
    throw new Error(
      'fetch is not available in this environment.',
    );
  }
  if (!url) {
    throw new Error(
      'A JSON URL is required.',
    );
  }
  const response =
    await fetchImpl(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch JSON "${url}" (${response.status} ${response.statusText}).`,
    );
  }
  const text =
    await response.text();
  const payload =
    tryParseJson(text);
  if (payload === null) {
    throw new Error(
      `Invalid JSON received from "${url}".`,
    );
  }
  return payload;
};
/* ---------------------------------------------------------
   Motion Payload
   --------------------------------------------------------- */
export const loadMotionPayload = async (
  motionUrl,
  {
    fetchImpl =
      typeof fetch === 'function'
        ? fetch
        : null,
  } = {},
) => {
  /*
   * motionUrl がない場合は null。
   *
   * これによりモデルだけ読み込む構成にも対応。
   */
  if (!motionUrl) {
    return null;
  }
  const payload =
    await loadJsonPayload(
      motionUrl,
      { fetchImpl },
    );
  /*
   * Motion の形式は Runtime / Creator の
   * バージョンによって違う可能性があるので、
   * ここでは object / array をそのまま保持する。
   */
  if (
    !isPlainObject(payload) &&
    !Array.isArray(payload)
  ) {
    throw new Error(
      'Invalid Inochi2D motion payload.',
    );
  }
  return payload;
};
/* ---------------------------------------------------------
   Model + Motion 一括ロード
   --------------------------------------------------------- */
export const loadPayloads = async ({
  modelUrl,
  motionUrl = null,
  fetchImpl =
    typeof fetch === 'function'
      ? fetch
      : null,
}) => {
  if (!modelUrl) {
    throw new Error(
      'modelUrl is required.',
    );
  }
  const modelBytes =
    await fetchBytes(
      modelUrl,
      { fetchImpl },
    );
  const puppetPayload =
    decodePuppetPayload(
      modelBytes,
    );
  const motionPayload =
    motionUrl
      ? await loadMotionPayload(
          motionUrl,
          { fetchImpl },
        )
      : null;
  return {
    modelBytes,
    puppetPayload,
    motionPayload,
  };
};
/* ---------------------------------------------------------
   Payload 情報取得
   --------------------------------------------------------- */
export const getPuppetPayloadInfo = (
  payload,
) => {
  const valid =
    isPlainObject(payload);
  if (!valid) {
    return {
      valid: false,
      keys: [],
      parameterCount: 0,
      nodeCount: 0,
      animationCount: 0,
    };
  }
  const parameters =
    Array.isArray(payload.param)
      ? payload.param
      : [];
  const nodes =
    Array.isArray(payload.nodes)
      ? payload.nodes
      : [];
  const animations =
    Array.isArray(payload.animations)
      ? payload.animations
      : isPlainObject(
          payload.animations,
        )
      ? Object.keys(
          payload.animations,
        )
      : [];
  return {
    valid: true,
    keys:
      getPayloadKeys(payload),
    parameterCount:
      parameters.length,
    nodeCount:
      nodes.length,
    animationCount:
      animations.length,
    hasMeta:
      payload.meta !== undefined,
    hasPhysics:
      payload.physics !== undefined,
    hasParameters:
      payload.param !== undefined,
    hasAutomation:
      payload.automation !== undefined,
    hasAnimations:
      payload.animations !== undefined,
  };
};
/* ---------------------------------------------------------
   安全な Parameter 配列取得
   --------------------------------------------------------- */
export const getParameterPayload = (
  payload,
) => {
  if (
    !isPlainObject(payload)
  ) {
    return [];
  }
  if (
    Array.isArray(payload.param)
  ) {
    return payload.param;
  }
  /*
   * 一部形式で param が object の可能性もあるため、
   * object の場合は values を返す。
   */
  if (
    isPlainObject(payload.param)
  ) {
    return Object.values(
      payload.param,
    );
  }
  return [];
};
/* ---------------------------------------------------------
   安全な Node 配列取得
   --------------------------------------------------------- */
export const getNodePayload = (
  payload,
) => {
  if (
    !isPlainObject(payload)
  ) {
    return [];
  }
  if (
    Array.isArray(payload.nodes)
  ) {
    return payload.nodes;
  }
  if (
    isPlainObject(payload.nodes)
  ) {
    return Object.values(
      payload.nodes,
    );
  }
  return [];
};
/* ---------------------------------------------------------
   安全な Animation Payload 取得
   --------------------------------------------------------- */
export const getAnimationPayload = (
  payload,
) => {
  if (
    !isPlainObject(payload)
  ) {
    return [];
  }
  const animations =
    payload.animations;
  if (
    Array.isArray(animations)
  ) {
    return animations;
  }
  if (
    isPlainObject(animations)
  ) {
    return Object.entries(
      animations,
    ).map(
      ([name, value]) => ({
        name,
        ...(
          isPlainObject(value)
            ? value
            : { value }
        ),
      }),
    );
  }
  return [];
};
/* ---------------------------------------------------------
   Debug 用 summary
   --------------------------------------------------------- */
export const getPayloadSummary = (
  puppetPayload,
  motionPayload = null,
) => {
  const puppetInfo =
    getPuppetPayloadInfo(
      puppetPayload,
    );
  return {
    puppet: puppetInfo,
    motion: {
      exists:
        motionPayload !== null,
      type:
        Array.isArray(motionPayload)
          ? 'array'
          : isPlainObject(
              motionPayload,
            )
          ? 'object'
          : motionPayload === null
          ? 'null'
          : typeof motionPayload,
    },
  };
};
/* ---------------------------------------------------------
   Default export
   --------------------------------------------------------- */
export default {
  decodePuppetPayload,
  fetchBytes,
  loadJsonPayload,
  loadMotionPayload,
  loadPayloads,
  getPuppetPayloadInfo,
  getParameterPayload,
  getNodePayload,
  getAnimationPayload,
  getPayloadSummary,
};
