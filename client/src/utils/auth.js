// src/utils/auth.js
import config from "../config";

export function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}

export function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export const joinUrl = (base, path) =>
  `${String(base).replace(/\/$/, "")}/${String(path || "").replace(/^\//, "")}`;

// אם יש לך הורדה שחייבת token ב-query (רק אם השרת תומך)
export const buildDownloadUrl = (plan) => {
  const token = getToken();
  const base = plan.downloadUrl || `/api/workouts/file/${plan._id}`;
  const absolute = base.startsWith("http")
    ? base
    : joinUrl(config.apiBaseUrl, base);

  if (!token) return absolute;

  const sep = absolute.includes("?") ? "&" : "?";
  return `${absolute}${sep}token=${encodeURIComponent(token)}`;
};
