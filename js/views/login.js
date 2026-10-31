'use strict';
F.views = F.views || {};

F.views.login = {
  render(el) {
    const ERRORS = {
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
      'auth/invalid-login-credentials': 'E-mail ou senha incorretos.',
      'auth/wrong-password': 'E-mail ou senha incorretos.',
      'auth/user-not-found': 'E-mail ou senha incorretos.',
      'auth/invalid-email': 'Esse e-mail não é válido.',
      'auth/missing-password': 'Digite a senha.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
      'auth/network-request-failed': 'Sem conexão com a internet.',
      'auth/user-disabled': 'Este usuário está desativado.',
    };
    el.innerHTML = `
      <div class="auth-wrap">
        <form class="card auth-card" novalidate>
          <img src="icons/icon.svg" width="56" height="56" alt="">
          <h1>Meu Financeiro</h1>
          <p class="text-2">Entre com o seu e-mail e senha.</p>
          ${F.ui.field('E-mail', '<input class="input" type="email" id="l-email" autocomplete="username" inputmode="email" autocapitalize="off">')}
          ${F.ui.field('Senha', '<input class="input" type="password" id="l-pass" autocomplete="current-password">')}
          <p class="auth-msg" role="alert" hidden></p>
          <button class="btn btn-primary auth-btn">Entrar</button>
          <button type="button" class="link auth-reset">Esqueci minha senha</button>
        </form>
      </div>`;
    const form = el.querySelector('form'), msg = el.querySelector('.auth-msg'), btn = el.querySelector('.auth-btn');
    const email = el.querySelector('#l-email'), pass = el.querySelector('#l-pass');
    const show = (text, ok = false) => { msg.textContent = text; msg.className = 'auth-msg' + (ok ? ' ok' : ''); msg.hidden = false; };
    const fail = e => show(ERRORS[e.code] || `Não foi possível entrar (${e.code || e.message}).`);

    form.addEventListener('submit', async e => {
      e.preventDefault();
      msg.hidden = true;
      if (!email.value.trim()) { show('Digite o seu e-mail.'); email.focus(); return; }
      btn.disabled = true;
      btn.textContent = 'Entrando…';
      try {
        await firebase.auth().signInWithEmailAndPassword(email.value.trim(), pass.value);
      } catch (err) {
        fail(err);
        btn.disabled = false;
        btn.textContent = 'Entrar';
      }
    });
    el.querySelector('.auth-reset').addEventListener('click', async () => {
      if (!email.value.trim()) { show('Digite o seu e-mail acima e toque de novo em "Esqueci minha senha".'); email.focus(); return; }
      try {
        await firebase.auth().sendPasswordResetEmail(email.value.trim());
        show('Se esse e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.', true);
      } catch (err) { fail(err); }
    });
    setTimeout(() => email.focus(), 50);
  },
};
