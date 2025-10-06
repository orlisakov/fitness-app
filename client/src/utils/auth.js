// src/utils/auth.js
import config from "../config";

export const getToken = () =>
  sessionStorage.getItem("token") || localStorage.getItem("token");

export const buildDownloadUrl = (plan) => {
  const token = getToken();
  const base = plan.downloadUrl || `/api/workouts/file/${plan._id}`;
  const absolute = base.startsWith("http")
    ? base
    : `${config.apiBaseUrl}${base}`;
  if (!token) return absolute;
  const sep = absolute.includes("?") ? "&" : "?";
  return `${absolute}${sep}token=${encodeURIComponent(token)}`;
};
