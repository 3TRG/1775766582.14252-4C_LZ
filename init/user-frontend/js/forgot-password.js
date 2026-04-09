// forgot-password.js - 优化找回密码页面逻辑

document.getElementById('forgotPasswordForm').addEventListener('submit', function(e) {
  e.preventDefault();

  const userIdentifier = document.getElementById('userIdentifier').value; // 用户名、手机号或邮箱
  const verificationCode = document.getElementById('verificationCode').value; // 验证码

  // 清除之前的错误提示
  document.getElementById('message').textContent = '';

  // 表单验证
  if (!userIdentifier || !verificationCode) {
    document.getElementById('message').textContent = '请输入手机号、邮箱或验证码！';
    return;
  }

  if (!/^1[3-9]\d{9}$/.test(userIdentifier) && !/\S+@\S+\.\S+/.test(userIdentifier)) {
    document.getElementById('message').textContent = '请输入有效的手机号或邮箱！';
    return;
  }

  // 禁用按钮防止重复提交
  const resetBtn = document.querySelector('button[type="submit"]');
  resetBtn.disabled = true;

  // 模拟发送数据到后端进行找回密码操作
  fetch('/forgot-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ userIdentifier, verificationCode })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // 找回密码成功，跳转到密码重置页面
      window.location.href = 'reset-password.html';
    } else {
      document.getElementById('message').textContent = data.message || '找回密码失败，请重试！';
    }
  })
  .catch(err => {
    console.error(err);
    document.getElementById('message').textContent = '发生错误，请稍后再试！';
  })
  .finally(() => {
    // 恢复按钮状态
    resetBtn.disabled = false;
  });
});