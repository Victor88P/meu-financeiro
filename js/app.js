'use strict';
// Inicialização: login (quando o Firebase está configurado), rotas (#/inicio, #/extrato...), tema e atalhos.
(() => {
  const U = F.util, S = F.store;
  const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

  F.state = {
    month: U.monthOf(U.today()),
    account: 'all',
    q: '',
    cardId: null,
    invoiceKey: null,
    invoiceCard: null,
    cadTab: 'contas',
    catQ: '',
  };

  const ROUTES = {
    inicio: F.views.dashboard,
    extrato: F.views.extrato,
    cartoes: F.views.cartoes,
    patrimonio: F.views.patrimonio,
    cadastros: F.views.cadastros,
  };
  const view = document.getElementById('view');
  const authEl = document.getElementById('auth');
  let current = null;
  let mode = 'loading'; // loading | auth | app

  function setMode(m) {
    mode = m;
    document.body.dataset.mode = m;
    authEl.hidden = m === 'app';
    if (m === 'app') authEl.innerHTML = '';
  }

  function render() {
    if (mode !== 'app') return;
    const name = (location.hash.match(/^#\/(\w+)/) || [])[1];
    const key = ROUTES[name] ? name : 'inicio';
    const v = ROUTES[key];
    if (current !== key) { current = key; window.scrollTo(0, 0); }
    document.getElementById('page-title').textContent = v.title;
    document.title = `${v.title} · Meu Financeiro`;
    document.querySelectorAll('.nav a[data-route]').forEach(a => a.classList.toggle('active', a.dataset.route === key));
    v.render(view);
  }

  function applyTheme() {
    const t = S.settings().theme;
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
  }

  function showApp() { setMode('app'); applyTheme(); render(); }
  function showSplash(text, retry = false) {
    setMode('loading');
    authEl.innerHTML = `<div class="auth-wrap"><div class="splash"><img src="icons/icon.svg" width="56" height="56" alt=""><p>${U.esc(text)}</p>${retry ? '<button class="btn btn-primary" onclick="location.reload()">Tentar de novo</button>' : ''}</div></div>`;
  }
  function showLogin() {
    document.querySelectorAll('.sheet-wrap').forEach(w => w.remove());
    document.body.classList.remove('locked');
    setMode('auth');
    F.views.login.render(authEl);
  }

  S.onChange(() => { applyTheme(); render(); });
  window.addEventListener('hashchange', render);
  let lastW = window.innerWidth;
  window.addEventListener('resize', U.debounce(() => {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    render();
  }, 200));

  document.getElementById('btn-add').addEventListener('click', () => F.forms.entry());
  // Atalho no computador: tecla N abre um novo lançamento.
  document.addEventListener('keydown', e => {
    if (mode !== 'app' || e.key.toLowerCase() !== 'n' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.querySelector('.sheet-wrap')) return;
    e.preventDefault();
    F.forms.entry();
  });

  const loadScript = src => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(src));
    document.head.appendChild(s);
  });

  async function start() {
    // O login do Firebase não funciona em páginas abertas direto do arquivo (file://).
    if (!F.firebaseConfig || location.protocol === 'file:') { S.load(); showApp(); return; }
    showSplash('Carregando…');
    try {
      for (const f of ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js']) await loadScript(FIREBASE_SDK + f);
    } catch {
      showSplash('Não foi possível carregar o app. Verifique a internet.', true);
      return;
    }
    firebase.initializeApp(F.firebaseConfig);
    const db = firebase.firestore();
    db.settings({ ignoreUndefinedProperties: true });
    // guarda uma cópia no aparelho: abre rápido e funciona sem internet
    await db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
    firebase.auth().onAuthStateChanged(async user => {
      if (!user) { S.disconnect(); showLogin(); return; }
      showSplash('Carregando seus dados…');
      await S.connect(user);
      showApp();
    });
  }

  F.app = {
    render,
    logout: () => firebase.auth().signOut(),
  };

  start();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
