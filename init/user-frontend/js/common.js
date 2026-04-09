const STORAGE_KEYS = {
  USER: "chat_demo_user",
  TOKEN: "chat_demo_token",
  MESSAGES: "chat_demo_messages"
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getCurrentTime() {
  const now = new Date();
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

function getStoredUser() {
  const raw = localStorage.getItem(STORAGE_KEYS.USER);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function cloneData(data) {
  return JSON.parse(JSON.stringify(data));
}