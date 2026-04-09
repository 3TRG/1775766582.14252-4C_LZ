// register.js - 优化注册页面逻辑

document.getElementById('registerForm').addEventListener('submit', function(e) {
  e.preventDefault();

  // 获取表单数据
  const username = document.getElementById('username').value;
  const phone = document.getElementById('phone').value;
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  // 清除之前的错误提示
  document.getElementById('message').textContent = '';

  // 简单的表单验证
  if (!username || !phone || !password || !confirmPassword) {
    document.getElementById('message').textContent = '请填写所有字段！';
    return;
  }

  if (password !== confirmPassword) {
    document.getElementById('message').textContent = '密码和确认密码不一致！';
    return;
  }

  if (!/^1[3-9]\d{9}$/.test(phone)) {
    document.getElementById('message').textContent = '请输入有效的手机号！';
    return;
  }

  if (password.length < 6) {
    document.getElementById('message').textContent = '密码长度不能少于6个字符！';
    return;
  }

  // 禁用按钮防止重复提交
  const registerBtn = document.querySelector('button[type="submit"]');
  registerBtn.disabled = true;

  registerUserApi({
    username: username,
    account: phone,
    password: password
  })
    .then(() => {
      document.getElementById('message').textContent = '注册成功，请登录';
      document.getElementById('message').style.color = '#22c55e';
      setTimeout(function () {
        window.location.href = 'login.html';
      }, 500);
    })
    .catch(err => {
      console.error(err);
      document.getElementById('message').textContent = err.message || '注册失败，请重试！';
      document.getElementById('message').style.color = '#f87171';
    })
    .finally(() => {
      registerBtn.disabled = false;
    });
});
