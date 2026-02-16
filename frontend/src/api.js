const API_BASE = import.meta.env.VITE_API_BASE || '';

async function request(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

export function searchFunctions(query, limit = 40) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  params.set('limit', String(limit));
  return request(`/api/functions?${params.toString()}`);
}

export function fetchSubgraph(functionId, depth = 2, limit = 60) {
  const params = new URLSearchParams({ depth: String(depth), limit: String(limit) });
  return request(`/api/function/${functionId}/subgraph?${params.toString()}`);
}

export function fetchSource(file) {
  const params = new URLSearchParams({ file });
  return request(`/api/source?${params.toString()}`);
}

export function fetchFunction(functionId) {
  return request(`/api/function/${functionId}`);
}
