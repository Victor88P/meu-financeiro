'use strict';
// Gráficos em SVG, sem bibliotecas externas (funciona offline).
F.charts = (() => {
  const U = F.util;

  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  function ticks(max, count = 4) {
    if (max <= 0) max = 10000;
    const step = niceStep(max / count), top = Math.ceil(max / step) * step, out = [];
    for (let v = 0; v <= top + step / 2; v += step) out.push(v);
    return out;
  }
  // Barra com cantos arredondados só no topo (a base fica presa ao eixo).
  function barPath(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h));
    const yb = y + h;
    return `M${x},${yb}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${yb}Z`;
  }

  // Barras agrupadas: labels = eixo X, series = [{ name, cls, values }], tooltip(i) => html.
  function groupedBars(el, { labels, series, tooltip, height = 230, ariaLabel = '' }) {
    const W = Math.max(280, el.clientWidth), H = height;
    const m = { t: 10, r: 4, b: 26, l: 62 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const tk = ticks(Math.max(0, ...series.flatMap(s => s.values)));
    const top = tk[tk.length - 1];
    const y = v => m.t + ih - (v / top) * ih;
    const gw = iw / labels.length, n = series.length;
    const bw = Math.max(4, Math.min(26, (gw * 0.72 - (n - 1) * 2) / n));
    const groupW = n * bw + (n - 1) * 2;

    let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="${U.esc(ariaLabel)}">`;
    for (const t of tk) {
      const yy = y(t);
      svg += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${yy}" y2="${yy}"/>`;
      svg += `<text class="tick" x="${m.l - 8}" y="${yy}" dy="0.32em" text-anchor="end">${U.esc(U.moneyCompact(t))}</text>`;
    }
    labels.forEach((lab, i) => {
      const gx = m.l + gw * i, cx = gx + gw / 2, x0 = cx - groupW / 2;
      svg += `<g class="grp" data-i="${i}"><rect class="hit" x="${gx + 1}" y="${m.t}" width="${gw - 2}" height="${ih}" rx="6"/>`;
      series.forEach((s, j) => {
        const v = s.values[i], yy = y(v), h = m.t + ih - yy;
        if (h > 0.5) svg += `<path class="bar ${s.cls}" d="${barPath(x0 + j * (bw + 2), yy, bw, h, 4)}"/>`;
      });
      svg += `<text class="xlab" x="${cx}" y="${H - 8}" text-anchor="middle">${U.esc(lab)}</text></g>`;
    });
    svg += `<line class="baseline" x1="${m.l}" x2="${W - m.r}" y1="${m.t + ih}" y2="${m.t + ih}"/></svg>`;

    el.innerHTML = `<div class="chart-wrap">${svg}<div class="tooltip" hidden></div></div>`;
    const wrap = el.firstElementChild, svgEl = wrap.querySelector('svg'), tip = wrap.querySelector('.tooltip');
    const hide = () => { tip.hidden = true; svgEl.classList.remove('hovering'); wrap.querySelectorAll('.grp.on').forEach(g => g.classList.remove('on')); };
    wrap.querySelectorAll('.grp').forEach(g => {
      const show = () => {
        const i = +g.dataset.i;
        wrap.querySelectorAll('.grp.on').forEach(o => o !== g && o.classList.remove('on'));
        g.classList.add('on');
        svgEl.classList.add('hovering');
        tip.innerHTML = tooltip(i);
        tip.hidden = false;
        const cx = m.l + gw * i + gw / 2, tw = tip.offsetWidth;
        tip.style.left = Math.max(0, Math.min(W - tw, cx - tw / 2)) + 'px';
        tip.style.top = '0px';
      };
      g.addEventListener('pointerenter', show);
      g.addEventListener('pointerdown', show);
    });
    wrap.addEventListener('pointerleave', hide);
  }

  // Escala "bonita" cobrindo [min, max] (a linha não precisa começar no zero).
  function niceRange(min, max, count = 4) {
    if (min === max) { const pad = Math.max(Math.abs(max) * 0.1, 10000); min -= pad; max += pad; }
    const step = niceStep((max - min) / count);
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, out = [];
    for (let v = lo; v <= hi + step / 2; v += step) out.push(v);
    return out;
  }

  // Linha única com marcadores, linha-guia e tooltip ao passar o dedo/mouse.
  function lineChart(el, { labels, values, tooltip, height = 230, ariaLabel = '', cls = 's1' }) {
    const W = Math.max(280, el.clientWidth), H = height;
    const m = { t: 12, r: 12, b: 26, l: 66 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b, n = values.length;
    const tk = niceRange(Math.min(...values), Math.max(...values));
    const lo = tk[0], hi = tk[tk.length - 1];
    const x = i => m.l + 10 + (n === 1 ? (iw - 20) / 2 : ((iw - 20) * i) / (n - 1));
    const y = v => m.t + ih - ((v - lo) / (hi - lo)) * ih;
    const colW = n === 1 ? iw : (iw - 20) / (n - 1);
    const every = colW < 40 ? 2 : 1;

    let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="${U.esc(ariaLabel)}">`;
    for (const t of tk) {
      const yy = y(t);
      svg += `<line class="${t === 0 && lo < 0 ? 'baseline' : 'grid'}" x1="${m.l}" x2="${W - m.r}" y1="${yy}" y2="${yy}"/>`;
      svg += `<text class="tick" x="${m.l - 8}" y="${yy}" dy="0.32em" text-anchor="end">${U.esc(U.moneyCompact(t))}</text>`;
    }
    labels.forEach((lab, i) => {
      if ((n - 1 - i) % every === 0) svg += `<text class="xlab" x="${x(i)}" y="${H - 8}" text-anchor="middle">${U.esc(lab)}</text>`;
    });
    svg += `<line class="crosshair" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" visibility="hidden"/>`;
    svg += `<path class="line ${cls}" d="${values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('')}"/>`;
    values.forEach((v, i) => { svg += `<circle class="dot ${cls}" data-i="${i}" cx="${x(i)}" cy="${y(v)}" r="${i === n - 1 ? 5 : 3.5}"/>`; });
    values.forEach((v, i) => { svg += `<rect class="hit" data-i="${i}" x="${x(i) - colW / 2}" y="${m.t}" width="${colW}" height="${ih}"/>`; });
    svg += '</svg>';

    el.innerHTML = `<div class="chart-wrap">${svg}<div class="tooltip" hidden></div></div>`;
    const wrap = el.firstElementChild, svgEl = wrap.querySelector('svg'), tip = wrap.querySelector('.tooltip');
    const cross = svgEl.querySelector('.crosshair');
    const dots = [...svgEl.querySelectorAll('.dot')];
    const hide = () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); dots.forEach(d => d.classList.remove('on')); };
    svgEl.querySelectorAll('.hit').forEach(r => {
      const show = () => {
        const i = +r.dataset.i, cx = x(i);
        cross.setAttribute('x1', cx);
        cross.setAttribute('x2', cx);
        cross.setAttribute('visibility', 'visible');
        dots.forEach((d, j) => d.classList.toggle('on', j === i));
        tip.innerHTML = tooltip(i);
        tip.hidden = false;
        const tw = tip.offsetWidth;
        tip.style.left = Math.max(0, Math.min(W - tw, cx + 12 + tw > W ? cx - tw - 12 : cx + 12)) + 'px';
        tip.style.top = '0px';
      };
      r.addEventListener('pointerenter', show);
      r.addEventListener('pointerdown', show);
    });
    wrap.addEventListener('pointerleave', hide);
  }

  // Barra empilhada única (composição), em HTML.
  function stackBar(parts) {
    const total = U.sum(parts, p => Math.max(0, p.value));
    if (!total) return '';
    return `<div class="stackbar" role="img" aria-label="${U.esc(parts.map(p => `${p.name}: ${U.money(p.value)}`).join(', '))}">${parts
      .filter(p => p.value > 0)
      .map(p => `<span class="${p.cls}" style="flex:${p.value / total}" title="${U.esc(p.name)}: ${U.esc(U.money(p.value))}"></span>`)
      .join('')}</div>`;
  }

  return { groupedBars, lineChart, stackBar };
})();
