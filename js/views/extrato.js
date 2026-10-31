'use strict';
F.views = F.views || {};

F.views.extrato = {
  title: 'Extrato',
  render(el) {
    const U = F.util, S = F.store, fin = F.fin, ui = F.ui, st = F.state;
    const accounts = S.list('accounts');
    if (!accounts.length) {
      el.innerHTML = ui.empty('list', 'Nenhuma conta cadastrada', 'Cadastre sua conta com o saldo inicial para ver o extrato.', '<button class="btn btn-primary" data-new-acc>Cadastrar conta</button>');
      el.querySelector('[data-new-acc]').addEventListener('click', () => F.forms.account());
      return;
    }
    if (st.account !== 'all' && !S.get('accounts', st.account)) st.account = 'all';

    const stmt = fin.statement(st.account, st.month);
    const single = st.account !== 'all';
    const accName = id => (S.get('accounts', id) || {}).name || '?';
    const catOf = tx => S.get('categories', tx.categoryId);
    const today = U.today();

    function describe(r) {
      if (r.kind === 'inicial') return { icon: 'flag', cls: '', title: 'Saldo inicial', sub: r.account.name };
      const tx = r.tx, c = catOf(tx);
      switch (tx.type) {
        case 'transferencia':
          return { icon: 'swap', cls: '', title: tx.description || 'Transferência', sub: `${accName(tx.accountId)} → ${accName(tx.toAccountId)}` };
        case 'aporte':
        case 'resgate': {
          const inv = S.get('investments', tx.investmentId);
          return {
            icon: 'trend',
            cls: tx.type === 'resgate' ? 'in' : 'out',
            title: tx.description || (tx.type === 'aporte' ? 'Aporte' : 'Resgate'),
            sub: `${tx.type === 'aporte' ? 'Aporte em' : 'Resgate de'} ${inv ? inv.name : 'aplicação'}${single ? '' : ' · ' + accName(tx.accountId)}`,
          };
        }
        case 'fatura': {
          const card = S.get('cards', tx.cardId);
          return { icon: 'card', cls: 'out', title: tx.description || 'Pagamento de fatura', sub: `Cartão ${card ? card.name : ''}${single ? '' : ' · ' + accName(tx.accountId)}` };
        }
        default:
          return {
            icon: tx.type === 'receita' ? 'up' : 'down',
            cls: tx.type === 'receita' ? 'in' : 'out',
            title: tx.description || (c ? c.name : 'Sem categoria'),
            sub: [c ? `${c.code} ${c.name}` : '', single ? '' : accName(tx.accountId)].filter(Boolean).join(' · '),
          };
      }
    }

    el.innerHTML = `
      <div class="toolbar">
        ${ui.monthNav(st.month)}
        <select class="input select-acc" aria-label="Conta">
          <option value="all">Todas as contas</option>${ui.options(accounts.map(a => [a.id, a.name + (a.archived ? ' (arquivada)' : '')]), st.account)}
        </select>
        <div class="search">${ui.icon('search', 18)}<input class="input" type="search" placeholder="Buscar no mês" value="${U.esc(st.q)}" aria-label="Buscar"></div>
      </div>
      <div class="summary">
        <div><div class="lbl">Saldo anterior</div><div class="val">${U.money(stmt.opening)}</div></div>
        <div><div class="lbl">Entradas</div><div class="val pos">${U.moneySigned(stmt.inflow)}</div></div>
        <div><div class="lbl">Saídas</div><div class="val neg">${U.moneySigned(-stmt.outflow)}</div></div>
        <div><div class="lbl">Saldo no fim do mês</div><div class="val ${stmt.closing < 0 ? 'neg' : ''}">${U.money(stmt.closing)}</div></div>
      </div>
      ${st.account === 'all' ? '<p class="hint-line">Transferências entre suas contas não contam como entrada nem saída na visão "Todas as contas".</p>' : ''}
      <div id="ext-list"></div>`;

    const listEl = el.querySelector('#ext-list');
    // saldo ao fim de cada dia (com todos os lançamentos, mesmo se houver busca)
    const dayBal = new Map();
    stmt.rows.forEach(r => dayBal.set(r.date, r.balance));

    function renderList() {
      const q = U.norm(st.q);
      let rows = stmt.rows.map(r => ({ r, d: describe(r) }));
      if (q) rows = rows.filter(({ r, d }) => U.norm(`${d.title} ${d.sub} ${r.tx ? r.tx.notes || '' : ''} ${U.money(Math.abs(r.amount))}`).includes(q));
      if (!rows.length) {
        listEl.innerHTML = ui.empty('list', q ? 'Nada encontrado' : 'Sem lançamentos neste mês', q ? 'Tente outra palavra.' : 'Toque no botão + para lançar.');
        return;
      }
      const byDay = new Map();
      rows.slice().reverse().forEach(x => {
        if (!byDay.has(x.r.date)) byDay.set(x.r.date, []);
        byDay.get(x.r.date).push(x);
      });
      let html = '<div class="list">';
      for (const [date, items] of byDay) {
        html += `<div class="day-head"><span>${U.dayHeader(date)}${date > today ? ' <span class="badge info">agendado</span>' : ''}</span><span class="tnum">Saldo ${U.money(dayBal.get(date))}</span></div>`;
        for (const { r, d } of items) {
          const neutral = r.kind === 'tx' && r.tx.type === 'transferencia' && !single;
          const amtCls = neutral ? 'text-2' : r.amount > 0 ? 'pos' : r.amount < 0 ? 'neg' : '';
          const amtText = neutral ? U.money(r.tx.amount) : r.kind === 'inicial' ? U.money(r.amount) : U.moneySigned(r.amount);
          const attrs = r.kind === 'tx' ? `data-tx="${r.tx.id}"` : `data-acc="${r.account.id}"`;
          html += `<button type="button" class="item" ${attrs}>
            <span class="item-icon ${d.cls}">${ui.icon(d.icon, 18)}</span>
            <span class="item-main"><span class="item-title">${U.esc(d.title)}</span><span class="item-sub">${U.esc(d.sub)}</span></span>
            <span class="item-amt ${amtCls}">${amtText}</span>
          </button>`;
        }
      }
      listEl.innerHTML = html + '</div>';
      listEl.querySelectorAll('[data-tx]').forEach(b => b.addEventListener('click', () => F.forms.entry({ tx: S.get('transactions', b.dataset.tx) })));
      listEl.querySelectorAll('[data-acc]').forEach(b => b.addEventListener('click', () => F.forms.account({ acc: S.get('accounts', b.dataset.acc) })));
    }
    renderList();

    ui.bindMonthNav(el, () => this.render(el));
    el.querySelector('.select-acc').addEventListener('change', e => { st.account = e.target.value; this.render(el); });
    el.querySelector('input[type=search]').addEventListener('input', U.debounce(e => { st.q = e.target.value; renderList(); }, 150));
  },
};
