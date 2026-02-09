// fitmatch/client/src/config.js
//const URL_WEB = "https://fitness-app-wdsh.onrender.com";

// src/config.js
const apiBaseUrl =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

console.log("API BASE (FORCED):", apiBaseUrl);

const config = {
  apiBaseUrl,
};

export default config;
