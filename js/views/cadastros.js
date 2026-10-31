'use strict';
F.views = F.views || {};

F.views.cadastros = {
  title: 'Cadastros',
  render(el) {
    const U = F.util, S = F.store, fin = F.fin, ui = F.ui, st = F.state;
    const TABS = [['contas', 'Contas'], ['categorias', 'Categorias'], ['cartoes', 'Cartões'], ['ajustes', 'Ajustes']];
    const tab = TABS.some(t => t[0] === st.cadTab) ? st.cadTab : 'contas';

    let content = '';
    if (tab === 'contas') {
      const accs = S.list('accounts');
      const kindName = k => (F.forms.ACCOUNT_KINDS.find(x => x[0] === k) || [, ''])[1];
      content = `
        <div class="section-title"><h2>Contas</h2><button class="btn btn-sm btn-primary" data-new>${ui.icon('plus', 16)} Nova conta</button></div>
        ${accs.length ? `<div class="list">${accs.map(a => `
          <button type="button" class="item" data-id="${a.id}">
            <span class="item-icon">${ui.icon('wallet', 18)}</span>
            <span class="item-main"><span class="item-title">${U.esc(a.name)}${a.archived ? ' <span class="badge">arquivada</span>' : ''}</span>
              <span class="item-sub">${kindName(a.kind)} · saldo inicial ${U.money(a.initialBalance)} em ${U.fmtDate(a.initialDate)}</span></span>
            <span class="item-amt">${U.money(fin.accountBalance(a.id))}</span>
          </button>`).join('')}</div>` : `<div class="card">${ui.empty('wallet', 'Nenhuma conta', 'Cadastre suas contas bancárias e a carteira com o saldo inicial.')}</div>`}`;
    } else if (tab === 'categorias') {
      const q = U.norm(st.catQ || '');
      const all = S.list('categories').slice().sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
      const match = c => !q || c.code.startsWith(q) || U.norm(c.name).includes(q);
      const group = (kind, title) => {
        const items = all.filter(c => c.kind === kind && match(c));
        return `<h3 class="sub-title">${title} <span class="muted">(${items.length})</span></h3>
          <div class="list">${items.map(c => `
            <button type="button" class="item compact" data-id="${c.id}">
              <span class="code-pill">${U.esc(c.code)}</span>
              <span class="item-main"><span class="item-title">${U.esc(c.name)}</span></span>
              ${c.salary ? '<span class="badge ok">salário</span>' : ''}${c.active === false ? '<span class="badge">inativa</span>' : ''}
            </button>`).join('') || '<div class="item"><span class="text-2">Nada encontrado</span></div>'}</div>`;
      };
      content = `
        <div class="section-title"><h2>Categorias</h2><button class="btn btn-sm btn-primary" data-new>${ui.icon('plus', 16)} Nova categoria</button></div>
        <p class="hint-line">Na hora de lançar, digite o código (ex.: 206) ou parte do nome (ex.: merc).</p>
        <div class="search wide">${ui.icon('search', 18)}<input class="input" type="search" id="cat-q" placeholder="Buscar categoria" value="${U.esc(st.catQ || '')}"></div>
        <div class="grid2 top">${group('despesa', 'Despesas')}<div>${group('receita', 'Receitas')}</div></div>`;
    } else if (tab === 'cartoes') {
      const cards = S.list('cards');
      content = `
        <div class="section-title"><h2>Cartões de crédito</h2><button class="btn btn-sm btn-primary" data-new>${ui.icon('plus', 16)} Novo cartão</button></div>
        ${cards.length ? `<div class="list">${cards.map(c => `
          <button type="button" class="item" data-id="${c.id}">
            <span class="item-icon">${ui.icon('card', 18)}</span>
            <span class="item-main"><span class="item-title">${U.esc(c.name)}</span><span class="item-sub">Fecha dia ${c.closingDay} · vence dia ${c.dueDay}${c.limit ? ` · limite ${U.money(c.limit)}` : ''}</span></span>
            <span class="item-amt">${U.money(fin.cardDebt(c))}</span>
          </button>`).join('')}</div>` : `<div class="card">${ui.empty('card', 'Nenhum cartão', 'Cadastre seu cartão para lançar compras no crédito.')}</div>`}`;
    } else {
      const set = S.settings();
      const user = S.user();
      content = `
        ${user ? `<section class="card mt">
          <h3>Conta</h3>
          <p class="text-2">Conectado como <b>${U.esc(user.email)}</b>. Seus dados ficam na nuvem (Firebase) e aparecem em todos os seus aparelhos.</p>
          <p class="field-hint">Seu ID de usuário:</p>
          <p class="uid">${U.esc(user.uid)}</p>
          <button type="button" class="btn" id="logout">Sair desta conta</button>
        </section>` : ''}
        <section class="card mt">
          <h3>Aparência</h3>
          ${ui.field('Tema', `<select class="input" id="set-theme">${ui.options([['auto', 'Automático (igual ao aparelho)'], ['light', 'Claro'], ['dark', 'Escuro']], set.theme)}</select>`)}
        </section>
        <section class="card mt">
          <h3>Compras no cartão nos gráficos</h3>
          ${ui.field('Contar a compra no mês', `<select class="input" id="set-comp">${ui.options([['compra', 'Da compra (cada parcela no seu mês)'], ['fatura', 'Da fatura (quando vence)']], set.cardCompetence)}</select>`, { hint: 'Define em qual mês a compra no crédito entra no gráfico "gastos × salário". O saldo da conta só muda quando você paga a fatura.' })}
        </section>
        <section class="card mt">
          <h3>Backup dos dados</h3>
          <p class="text-2">${user
            ? 'Seus dados estão na nuvem, mas é bom guardar um backup de vez em quando.'
            : 'Neste modo, os dados ficam salvos só neste navegador. Faça backup de vez em quando.'}</p>
          <div class="actions">
            <button type="button" class="btn" id="bk-export">${ui.icon('download', 18)} Baixar backup</button>
            <label class="btn">${ui.icon('upload', 18)} Restaurar backup<input type="file" id="bk-import" accept="application/json,.json" hidden></label>
          </div>
        </section>
        <section class="card mt danger-zone">
          <h3>Zona de perigo</h3>
          <p class="text-2">Apaga todas as contas, lançamentos, cartões e patrimônio${user ? ', em todos os aparelhos' : ' deste navegador'}.</p>
          <button type="button" class="btn danger" id="bk-clear">${ui.icon('trash', 18)} Apagar todos os dados</button>
        </section>`;
    }

    el.innerHTML = `<div class="seg tabs" role="tablist">${TABS.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === tab}">${l}</button>`).join('')}</div>${content}`;

    el.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { st.cadTab = b.dataset.tab; this.render(el); }));
    const newBtn = el.querySelector('[data-new]');
    if (tab === 'contas') {
      newBtn.addEventListener('click', () => F.forms.account());
      el.querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', () => F.forms.account({ acc: S.get('accounts', b.dataset.id) })));
    } else if (tab === 'categorias') {
      newBtn.addEventListener('click', () => F.forms.category());
      el.querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', () => F.forms.category({ cat: S.get('categories', b.dataset.id) })));
      const qi = el.querySelector('#cat-q');
      qi.addEventListener('input', U.debounce(() => {
        st.catQ = qi.value;
        this.render(el);
        const again = el.querySelector('#cat-q');
        again.focus();
        again.setSelectionRange(again.value.length, again.value.length);
      }, 200));
    } else if (tab === 'cartoes') {
      newBtn.addEventListener('click', () => F.forms.card());
      el.querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', () => F.forms.card({ c: S.get('cards', b.dataset.id) })));
    } else {
      el.querySelector('#set-theme').addEventListener('change', e => S.setSettings({ theme: e.target.value }));
      el.querySelector('#set-comp').addEventListener('change', e => { S.setSettings({ cardCompetence: e.target.value }); ui.toast('Preferência salva'); });
      el.querySelector('#bk-export').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(S.exportAll(), null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `meu-financeiro-backup-${U.today()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      });
      el.querySelector('#bk-import').addEventListener('change', async e => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        if (!(await ui.confirm('Restaurar este backup? Os dados atuais serão substituídos pelos do arquivo.', { ok: 'Restaurar', danger: true }))) return;
        try {
          const obj = JSON.parse(await file.text());
          if (S.user()) ui.toast('Enviando para a nuvem…');
          await S.importAll(obj);
          ui.toast('Backup restaurado');
        } catch (err) {
          ui.toast(err.message || 'Arquivo inválido', 'error');
        }
      });
      el.querySelector('#bk-clear').addEventListener('click', async () => {
        if (!(await ui.confirm('Apagar TODOS os dados? Faça um backup antes. Isso não pode ser desfeito.', { ok: 'Apagar tudo', danger: true }))) return;
        await S.clearAll();
        ui.toast('Dados apagados');
      });
      const logout = el.querySelector('#logout');
      if (logout) logout.addEventListener('click', async () => {
        if (await ui.confirm('Sair da sua conta neste aparelho?', { ok: 'Sair' })) F.app.logout();
      });
    }
  },
};
