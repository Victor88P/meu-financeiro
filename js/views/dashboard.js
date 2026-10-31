'use strict';
F.views = F.views || {};

F.views.dashboard = {
  title: 'Início',
  render(el) {
    const U = F.util, S = F.store, fin = F.fin, ui = F.ui;

    if (!S.list('accounts').length) {
      el.innerHTML = `
        <section class="card welcome">
          <h2>Bem-vindo ao seu financeiro 👋</h2>
          <p class="text-2">Para começar, siga estes passos (dá para fazer depois também):</p>
          <ol class="steps">
            <li><div><b>Cadastre suas contas</b> com o saldo inicial de cada uma.</div><button class="btn btn-primary btn-sm" data-act="acc">Cadastrar conta</button></li>
            <li><div><b>Confira as categorias</b>. Já deixei algumas com código, como 101 Salário e 206 Mercado.</div><a class="btn btn-sm" href="#/cadastros" data-tab="categorias">Ver categorias</a></li>
            <li><div><b>Cadastre seu cartão</b> com os dias de fechamento e vencimento.</div><button class="btn btn-sm" data-act="card">Cadastrar cartão</button></li>
            <li><div><b>Lance seu carro e sua aplicação</b> em Patrimônio.</div><a class="btn btn-sm" href="#/patrimonio">Ir para Patrimônio</a></li>
          </ol>
        </section>`;
      el.querySelector('[data-act=acc]').addEventListener('click', () => F.forms.account());
      el.querySelector('[data-act=card]').addEventListener('click', () => F.forms.card());
      el.querySelector('[data-tab]').addEventListener('click', () => { F.state.cadTab = 'categorias'; });
      return;
    }

    const month = F.state.month;
    const sum = fin.monthSummary(month);
    const pat = fin.patrimony();
    const livre = pat.contas - pat.dividas;
    const accounts = S.list('accounts').filter(a => !a.archived);
    const nextInv = S.list('cards')
      .flatMap(c => fin.invoices(c).filter(i => i.open > 0).map(inv => ({ c, inv })))
      .sort((a, b) => a.inv.due.localeCompare(b.inv.due))[0];

    // ---- Gastos x salário ----
    const base = sum.salario || sum.receitas;
    const baseName = sum.salario ? 'do salário' : 'das receitas';
    const ratio = base ? sum.despesas / base : null;
    let level = '', statusLine = '';
    if (ratio !== null && ratio > 1) {
      level = 'crit';
      statusLine = `<div class="status-line crit-text">${ui.icon('alert', 16)} Gastos acima ${baseName} em ${U.money(sum.despesas - base)}</div>`;
    } else if (ratio !== null && ratio >= 0.8) {
      level = 'warn';
      statusLine = `<div class="status-line">${ui.icon('alert', 16)} Atenção: já foram mais de 80% ${baseName}</div>`;
    }
    const meter = ratio === null
      ? `<p class="text-2">Nenhuma receita lançada em ${U.monthLabel(month).toLowerCase()}. Lance seu salário com a categoria <b>101 · Salário</b> para acompanhar quanto dele você já gastou.</p>
         <div class="kv"><span>Despesas do mês</span><b>${U.money(sum.despesas)}</b></div>`
      : `<div class="hero-num">${U.pct(ratio)}</div>
         <div class="text-2">${sum.salario ? 'do salário foi gasto' : 'das receitas foram gastas'} em ${U.monthLabel(month).toLowerCase()}</div>
         <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(ratio * 100)}" aria-label="Percentual gasto">
           <div class="meter-fill ${level}" style="width:${Math.min(100, ratio * 100)}%"></div>
         </div>
         <div class="meter-cap"><span>Gastou <b>${U.money(sum.despesas)}</b></span><span>de <b>${U.money(base)}</b></span></div>
         ${statusLine}
         <div class="kv first"><span>Despesas na conta</span><span>${U.money(sum.despConta)}</span></div>
         <div class="kv"><span>Compras no cartão</span><span>${U.money(sum.despCartao)}</span></div>
         ${sum.receitas !== sum.salario && sum.salario ? `<div class="kv"><span>Outras receitas</span><span>${U.money(sum.receitas - sum.salario)}</span></div>` : ''}
         <div class="kv total"><span>${sum.resultado >= 0 ? 'Sobra do mês' : 'Faltou no mês'}</span><b class="${sum.resultado >= 0 ? 'pos' : 'neg'}">${U.moneySigned(sum.resultado)}</b></div>`;

    // ---- Despesas por categoria ----
    const cats = sum.categories;
    const top = cats.slice(0, 7);
    const rest = cats.slice(7);
    if (rest.length) top.push({ category: { code: '', name: `Outras (${rest.length})` }, amount: U.sum(rest, r => r.amount) });
    const maxCat = Math.max(1, ...top.map(c => c.amount));
    const catRows = top.length
      ? top.map(r => `
          <div class="cat-row">
            <div class="cat-top"><span class="code">${U.esc(r.category ? r.category.code : '')}</span><span class="name">${U.esc(r.category ? r.category.name : 'Sem categoria')}</span><span class="val">${U.money(r.amount)}</span></div>
            <div class="hbar"><span style="width:${(r.amount / maxCat) * 100}%"></span></div>
            <div class="cat-sub">${U.pct(r.amount / sum.despesas)} das despesas${base ? ` · ${U.pct(r.amount / base)} ${baseName}` : ''}</div>
          </div>`).join('')
      : '<p class="text-2">Nenhuma despesa neste mês.</p>';

    const goals = S.list('goals');

    // ---- Próximos vencimentos ----
    const up = fin.upcoming(30);
    const upRows = up.slice(0, 6).map(u => u.kind === 'fatura'
      ? `<a class="item" href="#/cartoes" data-card="${u.card.id}" data-inv="${u.inv.key}"><span class="item-icon">${ui.icon('card', 18)}</span><span class="item-main"><span class="item-title">Fatura ${U.esc(u.card.name)}</span><span class="item-sub">${u.inv.status === 'vencida' ? 'Venceu' : 'Vence'} ${U.fmtDate(u.inv.due)}</span></span><span class="item-amt">${U.money(u.inv.open)}</span></a>`
      : `<button type="button" class="item" data-tx="${u.tx.id}"><span class="item-icon ${u.tx.type === 'receita' ? 'in' : 'out'}">${ui.icon(u.tx.type === 'receita' ? 'up' : 'down', 18)}</span><span class="item-main"><span class="item-title">${U.esc(u.tx.description || (S.get('categories', u.tx.categoryId) || {}).name || 'Lançamento')}</span><span class="item-sub">Agendado para ${U.fmtDate(u.tx.date)}</span></span><span class="item-amt ${u.tx.type === 'receita' ? 'pos' : ''}">${U.moneySigned(u.tx.type === 'receita' ? u.tx.amount : -u.tx.amount)}</span></button>`).join('');

    el.innerHTML = `
      <div class="tiles">
        <div class="tile">
          <div class="tile-label">${ui.icon('wallet', 16)} Saldo em contas</div>
          <div class="tile-value ${pat.contas < 0 ? 'neg' : ''}">${U.money(pat.contas)}</div>
          <div class="tile-sub">${accounts.slice(0, 3).map(a => `${U.esc(a.name)} ${U.money(fin.accountBalance(a.id))}`).join(' · ')}</div>
        </div>
        <div class="tile">
          <div class="tile-label">${ui.icon('card', 16)} Cartão (despesa futura)</div>
          <div class="tile-value">${U.money(pat.dividas)}</div>
          <div class="tile-sub">${nextInv ? `Próx. vencimento ${U.fmtDayMonth(nextInv.inv.due)}: ${U.money(nextInv.inv.open)}` : 'Nenhuma fatura em aberto'}</div>
        </div>
        <div class="tile">
          <div class="tile-label">${ui.icon('check', 16)} Saldo livre</div>
          <div class="tile-value ${livre < 0 ? 'neg' : ''}">${U.money(livre)}</div>
          <div class="tile-sub">Contas menos tudo que falta pagar no cartão</div>
        </div>
        <a class="tile tile-link" href="#/patrimonio">
          <div class="tile-label">${ui.icon('bank', 16)} Patrimônio líquido</div>
          <div class="tile-value">${U.money(pat.total)}</div>
          <div class="tile-sub">Contas, aplicações e bens, menos dívidas</div>
        </a>
      </div>

      <div class="section-title"><h2>Resumo do mês</h2>${ui.monthNav(month)}</div>

      <div class="grid2">
        <section class="card">
          <div class="card-head"><h3>Gastos × salário</h3></div>
          ${meter}
        </section>
        <section class="card">
          <div class="card-head"><h3>Despesas por categoria</h3><span class="muted small">${U.money(sum.despesas)}</span></div>
          ${catRows}
        </section>
      </div>

      <section class="card mt">
        <div class="card-head"><h3>Receitas × despesas · últimos 6 meses</h3></div>
        <div class="legend"><span><i class="sw s1"></i>Receitas</span><span><i class="sw s2"></i>Despesas</span></div>
        <div id="chart-6m"></div>
      </section>

      ${goals.length ? `<section class="mt">
        <div class="section-title"><h2>Metas</h2><a class="btn btn-sm" href="#/patrimonio">Ver todas</a></div>
        <div class="asset-grid">${goals.slice(0, 4).map(g => F.views.patrimonio.goalCard(g)).join('')}</div>
      </section>` : ''}

      ${up.length ? `<section class="mt"><div class="section-title"><h2>Próximos 30 dias</h2></div><div class="list">${upRows}</div></section>` : ''}`;

    ui.bindMonthNav(el, () => this.render(el));

    // Gráfico de 6 meses
    const months = Array.from({ length: 6 }, (_, i) => U.addMonths(month, i - 5));
    const sums = months.map(m => fin.monthSummary(m));
    F.charts.groupedBars(el.querySelector('#chart-6m'), {
      labels: months.map(U.monthShort),
      series: [
        { name: 'Receitas', cls: 's1', values: sums.map(s => s.receitas) },
        { name: 'Despesas', cls: 's2', values: sums.map(s => s.despesas) },
      ],
      ariaLabel: 'Receitas e despesas dos últimos 6 meses',
      tooltip: i => {
        const s = sums[i], b = s.salario || s.receitas;
        return `<div class="t-title">${U.monthLabel(months[i])}</div>
          <div class="t-row"><span><i class="sw s1"></i> Receitas</span><b>${U.money(s.receitas)}</b></div>
          <div class="t-row"><span><i class="sw s2"></i> Despesas</span><b>${U.money(s.despesas)}</b></div>
          <div class="t-row t-sep"><span>Resultado</span><b>${U.moneySigned(s.resultado)}</b></div>
          ${b ? `<div class="t-row"><span>Gasto ${s.salario ? 'do salário' : 'das receitas'}</span><b>${U.pct(s.despesas / b)}</b></div>` : ''}`;
      },
    });

    el.querySelectorAll('[data-goal]').forEach(b => b.addEventListener('click', () => F.forms.goal({ g: S.get('goals', b.dataset.goal) })));
    el.querySelectorAll('[data-tx]').forEach(b => b.addEventListener('click', () => F.forms.entry({ tx: S.get('transactions', b.dataset.tx) })));
    el.querySelectorAll('[data-card]').forEach(a => a.addEventListener('click', () => {
      F.state.cardId = a.dataset.card;
      F.state.invoiceKey = a.dataset.inv;
      F.state.invoiceCard = a.dataset.card;
    }));
  },
};
