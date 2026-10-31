'use strict';
// Utilitários gerais: datas, dinheiro (sempre em centavos inteiros), texto.
window.F = window.F || {};

F.util = (() => {
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const NUM1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
  const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const WEEK = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const pad = n => String(n).padStart(2, '0');
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  const money = cents => BRL.format((cents || 0) / 100);
  const moneySigned = cents => (cents > 0 ? '+' : cents < 0 ? '−' : '') + BRL.format(Math.abs(cents || 0) / 100);
  function moneyCompact(cents) {
    const v = Math.abs(cents) / 100, s = cents < 0 ? '−' : '';
    if (v >= 1e6) return `${s}R$ ${NUM1.format(v / 1e6)} mi`;
    if (v >= 1e3) return `${s}R$ ${NUM1.format(v / 1e3)} mil`;
    return `${s}R$ ${NUM1.format(Math.round(v))}`;
  }
  const pct = ratio => NUM1.format(ratio * 100) + '%';

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const iso = dt => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const today = () => iso(new Date());
  const monthOf = date => date.slice(0, 7);
  function addMonths(key, n) {
    let [y, m] = key.split('-').map(Number);
    m += n;
    y += Math.floor((m - 1) / 12);
    m = (((m - 1) % 12) + 12) % 12 + 1;
    return `${y}-${pad(m)}`;
  }
  function daysInMonth(key) { const [y, m] = key.split('-').map(Number); return new Date(y, m, 0).getDate(); }
  const dateIn = (key, day) => `${key}-${pad(Math.min(day, daysInMonth(key)))}`;
  function addDays(date, n) { const [y, m, d] = date.split('-').map(Number); return iso(new Date(y, m - 1, d + n)); }
  function monthLabel(key) { const [y, m] = key.split('-').map(Number); return `${cap(MONTHS[m - 1])} de ${y}`; }
  function monthShort(key) { const [y, m] = key.split('-').map(Number); return `${MONTHS[m - 1].slice(0, 3)}/${String(y).slice(2)}`; }
  const fmtDate = d => d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '';
  const fmtDayMonth = d => d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '';
  function dayHeader(date) {
    const t = today();
    if (date === t) return 'Hoje';
    if (date === addDays(t, -1)) return 'Ontem';
    if (date === addDays(t, 1)) return 'Amanhã';
    const [y, m, d] = date.split('-').map(Number);
    return `${cap(WEEK[new Date(y, m - 1, d).getDay()])}, ${d} de ${MONTHS[m - 1]}`;
  }

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const sum = (arr, f = x => x) => arr.reduce((a, x) => a + f(x), 0);
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  return {
    money, moneySigned, moneyCompact, pct, uid, today, monthOf, addMonths, daysInMonth, dateIn, addDays,
    monthLabel, monthShort, fmtDate, fmtDayMonth, dayHeader, esc, norm, sum, debounce, cap,
  };
})();
