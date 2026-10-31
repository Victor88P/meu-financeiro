'use strict';
// Componentes de interface: ícones, aviso (toast), janelas (sheet), campo de dinheiro,
// seletor de categoria por código/nome e pequenos helpers de HTML.
F.ui = (() => {
  const U = F.util;

  const ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    chevL: '<path d="m15 18-6-6 6-6"/>',
    chevR: '<path d="m9 18 6-6-6-6"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    swap: '<path d="M4 8h15l-4-4M20 16H5l4 4"/>',
    card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
    alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    car: '<path d="M5 17H3v-5l2-5h14l2 5v5h-2"/><path d="M3 12h18"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/><path d="M9.5 17h5"/>',
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/><path d="M21 11h-5a2 2 0 0 0 0 4h5Z"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 3v3M16 3v3"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
    tag: '<path d="M3 12V3h9l9 9-9 9Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    bank: '<path d="M3 21h18M5 21v-9M19 21v-9M9.5 21v-9M14.5 21v-9M2 9.5 12 4l10 5.5Z"/>',
  };
  const icon = (name, size = 20) =>
    `<svg class="i" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  // ---------- Toast ----------
  let toastTimer;
  function toast(msg, kind = '') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast show ' + kind;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, 2800);
  }

  // ---------- Sheets (janela de baixo no celular, modal no computador) ----------
  // O botão "voltar" do celular fecha a janela em vez de sair da página.
  const stack = [];
  let ignorePop = 0;
  window.addEventListener('popstate', () => {
    if (ignorePop) { ignorePop--; return; }
    const top = stack[stack.length - 1];
    if (top) top.close(true);
  });

  function sheet({ title, body, foot = '', wide = false, onSubmit, onClose }) {
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = `
      <div class="sheet-backdrop" data-close></div>
      <section class="sheet${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${U.esc(title)}">
        <form novalidate autocomplete="off">
          <header class="sheet-head"><h2>${U.esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Fechar">${icon('x')}</button></header>
          <div class="sheet-body">${body}</div>
          ${foot ? `<footer class="sheet-foot">${foot}</footer>` : ''}
        </form>
      </section>`;
    document.getElementById('layer').appendChild(wrap);
    const form = wrap.querySelector('form');
    const api = {
      el: wrap, form, closed: false,
      $: s => wrap.querySelector(s),
      $$: s => [...wrap.querySelectorAll(s)],
      close,
    };
    function close(fromPop) {
      if (api.closed) return;
      api.closed = true;
      const i = stack.indexOf(api);
      if (i >= 0) stack.splice(i, 1);
      wrap.classList.remove('open');
      setTimeout(() => wrap.remove(), 250);
      if (fromPop !== true) { ignorePop++; history.back(); }
      document.body.classList.toggle('locked', stack.length > 0);
      if (onClose) onClose();
    }
    wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (onSubmit) onSubmit((e.submitter && e.submitter.value) || '', api);
    });
    wrap.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    stack.push(api);
    history.pushState({ sheet: stack.length }, '');
    document.body.classList.add('locked');
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
    return api;
  }

  function confirmDialog(message, { title = 'Confirmar', ok = 'Confirmar', danger = false } = {}) {
    return new Promise(resolve => {
      let done = false;
      const s = sheet({
        title,
        body: `<p class="confirm-text">${U.esc(message)}</p>`,
        foot: `<button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" value="ok">${U.esc(ok)}</button><button type="button" class="btn" data-close>Cancelar</button>`,
        onSubmit: () => { done = true; s.close(); resolve(true); },
        onClose: () => { if (!done) resolve(false); },
      });
    });
  }

  // ---------- Campo de dinheiro (estilo caixa eletrônico: digita só números) ----------
  // Ao entrar no campo o valor fica selecionado e a primeira tecla substitui;
  // tocando de novo, continua digitando a partir do valor atual.
  function moneyField(input, cents = 0) {
    let val = Math.abs(cents || 0), fresh = false, focusedAt = 0;
    const moveEnd = () => { const n = input.value.length; try { input.setSelectionRange(n, n); } catch { /* ignore */ } };
    const render = () => { input.value = U.money(val); };
    const changed = () => { fresh = false; render(); moveEnd(); input.dispatchEvent(new CustomEvent('money', { bubbles: true })); };
    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('autocomplete', 'off');
    input.addEventListener('beforeinput', e => {
      if (e.inputType === 'insertText' && e.data != null) {
        e.preventDefault();
        const d = e.data.replace(/\D/g, '');
        if (!d) return;
        val = parseInt(((fresh ? '' : String(val)) + d).replace(/^0+/, '').slice(0, 12) || '0', 10);
        changed();
      } else if (e.inputType.startsWith('delete')) {
        e.preventDefault();
        val = fresh ? 0 : Math.floor(val / 10);
        changed();
      }
    });
    // fallback (colar, teclados que não enviam beforeinput)
    input.addEventListener('input', () => {
      const digits = input.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 12);
      val = parseInt(digits || '0', 10);
      changed();
    });
    input.addEventListener('focus', () => { fresh = true; focusedAt = Date.now(); setTimeout(() => input.select(), 0); });
    input.addEventListener('click', () => { if (Date.now() - focusedAt > 400) { fresh = false; moveEnd(); } });
    input.addEventListener('blur', () => { fresh = false; });
    input.getCents = () => val;
    input.setCents = c => { val = Math.abs(c || 0); render(); input.dispatchEvent(new CustomEvent('money', { bubbles: true })); };
    render();
    return input;
  }

  // ---------- Seletor de categoria: busca por código ou nome ----------
  function categoryPicker(root, { kind, value = null, onChange } = {}) {
    root.classList.add('combo');
    root.innerHTML = `<input class="input" type="text" placeholder="Digite o código ou o nome" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-label="Categoria"><ul class="combo-list" role="listbox" hidden></ul>`;
    const input = root.querySelector('input'), listEl = root.querySelector('ul');
    let selected = value, items = [], active = 0;
    const current = () => (selected ? F.store.get('categories', selected) : null);
    const label = c => (c ? `${c.code} · ${c.name}` : '');
    const cats = () => F.store.list('categories')
      .filter(c => c.kind === kind && (c.active !== false || c.id === selected))
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

    function filter(q) {
      const nq = U.norm(q), all = cats();
      if (!nq) return all;
      const scored = [];
      for (const c of all) {
        const n = U.norm(c.name);
        let s = -1;
        if (c.code === nq) s = 0;
        else if (c.code.startsWith(nq)) s = 1;
        else if (n.startsWith(nq)) s = 2;
        else if (n.split(/[\s/,-]+/).some(w => w.startsWith(nq))) s = 3;
        else if (n.includes(nq)) s = 4;
        if (s >= 0) scored.push([s, c]);
      }
      return scored.sort((a, b) => a[0] - b[0]).map(x => x[1]);
    }
    const options = () => [...listEl.querySelectorAll('li[data-i], li[data-new]')];
    function renderList(q) {
      const qt = q.trim();
      let html = items.map((c, i) => `<li role="option" data-i="${i}"><span class="code">${U.esc(c.code)}</span><span>${U.esc(c.name)}</span></li>`).join('');
      if (qt && !/^\d+$/.test(qt) && !items.some(c => U.norm(c.name) === U.norm(qt))) {
        html += `<li role="option" data-new class="new">${icon('plus', 16)}<span>Cadastrar “${U.esc(qt)}”</span></li>`;
      }
      listEl.innerHTML = html || '<li class="none">Nenhuma categoria encontrada</li>';
      mark();
    }
    function mark() {
      options().forEach((li, i) => li.classList.toggle('active', i === active));
      const el = options()[active];
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
    function open(q) {
      items = filter(q);
      active = 0;
      renderList(q);
      listEl.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }
    function closeList() { listEl.hidden = true; input.setAttribute('aria-expanded', 'false'); }
    function choose(c) {
      selected = c ? c.id : null;
      input.value = label(c);
      closeList();
      if (onChange) onChange(selected);
    }
    function createNew() {
      const name = input.value.trim();
      closeList();
      F.forms.category({ kind, name, onSaved: c => choose(c) });
    }
    function pick(i) {
      if (i < items.length) choose(items[i]);
      else if (listEl.querySelector('[data-new]')) createNew();
    }

    input.addEventListener('focus', () => { input.select(); open(''); });
    input.addEventListener('input', () => open(input.value));
    input.addEventListener('keydown', e => {
      const n = options().length;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (listEl.hidden) { open(''); return; }
        if (!n) return;
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
        mark();
      } else if (e.key === 'Enter') {
        if (!listEl.hidden && n) { e.preventDefault(); pick(active); }
      } else if (e.key === 'Escape') {
        if (!listEl.hidden) { e.preventDefault(); e.stopPropagation(); closeList(); input.value = label(current()); }
      }
    });
    listEl.addEventListener('mousedown', e => e.preventDefault());
    listEl.addEventListener('click', e => {
      const li = e.target.closest('li');
      if (!li) return;
      if (li.hasAttribute('data-new')) createNew();
      else if (li.dataset.i !== undefined) choose(items[+li.dataset.i]);
    });
    // Aceita o que foi digitado se bater exatamente com um código ou nome.
    function commit() {
      const q = input.value.trim();
      if (!q) { if (selected) choose(null); return; }
      if (q === label(current())) return;
      const exact = cats().find(c => c.code === q || U.norm(c.name) === U.norm(q));
      if (exact) choose(exact); else input.value = label(current());
    }
    input.addEventListener('blur', () => setTimeout(() => {
      if (document.activeElement === input) return;
      closeList();
      commit();
    }, 150));

    input.value = label(current());
    return {
      input,
      get value() { return selected; },
      set(id) { selected = id; input.value = label(current()); },
      setKind(k) { if (k === kind) return; kind = k; selected = null; input.value = ''; },
      focus: () => input.focus(),
      commit,
    };
  }

  // ---------- Helpers de HTML ----------
  const field = (label, control, { hint = '', cls = '' } = {}) =>
    `<label class="field ${cls}"><span class="field-label">${label}</span>${control}${hint ? `<span class="field-hint">${hint}</span>` : ''}</label>`;
  const options = (pairs, sel) =>
    pairs.map(([v, l]) => `<option value="${U.esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${U.esc(l)}</option>`).join('');
  const accountOptions = sel =>
    options(F.store.list('accounts').filter(a => !a.archived || a.id === sel).map(a => [a.id, a.name]), sel);

  function monthNav(month) {
    return `<div class="month-nav">
      <button type="button" class="icon-btn" data-month="-1" aria-label="Mês anterior">${icon('chevL')}</button>
      <button type="button" class="month-label" data-month="0" title="Voltar para o mês atual">${U.monthLabel(month)}</button>
      <button type="button" class="icon-btn" data-month="1" aria-label="Próximo mês">${icon('chevR')}</button>
    </div>`;
  }
  function bindMonthNav(root, onChange) {
    root.querySelectorAll('[data-month]').forEach(b => b.addEventListener('click', () => {
      const d = +b.dataset.month;
      F.state.month = d === 0 ? U.monthOf(U.today()) : U.addMonths(F.state.month, d);
      onChange();
    }));
  }

  const empty = (iconName, title, text, action = '') =>
    `<div class="empty">${icon(iconName, 36)}<h3>${title}</h3><p>${text}</p>${action}</div>`;

  return { icon, toast, sheet, confirm: confirmDialog, moneyField, categoryPicker, field, options, accountOptions, monthNav, bindMonthNav, empty };
})();
