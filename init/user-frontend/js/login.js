const loginForm = document.getElementById("loginForm");
const phoneInput = document.getElementById("phone");
const passwordInput = document.getElementById("password");
const agreeInput = document.getElementById("agree");
const message = document.getElementById("message");

if (loginForm) {
  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const phone = phoneInput.value.trim();
    const password = passwordInput.value.trim();
    const agree = agreeInput.checked;

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      message.textContent = "手机号格式不正确";
      message.style.color = "#f87171";
      return;
    }

    if (password.length < 6) {
      message.textContent = "密码长度至少 6 位";
      message.style.color = "#f87171";
      return;
    }

    if (!agree) {
      message.textContent = "请先勾选用户协议";
      message.style.color = "#f87171";
      return;
    }

    message.textContent = "登录中，请稍候...";
    message.style.color = "#38bdf8";

    try {
      const result = await fakeLoginApi(phone, password);

      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(result.user));
      localStorage.setItem(STORAGE_KEYS.TOKEN, result.token);

      message.textContent = "登录成功，正在跳转...";
      message.style.color = "#22c55e";

      setTimeout(function () {
        window.location.href = APP_CONFIG.LOGIN_REDIRECT;
      }, 500);
    } catch (error) {
      message.textContent = error.message || "登录失败";
      message.style.color = "#f87171";
    }
  });
}
