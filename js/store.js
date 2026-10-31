'use strict';
// Camada de dados. Dois modos:
// - local: grava no navegador (localStorage), usado quando não há configuração do Firebase;
// - nuvem: grava no Firestore em users/{uid}/{coleção}/{id} e recebe mudanças em tempo real.
// O resto do app usa só list/get/add/update/remove, igual nos dois modos.
F.store = (() => {
  const U = F.util;
  const PREFIX = 'mf:';
  const COLS = ['accounts', 'categories', 'transactions', 'cards', 'cardPurchases', 'investments', 'assets', 'goals'];
  const DEFAULT_SETTINGS = { theme: 'auto', cardCompetence: 'compra' };
  const SEED_CATEGORIES = [
    ['receita', '101', 'Salário', true],
    ['receita', '102', '13º salário e férias', true],
    ['receita', '103', 'Rendimentos'],
    ['receita', '104', 'Renda extra'],
    ['receita', '105', 'Reembolsos'],
    ['receita', '199', 'Outras receitas'],
    ['despesa', '201', 'Aluguel / moradia'],
    ['despesa', '202', 'Condomínio'],
    ['despesa', '203', 'Energia elétrica'],
    ['despesa', '204', 'Água'],
    ['despesa', '205', 'Internet e telefone'],
    ['despesa', '206', 'Mercado'],
    ['despesa', '207', 'Restaurantes e delivery'],
    ['despesa', '208', 'Combustível'],
    ['despesa', '209', 'Manutenção do carro'],
    ['despesa', '210', 'IPVA, licenciamento e seguro'],
    ['despesa', '211', 'Transporte e aplicativos'],
    ['despesa', '212', 'Saúde e farmácia'],
    ['despesa', '213', 'Educação'],
    ['despesa', '214', 'Lazer'],
    ['despesa', '215', 'Assinaturas'],
    ['despesa', '216', 'Roupas e cuidados pessoais'],
    ['despesa', '217', 'Presentes'],
    ['despesa', '218', 'Tarifas e juros bancários'],
    ['despesa', '219', 'Impostos'],
    ['despesa', '299', 'Outras despesas'],
  ];

  const data = {};
  COLS.forEach(c => { data[c] = []; });
  let settings = { ...DEFAULT_SETTINGS };
  const listeners = new Set();
  let cloud = null; // { base, user, unsub: [] }

  const seedCategories = () => SEED_CATEGORIES.map(([kind, code, name, salary]) =>
    ({ id: U.uid(), kind, code, name, salary: !!salary, active: true, createdAt: Date.now() }));
  const emit = col => listeners.forEach(fn => fn(col));
  const clean = obj => JSON.parse(JSON.stringify(obj)); // o Firestore não aceita "undefined"
  const byCreated = (a, b) => (a.createdAt || 0) - (b.createdAt || 0) || (a.id < b.id ? -1 : 1);

  // ---------- localStorage ----------
  function readLocal(key, fallback) {
    try { const v = localStorage.getItem(PREFIX + key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  }
  function writeLocal(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); }
    catch (e) { console.error(e); alert('Não foi possível salvar os dados neste navegador.'); }
  }

  // ---------- Modo local ----------
  function load() {
    COLS.forEach(c => { data[c] = readLocal(c, []); });
    settings = { ...DEFAULT_SETTINGS, ...readLocal('settings', {}) };
    if (!readLocal('seeded', false)) {
      if (!data.categories.length) {
        data.categories = seedCategories();
        writeLocal('categories', data.categories);
      }
      writeLocal('seeded', true);
    }
  }

  // ---------- Modo nuvem ----------
  function cloudError(e) {
    console.error(e);
    if (F.ui) F.ui.toast(`Erro na nuvem: ${e.code || e.message}`, 'error');
  }
  const colRef = c => cloud.base.collection(c);
  const settingsRef = () => cloud.base.collection('meta').doc('settings');

  // Aplica várias gravações em lotes (o Firestore aceita até 500 por lote).
  async function commit(ops) {
    const db = firebase.firestore();
    for (let i = 0; i < ops.length; i += 400) {
      const batch = db.batch();
      ops.slice(i, i + 400).forEach(op => op(batch));
      await batch.commit();
    }
  }

  // Conecta ao usuário logado; resolve quando todos os dados chegaram pela primeira vez.
  function connect(user) {
    disconnect();
    cloud = { base: firebase.firestore().collection('users').doc(user.uid), user, unsub: [] };
    let firstRunDone = false;
    return new Promise(resolve => {
      const pending = new Set([...COLS, 'settings']);
      const done = key => { if (pending.delete(key) && !pending.size) resolve(); };
      COLS.forEach(c => cloud.unsub.push(colRef(c).onSnapshot(snap => {
        data[c] = snap.docs.map(d => d.data()).sort(byCreated);
        if (!pending.size) emit(c);
        done(c);
      }, err => { cloudError(err); done(c); })));
      cloud.unsub.push(settingsRef().onSnapshot(doc => {
        if (doc.exists) settings = { ...DEFAULT_SETTINGS, ...doc.data() };
        else if (!doc.metadata.fromCache && !firstRunDone) {
          // primeiro acesso: cria as categorias padrão
          firstRunDone = true;
          const cats = seedCategories();
          commit([...cats.map(c => b => b.set(colRef('categories').doc(c.id), c)), b => b.set(settingsRef(), DEFAULT_SETTINGS)]).catch(cloudError);
        }
        if (!pending.size) emit('settings');
        done('settings');
      }, err => { cloudError(err); done('settings'); }));
    });
  }
  function disconnect() {
    if (cloud) cloud.unsub.forEach(fn => fn());
    cloud = null;
    COLS.forEach(c => { data[c] = []; });
    settings = { ...DEFAULT_SETTINGS };
  }

  // ---------- Leitura e gravação ----------
  function persist(col, item, removedId) {
    if (!cloud) { writeLocal(col, data[col]); return; }
    const ref = colRef(col).doc(removedId || item.id);
    (removedId ? ref.delete() : ref.set(clean(item))).catch(cloudError);
  }

  const list = col => data[col];
  const get = (col, id) => data[col].find(x => x.id === id) || null;

  function add(col, obj) {
    const item = { ...obj, id: U.uid(), createdAt: Date.now() };
    data[col].push(item);
    persist(col, item);
    emit(col);
    return item;
  }
  function update(col, id, patch) {
    const i = data[col].findIndex(x => x.id === id);
    if (i < 0) return null;
    data[col][i] = { ...data[col][i], ...patch, updatedAt: Date.now() };
    persist(col, data[col][i]);
    emit(col);
    return data[col][i];
  }
  function remove(col, id) {
    data[col] = data[col].filter(x => x.id !== id);
    persist(col, null, id);
    emit(col);
  }

  function setSettings(patch) {
    settings = { ...settings, ...patch };
    if (cloud) settingsRef().set(clean(settings)).catch(cloudError);
    else writeLocal('settings', settings);
    emit('settings');
  }

  // ---------- Backup ----------
  function exportAll() {
    return { app: 'meu-financeiro', version: 1, exportedAt: new Date().toISOString(), settings, ...Object.fromEntries(COLS.map(c => [c, data[c]])) };
  }
  // Substitui todos os dados pelos do backup. Na nuvem, resolve quando o servidor confirmou.
  async function importAll(obj) {
    if (!obj || obj.app !== 'meu-financeiro') throw new Error('Este arquivo não é um backup do Meu Financeiro.');
    const ops = [];
    for (const c of COLS) {
      const incoming = (Array.isArray(obj[c]) ? obj[c] : []).map(x => (x.id ? x : { ...x, id: U.uid() }));
      if (cloud) {
        const keep = new Set(incoming.map(x => x.id));
        data[c].filter(x => !keep.has(x.id)).forEach(x => ops.push(b => b.delete(colRef(c).doc(x.id))));
        incoming.forEach(x => ops.push(b => b.set(colRef(c).doc(x.id), clean(x))));
      } else writeLocal(c, incoming);
      data[c] = incoming;
    }
    settings = { ...DEFAULT_SETTINGS, ...(obj.settings || {}) };
    if (cloud) ops.push(b => b.set(settingsRef(), clean(settings)));
    else { writeLocal('settings', settings); writeLocal('seeded', true); }
    emit('*');
    if (ops.length) await commit(ops);
  }
  function clearAll() {
    return importAll({ app: 'meu-financeiro', settings: DEFAULT_SETTINGS, categories: seedCategories() });
  }

  // Preferências deste aparelho (última conta usada etc.). Não vão para o backup nem para a nuvem.
  function pref(key, value) {
    if (value === undefined) return readLocal('pref:' + key, null);
    writeLocal('pref:' + key, value);
  }

  return {
    load, connect, disconnect, list, get, add, update, remove, settings: () => settings, setSettings,
    exportAll, importAll, clearAll, pref, onChange: fn => listeners.add(fn),
    user: () => (cloud ? cloud.user : null),
  };
})();
