'use strict';
// Regras de negócio: saldos, extrato, faturas de cartão, resumo do mês e patrimônio.
// Todos os valores em centavos.
F.fin = (() => {
  const U = F.util, S = F.store;

  // ---------- Contas ----------
  // Como cada lançamento mexe no saldo das contas.
  function effects(tx) {
    switch (tx.type) {
      case 'receita':
      case 'resgate': return [{ accountId: tx.accountId, amount: tx.amount }];
      case 'transferencia': return [{ accountId: tx.accountId, amount: -tx.amount }, { accountId: tx.toAccountId, amount: tx.amount }];
      default: return [{ accountId: tx.accountId, amount: -tx.amount }]; // despesa, pagamento de fatura e aporte
    }
  }
  const inSet = (set, id) => !set || set.has(id);
  const accSet = accountId => (accountId && accountId !== 'all' ? new Set([accountId]) : null);

  function balance(set, until) {
    let b = 0;
    for (const a of S.list('accounts')) if (inSet(set, a.id) && (!until || a.initialDate <= until)) b += a.initialBalance || 0;
    for (const tx of S.list('transactions')) {
      if (until && tx.date > until) continue;
      for (const e of effects(tx)) if (inSet(set, e.accountId)) b += e.amount;
    }
    return b;
  }
  const accountBalance = (id, until = U.today()) => balance(new Set([id]), until);
  const totalBalance = (until = U.today()) => balance(null, until);

  function statement(accountId, month) {
    const set = accSet(accountId);
    const start = month + '-01', end = U.dateIn(month, 31);
    const opening = balance(set, U.addDays(start, -1));
    const rows = [];
    for (const a of S.list('accounts')) {
      if (inSet(set, a.id) && a.initialDate >= start && a.initialDate <= end) {
        rows.push({ kind: 'inicial', date: a.initialDate, amount: a.initialBalance || 0, account: a, order: 0 });
      }
    }
    for (const tx of S.list('transactions')) {
      if (tx.date < start || tx.date > end) continue;
      const eff = effects(tx).filter(e => inSet(set, e.accountId));
      if (!eff.length) continue;
      rows.push({ kind: 'tx', date: tx.date, amount: U.sum(eff, e => e.amount), tx, order: tx.createdAt || 1 });
    }
    rows.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
    let run = opening, inflow = 0, outflow = 0;
    for (const r of rows) {
      run += r.amount;
      r.balance = run;
      if (r.kind !== 'tx') continue;
      if (r.amount > 0) inflow += r.amount; else outflow -= r.amount;
    }
    return { opening, rows, inflow, outflow, closing: run };
  }

  // ---------- Cartões ----------
  // A fatura é identificada pelo mês de vencimento ("2026-11").
  // Compras a partir do dia de fechamento vão para a fatura seguinte.
  function invoiceKeyFor(card, date) {
    const month = U.monthOf(date);
    const closeDay = Math.min(card.closingDay, U.daysInMonth(month));
    const closeKey = +date.slice(8, 10) >= closeDay ? U.addMonths(month, 1) : month;
    return card.dueDay > card.closingDay ? closeKey : U.addMonths(closeKey, 1);
  }
  const closingDate = (card, key) => U.dateIn(card.dueDay > card.closingDay ? key : U.addMonths(key, -1), card.closingDay);
  const dueDate = (card, key) => U.dateIn(key, card.dueDay);
  const currentInvoiceKey = card => invoiceKeyFor(card, U.today());

  // Compra antiga já em andamento: startInstallment diz qual parcela cai na firstInvoice
  // (e a data é a desta parcela); as anteriores não entram no app.
  function installments(p) {
    const n = Math.max(1, p.installments || 1), sign = p.refund ? -1 : 1;
    const start = Math.min(n, Math.max(1, p.startInstallment || 1));
    const base = Math.floor(p.amount / n), rest = p.amount - base * n;
    return Array.from({ length: n - start + 1 }, (_, j) => {
      const i = start - 1 + j;
      return {
        purchase: p, n: i + 1, of: n,
        amount: sign * (base + (i < rest ? 1 : 0)),
        invoiceKey: U.addMonths(p.firstInvoice, j),
        competence: U.addMonths(U.monthOf(p.date), j),
      };
    });
  }
  const cardInstallments = cardId => S.list('cardPurchases').filter(p => p.cardId === cardId).flatMap(installments);
  const cardPayments = cardId => S.list('transactions').filter(t => t.type === 'fatura' && t.cardId === cardId);

  // credit = sobra de pagamento da fatura anterior, que abate desta.
  function finalize(card, inv, credit = 0) {
    const t = U.today();
    inv.credit = credit;
    inv.open = inv.total - inv.paid - credit;
    inv.closing = closingDate(card, inv.key);
    inv.due = dueDate(card, inv.key);
    if (t < inv.closing) inv.status = 'aberta';
    else if (inv.open <= 0) inv.status = inv.total > 0 ? 'paga' : 'vazia';
    else inv.status = t <= inv.due ? 'fechada' : 'vencida';
    return inv;
  }
  function invoices(card) {
    const map = new Map();
    const get = key => {
      if (!map.has(key)) map.set(key, { key, items: [], payments: [], total: 0, paid: 0 });
      return map.get(key);
    };
    for (const it of cardInstallments(card.id)) { const inv = get(it.invoiceKey); inv.items.push(it); inv.total += it.amount; }
    for (const p of cardPayments(card.id)) { const inv = get(p.invoiceKey); inv.payments.push(p); inv.paid += p.amount; }
    const list = [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
    let carry = 0;
    list.forEach((inv, i) => {
      inv.items.sort((a, b) => a.purchase.date.localeCompare(b.purchase.date));
      inv.payments.sort((a, b) => a.date.localeCompare(b.date));
      finalize(card, inv, carry);
      // pagou a mais: a sobra vira crédito na próxima fatura (na última, fica negativa)
      carry = inv.open < 0 && i < list.length - 1 ? -inv.open : 0;
      if (carry) inv.open = 0;
    });
    return list;
  }
  const invoice = (card, key) => invoices(card).find(i => i.key === key) || finalize(card, { key, items: [], payments: [], total: 0, paid: 0 });
  // Tudo o que ainda vai sair do bolso por causa do cartão (inclui parcelas futuras).
  const cardDebt = card => U.sum(cardInstallments(card.id), i => i.amount) - U.sum(cardPayments(card.id), p => p.amount);
  const totalCardDebt = () => U.sum(S.list('cards'), cardDebt);

  // ---------- Resumo do mês ----------
  function monthSummary(month) {
    const cats = new Map(S.list('categories').map(c => [c.id, c]));
    const byCat = new Map();
    const addCat = (id, v) => byCat.set(id || '', (byCat.get(id || '') || 0) + v);
    let receitas = 0, salario = 0, despConta = 0, despCartao = 0;
    for (const tx of S.list('transactions')) {
      if (U.monthOf(tx.date) !== month) continue;
      if (tx.type === 'receita') {
        receitas += tx.amount;
        if (cats.get(tx.categoryId)?.salary) salario += tx.amount;
      } else if (tx.type === 'despesa') {
        despConta += tx.amount;
        addCat(tx.categoryId, tx.amount);
      }
    }
    const byInvoice = S.settings().cardCompetence === 'fatura';
    for (const p of S.list('cardPurchases')) {
      for (const it of installments(p)) {
        if ((byInvoice ? it.invoiceKey : it.competence) !== month) continue;
        despCartao += it.amount;
        addCat(p.categoryId, it.amount);
      }
    }
    const despesas = despConta + despCartao;
    const categories = [...byCat.entries()]
      .filter(([, v]) => v > 0)
      .map(([id, amount]) => ({ category: cats.get(id) || null, amount }))
      .sort((a, b) => b.amount - a.amount);
    return { month, receitas, salario, despConta, despCartao, despesas, resultado: receitas - despesas, categories };
  }

  // ---------- Aplicações ----------
  // Valor numa data = última atualização manual de valores (até a data)
  // + aportes e resgates lançados depois dela.
  function snapshots(inv) {
    const h = inv.history && inv.history.length ? inv.history
      : [{ date: inv.updatedOn || inv.startDate || U.today(), applied: inv.applied || 0, grossYield: inv.grossYield || 0, discounts: inv.discounts || 0, savedAt: 0 }];
    return h.slice().sort((a, b) => a.date.localeCompare(b.date) || (a.savedAt || 0) - (b.savedAt || 0));
  }
  const investmentMoves = invId => S.list('transactions')
    .filter(t => (t.type === 'aporte' || t.type === 'resgate') && t.investmentId === invId)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0));

  function investmentState(inv, until = U.today()) {
    const snaps = snapshots(inv);
    let snap = null;
    for (const h of snaps) if (h.date <= until) snap = h;
    // antes da primeira atualização: considera só o valor aplicado (a partir da data da aplicação)
    const st = snap
      ? { applied: snap.applied || 0, grossYield: snap.grossYield || 0, discounts: snap.discounts || 0 }
      : { applied: inv.startDate && inv.startDate <= until ? snaps[0].applied || 0 : 0, grossYield: 0, discounts: 0 };
    if (snap) {
      for (const m of investmentMoves(inv.id)) {
        if (m.date > until) break;
        const included = m.date < snap.date || (m.date === snap.date && (m.createdAt || 0) <= (snap.savedAt || 0));
        if (included) continue;
        if (m.type === 'aporte') {
          st.applied += m.amount;
        } else {
          // resgate reduz tudo na mesma proporção
          const net = st.applied + st.grossYield - st.discounts;
          const k = net > 0 ? Math.max(0, 1 - m.amount / net) : 0;
          st.applied = Math.round(st.applied * k);
          st.grossYield = Math.round(st.grossYield * k);
          st.discounts = Math.round(st.discounts * k);
        }
      }
    }
    st.net = st.applied + st.grossYield - st.discounts;
    st.snapDate = snap ? snap.date : null;
    return st;
  }
  const investmentNet = (inv, until) => investmentState(inv, until).net;

  // ---------- Bens (imobilizado) ----------
  // Entre a compra e cada atualização, o valor varia em linha reta.
  const dayNum = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 864e5;
  function assetValueAt(a, date) {
    if (a.acquisitionDate && date < a.acquisitionDate) return 0;
    const pts = [];
    if (a.acquisitionDate && a.acquisitionValue) pts.push({ date: a.acquisitionDate, value: a.acquisitionValue });
    (a.history || []).forEach(h => pts.push({ date: h.date, value: h.value }));
    if (!pts.length) pts.push({ date: a.updatedOn || U.today(), value: a.currentValue || 0 });
    pts.sort((x, y) => x.date.localeCompare(y.date));
    if (date < pts[0].date) return pts[0].value;
    for (let i = pts.length - 1; i >= 0; i--) {
      if (pts[i].date > date) continue;
      const p = pts[i], n = pts[i + 1];
      if (!n) return p.value;
      const t = (dayNum(date) - dayNum(p.date)) / (dayNum(n.date) - dayNum(p.date) || 1);
      return Math.round(p.value + (n.value - p.value) * t);
    }
    return 0;
  }

  // ---------- Patrimônio ----------
  function cardDebtAt(card, date) {
    const inst = S.list('cardPurchases').filter(p => p.cardId === card.id && p.date <= date).flatMap(installments);
    return U.sum(inst, i => i.amount) - U.sum(cardPayments(card.id).filter(p => p.date <= date), p => p.amount);
  }
  function patrimonyAt(date) {
    const contas = balance(null, date);
    const aplicacoes = U.sum(S.list('investments'), i => investmentNet(i, date));
    const imobilizado = U.sum(S.list('assets'), a => assetValueAt(a, date));
    const dividas = U.sum(S.list('cards'), c => cardDebtAt(c, date));
    return { contas, aplicacoes, imobilizado, dividas, total: contas + aplicacoes + imobilizado - dividas };
  }
  function patrimony() {
    const p = patrimonyAt(U.today());
    p.dividas = totalCardDebt(); // inclui compras lançadas com data futura
    p.total = p.contas + p.aplicacoes + p.imobilizado - p.dividas;
    return p;
  }

  // ---------- Metas ----------
  function goalProgress(g) {
    const current = g.mode === 'manual'
      ? g.saved || 0
      : U.sum(S.list('investments').filter(i => (g.investmentIds || []).includes(i.id)), i => investmentNet(i));
    const target = g.target || 0, remaining = Math.max(0, target - current);
    let monthsLeft = null, perMonth = null;
    if (g.deadline) {
      const t = U.today();
      const diff = (+g.deadline.slice(0, 4) - +t.slice(0, 4)) * 12 + (+g.deadline.slice(5, 7) - +t.slice(5, 7));
      monthsLeft = g.deadline < t ? 0 : Math.max(1, diff);
      perMonth = monthsLeft ? Math.ceil(remaining / monthsLeft) : null;
    }
    return { current, target, remaining, ratio: target ? current / target : 0, done: target > 0 && current >= target, monthsLeft, perMonth };
  }
  // Média das despesas dos últimos meses fechados que tiveram gasto.
  function avgMonthlyExpense(n = 6) {
    const cur = U.monthOf(U.today()), vals = [];
    for (let i = 1; i <= n; i++) {
      const d = monthSummary(U.addMonths(cur, -i)).despesas;
      if (d > 0) vals.push(d);
    }
    return vals.length ? Math.round(U.sum(vals) / vals.length) : monthSummary(cur).despesas;
  }

  // Lançamentos agendados (data futura) e faturas a vencer nos próximos dias.
  function upcoming(days = 30) {
    const t = U.today(), limit = U.addDays(t, days), out = [];
    for (const tx of S.list('transactions')) if (tx.date > t && tx.date <= limit) out.push({ kind: 'tx', date: tx.date, tx });
    for (const card of S.list('cards')) {
      for (const inv of invoices(card)) {
        if (inv.open > 0 && inv.due <= limit) out.push({ kind: 'fatura', date: inv.due, card, inv });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }

  return {
    effects, accountBalance, totalBalance, statement,
    invoiceKeyFor, closingDate, dueDate, currentInvoiceKey, installments, invoices, invoice, cardDebt, totalCardDebt,
    monthSummary, investmentState, investmentNet, investmentMoves, assetValueAt, patrimony, patrimonyAt,
    goalProgress, avgMonthlyExpense, upcoming,
  };
})();
