const DEFAULT_CHAT_HOST =
  window.location.hostname && window.location.hostname !== ""
    ? window.location.hostname
    : "127.0.0.1";

const IS_EMBEDDED_IN_BACKEND =
  (window.location.protocol === "http:" || window.location.protocol === "https:") &&
  (window.location.pathname === "/user" || window.location.pathname.startsWith("/user/"));

const APP_CONFIG = {
  APP_NAME: "Quantum Chat",
  LOGIN_REDIRECT: "chat.html",
  LOGOUT_REDIRECT: "login.html",
  API_BASE_URL: IS_EMBEDDED_IN_BACKEND
    ? "/api/v1"
    : `http://${DEFAULT_CHAT_HOST}:8000/api/v1`,
  DEMO_REPLY_DELAY: 500
};
