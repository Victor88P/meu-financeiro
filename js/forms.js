'use strict';
// Formulários (abrem em janela): lançamento, pagamento de fatura e cadastros.
F.forms = (() => {
  const U = F.util, S = F.store, ui = F.ui, fin = F.fin;

  function fail(msg, el) {
    ui.toast(msg, 'error');
    if (el) el.focus();
  }
  const deleteBtn = '<button type="button" class="btn btn-ghost danger" data-del>Excluir</button>';

  // ======================================================================
  // Lançamento: despesa, receita, compra no cartão ou transferência
  // ======================================================================
  const TYPES = [['despesa', 'Despesa'], ['receita', 'Receita'], ['cartao', 'Cartão'], ['transferencia', 'Transf.']];

  function entry(opts = {}) {
    const tx = opts.tx || null, purchase = opts.purchase || null;
    if (tx && tx.type === 'fatura') return invoicePayment({ tx });
    if (tx && (tx.type === 'aporte' || tx.type === 'resgate')) return investmentMove({ tx });
    const editing = !!(tx || purchase);
    const src = purchase || tx || {};
    let type = purchase ? 'cartao' : tx ? tx.type : (opts.type || S.pref('lastType') || 'despesa');
    const activeAccounts = S.list('accounts').filter(a => !a.archived);
    const cards = S.list('cards');
    const defAcc = src.accountId || (activeAccounts.find(a => a.id === S.pref('lastAccount')) || activeAccounts[0] || {}).id || '';
    const defTo = src.toAccountId || (activeAccounts.find(a => a.id !== defAcc) || {}).id || '';
    const defCard = src.cardId || (cards.find(c => c.id === S.pref('lastCard')) || cards[0] || {}).id || '';
    // compra em andamento: o campo de valor mostra a parcela, não o total
    const ongoing0 = !!(purchase && (purchase.startInstallment || 1) > 1);
    const amount0 = ongoing0 ? Math.round(purchase.amount / purchase.installments) : src.amount || 0;

    const body = `
      <div class="seg" role="tablist">${TYPES.map(([v, l]) => `<button type="button" role="tab" data-type="${v}"${editing && v !== type ? ' disabled' : ''}>${l}</button>`).join('')}</div>
      <input class="money-input" id="f-amount" aria-label="Valor">
      <div class="money-cap" id="f-amount-cap" hidden>valor de cada parcela</div>
      <div class="notice" data-notice="acc" hidden>Você ainda não tem nenhuma conta cadastrada. <button type="button" class="link" data-new-acc>Cadastrar conta</button></div>
      <div class="notice" data-notice="card" hidden>Você ainda não tem nenhum cartão cadastrado. <button type="button" class="link" data-new-card>Cadastrar cartão</button></div>
      <div class="type-block" data-for="despesa receita cartao">
        <div class="field"><span class="field-label">Categoria</span><div id="f-cat"></div></div>
      </div>
      ${ui.field('Descrição', `<input class="input" id="f-desc" maxlength="120" placeholder="Opcional" value="${U.esc(src.description || '')}">`)}
      <div class="row2 date-row">
        ${ui.field('Data', `<input class="input" type="date" id="f-date" value="${src.date || opts.date || U.today()}">`)}
        <div class="chips"><button type="button" class="chip" data-day="0">Hoje</button><button type="button" class="chip" data-day="-1">Ontem</button></div>
      </div>
      <div class="type-block" data-for="despesa receita">${ui.field('Conta', `<select class="input" id="f-acc">${ui.accountOptions(defAcc)}</select>`)}</div>
      <div class="type-block row2" data-for="transferencia">
        ${ui.field('Sai de', `<select class="input" id="f-from">${ui.accountOptions(defAcc)}</select>`)}
        ${ui.field('Entra em', `<select class="input" id="f-to">${ui.accountOptions(defTo)}</select>`)}
      </div>
      <div class="type-block" data-for="cartao">
        <div class="row2">
          ${ui.field('Cartão', `<select class="input" id="f-card">${ui.options(cards.map(c => [c.id, c.name]), defCard)}</select>`)}
          ${ui.field('Parcelas', `<select class="input" id="f-inst">${ui.options(Array.from({ length: 24 }, (_, i) => [i + 1, i === 0 ? 'À vista' : `${i + 1}x`]), src.installments || 1)}</select>`)}
        </div>
        <label class="check"><input type="checkbox" id="f-ongoing"${ongoing0 ? ' checked' : ''}> Compra antiga, com parcelas já em andamento</label>
        <div id="f-ongoing-box"${ongoing0 ? '' : ' hidden'}>
          ${ui.field('Parcela atual', `<select class="input" id="f-start">${ui.options(Array.from({ length: 24 }, (_, i) => [i + 1, `${i + 1}ª parcela`]), src.startInstallment || 2)}</select>`,
            { hint: 'Informe o valor de cada parcela lá em cima e use como data o dia em que esta parcela foi lançada na fatura. As parcelas anteriores não entram no app.' })}
        </div>
        <label class="check"><input type="checkbox" id="f-refund"${src.refund ? ' checked' : ''}> É um estorno / crédito na fatura</label>
        <p class="info" id="f-invinfo"></p>
      </div>
      ${ui.field('Observação', `<textarea class="input" id="f-notes" rows="2" maxlength="500" placeholder="Opcional">${U.esc(src.notes || '')}</textarea>`)}`;

    const foot = `<button class="btn btn-primary" value="save">Salvar</button>${editing ? deleteBtn : '<button class="btn" value="again">Salvar e lançar outro</button>'}`;
    const s = ui.sheet({ title: editing ? 'Editar lançamento' : 'Novo lançamento', body, foot, onSubmit: save });
    const amount = ui.moneyField(s.$('#f-amount'), amount0);
    const isOngoing = () => type === 'cartao' && s.$('#f-ongoing').checked;
    const picker = ui.categoryPicker(s.$('#f-cat'), { kind: type === 'receita' ? 'receita' : 'despesa', value: src.categoryId || null });
    const sheetEl = s.$('.sheet');

    function setType(t) {
      type = t;
      sheetEl.dataset.type = t;
      s.$$('[data-type]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.type === t)));
      s.$$('.type-block').forEach(b => { b.hidden = !b.dataset.for.split(' ').includes(t); });
      picker.setKind(t === 'receita' ? 'receita' : 'despesa');
      const noAcc = !S.list('accounts').length, noCard = !S.list('cards').length;
      s.$('[data-notice=acc]').hidden = !(noAcc && t !== 'cartao');
      s.$('[data-notice=card]').hidden = !(noCard && t === 'cartao');
      invInfo();
    }
    function invInfo() {
      s.$('#f-amount-cap').hidden = !isOngoing();
      if (type !== 'cartao') return;
      s.$('#f-ongoing-box').hidden = !isOngoing();
      const el = s.$('#f-invinfo'), card = S.get('cards', s.$('#f-card').value);
      if (!card) { el.hidden = true; return; }
      el.hidden = false;
      const date = s.$('#f-date').value || U.today();
      const key = purchase && purchase.cardId === card.id && purchase.date === date ? purchase.firstInvoice : fin.invoiceKeyFor(card, date);
      const n = +s.$('#f-inst').value, c = amount.getCents();
      const due = `(vence ${U.fmtDate(fin.dueDate(card, key))})`;
      if (isOngoing()) {
        const start = +s.$('#f-start').value;
        if (start > n || n < 2) { el.innerHTML = 'A parcela atual precisa ser menor ou igual ao total de parcelas.'; return; }
        const left = n - start + 1;
        el.innerHTML = `A parcela <b>${start}/${n}</b> entra na fatura de <b>${U.monthShort(key)}</b> ${due}. ${left > 1
          ? `Faltam ${left} parcelas, a última na fatura de ${U.monthShort(U.addMonths(key, left - 1))}.`
          : 'É a última parcela.'}${c ? ` Total ainda a pagar: <b>${U.money(c * left)}</b>.` : ''} Não mexe no saldo da conta.`;
        return;
      }
      const parc = n > 1 && c ? ` São ${n}x de ${U.money(Math.round(c / n))}, a última na fatura de ${U.monthShort(U.addMonths(key, n - 1))}.` : '';
      el.innerHTML = `Entra na fatura de <b>${U.monthShort(key)}</b> ${due}. Não mexe no saldo da conta agora.${parc}`;
    }
    function refreshAccounts() {
      const accs = S.list('accounts');
      const first = (accs[0] || {}).id || '';
      s.$('#f-acc').innerHTML = ui.accountOptions(first);
      s.$('#f-from').innerHTML = ui.accountOptions(first);
      s.$('#f-to').innerHTML = ui.accountOptions((accs[1] || accs[0] || {}).id);
      setType(type);
    }
    function refreshCards() {
      const list = S.list('cards');
      s.$('#f-card').innerHTML = ui.options(list.map(c => [c.id, c.name]), (list[list.length - 1] || {}).id);
      setType(type);
    }

    s.$$('[data-type]').forEach(b => b.addEventListener('click', () => { if (!b.disabled) setType(b.dataset.type); }));
    s.$$('[data-day]').forEach(b => b.addEventListener('click', () => { s.$('#f-date').value = U.addDays(U.today(), +b.dataset.day); invInfo(); }));
    ['#f-date', '#f-card', '#f-inst', '#f-start', '#f-ongoing'].forEach(id => s.$(id).addEventListener('change', invInfo));
    amount.addEventListener('money', invInfo);
    s.$('[data-new-acc]').addEventListener('click', () => account({ onSaved: refreshAccounts }));
    s.$('[data-new-card]').addEventListener('click', () => card({ onSaved: refreshCards }));
    const del = s.$('[data-del]');
    if (del) del.addEventListener('click', async () => {
      if (!(await ui.confirm('Excluir este lançamento?', { ok: 'Excluir', danger: true }))) return;
      if (purchase) S.remove('cardPurchases', purchase.id); else S.remove('transactions', tx.id);
      ui.toast('Lançamento excluído');
      s.close();
    });

    setType(type);
    setTimeout(() => { if (!editing) amount.focus(); }, 280);

    function save(action) {
      picker.commit();
      const amt = amount.getCents(), date = s.$('#f-date').value;
      const description = s.$('#f-desc').value.trim(), notes = s.$('#f-notes').value.trim();
      if (!amt) return fail('Informe o valor.', amount);
      if (!date) return fail('Informe a data.', s.$('#f-date'));

      if (type === 'cartao') {
        const cardId = s.$('#f-card').value, c = S.get('cards', cardId);
        if (!c) return fail('Cadastre um cartão primeiro.');
        if (!picker.value) return fail('Escolha a categoria.', picker.input);
        const firstInvoice = purchase && purchase.cardId === cardId && purchase.date === date ? purchase.firstInvoice : fin.invoiceKeyFor(c, date);
        const n = +s.$('#f-inst').value, ongoing = isOngoing(), start = ongoing ? +s.$('#f-start').value : 1;
        if (ongoing && (n < 2 || start > n)) return fail('A parcela atual precisa ser menor ou igual ao total de parcelas.', s.$('#f-start'));
        const rec = {
          cardId, date, amount: ongoing ? amt * n : amt, installments: n, startInstallment: start,
          refund: s.$('#f-refund').checked, categoryId: picker.value, description, notes, firstInvoice,
        };
        if (purchase) S.update('cardPurchases', purchase.id, rec); else S.add('cardPurchases', rec);
        S.pref('lastCard', cardId);
      } else {
        const rec = { type, date, amount: amt, description, notes };
        if (type === 'transferencia') {
          rec.accountId = s.$('#f-from').value;
          rec.toAccountId = s.$('#f-to').value;
          rec.categoryId = null;
          if (!rec.accountId || !rec.toAccountId) return fail('Cadastre as contas primeiro.');
          if (rec.accountId === rec.toAccountId) return fail('Escolha contas diferentes.', s.$('#f-to'));
        } else {
          rec.accountId = s.$('#f-acc').value;
          rec.categoryId = picker.value;
          if (!rec.accountId) return fail('Cadastre uma conta primeiro.');
          if (!rec.categoryId) return fail('Escolha a categoria.', picker.input);
        }
        if (tx) S.update('transactions', tx.id, rec); else S.add('transactions', rec);
        S.pref('lastAccount', rec.accountId);
      }
      if (!editing) S.pref('lastType', type);
      ui.toast(editing ? 'Lançamento atualizado' : 'Lançamento salvo');
      if (action === 'again') {
        amount.setCents(0);
        s.$('#f-desc').value = '';
        s.$('#f-notes').value = '';
        s.$('#f-refund').checked = false;
        s.$('#f-inst').value = '1';
        picker.set(null);
        amount.focus();
      } else s.close();
    }
  }

  // ======================================================================
  // Antecipar / pagar fatura (sai da conta e abate da fatura)
  // ======================================================================
  function invoicePayment({ cardId, key, tx } = {}) {
    const c = S.get('cards', tx ? tx.cardId : cardId);
    if (!c) return ui.toast('Cartão não encontrado.', 'error');
    const invs = fin.invoices(c), cur = fin.currentInvoiceKey(c);
    const openOf = k => {
      const inv = invs.find(i => i.key === k);
      return (inv ? inv.open : 0) + (tx && tx.invoiceKey === k ? tx.amount : 0);
    };
    const keys = new Set(invs.filter(i => i.open > 0).map(i => i.key));
    keys.add(cur);
    if (tx) keys.add(tx.invoiceKey);
    if (key) keys.add(key);
    const sel = tx ? tx.invoiceKey : key || (invs.find(i => i.open > 0) || {}).key || cur;
    const accs = S.list('accounts').filter(a => !a.archived);
    const defAcc = tx ? tx.accountId : (accs.find(a => a.id === S.pref('lastAccount')) || accs[0] || {}).id;
    const invLabel = k => `${U.monthShort(k)} · vence ${U.fmtDayMonth(fin.dueDate(c, k))} · em aberto ${U.money(openOf(k))}`;

    const body = `
      <p class="info">O valor sai do saldo da conta escolhida e diminui o que falta pagar da fatura. Pode ser só uma parte (antecipação).</p>
      ${ui.field('Fatura', `<select class="input" id="p-inv">${ui.options([...keys].sort().map(k => [k, invLabel(k)]), sel)}</select>`)}
      <div class="field"><span class="field-label">Valor</span>
        <div class="money-row"><input class="input money-sm" id="p-amount" aria-label="Valor"><button type="button" class="chip" id="p-full">Valor total</button></div>
      </div>
      ${ui.field('Pagar com a conta', `<select class="input" id="p-acc">${ui.accountOptions(defAcc)}</select>`)}
      ${ui.field('Data do pagamento', `<input class="input" type="date" id="p-date" value="${tx ? tx.date : U.today()}">`)}`;
    const s = ui.sheet({
      title: `Antecipar / pagar fatura · ${c.name}`,
      body,
      foot: `<button class="btn btn-primary" value="save">${tx ? 'Salvar' : 'Confirmar pagamento'}</button>${tx ? deleteBtn : ''}`,
      onSubmit: save,
    });
    const amount = ui.moneyField(s.$('#p-amount'), tx ? tx.amount : Math.max(0, openOf(sel)));
    s.$('#p-full').addEventListener('click', () => amount.setCents(Math.max(0, openOf(s.$('#p-inv').value))));
    s.$('#p-inv').addEventListener('change', () => { if (!tx) amount.setCents(Math.max(0, openOf(s.$('#p-inv').value))); });
    const del = s.$('[data-del]');
    if (del) del.addEventListener('click', async () => {
      if (!(await ui.confirm('Excluir este pagamento? O valor volta para a fatura e para o saldo da conta.', { ok: 'Excluir', danger: true }))) return;
      S.remove('transactions', tx.id);
      ui.toast('Pagamento excluído');
      s.close();
    });

    function save() {
      const amt = amount.getCents(), accountId = s.$('#p-acc').value, invoiceKey = s.$('#p-inv').value, date = s.$('#p-date').value;
      if (!amt) return fail('Informe o valor.', amount);
      if (!accountId) return fail('Cadastre uma conta primeiro.');
      if (!date) return fail('Informe a data.', s.$('#p-date'));
      const rec = { type: 'fatura', cardId: c.id, invoiceKey, accountId, amount: amt, date, description: `Fatura ${c.name} (${U.monthShort(invoiceKey)})`, categoryId: null };
      if (tx) S.update('transactions', tx.id, rec); else S.add('transactions', rec);
      ui.toast(amt < openOf(invoiceKey) ? 'Antecipação registrada' : 'Pagamento registrado');
      s.close();
    }
  }

  // ======================================================================
  // Cadastros
  // ======================================================================
  function nextCode(kind) {
    const codes = S.list('categories').filter(c => c.kind === kind).map(c => parseInt(c.code, 10)).filter(n => !isNaN(n));
    const base = kind === 'receita' ? 101 : 201;
    // procura o primeiro número livre dentro da faixa (1xx / 2xx), antes dos "99"
    for (let n = base; n < base + 98; n++) if (!codes.includes(n)) return String(n);
    return String(Math.max(base, ...codes) + 1);
  }

  function category({ cat = null, kind = 'despesa', name = '', onSaved } = {}) {
    const k = cat ? cat.kind : kind;
    const body = `
      <div class="seg" role="tablist">
        <button type="button" data-kind="despesa" aria-selected="${k === 'despesa'}">Despesa</button>
        <button type="button" data-kind="receita" aria-selected="${k === 'receita'}">Receita</button>
      </div>
      <div class="row2 code-row">
        ${ui.field('Código', `<input class="input" id="c-code" inputmode="numeric" maxlength="8" value="${U.esc(cat ? cat.code : nextCode(k))}">`)}
        ${ui.field('Nome', `<input class="input" id="c-name" maxlength="60" value="${U.esc(cat ? cat.name : name)}">`)}
      </div>
      <label class="check" id="c-salary-wrap"><input type="checkbox" id="c-salary"${cat && cat.salary ? ' checked' : ''}> Conta como salário (usado no gráfico gastos × salário)</label>
      ${cat ? `<label class="check"><input type="checkbox" id="c-active"${cat.active !== false ? ' checked' : ''}> Ativa (aparece na hora de lançar)</label>` : ''}`;
    const s = ui.sheet({
      title: cat ? 'Editar categoria' : 'Nova categoria',
      body,
      foot: `<button class="btn btn-primary" value="save">Salvar</button>${cat ? deleteBtn : ''}`,
      onSubmit: save,
    });
    let curKind = k;
    const syncKind = () => {
      s.$$('[data-kind]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.kind === curKind)));
      s.$('#c-salary-wrap').hidden = curKind !== 'receita';
    };
    s.$$('[data-kind]').forEach(b => b.addEventListener('click', () => {
      if (curKind === b.dataset.kind) return;
      curKind = b.dataset.kind;
      if (!cat) s.$('#c-code').value = nextCode(curKind);
      syncKind();
    }));
    syncKind();
    setTimeout(() => s.$('#c-name').focus(), 280);

    const del = s.$('[data-del]');
    if (del) del.addEventListener('click', async () => {
      const used = S.list('transactions').some(t => t.categoryId === cat.id) || S.list('cardPurchases').some(p => p.categoryId === cat.id);
      if (used) return ui.toast('Essa categoria já tem lançamentos. Desmarque "Ativa" para escondê-la.', 'error');
      if (!(await ui.confirm(`Excluir a categoria "${cat.name}"?`, { ok: 'Excluir', danger: true }))) return;
      S.remove('categories', cat.id);
      s.close();
    });

    function save() {
      const code = s.$('#c-code').value.trim(), nm = s.$('#c-name').value.trim();
      if (!code) return fail('Informe o código.', s.$('#c-code'));
      if (!nm) return fail('Informe o nome.', s.$('#c-name'));
      if (S.list('categories').some(c => c.code === code && (!cat || c.id !== cat.id))) return fail(`O código ${code} já está em uso.`, s.$('#c-code'));
      const rec = {
        kind: curKind, code, name: nm,
        salary: curKind === 'receita' && s.$('#c-salary').checked,
        active: cat ? s.$('#c-active').checked : true,
      };
      const saved = cat ? S.update('categories', cat.id, rec) : S.add('categories', rec);
      ui.toast('Categoria salva');
      s.close();
      if (onSaved) onSaved(saved);
    }
  }

  const ACCOUNT_KINDS = [['corrente', 'Conta corrente'], ['digital', 'Conta digital'], ['poupanca', 'Poupança'], ['carteira', 'Carteira / dinheiro'], ['outra', 'Outra']];

  function account({ acc = null, onSaved } = {}) {
    const body = `
      ${ui.field('Nome', `<input class="input" id="a-name" maxlength="40" placeholder="Ex.: Nubank, Itaú, Carteira" value="${U.esc(acc ? acc.name : '')}">`)}
      ${ui.field('Tipo', `<select class="input" id="a-kind">${ui.options(ACCOUNT_KINDS, acc ? acc.kind : 'corrente')}</select>`)}
      <div class="row2">
        ${ui.field('Saldo inicial', '<input class="input money-sm" id="a-bal">')}
        ${ui.field('Na data de', `<input class="input" type="date" id="a-date" value="${acc ? acc.initialDate : U.today()}">`)}
      </div>
      <label class="check"><input type="checkbox" id="a-neg"${acc && acc.initialBalance < 0 ? ' checked' : ''}> Saldo inicial negativo (cheque especial)</label>
      <p class="info">É o saldo que a conta tinha no começo desse dia. Os lançamentos a partir daí somam ou subtraem desse valor.</p>
      ${acc ? `<label class="check"><input type="checkbox" id="a-arch"${acc.archived ? ' checked' : ''}> Arquivada (não aparece mais para lançar)</label>` : ''}`;
    const s = ui.sheet({
      title: acc ? 'Editar conta' : 'Nova conta',
      body,
      foot: `<button class="btn btn-primary" value="save">Salvar</button>${acc ? deleteBtn : ''}`,
      onSubmit: save,
    });
    const bal = ui.moneyField(s.$('#a-bal'), acc ? acc.initialBalance : 0);
    setTimeout(() => { if (!acc) s.$('#a-name').focus(); }, 280);
    const del = s.$('[data-del]');
    if (del) del.addEventListener('click', async () => {
      if (S.list('transactions').some(t => t.accountId === acc.id || t.toAccountId === acc.id)) {
        return ui.toast('Essa conta tem lançamentos. Marque como "Arquivada" para escondê-la.', 'error');
      }
      if (!(await ui.confirm(`Excluir a conta "${acc.name}"?`, { ok: 'Excluir', danger: true }))) return;
      S.remove('accounts', acc.id);
      s.close();
    });
    function save() {
      const name = s.$('#a-name').value.trim(), initialDate = s.$('#a-date').value;
      if (!name) return fail('Informe o nome da conta.', s.$('#a-name'));
      if (!initialDate) return fail('Informe a data do saldo inicial.', s.$('#a-date'));
      const rec = {
        name, kind: s.$('#a-kind').value, initialDate,
        initialBalance: bal.getCents() * (s.$('#a-neg').checked ? -1 : 1),
        archived: acc ? s.$('#a-arch').checked : false,
      };
      const saved = acc ? S.update('accounts', acc.id, rec) : S.add('accounts', rec);
      ui.toast('Conta salva');
      s.close();
      if (onSaved) onSaved(saved);
    }
  }

  function card({ c = null, onSaved } = {}) {
    const days = Array.from({ length: 31 }, (_, i) => [i + 1, `Dia ${i + 1}`]);
    const body = `
      ${ui.field('Nome do cartão', `<input class="input" id="k-name" maxlength="40" placeholder="Ex.: Nubank, Inter" value="${U.esc(c ? c.name : '')}">`)}
      ${ui.field('Limite', '<input class="input money-sm" id="k-limit">')}
      <div class="row2">
        ${ui.field('Fechamento', `<select class="input" id="k-close">${ui.options(days, c ? c.closingDay : 3)}</select>`)}
        ${ui.field('Vencimento', `<select class="input" id="k-due">${ui.options(days, c ? c.dueDay : 10)}</select>`)}
      </div>
      <p class="info">Compras feitas a partir do dia do fechamento já vão para a fatura do mês seguinte (é o "melhor dia de compra").</p>`;
    const s = ui.sheet({
      title: c ? 'Editar cartão' : 'Novo cartão',
      body,
      foot: `<button class="btn btn-primary" value="save">Salvar</button>${c ? deleteBtn : ''}`,
      onSubmit: save,
    });
    const limit = ui.moneyField(s.$('#k-limit'), c ? c.limit : 0);
    setTimeout(() => { if (!c) s.$('#k-name').focus(); }, 280);
    const del = s.$('[data-del]');
    if (del) del.addEventListener('click', async () => {
      if (S.list('cardPurchases').some(p => p.cardId === c.id) || S.list('transactions').some(t => t.cardId === c.id)) {
        return ui.toast('Esse cartão tem compras ou pagamentos lançados e não pode ser excluído.', 'error');
      }
      if (!(await ui.confirm(`Excluir o cartão "${c.name}"?`, { ok: 'Excluir', danger: true }))) return;
      S.remove('cards', c.id);
      s.close();
    });
    function save() {
      const name = s.$('#k-name').value.trim();
      if (!name) return fail('Informe o nome do cartão.', s.$('#k-name'));
      const rec = { name, limit: limit.getCents(), closingDay: +s.$('#k-close').value, dueDay: +s.$('#k-due').value };
      if (rec.closingDay === rec.dueDay) return fail('Fechamento e vencimento não podem ser no mesmo dia.', s.$('#k-due'));
      const saved = c ? S.update('cards', c.id, rec) : S.add('cards', rec);
      ui.toast('Cartão salvo');
      s.close();
      if (onSaved) onSaved(saved);
    }
  }

  // ======================================================================
  // Patrimônio
  // ======================================================================
  const INVEST_KINDS = [['CDB', 'CDB / RDB'], ['Tesouro', 'Tesouro Direto'], ['LCI/LCA', 'LCI / LCA'], ['Poupança', 'Poupança'], ['Fundo', 'Fundo de investimento'], ['Previdência', 'Previdência'], ['Ações', 'Ações / FIIs'], ['Outro', 'Outro']];

  function historyList(hist, render) {
    if (!hist || !hist.length) return '';
    return `<h3 class="sub-title">Histórico de atualizações</h3><div class="hist">${hist.slice().reverse().slice(0, 12)
      .map(h => `<div class="hist-row"><span>${U.fmtDate(h.date)}</span>${render(h)}</div>`).join('')}</div>`;
  }

  function investment({ inv = null } = {}) {
    const cur = inv ? fin.investmentState(inv) : null;
    const moves = inv ? fin.investmentMoves(inv.id) : [];
    const body = `
      ${ui.field('Nome', `<input class="input" id="i-name" maxlength="60" placeholder="Ex.: CDB 110% CDI" value="${U.esc(inv ? inv.name : '')}">`)}
      <div class="row2">
        ${ui.field('Instituição', `<input class="input" id="i-inst" maxlength="40" placeholder="Ex.: Banco Inter" value="${U.esc(inv ? inv.institution : '')}">`)}
        ${ui.field('Tipo', `<select class="input" id="i-kind">${ui.options(INVEST_KINDS, inv ? inv.kind : 'CDB')}</select>`)}
      </div>
      <div class="row2">
        ${ui.field('Valor aplicado', '<input class="input money-sm" id="i-applied">')}
        ${ui.field('Data da aplicação', `<input class="input" type="date" id="i-start" value="${inv ? inv.startDate || '' : U.today()}">`)}
      </div>
      <div class="row2">
        ${ui.field('Rendimento bruto até hoje', '<input class="input money-sm" id="i-yield">')}
        ${ui.field('Descontos atuais (IR, IOF, taxas)', '<input class="input money-sm" id="i-disc">')}
      </div>
      ${ui.field('Valores atualizados em', `<input class="input" type="date" id="i-upd" value="${U.today()}">`)}
      <div class="net-preview"><span>Valor líquido se sacar hoje</span><strong id="i-net"></strong></div>
      ${ui.field('Observação', `<textarea class="input" id="i-notes" rows="2" maxlength="300" placeholder="Ex.: vencimento, liquidez">${U.esc(inv ? inv.notes || '' : '')}</textarea>`)}
      ${moves.length ? `<h3 class="sub-title">Aportes e resgates</h3><div class="hist">${moves.slice().reverse().map(m => `
        <button type="button" class="hist-row" data-move="${m.id}"><span>${U.fmtDate(m.date)} · ${m.type === 'aporte' ? 'Aporte' : 'Resgate'}</span><span class="${m.type === 'aporte' ? '' : 'pos'}">${U.moneySigned(m.type === 'aporte' ? m.amount : -m.amount)}</span></button>`).join('')}</div>` : ''}
      ${inv ? historyList(inv.history, h => `<span>líquido ${U.money(h.applied + h.grossYield - h.discounts)}</span>`) : ''}`;
    const s = ui.sheet({
      title: inv ? 'Atualizar aplicação' : 'Nova aplicação',
      body,
      foot: `<button class="btn btn-primary" value="save">Salvar</button>${inv ? deleteBtn : ''}`,
      onSubmit: save,
    });
    const applied = ui.moneyField(s.$('#i-applied'), cur ? cur.applied : 0);
    const gy = ui.moneyField(s.$('#i-yield'), cur ? cur.grossYield : 0);
    const disc = ui.moneyField(s.$('#i-disc'), cur ? cur.discounts : 0);
    const preview = () => { s.$('#i-net').textContent = U.money(applied.getCents() + gy.getCents() - disc.getCents()); };
    s.el.addEventListener('money', preview);
    preview();
    setTimeout(() => (inv ? gy : s.$('#i-name')).focus(), 280);
    s.$$('[data-move]').forEach(b => b.addEventListener('click', () => {
      s.close();
      investmentMove({ tx: S.get('transactions', b.dataset.move) });
    }));
    const del = s.$('[data-del]');
    if (del) del.addEventListener('click', async () => {
      if (moves.length) return ui.toast('Essa aplicação tem aportes/resgates no extrato. Exclua-os antes.', 'error');
      if (!(await ui.confirm(`Excluir a aplicação "${inv.name}"?`, { ok: 'Excluir', danger: true }))) return;
      S.remove('investments', inv.id);
      s.close();
    });
    function save() {
      const name = s.$('#i-name').value.trim();
      if (!name) return fail('Informe o nome da aplicação.', s.$('#i-name'));
      const snap = { date: s.$('#i-upd').value || U.today(), applied: applied.getCents(), grossYield: gy.getCents(), discounts: disc.getCents(), savedAt: Date.now() };
      const history = (inv && inv.history ? inv.history.slice() : []).filter(h => h.date !== snap.date);
      history.push(snap);
      history.sort((a, b) => a.date.localeCompare(b.date));
      const rec = {
        name, institution: s.$('#i-inst').value.trim(), kind: s.$('#i-kind').value, startDate: s.$('#i-start').value,
        applied: snap.applied, grossYield: snap.grossYield, discounts: snap.discounts, updatedOn: snap.date,
        notes: s.$('#i-notes').value.trim(), history,
      };
      if (inv) S.update('investments', inv.id, rec); else S.add('investments', rec);
      ui.toast('Aplicação salva');
      s.close();
    }
  }

  const ASSET_KINDS = [['veiculo', 'Veículo'], ['imovel', 'Imóvel'], ['outro', 'Outro bem']];

  function asset({ a = null } = {}) {
    const body = `
      ${ui.field('Tipo', `<select class="input" id="b-kind">${ui.options(ASSET_KINDS, a ? a.kind : 'veiculo')}</select>`)}
      ${ui.field('Nome', `<input class="input" id="b-name" maxlength="60" placeholder="Ex.: Onix 1.0 2020" value="${U.esc(a ? a.name : '')}">`)}
      ${ui.field('Detalhes', `<input class="input" id="b-det" maxlength="80" placeholder="Ex.: placa, cor, ano/modelo" value="${U.esc(a ? a.details || '' : '')}">`)}
      <div class="row2">
        ${ui.field('Valor de compra', '<input class="input money-sm" id="b-acq">')}
        ${ui.field('Data da compra', `<input class="input" type="date" id="b-date" value="${a ? a.acquisitionDate || '' : ''}">`)}
      </div>
      <div class="row2">
        ${ui.field('Valor atual', '<input class="input money-sm" id="b-cur">', { hint: 'Para carro, use a tabela FIPE.' })}
        ${ui.field('Atualizado em', `<input class="input" type="date" id="b-upd" value="${U.today()}">`)}
      </div>
      ${a ? historyList(a.history, h => `<span>${U.money(h.value)}</span>`) : ''}`;
    const s = ui.sheet({
      title: a ? 'Editar bem' : 'Novo bem (imobilizado)',
      body,
      foot: `<button class="btn btn-primary" value="save">Salvar</button>${a ? deleteBtn : ''}`,
      onSubmit: save,
    });
    const acq = ui.moneyField(s.$('#b-acq'), a ? a.acquisitionValue : 0);
    const cur = ui.moneyField(s.$('#b-cur'), a ? a.currentValue : 0);
    setTimeout(() => (a ? cur : s.$('#b-name')).focus(), 280);
    const del = s.$('[data-del]');
    if (del) del.addEventListener('click', async () => {
      if (!(await ui.confirm(`Excluir "${a.name}" do patrimônio?`, { ok: 'Excluir', danger: true }))) return;
      S.remove('assets', a.id);
      s.close();
    });
    function save() {
      const name = s.$('#b-name').value.trim();
      if (!name) return fail('Informe o nome do bem.', s.$('#b-name'));
      if (!cur.getCents()) return fail('Informe o valor atual.', cur);
      const snap = { date: s.$('#b-upd').value || U.today(), value: cur.getCents() };
      const history = (a && a.history ? a.history.slice() : []).filter(h => h.date !== snap.date);
      history.push(snap);
      history.sort((x, y) => x.date.localeCompare(y.date));
      const rec = {
        kind: s.$('#b-kind').value, name, details: s.$('#b-det').value.trim(),
        acquisitionValue: acq.getCents(), acquisitionDate: s.$('#b-date').value,
        currentValue: snap.value, updatedOn: snap.date, history,
      };
      if (a) S.update('assets', a.id, rec); else S.add('assets', rec);
      ui.toast('Bem salvo');
      s.close();
    }
  }

  // ======================================================================
  // Aporte / resgate de aplicação (mexe no saldo da conta)
  // ======================================================================
  function investmentMove({ inv = null, kind = 'aporte', tx = null } = {}) {
    if (tx) { inv = S.get('investments', tx.investmentId); kind = tx.type; }
    if (!inv) return ui.toast('Aplicação não encontrada.', 'error');
    const aporte = kind === 'aporte';
    const accs = S.list('accounts').filter(a => !a.archived);
    const defAcc = tx ? tx.accountId : (accs.find(a => a.id === S.pref('lastAccount')) || accs[0] || {}).id;
    // líquido disponível na data, desconsiderando o próprio resgate quando está editando
    const netAt = date => {
      const st = fin.investmentState(inv, date);
      return tx && tx.type === 'resgate' && tx.date <= date ? st.net + tx.amount : st.net;
    };
    const lastSnap = fin.investmentState(inv).snapDate;
    const body = `
      <p class="info">${aporte
        ? 'O valor sai da conta escolhida e soma no valor aplicado.'
        : 'Informe o valor <b>líquido</b> que caiu na conta. A aplicação diminui na mesma proporção (aplicado, rendimento e descontos).'}</p>
      <div class="field"><span class="field-label">${aporte ? 'Valor do aporte' : 'Valor líquido recebido'}</span>
        <div class="money-row"><input class="input money-sm" id="m-amount" aria-label="Valor">${aporte ? '' : '<button type="button" class="chip" id="m-all">Resgatar tudo</button>'}</div>
        ${aporte ? '' : '<span class="field-hint" id="m-avail"></span>'}
      </div>
      ${ui.field(aporte ? 'Sai da conta' : 'Cai na conta', `<select class="input" id="m-acc">${ui.accountOptions(defAcc)}</select>`)}
      ${ui.field('Data', `<input class="input" type="date" id="m-date" value="${tx ? tx.date : U.today()}">`)}
      <p class="info" id="m-old" hidden>A última atualização de valores desta aplicação é de ${U.fmtDate(lastSnap)}. Movimentos com data anterior são considerados já incluídos nela.</p>
      ${ui.field('Descrição', `<input class="input" id="m-desc" maxlength="120" placeholder="Opcional" value="${U.esc(tx && !/^(Aporte|Resgate) · /.test(tx.description || '') ? tx.description : '')}">`)}`;
    const s = ui.sheet({
      title: `${aporte ? 'Aporte em' : 'Resgate de'} ${inv.name}`,
      body,
      foot: `<button class="btn btn-primary" value="save">Salvar</button>${tx ? deleteBtn : ''}`,
      onSubmit: save,
    });
    const amount = ui.moneyField(s.$('#m-amount'), tx ? tx.amount : 0);
    const dateEl = s.$('#m-date');
    const sync = () => {
      const d = dateEl.value || U.today();
      s.$('#m-old').hidden = !(lastSnap && d < lastSnap);
      if (!aporte) s.$('#m-avail').textContent = `Disponível para resgate nessa data: ${U.money(netAt(d))}`;
    };
    dateEl.addEventListener('change', sync);
    sync();
    if (!aporte) s.$('#m-all').addEventListener('click', () => amount.setCents(Math.max(0, netAt(dateEl.value || U.today()))));
    setTimeout(() => { if (!tx) amount.focus(); }, 280);
    const del = s.$('[data-del]');
    if (del) del.addEventListener('click', async () => {
      if (!(await ui.confirm(`Excluir este ${aporte ? 'aporte' : 'resgate'}? O saldo da conta e o valor da aplicação voltam ao que eram.`, { ok: 'Excluir', danger: true }))) return;
      S.remove('transactions', tx.id);
      ui.toast('Movimento excluído');
      s.close();
    });

    function save() {
      const amt = amount.getCents(), accountId = s.$('#m-acc').value, date = dateEl.value;
      if (!amt) return fail('Informe o valor.', amount);
      if (!accountId) return fail('Cadastre uma conta primeiro.');
      if (!date) return fail('Informe a data.', dateEl);
      if (!aporte && amt > netAt(date)) return fail(`O resgate é maior que o disponível (${U.money(netAt(date))}).`, amount);
      const description = s.$('#m-desc').value.trim() || `${aporte ? 'Aporte' : 'Resgate'} · ${inv.name}`;
      const rec = { type: kind, investmentId: inv.id, accountId, amount: amt, date, description, categoryId: null };
      if (tx) S.update('transactions', tx.id, rec); else S.add('transactions', rec);
      S.pref('lastAccount', accountId);
      ui.toast(aporte ? 'Aporte registrado' : 'Resgate registrado');
      s.close();
    }
  }

  // ======================================================================
  // Metas
  // ======================================================================
  function goal({ g = null } = {}) {
    const invs = S.list('investments');
    const avg = fin.avgMonthlyExpense();
    let mode = g ? g.mode : invs.length ? 'aplicacoes' : 'manual';
    const linked = new Set(g ? g.investmentIds || [] : []);
    const body = `
      ${ui.field('Nome da meta', `<input class="input" id="g-name" maxlength="60" placeholder="Ex.: Reserva de emergência, Viagem" value="${U.esc(g ? g.name : '')}">`)}
      <div class="field"><span class="field-label">Valor da meta</span><input class="input money-sm" id="g-target" aria-label="Valor da meta"></div>
      ${avg ? `<button type="button" class="link suggest" id="g-suggest">Sugestão para reserva de emergência: 6× seu gasto médio mensal = ${U.money(avg * 6)}</button>` : ''}
      ${ui.field('Prazo (opcional)', `<input class="input" type="date" id="g-deadline" value="${g ? g.deadline || '' : ''}">`, { hint: 'Com prazo, o app calcula quanto guardar por mês.' })}
      <div class="field"><span class="field-label">Como acompanhar o valor guardado</span>
        <div class="seg">
          <button type="button" data-mode="aplicacoes">Pelas aplicações</button>
          <button type="button" data-mode="manual">Valor manual</button>
        </div>
      </div>
      <div data-show="aplicacoes">
        ${invs.length ? `<p class="field-hint mt-s">Soma o valor líquido das aplicações marcadas:</p>${invs.map(i => `
          <label class="check"><input type="checkbox" value="${i.id}"${linked.has(i.id) ? ' checked' : ''}> ${U.esc(i.name)} <span class="muted">· ${U.money(fin.investmentNet(i))}</span></label>`).join('')}`
          : '<p class="info">Você ainda não tem aplicações cadastradas. Cadastre em Patrimônio ou use o valor manual.</p>'}
      </div>
      <div data-show="manual">
        <div class="field"><span class="field-label">Quanto já tem guardado</span><input class="input money-sm" id="g-saved" aria-label="Valor guardado"></div>
      </div>`;
    const s = ui.sheet({
      title: g ? 'Editar meta' : 'Nova meta',
      body,
      foot: `<button class="btn btn-primary" value="save">Salvar</button>${g ? deleteBtn : ''}`,
      onSubmit: save,
    });
    const target = ui.moneyField(s.$('#g-target'), g ? g.target : 0);
    const saved = ui.moneyField(s.$('#g-saved'), g ? g.saved || 0 : 0);
    const setMode = m => {
      mode = m;
      s.$$('[data-mode]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
      s.$$('[data-show]').forEach(d => { d.hidden = d.dataset.show !== m; });
    };
    s.$$('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
    setMode(mode);
    const sug = s.$('#g-suggest');
    if (sug) sug.addEventListener('click', () => {
      target.setCents(avg * 6);
      if (!s.$('#g-name').value.trim()) s.$('#g-name').value = 'Reserva de emergência';
    });
    setTimeout(() => { if (!g) s.$('#g-name').focus(); }, 280);
    const del = s.$('[data-del]');
    if (del) del.addEventListener('click', async () => {
      if (!(await ui.confirm(`Excluir a meta "${g.name}"? As aplicações não são afetadas.`, { ok: 'Excluir', danger: true }))) return;
      S.remove('goals', g.id);
      s.close();
    });

    function save() {
      const name = s.$('#g-name').value.trim();
      if (!name) return fail('Informe o nome da meta.', s.$('#g-name'));
      if (!target.getCents()) return fail('Informe o valor da meta.', target);
      const investmentIds = s.$$('[data-show=aplicacoes] input[type=checkbox]:checked').map(c => c.value);
      if (mode === 'aplicacoes' && !investmentIds.length) return fail('Marque pelo menos uma aplicação ou use o valor manual.');
      const rec = { name, target: target.getCents(), deadline: s.$('#g-deadline').value, mode, investmentIds, saved: saved.getCents() };
      if (g) S.update('goals', g.id, rec); else S.add('goals', rec);
      ui.toast('Meta salva');
      s.close();
    }
  }

  return { entry, invoicePayment, category, account, card, investment, investmentMove, asset, goal, ACCOUNT_KINDS };
})();
