const state = {
  candidates: [],
  selectedIndex: -1,
  lastResult: null,
  enrichSeq: 0,
};

const needs = [
  "청소년 공간",
  "고령자 돌봄 공간",
  "문화시설",
  "창업 공간",
  "학습 공간",
  "녹지·쉼터",
  "생활 편의시설",
  "지역 커뮤니티 공간",
  "관광·전시 공간",
];

const scoreControls = [
  ["structure_condition", "구조 상태", 3],
  ["facility_condition", "설비 상태", 3],
  ["leak_crack", "누수·균열", 3],
  ["plan_flexibility", "평면 유연성", 3],
  ["outdoor_space", "외부공간", 3],
  ["rooftop_potential", "옥상 활용", 3],
  ["ground_floor_openness", "저층부 개방", 3],
  ["pedestrian_flow", "보행 유입", 3],
  ["resident_demand", "지역 수요", 3],
  ["material_reuse", "재료 재사용", 3],
  ["heritage_value", "장소 기억", 3],
  ["operation_profit", "운영 수익성", 3],
];

function $(id) {
  return document.getElementById(id);
}

function sameOriginApiBase() {
  if (location.hostname.endsWith("github.io")) return "";
  return location.origin;
}

function normalizeBase(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function bootstrapHiddenConfig() {
  const params = new URLSearchParams(location.search);
  const api = params.get("api");
  if (api) {
    localStorage.setItem("revalueApiBase", api);
  }
  if (params.has("api")) {
    params.delete("api");
    const clean = `${location.pathname}${params.toString() ? `?${params}` : ""}${location.hash}`;
    history.replaceState(null, "", clean);
  }
}

function apiBase() {
  return normalizeBase(
    window.REVALUE_API_BASE
    || localStorage.getItem("revalueApiBase")
    || sameOriginApiBase()
  );
}

function token() {
  return String(
    window.REVALUE_SITE_TOKEN
    || localStorage.getItem("revalueSiteToken")
    || ""
  ).trim();
}

function setSearchStatus(message) {
  $("searchStatus").textContent = message;
}

function setAutoFillStatus(message) {
  const target = $("autoFillStatus");
  if (target) target.textContent = message;
}

function showAccessOverlay(message = "") {
  $("accessOverlay").classList.remove("hidden");
  $("accessHint").textContent = message;
  setTimeout(() => $("accessTokenInput").focus(), 50);
}

function hideAccessOverlay() {
  $("accessOverlay").classList.add("hidden");
  $("accessHint").textContent = "";
}

function saveAccessToken() {
  const value = $("accessTokenInput").value.trim();
  if (!value) {
    $("accessHint").textContent = "접속 코드를 입력해 주세요.";
    return;
  }
  localStorage.setItem("revalueSiteToken", value);
  hideAccessOverlay();
  setSearchStatus("접속 코드가 저장되었습니다. 검색을 진행하세요.");
}

async function apiRequest(path, options = {}) {
  const base = apiBase();
  if (!base) {
    throw new Error("관리자 설정이 필요합니다. 배포 설정에 서버 주소가 없습니다.");
  }
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (token()) {
    headers.Authorization = `Bearer ${token()}`;
    headers["X-REVALUE-SITE-TOKEN"] = token();
  }
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    const reason = String(error?.message || error || "");
    throw new Error(
      "브라우저가 API 서버 호출을 막았습니다. "
      + "config.js의 REVALUE_API_BASE가 Cloudflare Worker의 https://...workers.dev 주소인지, "
      + "Worker 배포가 성공했는지, ALLOWED_ORIGINS가 GitHub Pages 도메인까지만 입력됐는지 확인해 주세요. "
      + `현재 API 주소: ${base || "-"} / 원인: ${reason || "Failed to fetch"}`
    );
  }
  const bodyText = await response.text();
  let data = {};
  try {
    data = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    data = { detail: bodyText || `HTTP ${response.status}` };
  }
  if (!response.ok) {
    if (response.status === 401) {
      showAccessOverlay(data.detail || "접속 코드가 필요합니다.");
    }
    const detail = String(data.detail || "");
    if (response.status === 404 && /GitHub Pages|Page not found|<!doctype html|<!DOCTYPE html/i.test(detail)) {
      throw new Error(
        "API 서버 주소가 GitHub Pages 화면 주소로 되어 있습니다. config.js의 REVALUE_API_BASE에 Cloudflare Worker의 workers.dev 주소를 넣어 주세요."
      );
    }
    throw new Error(data.detail || `HTTP ${response.status}`);
  }
  return data;
}

function renderNeeds() {
  $("needsBox").innerHTML = needs.map((need, index) => `
    <label class="check-pill">
      <input type="checkbox" value="${escapeHtml(need)}" ${index < 2 ? "checked" : ""}>
      ${escapeHtml(need)}
    </label>
  `).join("");
}

function renderScoreControls() {
  $("scoreControls").innerHTML = scoreControls.map(([key, label, value]) => `
    <div class="slider-card">
      <header><span>${escapeHtml(label)}</span><output id="${key}Out">${value}</output></header>
      <input id="${key}" data-score-key="${key}" type="range" min="1" max="5" step="0.5" value="${value}">
    </div>
  `).join("");
  document.querySelectorAll("[data-score-key]").forEach((input) => {
    input.addEventListener("input", () => {
      $(`${input.dataset.scoreKey}Out`).textContent = input.value;
    });
  });
}

function selectedNeeds() {
  return [...document.querySelectorAll("#needsBox input:checked")].map((input) => input.value);
}

function scoreValues() {
  const result = {};
  document.querySelectorAll("[data-score-key]").forEach((input) => {
    result[input.dataset.scoreKey] = Number(input.value);
  });
  return result;
}

function inputValue(id) {
  const target = $(id);
  return target ? target.value.trim() : "";
}

function manualValues() {
  return cleanObject({
    building_name: inputValue("manualBuildingName"),
    address: inputValue("manualAddress"),
    previous_use: inputValue("manualUse"),
    current_status: inputValue("manualStatus"),
    year_built: inputValue("manualYear"),
    floors: inputValue("manualFloors"),
    area: inputValue("manualArea"),
    land_area: inputValue("manualLandArea"),
    structure_system: inputValue("manualStructure"),
    pnu: inputValue("manualPnu"),
  });
}

function cleanObject(object) {
  const out = {};
  Object.entries(object).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      out[key] = value;
    }
  });
  return out;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function currency(value) {
  const number = Number(value || 0);
  if (number >= 100000000) return `${(number / 100000000).toFixed(1)}억 원`;
  if (number >= 10000) return `${Math.round(number / 10000).toLocaleString()}만 원`;
  return `${Math.round(number).toLocaleString()}원`;
}

function percent(value) {
  return value === null || value === undefined ? "-" : `${Number(value).toFixed(1)}%`;
}

async function searchBuildings() {
  const query = $("queryInput").value.trim();
  if (!query) {
    setSearchStatus("검색어를 입력해 주세요.");
    return;
  }
  state.selectedIndex = -1;
  state.candidates = [];
  state.enrichSeq += 1;
  setAutoFillStatus("후보를 선택하면 공공데이터 기반 건물 정보가 자동으로 보정됩니다.");
  renderCandidates();
  setSearchStatus("VWorld에서 후보를 찾고 있습니다.");
  try {
    const data = await apiRequest(`/api/search?q=${encodeURIComponent(query)}`);
    state.candidates = data.candidates || [];
    renderCandidates(data.logs || []);
    setSearchStatus(state.candidates.length ? "후보를 선택하면 분석으로 이어집니다." : "검색 결과가 없습니다. 주소 표현을 바꿔 보세요.");
  } catch (error) {
    setSearchStatus(`검색 실패: ${error.message}`);
    renderCandidates();
  }
}

function renderCandidates(logs = []) {
  $("candidateCount").textContent = `${state.candidates.length}개`;
  const list = $("candidateList");
  if (!state.candidates.length) {
    list.className = "candidate-list empty";
    list.textContent = "검색 결과가 여기에 표시됩니다.";
    if (logs.length) {
      list.textContent = logs.join("\n");
    }
    return;
  }
  list.className = "candidate-list";
  list.innerHTML = state.candidates.map((candidate, index) => `
    <article class="candidate ${state.selectedIndex === index ? "selected" : ""}" data-index="${index}">
      <div class="candidate-meta">
        <span class="badge">${escapeHtml(candidate.source || "후보")}</span>
        <span class="badge muted">유사도 ${candidate.match_score || 0}%</span>
      </div>
      <strong>${escapeHtml(candidate.title || "이름 없음")}</strong>
      <p>도로명: ${escapeHtml(candidate.road_address || "-")}</p>
      <p>지번: ${escapeHtml(candidate.parcel_address || "-")}</p>
      <p>좌표: ${candidate.lat || "-"}, ${candidate.lon || "-"}</p>
    </article>
  `).join("");
  document.querySelectorAll(".candidate").forEach((card) => {
    card.addEventListener("click", () => selectCandidate(Number(card.dataset.index)));
  });
}

function selectCandidate(index) {
  state.selectedIndex = index;
  const candidate = state.candidates[index];
  $("manualBuildingName").value = candidate.title || "";
  $("manualAddress").value = candidate.road_address || candidate.parcel_address || candidate.address || "";
  setAutoFillStatus("공공데이터에서 건물 정보를 확인하고 있습니다.");
  renderCandidates();
  setSearchStatus("후보가 선택되었습니다. 건물 정보 자동 보정을 진행합니다.");
  enrichSelectedCandidate(candidate, state.enrichSeq + 1);
}

function setValue(id, value, overwrite = true) {
  const target = $(id);
  if (!target || value === undefined || value === null || String(value).trim() === "") return;
  if (!overwrite && target.value) return;
  target.value = String(value);
}

function setSelectValue(id, value) {
  const target = $(id);
  if (!target || !value) return;
  const match = [...target.options].find((option) => option.value === value || option.textContent === value);
  if (match) target.value = match.value;
}

function applyAutofill(building) {
  if (!building) return;
  setValue("manualBuildingName", building.building_name);
  setValue("manualAddress", building.address || building.road_address || building.parcel_address);
  setSelectValue("manualUse", building.previous_use);
  setValue("manualYear", building.year_built);
  setValue("manualFloors", building.floors);
  setValue("manualArea", building.area);
  setValue("manualLandArea", building.land_area);
  setValue("manualStructure", building.structure_system);
  setValue("manualPnu", building.pnu);
}

async function enrichSelectedCandidate(candidate, seq) {
  state.enrichSeq = seq;
  try {
    const data = await apiRequest("/api/enrich", {
      method: "POST",
      body: JSON.stringify({ candidate }),
    });
    if (state.enrichSeq !== seq) return;
    applyAutofill(data.building || {});
    if (data.record_found) {
      setAutoFillStatus("건축물대장 표제부 정보로 보정 창을 자동 채웠습니다.");
      setSearchStatus("공공데이터 자동 보정이 완료되었습니다. 필요한 값만 수정한 뒤 분석을 누르세요.");
    } else {
      const logs = (data.logs || []).join(" / ");
      setAutoFillStatus(`건축물대장 자동 채움 실패: ${logs || "조회 결과 없음"}`);
      setSearchStatus("주소는 확인했지만 건축물대장 자동 채움은 실패했습니다. 필요한 값은 직접 보정해 주세요.");
    }
  } catch (error) {
    if (state.enrichSeq !== seq) return;
    setAutoFillStatus(`건축물대장 자동 채움 실패: ${error.message}`);
    setSearchStatus("주소 후보는 선택됐지만 공공데이터 자동 보정은 실패했습니다.");
  }
}

async function analyze() {
  const candidate = state.selectedIndex >= 0
    ? state.candidates[state.selectedIndex]
    : {
        title: $("manualBuildingName").value.trim() || $("queryInput").value.trim(),
        address: $("manualAddress").value.trim() || $("queryInput").value.trim(),
      };
  if (!candidate.title && !candidate.address) {
    setSearchStatus("분석할 건물명 또는 주소가 필요합니다.");
    return;
  }
  $("analyzeBtn").disabled = true;
  $("analyzeBtn").textContent = "분석 중";
  try {
    const data = await apiRequest("/api/analyze", {
      method: "POST",
      body: JSON.stringify({
        candidate,
        manual: manualValues(),
        scores: scoreValues(),
        local_needs: selectedNeeds(),
      }),
    });
    state.lastResult = data;
    renderResults(data);
    $("results").classList.remove("hidden");
    $("results").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    setSearchStatus(`분석 실패: ${error.message}`);
  } finally {
    $("analyzeBtn").disabled = false;
    $("analyzeBtn").textContent = "이 조건으로 분석";
  }
}

function renderResults(data) {
  const building = data.building || {};
  const cost = data.cost || {};
  const regen = (data.comparison || []).find((row) => row.approach === "건축재생 디자인") || {};
  $("resultTitle").textContent = building.building_name || building.address || "분석 결과";
  $("decisionText").textContent = data.decision?.message || "";
  $("totalScore").textContent = data.total ?? "-";
  $("gradeText").textContent = data.grade || "-";
  $("costMetric").textContent = currency(cost.base);
  $("paybackMetric").textContent = cost.payback_years ? `${cost.payback_years}년` : "-";
  $("growthMetric").textContent = percent(regen.growth);
  $("decisionMetric").textContent = data.decision?.label || "-";
  renderDataSources(data.data_sources || {});
  renderAxis(data.axis || []);
  renderProjection(data.projection || []);
  renderModules(data.modules || []);
  renderComparison(data.comparison || []);
  renderRoadmap(data.roadmap || []);
  renderTags("typeTags", data.types || []);
  renderList("programList", data.programs || []);
  renderList("riskList", [...(data.risks || []), ...(data.potentials || [])]);
}

function renderDataSources(sources) {
  const hub = sources.building_hub || {};
  const commercial = sources.commercial_area || {};
  const districts = (hub.district_names || []).join(", ") || "-";
  $("dataSourceCards").innerHTML = [
    {
      name: "건축HUB",
      value: hub.floor_count_rows !== undefined ? `층별 ${hub.floor_count_rows || 0}건 · 전유부 ${hub.unit_count || 0}건` : "조회 대기",
      decision: `지역지구: ${districts}`,
      description: `공용면적 ${hub.public_area_sum || 0}㎡, 전유면적 ${hub.exclusive_area_sum || 0}㎡, 부속지번 ${hub.attached_jibun_count || 0}건`,
    },
    {
      name: "상권정보",
      value: commercial.store_count !== undefined ? `${commercial.radius_m || 500}m 반경 ${commercial.store_count}건` : "조회 대기",
      decision: `업종 다양도 ${commercial.category_count || 0}개`,
      description: `카페 ${commercial.cafe_count || 0}건, 문화 ${commercial.culture_count || 0}건, 소매 ${commercial.retail_count || 0}건, 서비스 ${commercial.service_count || 0}건`,
    },
  ].map((item) => `
    <article class="module-card">
      <span>${escapeHtml(item.name)}</span>
      <strong>${escapeHtml(item.value)}</strong>
      <b>${escapeHtml(item.decision)}</b>
      <p>${escapeHtml(item.description)}</p>
    </article>
  `).join("");
}

function renderAxis(axis) {
  $("axisBars").innerHTML = axis.map((item) => `
    <div class="axis-row">
      <header>
        <span>${escapeHtml(item.name)}</span>
        <span>${item.score} / ${item.max} · ${item.percent}%</span>
      </header>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, item.percent))}%"></div></div>
    </div>
  `).join("");
}

function renderProjection(rows) {
  const canvas = $("projectionChart");
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  if (!rows.length) return;
  const pad = 42;
  const values = rows.flatMap((row) => [row.annual, row.cumulative]).map(Number);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const scaleY = (value) => height - pad - ((value - min) / (max - min || 1)) * (height - pad * 1.7);
  const scaleX = (index) => pad + index * ((width - pad * 2) / Math.max(rows.length - 1, 1));

  ctx.strokeStyle = "#e5e9f0";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const y = pad + i * ((height - pad * 1.8) / 4);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
  }

  drawLine(ctx, rows.map((row) => row.annual), scaleX, scaleY, "#2563eb");
  drawLine(ctx, rows.map((row) => row.cumulative), scaleX, scaleY, "#0f9f8f");

  ctx.fillStyle = "#667085";
  ctx.font = "13px system-ui";
  rows.forEach((row, index) => {
    ctx.fillText(row.year, scaleX(index) - 18, height - 14);
  });
  ctx.fillStyle = "#172033";
  ctx.font = "bold 13px system-ui";
  ctx.fillText("파랑: 연간 순운영수익", pad, 22);
  ctx.fillStyle = "#0f9f8f";
  ctx.fillText("초록: 누적 현금흐름", pad + 150, 22);
}

function drawLine(ctx, values, scaleX, scaleY, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = scaleX(index);
    const y = scaleY(value);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  values.forEach((value, index) => {
    ctx.beginPath();
    ctx.arc(scaleX(index), scaleY(value), 5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function renderModules(modules) {
  $("moduleCards").innerHTML = modules.map((module) => `
    <article class="module-card">
      <span>${escapeHtml(module.name)}</span>
      <strong>${escapeHtml(module.value)}</strong>
      <b>${escapeHtml(module.decision)}</b>
      <p>${escapeHtml(module.description)}</p>
    </article>
  `).join("");
}

function renderComparison(rows) {
  $("comparisonTable").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>접근</th>
          <th>투자비</th>
          <th>연간 순운영수익</th>
          <th>수익 증가</th>
          <th>회수기간</th>
          <th>핵심 변화</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td><strong>${escapeHtml(row.approach)}</strong></td>
            <td>${escapeHtml(row.investment_label)}</td>
            <td>${escapeHtml(row.annual_cashflow_label)}</td>
            <td>${percent(row.growth)}</td>
            <td>${row.payback ? `${row.payback}년` : "-"}</td>
            <td>${escapeHtml(row.change)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderRoadmap(rows) {
  $("roadmapList").innerHTML = rows.map((row) => `
    <article class="roadmap-item">
      <div>
        <strong>${escapeHtml(row.phase)}</strong>
        <span>${escapeHtml(row.duration)}</span>
      </div>
      <div>
        <strong>${escapeHtml(row.budget)}</strong>
        <p>${escapeHtml(row.action)}</p>
      </div>
    </article>
  `).join("");
}

function renderTags(id, values) {
  $(id).innerHTML = values.map((value) => `<span class="tag">${escapeHtml(value)}</span>`).join("");
}

function renderList(id, values) {
  $(id).innerHTML = values.map((value) => `<li>${escapeHtml(value)}</li>`).join("");
}

function bindEvents() {
  $("searchBtn").addEventListener("click", searchBuildings);
  $("analyzeBtn").addEventListener("click", analyze);
  $("accessTokenBtn").addEventListener("click", saveAccessToken);
  $("accessTokenInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") saveAccessToken();
  });
  $("queryInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") searchBuildings();
  });
}

bootstrapHiddenConfig();
renderNeeds();
renderScoreControls();
bindEvents();
