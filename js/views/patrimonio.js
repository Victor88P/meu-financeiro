'use strict';
F.views = F.views || {};

F.views.patrimonio = {
  title: 'Patrimônio',

  // Card de meta (usado aqui e no Início).
  goalCard(g) {
    const U = F.util, ui = F.ui, S = F.store;
    const p = F.fin.goalProgress(g);
    let sub = '';
    if (p.done) sub = `${ui.icon('check', 14)} Meta atingida`;
    else if (p.monthsLeft === 0) sub = `${ui.icon('alert', 14)} Prazo encerrado em ${U.fmtDate(g.deadline)}`;
    else if (p.perMonth) sub = `Prazo ${U.monthShort(U.monthOf(g.deadline))} · guardar <b>${U.money(p.perMonth)}/mês</b> (${p.monthsLeft} ${p.monthsLeft === 1 ? 'mês' : 'meses'})`;
    const source = g.mode === 'manual'
      ? 'Valor informado manualmente'
      : (g.investmentIds || []).map(id => (S.get('investments', id) || {}).name).filter(Boolean).join(', ');
    return `<button type="button" class="card goal" data-goal="${g.id}">
      <div class="goal-top"><span class="goal-name">${U.esc(g.name)}</span><span class="goal-pct">${U.pct(Math.min(p.ratio, 9.99))}</span></div>
      <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(Math.min(1, p.ratio) * 100)}" aria-label="Progresso da meta">
        <div class="meter-fill${p.done ? ' good' : ''}" style="width:${Math.min(100, p.ratio * 100)}%"></div>
      </div>
      <div class="meter-cap"><span><b>${U.money(p.current)}</b> de ${U.money(p.target)}</span><span>${p.done ? '' : `falta ${U.money(p.remaining)}`}</span></div>
      ${sub ? `<div class="goal-sub${p.done ? ' pos' : p.monthsLeft === 0 ? ' neg' : ''}">${sub}</div>` : ''}
      <div class="goal-src">${U.esc(source)}</div>
    </button>`;
  },

  render(el) {
    const U = F.util, S = F.store, fin = F.fin, ui = F.ui, st = F.state;
    const pat = fin.patrimony();
    const invs = S.list('investments'), assets = S.list('assets'), cards = S.list('cards'), goals = S.list('goals');
    const accounts = S.list('accounts').filter(a => !a.archived || fin.accountBalance(a.id) !== 0);
    const parts = [
      { name: 'Contas', cls: 's1', value: pat.contas },
      { name: 'Aplicações', cls: 's2', value: pat.aplicacoes },
      { name: 'Imobilizado', cls: 's3', value: pat.imobilizado },
    ];
    const ASSET_ICON = { veiculo: 'car', imovel: 'home', outro: 'box' };
    const pctChange = (now, before) => (before ? (now - before) / before : null);
    const delta = r => (r === null ? '' : `<span class="${r >= 0 ? 'pos' : 'neg'}">${r >= 0 ? '▲' : '▼'} ${U.pct(Math.abs(r))}</span>`);

    // ---- Evolução (12 meses) ----
    const evoMode = st.evoMode || 'total';
    const curMonth = U.monthOf(U.today());
    const months = Array.from({ length: 12 }, (_, i) => U.addMonths(curMonth, i - 11));
    const snaps = months.map(m => fin.patrimonyAt(m === curMonth ? U.today() : U.dateIn(m, 31)));
    const valueOf = p => (evoMode === 'total' ? p.total : p.total - p.imobilizado);
    const series = snaps.map(valueOf);
    const firstIdx = snaps.findIndex(p => p.contas || p.aplicacoes || p.imobilizado || p.dividas);
    const hasEvo = firstIdx >= 0;
    const evoLabels = months.slice(firstIdx).map(U.monthShort);
    const evoValues = series.slice(firstIdx);
    const evoSnaps = snaps.slice(firstIdx);
    const last = evoValues[evoValues.length - 1], prev = evoValues[evoValues.length - 2];
    const varTotal = hasEvo ? last - evoValues[0] : 0;
    const varLine = (v, base, label) => `<span class="${v >= 0 ? 'pos' : 'neg'}"><b>${U.moneySigned(v)}</b>${base ? ` (${v >= 0 ? '+' : '−'}${U.pct(Math.abs(v / base))})` : ''}</span> ${label}`;

    el.innerHTML = `
      <div class="grid2">
        <section class="card">
          <div class="tile-label">${ui.icon('bank', 16)} Patrimônio líquido</div>
          <div class="hero-num">${U.money(pat.total)}</div>
          ${F.charts.stackBar(parts)}
          <div class="legend vertical">
            ${parts.map(p => `<span><i class="sw ${p.cls}"></i>${p.name}<b>${U.money(p.value)}</b></span>`).join('')}
            <span><i class="sw sw-debt"></i>Dívidas no cartão<b class="neg">${U.moneySigned(-pat.dividas)}</b></span>
          </div>
        </section>
        <section class="card">
          <div class="card-head">
            <h3>Evolução do patrimônio</h3>
            <div class="seg seg-sm" role="tablist">
              <button type="button" data-evo="total" aria-selected="${evoMode === 'total'}">Total</button>
              <button type="button" data-evo="fin" aria-selected="${evoMode === 'fin'}">Sem imobilizado</button>
            </div>
          </div>
          ${hasEvo ? `
            <div class="evo-vars">
              ${evoValues.length > 1 ? `<div>${varLine(last - prev, prev, 'no último mês')}</div>` : ''}
              ${evoValues.length > 2 ? `<div>${varLine(varTotal, evoValues[0], `desde ${evoLabels[0]}`)}</div>` : ''}
            </div>
            <div id="chart-evo"></div>
            <p class="hint-line chart-note">Fim de cada mês (o mês atual é hoje). Antes da 1ª atualização de uma aplicação, conta só o valor aplicado; o valor do carro varia em linha reta entre a compra e as atualizações.</p>`
            : '<p class="text-2">Cadastre contas, aplicações ou bens para ver a evolução.</p>'}
        </section>
      </div>

      <div class="section-title"><h2>Metas</h2><button class="btn btn-sm" data-new-goal>${ui.icon('plus', 16)} Nova meta</button></div>
      ${goals.length ? `<div class="asset-grid">${goals.map(g => this.goalCard(g)).join('')}</div>`
        : `<div class="card">${ui.empty('flag', 'Nenhuma meta ainda', 'Crie metas como reserva de emergência ou viagem e acompanhe quanto falta e quanto guardar por mês.')}</div>`}

      <div class="section-title"><h2>Aplicações financeiras</h2><button class="btn btn-sm" data-new-inv>${ui.icon('plus', 16)} Nova</button></div>
      ${invs.length ? `<div class="asset-grid">${invs.map(i => {
        const s = fin.investmentState(i);
        return `<div class="card asset">
          <button type="button" class="asset-main" data-inv="${i.id}">
            <div class="asset-head"><span class="item-icon">${ui.icon('trend', 18)}</span><div><div class="asset-name">${U.esc(i.name)}</div><div class="item-sub">${U.esc([i.kind, i.institution].filter(Boolean).join(' · '))}</div></div></div>
            <div class="asset-big"><span class="lbl">Líquido se sacar hoje</span><strong>${U.money(s.net)}</strong>${delta(pctChange(s.net, s.applied))}</div>
            <div class="kv-grid">
              <div><div class="lbl">Aplicado</div><div class="val">${U.money(s.applied)}</div></div>
              <div><div class="lbl">Rendimento bruto</div><div class="val pos">${U.moneySigned(s.grossYield)}</div></div>
              <div><div class="lbl">Descontos (IR/IOF)</div><div class="val neg">${U.moneySigned(-s.discounts)}</div></div>
              <div><div class="lbl">Valores atualizados em</div><div class="val">${U.fmtDate(s.snapDate)}</div></div>
            </div>
          </button>
          <div class="asset-actions">
            <button type="button" class="btn btn-sm" data-aporte="${i.id}">${ui.icon('plus', 16)} Aportar</button>
            <button type="button" class="btn btn-sm" data-resgate="${i.id}">${ui.icon('down', 16)} Resgatar</button>
            <button type="button" class="btn btn-sm" data-inv="${i.id}">${ui.icon('edit', 16)} Atualizar</button>
          </div>
        </div>`;
      }).join('')}</div>` : `<div class="card">${ui.empty('trend', 'Nenhuma aplicação', 'Cadastre sua aplicação com o valor aplicado, o rendimento e os descontos atuais.')}</div>`}

      <div class="section-title"><h2>Imobilizado</h2><button class="btn btn-sm" data-new-asset>${ui.icon('plus', 16)} Novo bem</button></div>
      ${assets.length ? `<div class="asset-grid">${assets.map(a => `
        <button type="button" class="card asset" data-asset="${a.id}">
          <div class="asset-head"><span class="item-icon">${ui.icon(ASSET_ICON[a.kind] || 'box', 18)}</span><div><div class="asset-name">${U.esc(a.name)}</div><div class="item-sub">${U.esc(a.details || '')}</div></div></div>
          <div class="asset-big"><span class="lbl">Valor atual</span><strong>${U.money(a.currentValue)}</strong>${delta(pctChange(a.currentValue, a.acquisitionValue))}</div>
          <div class="kv-grid">
            <div><div class="lbl">Valor de compra</div><div class="val">${a.acquisitionValue ? U.money(a.acquisitionValue) : '—'}</div></div>
            <div><div class="lbl">Atualizado em</div><div class="val">${U.fmtDate(a.updatedOn)}</div></div>
          </div>
          <span class="asset-cta">Toque para atualizar o valor</span>
        </button>`).join('')}</div>` : `<div class="card">${ui.empty('car', 'Nenhum bem cadastrado', 'Cadastre seu carro com o valor da tabela FIPE.')}</div>`}

      <div class="section-title"><h2>Contas e dívidas</h2></div>
      <div class="list">
        ${accounts.map(a => `<div class="item"><span class="item-icon">${ui.icon('wallet', 18)}</span><span class="item-main"><span class="item-title">${U.esc(a.name)}</span></span><span class="item-amt">${U.money(fin.accountBalance(a.id))}</span></div>`).join('')}
        ${cards.map(c => `<div class="item"><span class="item-icon out">${ui.icon('card', 18)}</span><span class="item-main"><span class="item-title">Cartão ${U.esc(c.name)}</span><span class="item-sub">Despesa futura</span></span><span class="item-amt neg">${U.moneySigned(-fin.cardDebt(c))}</span></div>`).join('')}
        ${!accounts.length && !cards.length ? '<div class="item"><span class="text-2">Nenhuma conta ou cartão cadastrado.</span></div>' : ''}
      </div>`;

    if (hasEvo) {
      F.charts.lineChart(el.querySelector('#chart-evo'), {
        labels: evoLabels,
        values: evoValues,
        ariaLabel: 'Evolução do patrimônio nos últimos 12 meses',
        tooltip: i => {
          const p = evoSnaps[i], v = evoValues[i], before = evoValues[i - 1];
          return `<div class="t-title">${U.cap(U.monthLabel(months[firstIdx + i]))}</div>
            <div class="t-row"><span>Contas</span><b>${U.money(p.contas)}</b></div>
            <div class="t-row"><span>Aplicações</span><b>${U.money(p.aplicacoes)}</b></div>
            ${evoMode === 'total' ? `<div class="t-row"><span>Imobilizado</span><b>${U.money(p.imobilizado)}</b></div>` : ''}
            <div class="t-row"><span>Dívidas cartão</span><b>${U.moneySigned(-p.dividas)}</b></div>
            <div class="t-row t-sep"><span>Patrimônio</span><b>${U.money(v)}</b></div>
            ${before !== undefined ? `<div class="t-row"><span>Variação no mês</span><b>${U.moneySigned(v - before)}</b></div>` : ''}`;
        },
      });
    }

    el.querySelectorAll('[data-evo]').forEach(b => b.addEventListener('click', () => { st.evoMode = b.dataset.evo; this.render(el); }));
    el.querySelector('[data-new-goal]').addEventListener('click', () => F.forms.goal());
    el.querySelectorAll('[data-goal]').forEach(b => b.addEventListener('click', () => F.forms.goal({ g: S.get('goals', b.dataset.goal) })));
    el.querySelector('[data-new-inv]').addEventListener('click', () => F.forms.investment());
    el.querySelector('[data-new-asset]').addEventListener('click', () => F.forms.asset());
    el.querySelectorAll('[data-inv]').forEach(b => b.addEventListener('click', () => F.forms.investment({ inv: S.get('investments', b.dataset.inv) })));
    el.querySelectorAll('[data-aporte]').forEach(b => b.addEventListener('click', () => F.forms.investmentMove({ inv: S.get('investments', b.dataset.aporte), kind: 'aporte' })));
    el.querySelectorAll('[data-resgate]').forEach(b => b.addEventListener('click', () => F.forms.investmentMove({ inv: S.get('investments', b.dataset.resgate), kind: 'resgate' })));
    el.querySelectorAll('[data-asset]').forEach(b => b.addEventListener('click', () => F.forms.asset({ a: S.get('assets', b.dataset.asset) })));
  },
};
