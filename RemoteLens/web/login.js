'use strict';
(function () {
    const zh = (navigator.language || '').toLowerCase().startsWith('zh');
    const text = zh ? {
        hint: '输入电脑上 RemoteLens 插件窗口里显示的访问口令，或直接扫描窗口里的二维码。',
        placeholder: '访问口令',
        submit: '进入',
        wrong_token: '口令不正确。',
        too_many_attempts: '尝试次数过多，请 5 分钟后再试。',
        network: '连不上电脑，请检查网络。',
    } : {
        hint: 'Enter the access token shown in the RemoteLens plugin window on your computer, or scan its QR code.',
        placeholder: 'Access token',
        submit: 'Enter',
        wrong_token: 'Wrong token.',
        too_many_attempts: 'Too many attempts. Try again in 5 minutes.',
        network: 'Cannot reach the computer. Check your network.',
    };
    document.documentElement.lang = zh ? 'zh-CN' : 'en';
    document.querySelector('[data-t="hint"]').textContent = text.hint;
    document.querySelector('[data-t="submit"]').textContent = text.submit;
    const input = document.getElementById('loginToken');
    const error = document.getElementById('loginError');
    input.placeholder = text.placeholder;

    document.getElementById('loginForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        error.textContent = '';
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: input.value.trim() }),
            });
            if (res.ok) {
                location.replace('/');
                return;
            }
            const body = await res.json().catch(() => ({}));
            error.textContent = text[body.error] || text.wrong_token;
        } catch {
            error.textContent = text.network;
        }
    });
})();
