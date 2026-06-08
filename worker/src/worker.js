async function searchBuildings(query, env) {
  const safeQuery = String(query || "").trim();
  if (!safeQuery) {
    return { ok: false, query: safeQuery, candidates: [], logs: ["검색어가 없습니다."] };
  }

  const order = looksLikeAddress(safeQuery) ? ["address", "place"] : ["place", "address"];
  const labels = { address: "주소검색결과", place: "장소검색결과" };

  const logs = [];
  let candidates = [];

  for (const type of order) {
    const result = await vworldSearch(safeQuery, type, env);
    logs.push(`${labels[type]}: ${result.log}`);

    if (result.candidates && result.candidates.length > 0) {
      candidates = candidates.concat(
        result.candidates.map((item, index) => ({
          ...item,
          _source_order: candidates.length + index,
        }))
      );
    }
  }

  candidates = dedupeCandidates(candidates)
    .sort(
      (a, b) =>
        (b.match_score || 0) - (a.match_score || 0) ||
        (a._source_order || 0) - (b._source_order || 0)
    )
    .slice(0, 10);

  return { ok: candidates.length > 0, query: safeQuery, candidates, logs };
}
