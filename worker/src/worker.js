const VWORLD_ADDRESS_URL = "https://api.vworld.kr/req/address";
const VWORLD_SEARCH_URL = "https://api.vworld.kr/req/search";
const VWORLD_DATA_URL = "https://api.vworld.kr/req/data";
const KAKAO_KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";
const KAKAO_ADDRESS_URL = "https://dapi.kakao.com/v2/local/search/address.json";
const MOLIT_ENDPOINTS = [
  "https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo",
  "https://apis.data.go.kr/1613000/BldRgstService_v2/getBrTitleInfo",
];

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      const status = Number(error?.status || 500);
      return json({ detail: maskSecretText(String(error?.message || error), env) }, status, request, env);
    }
  },
};

async function handleRequest(request, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") {
    return corsPreflight(request, env);
  }
  if (!url.pathname.startsWith("/api/")) {
    return json({ ok: true, service: "RE:VALUE MATRIX API" }, 200, request, env);
  }
  requireSiteToken(request, env);
  if (url.pathname === "/api/health" && request.method === "GET") {
    return json({
      ok: true,
      mode: "github-pages + cloudflare-worker",
      vworld: Boolean(env.VWORLD_API_KEY),
      kakao: Boolean(env.KAKAO_REST_API_KEY),
      molit: Boolean(env.MOLIT_BUILDING_API_KEY || env.DATA_GO_KR_API_KEY),
      site_token: Boolean(env.SITE_ACCESS_TOKEN),
    }, 200, request, env);
  }
  if (url.pathname === "/api/search" && request.method === "GET") {
    return json(await searchBuildings(url.searchParams.get("q") || "", env), 200, request, env);
  }
  if (url.pathname === "/api/analyze" && request.method === "POST") {
    return json(await analyzeBuilding(await request.json(), env), 200, request, env);
  }
  return json({ detail: "요청 경로를 찾지 못했습니다." }, 404, request, env);
}

function requireSiteToken(request, env) {
  const expected = String(env.SITE_ACCESS_TOKEN || "").trim();
  if (!expected) {
    throw new HttpError(503, "SITE_ACCESS_TOKEN이 Worker Secret에 설정되어 있지 않습니다.");
  }
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ")
    ? auth.slice("Bearer ".length).trim()
    : (request.headers.get("X-REVALUE-SITE-TOKEN") || "").trim();
  if (!token) {
    throw new HttpError(401, "접속 코드가 필요합니다.");
  }
  if (token !== expected) {
    throw new HttpError(401, "접속 코드가 맞지 않습니다.");
  }
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .map(normalizeOrigin)
    .filter(Boolean);
  const requestOrigin = normalizeOrigin(origin);
  const allowOrigin = allowed.length === 0
    ? requestOrigin || "*"
    : allowed.includes(requestOrigin)
      ? requestOrigin
      : allowed[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,X-REVALUE-SITE-TOKEN",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
}

function normalizeOrigin(value) {
  const text = String(value || "").trim().replace(/\/+$/, "");
  if (!text) return "";
  try {
    return new URL(text).origin;
  } catch {
    return text;
  }
}

function corsPreflight(request, env) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

function json(data, status, request, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request, env),
    },
  });
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function cleanHtml(value) {
  return String(value || "").replace(/<.*?>/g, "").trim();
}

function toNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(String(value).replaceAll(",", ""));
  return Number.isFinite(number) ? number : fallback;
}

function toInt(value, fallback = null) {
  const number = toNumber(value);
  return number === null ? fallback : Math.trunc(number);
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function avg(values) {
  const clean = values.map(Number).filter(Number.isFinite);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
}

function levenshteinRatio(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, index) => index);
  let curr = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }
  const distance = prev[b.length];
  return 1 - distance / Math.max(a.length, b.length);
}

function similarityPercent(query, ...values) {
  const needle = cleanHtml(query).toLowerCase().replace(/\s+/g, "");
  if (!needle) return 0;
  let best = 0;
  for (const value of values) {
    const text = cleanHtml(value).toLowerCase().replace(/\s+/g, "");
    if (!text) continue;
    best = Math.max(best, text.includes(needle) ? 100 : levenshteinRatio(needle, text) * 100);
  }
  return Math.round(best);
}

function looksLikeAddress(query) {
  const text = String(query || "").trim();
  if (!text) return false;
  if (/[0-9]/.test(text)) return true;
  return (
    /(?:특별시|광역시|특별자치시|특별자치도|도)\s*\S+(?:시|군|구)/.test(text) ||
    /(?:시|군|구)\s+\S+(?:읍|면|동|로|길)/.test(text) ||
    /(?:로|길)\s*\d+/.test(text) ||
    /(?:번지|산)\s*\d+/.test(text)
  );
}

function maskSecretText(text, env) {
  let out = String(text || "");
  for (const value of [
    env?.SITE_ACCESS_TOKEN,
    env?.VWORLD_API_KEY,
    env?.KAKAO_REST_API_KEY,
    env?.MOLIT_BUILDING_API_KEY,
    env?.DATA_GO_KR_API_KEY,
  ]) {
    if (value && String(value).length >= 6) out = out.replaceAll(String(value), "***");
  }
  return out.replace(/([?&](?:key|apikey|api_key|serviceKey|service_key)=)[^&\s]+/gi, "$1***");
}

function retryableStatus(status) {
  return [0, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524].includes(Number(status));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, params, env, options = {}) {
  const requestUrl = new URL(url);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") requestUrl.searchParams.set(key, value);
  });
  const retries = Number(options.retries || 0);
  const retryDelayMs = Number(options.retryDelayMs || 250);
  let lastResult = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(requestUrl.toString(), {
        headers: {
          "Accept": "application/json",
          "User-Agent": "REVALUE-MATRIX-Worker/1.0",
          ...(options.headers || {}),
        },
      });
      const text = await response.text();
      try {
        lastResult = { status: response.status, data: JSON.parse(text), url: maskSecretText(requestUrl.toString(), env) };
      } catch {
        lastResult = {
          status: response.status,
          data: { response: { status: "ERROR", error: { code: "NON_JSON_RESPONSE", text: maskSecretText(text.slice(0, 500), env) } } },
          url: maskSecretText(requestUrl.toString(), env),
        };
      }
    } catch (error) {
      lastResult = {
        status: 0,
        data: { response: { status: "ERROR", error: { code: "FETCH_FAILED", text: maskSecretText(String(error?.message || error), env) } } },
        url: maskSecretText(requestUrl.toString(), env),
      };
    }
    if (attempt < retries && retryableStatus(lastResult.status)) {
      await sleep(retryDelayMs * (attempt + 1));
      continue;
    }
    return lastResult;
  }
  return lastResult;
}

function responseError(data) {
  if (data?.detail) return String(data.detail);
  const response = data?.response || {};
  const error = response.error || {};
  const code = error.code || response.status || "UNKNOWN";
  const text = error.text || "응답 본문에서 오류 메시지를 찾지 못했습니다.";
  return `${code} - ${code === "NOT_FOUND" ? "검색 결과가 없습니다. 표현을 바꿔 시도해 주세요." : text}`;
}

async function vworldSearch(query, searchType, env) {
  if (!env.VWORLD_API_KEY) return { candidates: [], log: "VWORLD_API_KEY가 Worker Secret에 없습니다." };
  const { status, data, url } = await fetchJson(VWORLD_SEARCH_URL, {
    service: "search",
    request: "search",
    version: "2.0",
    crs: "epsg:4326",
    size: "10",
    page: "1",
    query,
    type: searchType,
    format: "json",
    errorformat: "json",
    key: env.VWORLD_API_KEY,
  }, env, { retries: 2, retryDelayMs: 350 });
  const response = data?.response || {};
  if (status !== 200 || response.status !== "OK") {
    return { candidates: [], log: `VWorld ${searchType} 검색 실패: HTTP ${status} / ${responseError(data)} / ${url}` };
  }
  const items = response?.result?.items || [];
  const candidates = items.map((item) => {
    const addressValue = item.address || {};
    const roadAddress = typeof addressValue === "object" ? addressValue.road || "" : "";
    const parcelAddress = typeof addressValue === "object" ? addressValue.parcel || "" : String(addressValue || "");
    const title = cleanHtml(item.title || query);
    const lon = toNumber(item?.point?.x);
    const lat = toNumber(item?.point?.y);
    return {
      title,
      address: roadAddress || parcelAddress,
      road_address: roadAddress,
      parcel_address: parcelAddress,
      lon,
      lat,
      source: searchType === "place" ? "장소" : "주소",
      match_score: similarityPercent(query, title, roadAddress, parcelAddress),
      raw: item,
    };
  });
  return { candidates, log: "OK" };
}

async function vworldCoordSearch(query, addressType, env) {
  if (!env.VWORLD_API_KEY) return { candidates: [], log: "VWORLD_API_KEY가 Worker Secret에 없습니다." };
  const { status, data, url } = await fetchJson(VWORLD_ADDRESS_URL, {
    service: "address",
    request: "getcoord",
    version: "2.0",
    crs: "epsg:4326",
    address: query,
    refine: "true",
    simple: "false",
    format: "json",
    errorformat: "json",
    type: addressType,
    key: env.VWORLD_API_KEY,
  }, env, { retries: 2, retryDelayMs: 350 });
  const response = data?.response || {};
  const point = response?.result?.point || {};
  const lon = toNumber(point.x);
  const lat = toNumber(point.y);
  if (status !== 200 || response.status !== "OK" || lon === null || lat === null) {
    return { candidates: [], log: `VWorld ${addressType} 좌표검색 실패: HTTP ${status} / ${responseError(data)} / ${url}` };
  }
  const refinedText = cleanHtml(response?.refined?.text || query);
  return {
    candidates: [{
      title: refinedText,
      address: refinedText,
      road_address: addressType === "road" ? refinedText : "",
      parcel_address: addressType === "parcel" ? refinedText : "",
      lon,
      lat,
      source: addressType === "road" ? "도로명 좌표" : "지번 좌표",
      match_score: similarityPercent(query, refinedText),
      raw: response,
    }],
    log: "OK",
  };
}

async function kakaoSearch(query, searchType, env) {
  if (!env.KAKAO_REST_API_KEY) return { candidates: [], log: "KAKAO_REST_API_KEY가 Worker Secret에 없습니다." };
  const url = searchType === "address" ? KAKAO_ADDRESS_URL : KAKAO_KEYWORD_URL;
  const { status, data } = await fetchJson(url, {
    query,
    size: "10",
  }, env, {
    retries: 1,
    retryDelayMs: 250,
    headers: { Authorization: `KakaoAK ${env.KAKAO_REST_API_KEY}` },
  });
  if (status !== 200 || !Array.isArray(data?.documents)) {
    return { candidates: [], log: `Kakao ${searchType} 검색 실패: HTTP ${status}` };
  }
  const candidates = data.documents.map((item) => {
    const title = cleanHtml(item.place_name || item.road_address?.building_name || item.address_name || query);
    const roadAddress = cleanHtml(item.road_address_name || item.road_address?.address_name || "");
    const parcelAddress = cleanHtml(item.address_name || item.address?.address_name || "");
    const lon = toNumber(item.x);
    const lat = toNumber(item.y);
    return {
      title,
      address: roadAddress || parcelAddress,
      road_address: roadAddress,
      parcel_address: parcelAddress,
      lon,
      lat,
      source: searchType === "address" ? "Kakao 주소" : "Kakao 장소",
      match_score: similarityPercent(query, title, roadAddress, parcelAddress),
      raw: item,
    };
  });
  return { candidates, log: "OK" };
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  const result = [];
  for (const candidate of candidates) {
    const key = [
      candidate.title || "",
      candidate.road_address || "",
      candidate.parcel_address || "",
      Number(candidate.lat || 0).toFixed(7),
      Number(candidate.lon || 0).toFixed(7),
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(candidate);
  }
  return result;
}

async function searchBuildings(query, env) {
  const safeQuery = String(query || "").trim();
  if (!safeQuery) return { ok: false, query: safeQuery, candidates: [], logs: ["검색어가 없습니다."] };
  const addressFirst = looksLikeAddress(safeQuery);
  const order = addressFirst ? ["address", "place"] : ["place", "address"];
  const logs = [];
  let candidates = [];
  for (const type of order) {
    const result = await vworldSearch(safeQuery, type, env);
    logs.push(`VWorld ${type}: ${result.log}`);
    candidates = candidates.concat(result.candidates.map((item, index) => ({ ...item, _source_order: candidates.length + index })));
  }
  if (addressFirst || candidates.length === 0) {
    for (const type of ["road", "parcel"]) {
      const result = await vworldCoordSearch(safeQuery, type, env);
      logs.push(`VWorld ${type} getcoord: ${result.log}`);
      candidates = candidates.concat(result.candidates.map((item, index) => ({ ...item, _source_order: candidates.length + index })));
    }
  }
  if (candidates.length === 0 || !env.VWORLD_API_KEY) {
    for (const type of order) {
      const result = await kakaoSearch(safeQuery, type, env);
      logs.push(`Kakao ${type}: ${result.log}`);
      candidates = candidates.concat(result.candidates.map((item, index) => ({ ...item, _source_order: candidates.length + index })));
    }
  }
  candidates = dedupeCandidates(candidates)
    .sort((a, b) => (b.match_score || 0) - (a.match_score || 0) || (a._source_order || 0) - (b._source_order || 0))
    .slice(0, 10);
  return { ok: candidates.length > 0, query: safeQuery, candidates, logs };
}

async function reverseGeocode(lon, lat, env) {
  if (!env.VWORLD_API_KEY || lon === null || lat === null) return { value: {}, log: "좌표 또는 VWorld 키가 없어 역지오코딩을 건너뜁니다." };
  const { status, data, url } = await fetchJson(VWORLD_ADDRESS_URL, {
    service: "address",
    request: "getaddress",
    version: "2.0",
    crs: "epsg:4326",
    point: `${lon},${lat}`,
    type: "both",
    zipcode: "true",
    simple: "false",
    format: "json",
    errorformat: "json",
    key: env.VWORLD_API_KEY,
  }, env);
  const response = data?.response || {};
  const result = response.result || [];
  if (status !== 200 || response.status !== "OK" || !Array.isArray(result)) {
    return { value: {}, log: `역지오코딩 실패: HTTP ${status} / ${responseError(data)} / ${url}` };
  }
  const out = {};
  for (const item of result) {
    const type = String(item.type || "").toLowerCase();
    if (type.includes("road")) out.road_address = item.text || "";
    else if (type.includes("parcel")) out.parcel_address = item.text || "";
    else if (item.text && !out.parcel_address) out.parcel_address = item.text;
  }
  return { value: out, log: "역지오코딩 완료" };
}

function extractPnuFromFeature(feature) {
  const props = feature?.properties || {};
  for (const value of Object.values(props)) {
    const match = String(value || "").match(/\d{19}/);
    if (match) return match[0];
  }
  const idMatch = String(feature?.id || "").match(/\d{19}/);
  return idMatch ? idMatch[0] : null;
}

async function fetchPnu(lon, lat, env) {
  if (!env.VWORLD_API_KEY || lon === null || lat === null) return { pnu: null, log: "좌표 또는 VWorld 키가 없어 PNU 조회를 건너뜁니다." };
  let last = "";
  for (const layer of ["LP_PA_CBND_BUBUN", "LP_PA_CBND_BONBUN"]) {
    const { status, data, url } = await fetchJson(VWORLD_DATA_URL, {
      service: "data",
      request: "GetFeature",
      data: layer,
      geomfilter: `point(${lon} ${lat})`,
      geometry: "false",
      attribute: "true",
      size: "10",
      page: "1",
      format: "json",
      errorformat: "json",
      key: env.VWORLD_API_KEY,
    }, env);
    const response = data?.response || {};
    if (status !== 200 || response.status !== "OK") {
      last = `${layer}: HTTP ${status} / ${responseError(data)} / ${url}`;
      continue;
    }
    const features = response?.result?.featureCollection?.features || [];
    for (const feature of features) {
      const pnu = extractPnuFromFeature(feature);
      if (pnu) return { pnu, log: `PNU 자동 조회 성공: ${layer}` };
    }
    last = `${layer}: PNU 속성을 찾지 못했습니다.`;
  }
  return { pnu: null, log: `PNU 자동 조회 실패: ${last}` };
}

function molitParamsFromPnu(pnu) {
  if (!pnu || String(pnu).length < 19) return null;
  const value = String(pnu).slice(0, 19);
  return {
    source: "vworld_pnu",
    pnu: value,
    sigunguCd: value.slice(0, 5),
    bjdongCd: value.slice(5, 10),
    platGbCd: value[10] === "2" ? "1" : "0",
    bun: value.slice(11, 15),
    ji: value.slice(15, 19),
  };
}

function parseAddressForMolit(address, env) {
  if (!address) return null;
  const match = String(address).match(/(\d+)(?:[-번지\s]+(\d+))?/);
  if (!env.MOLIT_SIGUNGU_CD || !env.MOLIT_BJDONG_CD) return null;
  return {
    source: "manual_code_address_parse",
    sigunguCd: env.MOLIT_SIGUNGU_CD,
    bjdongCd: env.MOLIT_BJDONG_CD,
    platGbCd: ` ${address} `.includes(" 산 ") ? "1" : "0",
    bun: match ? String(match[1]).padStart(4, "0") : "0000",
    ji: match && match[2] ? String(match[2]).padStart(4, "0") : "0000",
  };
}

async function fetchBuildingRegister(params, env) {
  const serviceKey = env.MOLIT_BUILDING_API_KEY || env.DATA_GO_KR_API_KEY;
  if (!serviceKey) return { record: null, log: "MOLIT_BUILDING_API_KEY 또는 DATA_GO_KR_API_KEY가 Worker Secret에 없습니다." };
  if (!params) return { record: null, log: "건축물대장 조회 파라미터를 만들지 못했습니다." };
  let last = "";
  for (const endpoint of MOLIT_ENDPOINTS) {
    const requestUrl = new URL(endpoint);
    Object.entries({
      serviceKey,
      sigunguCd: params.sigunguCd,
      bjdongCd: params.bjdongCd,
      platGbCd: params.platGbCd,
      bun: params.bun,
      ji: params.ji,
      numOfRows: "10",
      pageNo: "1",
      _type: "json",
    }).forEach(([key, value]) => requestUrl.searchParams.set(key, value));
    try {
      const response = await fetch(requestUrl.toString(), { headers: { Accept: "application/json" } });
      const text = await response.text();
      if (!response.ok) {
        last = `HTTP ${response.status}: ${maskSecretText(text.slice(0, 240), env)}`;
        continue;
      }
      try {
        const data = JSON.parse(text);
        const item = data?.response?.body?.items?.item;
        if (Array.isArray(item) && item.length) return { record: item[0], log: `건축물대장 조회 성공: ${params.source}` };
        if (item && typeof item === "object") return { record: item, log: `건축물대장 조회 성공: ${params.source}` };
        last = `${data?.response?.header?.resultCode || "-"}: ${data?.response?.header?.resultMsg || "item 없음"}`;
      } catch {
        last = "건축물대장 응답 파싱 실패";
      }
    } catch (error) {
      last = maskSecretText(String(error), env);
    }
  }
  return { record: null, log: `건축물대장 조회 실패: ${last}` };
}

function mapUse(raw) {
  const text = String(raw || "");
  if (/근린|판매|상가/.test(text)) return "상가";
  if (/교육|학교/.test(text)) return "학교";
  if (text.includes("공장")) return "공장";
  if (text.includes("창고")) return "창고";
  if (/단독|공동주택|주택/.test(text)) return "주거";
  if (text.includes("업무")) return "업무시설";
  if (/문화|집회/.test(text)) return "문화시설";
  if (text.includes("공공")) return "공공시설";
  return text ? "기타" : null;
}

function pick(record, keys) {
  for (const key of keys) {
    if (record?.[key] !== undefined && record?.[key] !== null && record?.[key] !== "") return record[key];
  }
  return null;
}

function normalizeRecord(record) {
  if (!record) return {};
  const useAprDay = pick(record, ["useAprDay", "사용승인일"]);
  const yearMatch = String(useAprDay || "").match(/(\d{4})/);
  const previousUse = pick(record, ["mainPurpsCdNm", "주용도코드명", "etcPurps", "기타용도"]);
  const out = {
    building_name: pick(record, ["bldNm", "건물명"]),
    address: pick(record, ["platPlc", "대지위치", "newPlatPlc", "도로명대지위치"]),
    previous_use: mapUse(previousUse),
    year_built: yearMatch ? Number(yearMatch[1]) : null,
    floors: toInt(pick(record, ["grndFlrCnt", "지상층수"])),
    area: toNumber(pick(record, ["totArea", "연면적"])),
    raw: record,
  };
  return Object.fromEntries(Object.entries(out).filter(([, value]) => value !== null && value !== ""));
}

async function enrichCandidate(candidate, env) {
  const logs = [];
  const location = { ...(candidate || {}) };
  const reverse = await reverseGeocode(location.lon, location.lat, env);
  logs.push(reverse.log);
  if (reverse.value.road_address) location.road_address = reverse.value.road_address;
  if (reverse.value.parcel_address) location.parcel_address = reverse.value.parcel_address;
  if (!location.address) location.address = location.road_address || location.parcel_address || "";
  const pnuResult = await fetchPnu(location.lon, location.lat, env);
  logs.push(pnuResult.log);
  if (pnuResult.pnu) location.pnu = pnuResult.pnu;
  const molitParams = molitParamsFromPnu(pnuResult.pnu) || parseAddressForMolit(location.parcel_address || location.address || "", env);
  const register = await fetchBuildingRegister(molitParams, env);
  logs.push(register.log);
  return { location, record: register.record, logs };
}

function mergeBuildingInfo(candidate, record, manual) {
  const normalized = normalizeRecord(record);
  const info = {
    building_name: candidate.title || candidate.building_name || "",
    address: candidate.road_address || candidate.parcel_address || candidate.address || "",
    road_address: candidate.road_address || "",
    parcel_address: candidate.parcel_address || "",
    lon: candidate.lon,
    lat: candidate.lat,
    previous_use: "기타",
    year_built: null,
    floors: null,
    area: null,
    current_status: "공실",
    structure_system: "",
  };
  Object.assign(info, normalized);
  Object.entries(manual || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && String(value).trim() !== "") info[key] = value;
  });
  info.year_built = toInt(info.year_built, new Date().getFullYear() - 30);
  info.floors = toInt(info.floors, 3);
  info.area = Math.max(toNumber(info.area, 500), 1);
  info.lon = toNumber(info.lon);
  info.lat = toNumber(info.lat);
  info.record_found = Boolean(record);
  return info;
}

function scoreFrom(overrides, key, fallback) {
  return clamp(toNumber(overrides?.[key], fallback), 1, 5);
}

function inferData(buildingInfo, overrides) {
  const currentYear = new Date().getFullYear();
  const age = Math.max(currentYear - Number(buildingInfo.year_built || currentYear), 0);
  const area = Number(buildingInfo.area || 500);
  const floors = Math.max(Number(buildingInfo.floors || 3), 1);
  const use = buildingInfo.previous_use || "기타";
  const status = buildingInfo.current_status || "공실";
  const ageCondition = age < 15 ? 4.3 : age < 25 ? 3.8 : age < 40 ? 3.2 : 2.5;
  const activeBonus = ["정상 사용", "부분 사용"].includes(status) ? 0.4 : 0;
  const useSpaceBonus = ["공장", "창고", "학교", "문화시설"].includes(use) ? 0.5 : 0;
  const compactBonus = area / floors <= 500 ? 0.4 : 0;
  return {
    physical: {
      structure_condition: scoreFrom(overrides, "structure_condition", ageCondition + activeBonus),
      facility_condition: scoreFrom(overrides, "facility_condition", ageCondition - 0.3),
      leak_crack: scoreFrom(overrides, "leak_crack", ageCondition - 0.2),
      ceiling_height: scoreFrom(overrides, "ceiling_height", ["공장", "창고"].includes(use) ? 4 : 3),
      plan_flexibility: scoreFrom(overrides, "plan_flexibility", 3.2 + useSpaceBonus),
    },
    spatial: {
      daylight: scoreFrom(overrides, "daylight", 3.1 + compactBonus),
      ventilation: scoreFrom(overrides, "ventilation", 3.1 + compactBonus),
      circulation: scoreFrom(overrides, "circulation", 3.2 + (floors <= 4 ? 0.3 : -0.2)),
      outdoor_space: scoreFrom(overrides, "outdoor_space", 3),
      rooftop_potential: scoreFrom(overrides, "rooftop_potential", floors <= 5 && area >= 250 ? 4 : 3),
      ground_floor_openness: scoreFrom(overrides, "ground_floor_openness", ["상가", "문화시설"].includes(use) ? 4 : 3),
    },
    regional: {
      public_transport: scoreFrom(overrides, "public_transport", 3.4),
      pedestrian_flow: scoreFrom(overrides, "pedestrian_flow", ["상가", "문화시설"].includes(use) ? 3.6 : 3.1),
      nearby_facilities: scoreFrom(overrides, "nearby_facilities", 3.4),
      street_connectivity: scoreFrom(overrides, "street_connectivity", 3.4),
    },
    social: {
      resident_demand: scoreFrom(overrides, "resident_demand", 3.5),
      publicness: scoreFrom(overrides, "publicness", ["학교", "공공시설", "문화시설"].includes(use) ? 3.8 : 3.1),
      community_activation: scoreFrom(overrides, "community_activation", 3.3),
      local_need: scoreFrom(overrides, "local_need", 3.5),
    },
    environmental: {
      structure_reuse: scoreFrom(overrides, "structure_reuse", ageCondition + 0.2),
      material_reuse: scoreFrom(overrides, "material_reuse", age >= 25 ? 3.6 : 3),
      insulation: scoreFrom(overrides, "insulation", age >= 30 ? 2.8 : 3.5),
      natural_light: scoreFrom(overrides, "natural_light", 3.2 + compactBonus),
      natural_ventilation: scoreFrom(overrides, "natural_ventilation", 3.2 + compactBonus),
      green_roof: scoreFrom(overrides, "green_roof", floors <= 5 ? 3.8 : 2.8),
    },
    identity: {
      heritage_value: scoreFrom(overrides, "heritage_value", age >= 35 ? 4 : 3),
      local_identity: scoreFrom(overrides, "local_identity", 3.4),
      adaptive_reuse_fit: scoreFrom(overrides, "adaptive_reuse_fit", ["공장", "창고", "학교", "문화시설"].includes(use) ? 3.8 : 3.2),
      community_acceptance: scoreFrom(overrides, "community_acceptance", 3.4),
      code_barrier: scoreFrom(overrides, "code_barrier", age >= 40 ? 2.8 : 3.4),
    },
    economic: {
      budget_level: scoreFrom(overrides, "budget_level", 3.2),
      repair_cost: scoreFrom(overrides, "repair_cost", age >= 35 ? 2.8 : 3.4),
      public_support: scoreFrom(overrides, "public_support", 3.2),
      operation_profit: scoreFrom(overrides, "operation_profit", 3.4),
      marketability: scoreFrom(overrides, "marketability", 3.5),
    },
  };
}

const AXIS_WEIGHTS = {
  "물리적 재생 가능성": 18,
  "공간 잠재력": 17,
  "지역 연계성": 14,
  "사회적 필요성": 14,
  "환경 지속가능성": 14,
  "장소성·전환 적합성": 10,
  "경제적 실행 가능성": 13,
};

function calculateScores(data, buildingInfo) {
  const scores = {
    "물리적 재생 가능성": avg(Object.values(data.physical)) / 5 * 18,
    "공간 잠재력": avg(Object.values(data.spatial)) / 5 * 17,
    "지역 연계성": avg(Object.values(data.regional)) / 5 * 14,
    "사회적 필요성": avg(Object.values(data.social)) / 5 * 14,
    "환경 지속가능성": avg(Object.values(data.environmental)) / 5 * 14,
    "장소성·전환 적합성": avg(Object.values(data.identity)) / 5 * 10,
    "경제적 실행 가능성": avg(Object.values(data.economic)) / 5 * 13,
  };
  let total = Object.values(scores).reduce((sum, value) => sum + value, 0);
  if (["공장", "창고"].includes(buildingInfo.previous_use) && data.physical.ceiling_height >= 4) total += 2;
  if (["상가", "근린생활시설"].includes(buildingInfo.previous_use) && data.spatial.ground_floor_openness >= 4) total += 2;
  total = clamp(total, 0, 100);
  const grade = total >= 85 ? "A - 적극 재생 권장" : total >= 70 ? "B - 재생 가능성 높음" : total >= 55 ? "C - 조건부 재생 가능" : total >= 40 ? "D - 제한적 재생 가능" : "E - 철거·대체 검토 필요";
  return { scores: Object.fromEntries(Object.entries(scores).map(([key, value]) => [key, Math.round(value * 10) / 10])), total: Math.round(total * 10) / 10, grade };
}

function classifyTypes(scores, data) {
  const types = [];
  if (scores["물리적 재생 가능성"] >= 14 && scores["사회적 필요성"] >= 11 && scores["지역 연계성"] >= 10) types.push("보존형 재생");
  if (scores["공간 잠재력"] >= 14 && scores["사회적 필요성"] >= 10) types.push("프로그램 삽입형 재생");
  if (data.spatial.ground_floor_openness >= 4 && scores["지역 연계성"] >= 10) types.push("저층부 개방형 재생");
  if (scores["환경 지속가능성"] >= 10) types.push("외피 개선형 재생");
  if (data.spatial.rooftop_potential >= 4 || data.spatial.ground_floor_openness >= 4) types.push("반외부 전환형 재생");
  if (scores["장소성·전환 적합성"] >= 7 && data.identity.heritage_value >= 4) types.push("장소 기억 보존형 재생");
  if (data.identity.adaptive_reuse_fit >= 4) types.push("용도전환 촉진형 재생");
  if (data.identity.code_barrier <= 2.5) types.push("법규·피난 정비형 재생");
  return types.length ? [...new Set(types)] : ["기초 정비형 재생"];
}

function recommendPrograms(localNeeds, data, buildingInfo) {
  const mapping = {
    "청소년 공간": ["방과후 학습센터", "청소년 라운지", "메이커스페이스"],
    "고령자 돌봄 공간": ["시니어 커뮤니티센터", "건강 상담실", "공동식당"],
    "문화시설": ["소규모 전시장", "공연 연습실", "로컬 아카이브"],
    "창업 공간": ["공유오피스", "팝업스토어", "창업 실험실"],
    "학습 공간": ["작은 도서관", "스터디룸", "평생교육센터"],
    "녹지·쉼터": ["옥상정원", "실내정원", "반외부 쉼터"],
    "생활 편의시설": ["공유부엌", "마을 세탁소", "생활수리센터"],
    "지역 커뮤니티 공간": ["주민회의실", "커뮤니티 카페", "공유 라운지"],
    "관광·전시 공간": ["로컬 역사관", "관광 안내소", "기념품 공방"],
  };
  const programs = [];
  for (const need of localNeeds || []) programs.push(...(mapping[need] || []));
  if (data.spatial.ground_floor_openness >= 4) programs.push("커뮤니티 카페", "로컬 마켓", "가로형 팝업스토어");
  if (data.physical.ceiling_height >= 4) programs.push("전시장", "메이커스페이스", "창고형 문화공간");
  if (data.spatial.rooftop_potential >= 4) programs.push("옥상정원", "야외 영화관", "도시농업 공간");
  if (["공장", "창고"].includes(buildingInfo.previous_use)) programs.push("로컬 제작소", "복합문화 창고", "공유 작업장");
  return [...new Set(programs)].slice(0, 8);
}

function extractRisks(data) {
  const risks = [];
  if (data.physical.structure_condition <= 2.5) risks.push("구조 보강 또는 정밀 안전진단 필요");
  if (data.physical.facility_condition <= 2.5) risks.push("전기·기계·위생 설비 교체 필요");
  if (data.physical.leak_crack <= 2.5) risks.push("누수 및 균열 정밀 진단 필요");
  if (data.spatial.circulation <= 2.5) risks.push("내부 동선 재구성 필요");
  if (data.economic.budget_level <= 2.5) risks.push("예산 부족으로 단계적 재생 전략 필요");
  if (data.identity.code_barrier <= 2.5) risks.push("용도변경, 피난, 소방, 접근성 기준 사전 검토 필요");
  return risks.length ? risks : ["치명적 위험 요소는 낮음"];
}

function extractPotentials(data) {
  const potentials = [];
  if (data.physical.structure_condition >= 4) potentials.push("기존 구조체 재사용 가능성 높음");
  if (data.physical.ceiling_height >= 4) potentials.push("높은 층고로 다양한 프로그램 수용 가능");
  if (data.spatial.rooftop_potential >= 4) potentials.push("옥상정원·태양광 등 상부 공간 활용 가능");
  if (data.spatial.ground_floor_openness >= 4) potentials.push("가로와 연계한 저층부 활성화 가능");
  if (data.regional.pedestrian_flow >= 4) potentials.push("지역 이용자 유입 가능성 높음");
  if (data.social.resident_demand >= 4) potentials.push("주민 수요 기반 운영 가능성 있음");
  if (data.environmental.material_reuse >= 4) potentials.push("재료 재사용을 통한 환경적 재생 가치 높음");
  if (data.identity.heritage_value >= 4) potentials.push("건물의 기억과 지역 서사를 공간 브랜드로 전환 가능");
  return potentials.length ? potentials : ["추가 현장조사를 통해 잠재 요소 발굴 필요"];
}

function priorityStrategies(types, risks) {
  const strategies = [];
  if (types.includes("저층부 개방형 재생")) strategies.push("1층 출입부와 가로 접점을 개방한다.");
  if (types.includes("프로그램 삽입형 재생")) strategies.push("지역 부족 시설에 맞는 프로그램을 내부에 삽입한다.");
  if (types.includes("외피 개선형 재생")) strategies.push("외단열, 차양, 창호 개선 등 외피 성능을 우선 보완한다.");
  if (types.includes("반외부 전환형 재생")) strategies.push("옥상, 마당, 필로티를 반외부 커뮤니티 공간으로 전환한다.");
  if (types.includes("장소 기억 보존형 재생")) strategies.push("보존할 흔적, 제거할 마감, 새로 삽입할 요소를 층위별로 구분한다.");
  if (risks.some((risk) => risk.includes("설비"))) strategies.push("노후 설비를 우선 교체한다.");
  if (risks.some((risk) => risk.includes("구조"))) strategies.push("구조 안전진단 후 보강 범위를 확정한다.");
  strategies.push("초기 운영 데이터를 바탕으로 단계적 리노베이션 계획을 수립한다.");
  return [...new Set(strategies)].slice(0, 8);
}

function formatKrw(value) {
  const number = Number(value || 0);
  if (number >= 100000000) return `${(number / 100000000).toFixed(1)}억 원`;
  if (number >= 10000) return `${Math.round(number / 10000).toLocaleString()}만 원`;
  return `${Math.round(number).toLocaleString()}원`;
}

function estimateCost(data, buildingInfo, total, types) {
  const area = Math.max(Number(buildingInfo.area || 1), 1);
  const age = Math.max(new Date().getFullYear() - Number(buildingInfo.year_built || new Date().getFullYear()), 0);
  let unitCost = 650000;
  if (age >= 40) unitCost += 280000;
  else if (age >= 25) unitCost += 150000;
  if (data.physical.structure_condition <= 2.5) unitCost += 420000;
  else if (data.physical.structure_condition <= 3.5) unitCost += 180000;
  if (data.physical.facility_condition <= 2.5) unitCost += 320000;
  if (data.physical.leak_crack <= 2.5) unitCost += 160000;
  if (data.environmental.insulation <= 2.5) unitCost += 180000;
  if (types.includes("외피 개선형 재생")) unitCost += 180000;
  if (data.identity.heritage_value >= 4) unitCost += 90000;
  const base = area * unitCost;
  let supportRate = data.economic.public_support >= 4 || data.social.publicness >= 4 ? 0.18 : data.economic.public_support >= 3 ? 0.08 : 0;
  if (data.identity.heritage_value >= 4 && data.social.publicness >= 4) supportRate = Math.min(0.25, supportRate + 0.05);
  const supportAmount = base * supportRate;
  const netCost = base - supportAmount;
  const occupancy = 0.45 + Math.min(0.25, total / 100 * 0.25);
  const monthlyPerSqm = 9000 + data.economic.operation_profit * 3500 + data.regional.pedestrian_flow * 2200 + data.social.resident_demand * 1200;
  const grossAnnual = area * monthlyPerSqm * 12 * occupancy;
  const netAnnual = grossAnnual * 0.62;
  return {
    area: Math.round(area * 10) / 10,
    age,
    unit_cost: Math.round(unitCost),
    low: Math.round(base * 0.82),
    base: Math.round(base),
    high: Math.round(base * 1.25),
    support_rate: Math.round(supportRate * 1000) / 10,
    support_amount: Math.round(supportAmount),
    net_cost: Math.round(netCost),
    gross_annual_revenue: Math.round(grossAnnual),
    net_annual_cashflow: Math.round(netAnnual),
    payback_years: netAnnual > 0 ? Math.round((netCost / netAnnual) * 10) / 10 : null,
    components: [
      ["구조 보강", 0.11],
      ["설비 교체", 0.16],
      ["외피/단열/방수", 0.14],
      ["내부 프로그램 공사", 0.25],
      ["소방/피난/접근성", 0.09],
      ["외부/옥상/가로 연계", 0.07],
      ["장소성/기록/사인", 0.04],
      ["설계/인허가/감리", 0.07],
      ["예비비", 0.07],
    ].map(([name, weight]) => ({ name, amount: Math.round(base * weight), label: formatKrw(base * weight) })),
  };
}

function currentCashflow(data, buildingInfo, total) {
  const area = Math.max(Number(buildingInfo.area || 1), 1);
  const factor = { "정상 사용": 0.92, "부분 사용": 0.62, "공실": 0.22, "폐쇄": 0.08, "방치": 0.04 }[buildingInfo.current_status] ?? 0.35;
  const physical = avg(Object.values(data.physical)) / 5;
  const location = avg([data.regional.public_transport, data.regional.pedestrian_flow, data.regional.nearby_facilities, data.regional.street_connectivity]) / 5;
  const demand = avg([data.social.resident_demand, data.social.community_activation, data.economic.operation_profit]) / 5;
  const monthlyPerSqm = 5500 + location * 15000 + demand * 8500;
  const operation = 0.48 + Math.min(0.12, total / 100 * 0.12);
  return Math.round(area * monthlyPerSqm * 12 * factor * (0.55 + physical * 0.45) * operation);
}

function compareApproaches(data, buildingInfo, total, cost) {
  const current = currentCashflow(data, buildingInfo, total);
  const physicalGap = Math.max(0, 5 - avg(Object.values(data.physical)));
  const vacancyBonus = ["공실", "폐쇄", "방치"].includes(buildingInfo.current_status) ? 0.22 : 0.06;
  const repairInvestment = cost.base * (0.28 + Math.min(0.16, physicalGap * 0.04));
  const repairCashflow = Math.max(current * Math.min(1.42, 1.08 + physicalGap * 0.07 + vacancyBonus), current + repairInvestment * 0.055);
  const premium = 0.16 + data.spatial.ground_floor_openness * 0.035 + data.spatial.rooftop_potential * 0.025 + data.regional.pedestrian_flow * 0.03 + data.social.publicness * 0.025;
  const regenInvestment = cost.net_cost;
  const regenCashflow = Math.max(cost.net_annual_cashflow, repairCashflow * Math.min(1.95, 1 + premium));
  return [
    ["현재 유지", 0, current, "현재 운영 상태 유지"],
    ["보수 중심", repairInvestment, repairCashflow, "누수, 설비, 마감 등 기능 회복 중심"],
    ["건축재생 디자인", regenInvestment, regenCashflow, "공간 경험, 프로그램, 브랜드, 운영모델 통합"],
  ].map(([approach, investment, cashflow, change]) => {
    const extra = cashflow - current;
    return {
      approach,
      investment: Math.round(investment),
      investment_label: formatKrw(investment),
      annual_cashflow: Math.round(cashflow),
      annual_cashflow_label: formatKrw(cashflow),
      growth: current > 0 ? Math.round(((cashflow - current) / current * 100) * 10) / 10 : null,
      roi: investment ? Math.round((extra / Math.max(investment, 1) * 100) * 10) / 10 : null,
      payback: investment ? Math.round((investment / Math.max(extra, 1)) * 10) / 10 : null,
      change,
    };
  });
}

function projection(cost) {
  let cumulative = -cost.net_cost;
  return [1, 2, 3, 4, 5].map((year) => {
    const annual = cost.net_annual_cashflow * (0.72 + year * 0.07);
    cumulative += annual;
    return { year: `${year}년차`, annual: Math.round(annual), annual_label: formatKrw(annual), cumulative: Math.round(cumulative), cumulative_label: formatKrw(cumulative) };
  });
}

function modules(data, buildingInfo, types, programs, cost, comparison) {
  const sustainability = clamp(avg([data.environmental.structure_reuse, data.environmental.material_reuse, data.environmental.insulation, data.environmental.natural_light, data.environmental.natural_ventilation, data.physical.structure_condition]) / 5 * 100, 0, 100);
  const risk = clamp((6 - data.physical.structure_condition) * 16 + (6 - data.physical.facility_condition) * 9 + (6 - data.physical.leak_crack) * 12 + (cost.age >= 40 ? 12 : cost.age >= 25 ? 7 : 2), 0, 100);
  const identity = clamp(avg(Object.values(data.identity)) / 5 * 100, 0, 100);
  const repair = comparison.find((row) => row.approach === "보수 중심") || {};
  const regen = comparison.find((row) => row.approach === "건축재생 디자인") || {};
  return [
    { name: "01 지속가능성", value: `${sustainability.toFixed(1)}점`, decision: sustainability >= 80 ? "기존 자산 보존형" : sustainability >= 60 ? "선별 재사용형" : "성능 보강 우선형", description: "구조체와 재료를 보존하면서 성능 개선을 결합하는 재생 접근을 검토합니다." },
    { name: "02 맥락 전략", value: types[0], decision: programs.slice(0, 2).join(", "), description: "지역 수요와 건물 유형을 연결해 운영 가능한 프로그램을 제안합니다." },
    { name: "03 구조 위험", value: `${risk.toFixed(1)}점`, decision: risk >= 70 ? "정밀진단 우선" : risk >= 45 ? "보강 병행" : "재생 검토 가능", description: "구조, 설비, 누수 위험을 먼저 잡고 재생 설계의 안전 범위를 정합니다." },
    { name: "04 장소성·전환", value: `${identity.toFixed(1)}점`, decision: identity >= 80 ? "장소자산화 우선" : identity >= 60 ? "선별 보존" : "기초 합의 필요", description: "보존할 기억과 새 용도가 충돌하지 않도록 전환 전략을 세웁니다." },
    { name: "05 경제 판단", value: `보수 ${repair.growth ?? "-"}% / 재생 ${regen.growth ?? "-"}%`, decision: `기준 사업비 ${formatKrw(cost.base)}`, description: "보수 중심과 건축재생 디자인의 투자비, 수익 증가율, 회수기간을 비교합니다." },
    { name: "06 설계 보조", value: `${buildingInfo.previous_use || "기존 용도"}의 흔적을 남기는 ${types[0]} 플랫폼`, decision: "첫 실행: 진단 후 파일럿", description: "평가 결과를 콘셉트, 공간 개입, 프로그램 브리프로 번역합니다." },
  ];
}

function decision(total, cost) {
  if (total >= 75 && (!cost.payback_years || cost.payback_years <= 8)) return { label: "즉시 기획 착수", message: "재생 가능성과 경제성이 함께 확인됩니다. 기본설계와 운영자 검토를 병행하는 편이 좋습니다." };
  if (total >= 60) return { label: "조건부 추진", message: "가능성은 충분하지만 구조, 설비, 운영 수익 중 약한 항목을 먼저 검증해야 합니다." };
  if (total >= 45) return { label: "파일럿 우선", message: "전면 투자보다 최소 개입으로 수요와 리스크를 확인한 뒤 단계적으로 판단하는 편이 안전합니다." };
  return { label: "보류 또는 대안 검토", message: "재생보다 철거, 매각, 기록 보존, 부분 활용 등 대안을 함께 비교해야 합니다." };
}

function roadmap(strategies, cost) {
  return [
    { phase: "0단계 진단", duration: "0-1개월", budget: formatKrw(cost.base * 0.04), action: "구조 안전진단, 설비 점검, 법규/용도 검토" },
    { phase: "1단계 파일럿", duration: "1-3개월", budget: formatKrw(cost.base * 0.12), action: strategies[0] || "저비용 임시 프로그램으로 수요 검증" },
    { phase: "2단계 핵심 공사", duration: "3-10개월", budget: formatKrw(cost.base * 0.58), action: strategies[1] || "설비, 외피, 내부 공간을 우선 개선" },
    { phase: "3단계 운영 고도화", duration: "10개월 이후", budget: formatKrw(cost.base * 0.26), action: "운영 데이터 기반 프로그램 조정 및 추가 투자 판단" },
  ];
}

async function analyzeBuilding(payload, env) {
  const enriched = await enrichCandidate(payload.candidate || {}, env);
  const building = mergeBuildingInfo(enriched.location, enriched.record, payload.manual || {});
  const data = inferData(building, payload.scores || {});
  const scoreResult = calculateScores(data, building);
  const types = classifyTypes(scoreResult.scores, data);
  const programs = recommendPrograms(payload.local_needs || [], data, building);
  const risks = extractRisks(data);
  const potentials = extractPotentials(data);
  const strategies = priorityStrategies(types, risks);
  const cost = estimateCost(data, building, scoreResult.total, types);
  const comparison = compareApproaches(data, building, scoreResult.total, cost);
  return {
    ok: true,
    building,
    data,
    total: scoreResult.total,
    grade: scoreResult.grade,
    decision: decision(scoreResult.total, cost),
    axis: Object.entries(scoreResult.scores).map(([name, score]) => ({ name, score, max: AXIS_WEIGHTS[name], percent: Math.round((score / AXIS_WEIGHTS[name] * 100) * 10) / 10 })),
    types,
    programs,
    risks,
    potentials,
    strategies,
    cost,
    comparison,
    modules: modules(data, building, types, programs, cost, comparison),
    projection: projection(cost),
    roadmap: roadmap(strategies, cost),
    logs: enriched.logs,
  };
}
