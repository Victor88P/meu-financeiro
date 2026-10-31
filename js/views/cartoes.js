'use strict';
F.views = F.views || {};

F.views.cartoes = {
  title: 'Cartões',
  render(el) {
    const U = F.util, S = F.store, fin = F.fin, ui = F.ui, st = F.state;
    const cards = S.list('cards');
    if (!cards.length) {
      el.innerHTML = ui.empty('card', 'Nenhum cartão cadastrado', 'Cadastre seu cartão com o dia de fechamento e de vencimento. As compras viram uma despesa futura, sem mexer no saldo da conta.', '<button class="btn btn-primary" data-new-card>Cadastrar cartão</button>');
      el.querySelector('[data-new-card]').addEventListener('click', () => F.forms.card());
      return;
    }
    const card = S.get('cards', st.cardId) || cards[0];
    st.cardId = card.id;
    const invs = fin.invoices(card);
    const cur = fin.currentInvoiceKey(card);
    if (!st.invoiceKey || st.invoiceCard !== card.id) {
      st.invoiceKey = (invs.find(i => i.open > 0) || {}).key || cur;
      st.invoiceCard = card.id;
    }
    const inv = fin.invoice(card, st.invoiceKey);
    const debt = fin.cardDebt(card);
    const used = Math.max(0, debt);
    const STATUS = {
      aberta: i => ['info', `Aberta · fecha ${U.fmtDayMonth(i.closing)}`],
      fechada: i => ['warn', `Fechada · vence ${U.fmtDayMonth(i.due)}`],
      vencida: i => ['crit', `Vencida em ${U.fmtDayMonth(i.due)}`],
      paga: () => ['ok', 'Paga'],
      vazia: () => ['', 'Sem lançamentos'],
    };
    const badge = i => { const [cls, txt] = STATUS[i.status](i); return `<span class="badge ${cls}">${txt}</span>`; };
    const openList = invs.filter(i => i.open > 0 || i.key === cur);
    if (!openList.some(i => i.key === cur)) openList.push(fin.invoice(card, cur));
    openList.sort((a, b) => a.key.localeCompare(b.key));
    const invRow = i => `
      <button type="button" class="inv-row${i.key === inv.key ? ' active' : ''}" data-key="${i.key}">
        <span><b>${U.cap(U.monthShort(i.key))}</b> ${badge(i)}</span>
        <span class="tnum">${U.money(i.open)}</span>
      </button>`;
    const catName = id => { const c = S.get('categories', id); return c ? `${c.code} ${c.name}` : 'Sem categoria'; };

    el.innerHTML = `
      ${cards.length > 1 ? `<div class="chips card-tabs">${cards.map(c => `<button type="button" class="chip${c.id === card.id ? ' active' : ''}" data-card="${c.id}">${U.esc(c.name)}</button>`).join('')}</div>` : ''}
      <div class="grid2">
        <section class="cc">
          <div class="cc-top"><span class="cc-name">${U.esc(card.name)}</span><button type="button" class="icon-btn on-dark" data-edit-card aria-label="Editar cartão">${ui.icon('edit', 18)}</button></div>
          <div class="cc-label">Despesa futura (falta pagar, com parcelas)</div>
          <div class="cc-value">${U.money(debt)}</div>
          ${card.limit ? `
            <div class="cc-lim"><span style="width:${Math.min(100, (used / card.limit) * 100)}%"></span></div>
            <div class="cc-foot"><span>Usado ${U.money(used)}</span><span>Disponível ${U.money(card.limit - used)}</span></div>` : ''}
          <div class="cc-foot muted-on-dark"><span>Fecha dia ${card.closingDay}</span><span>Vence dia ${card.dueDay}</span></div>
        </section>
        <section class="card">
          <div class="actions">
            <button type="button" class="btn btn-primary" data-buy>${ui.icon('plus', 18)} Nova compra</button>
            <button type="button" class="btn" data-pay>${ui.icon('check', 18)} Antecipar / pagar</button>
          </div>
          <h3 class="sub-title">Faturas</h3>
          <div class="inv-list">${openList.slice(0, 4).map(invRow).join('')}</div>
          ${openList.length > 4 ? `<details class="more"${openList.slice(4).some(i => i.key === inv.key) ? ' open' : ''}>
            <summary>Ver mais ${openList.length - 4} faturas futuras (${U.money(U.sum(openList.slice(4), i => i.open))})</summary>
            <div class="inv-list">${openList.slice(4).map(invRow).join('')}</div>
          </details>` : ''}
        </section>
      </div>

      <section class="card mt">
        <div class="card-head">
          <div class="month-nav">
            <button type="button" class="icon-btn" data-inv="-1" aria-label="Fatura anterior">${ui.icon('chevL')}</button>
            <span class="month-label">Fatura ${U.monthShort(inv.key)}</span>
            <button type="button" class="icon-btn" data-inv="1" aria-label="Próxima fatura">${ui.icon('chevR')}</button>
          </div>
          ${badge(inv)}
        </div>
        <div class="summary small-summary">
          <div><div class="lbl">Total da fatura</div><div class="val">${U.money(inv.total)}</div></div>
          <div><div class="lbl">${inv.credit ? 'Pago + crédito anterior' : 'Já pago / antecipado'}</div><div class="val pos">${U.money(inv.paid + inv.credit)}</div></div>
          <div><div class="lbl">Falta pagar</div><div class="val">${U.money(inv.open)}</div></div>
          <div><div class="lbl">Fecha / vence</div><div class="val">${U.fmtDayMonth(inv.closing)} · ${U.fmtDayMonth(inv.due)}</div></div>
        </div>
        ${inv.items.length || inv.payments.length ? `<div class="list flat">
          ${inv.items.map(it => `
            <button type="button" class="item" data-purchase="${it.purchase.id}">
              <span class="item-icon ${it.amount < 0 ? 'in' : 'out'}">${ui.icon(it.amount < 0 ? 'up' : 'card', 18)}</span>
              <span class="item-main">
                <span class="item-title">${U.esc(it.purchase.description || catName(it.purchase.categoryId))}${it.of > 1 ? ` <span class="badge">${it.n}/${it.of}</span>` : ''}</span>
                <span class="item-sub">${U.fmtDate(it.purchase.date)} · ${U.esc(catName(it.purchase.categoryId))}</span>
              </span>
              <span class="item-amt ${it.amount < 0 ? 'pos' : ''}">${U.money(Math.abs(it.amount))}</span>
            </button>`).join('')}
          ${inv.payments.map(p => `
            <button type="button" class="item" data-payment="${p.id}">
              <span class="item-icon in">${ui.icon('check', 18)}</span>
              <span class="item-main"><span class="item-title">Pagamento / antecipação</span><span class="item-sub">${U.fmtDate(p.date)} · saiu de ${U.esc((S.get('accounts', p.accountId) || {}).name || '?')}</span></span>
              <span class="item-amt pos">${U.moneySigned(-p.amount)}</span>
            </button>`).join('')}
        </div>` : '<p class="text-2">Nenhuma compra nesta fatura.</p>'}
      </section>`;

    el.querySelectorAll('[data-card]').forEach(b => b.addEventListener('click', () => { st.cardId = b.dataset.card; st.invoiceKey = null; this.render(el); }));
    el.querySelectorAll('[data-key]').forEach(b => b.addEventListener('click', () => { st.invoiceKey = b.dataset.key; this.render(el); }));
    el.querySelectorAll('[data-inv]').forEach(b => b.addEventListener('click', () => { st.invoiceKey = U.addMonths(inv.key, +b.dataset.inv); this.render(el); }));
    el.querySelector('[data-edit-card]').addEventListener('click', () => F.forms.card({ c: card }));
    el.querySelector('[data-buy]').addEventListener('click', () => { S.pref('lastCard', card.id); F.forms.entry({ type: 'cartao' }); });
    el.querySelector('[data-pay]').addEventListener('click', () => F.forms.invoicePayment({ cardId: card.id, key: inv.open > 0 ? inv.key : undefined }));
    el.querySelectorAll('[data-purchase]').forEach(b => b.addEventListener('click', () => F.forms.entry({ purchase: S.get('cardPurchases', b.dataset.purchase) })));
    el.querySelectorAll('[data-payment]').forEach(b => b.addEventListener('click', () => F.forms.invoicePayment({ tx: S.get('transactions', b.dataset.payment) })));
  },
};
