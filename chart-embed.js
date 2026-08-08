/*
 * Styla size-chart embed — renders one of your saved charts as a clean table
 * anywhere on your site (product page, size-guide modal, landing page).
 *
 *   <div data-styla-chart="CHART_ID"></div>
 *   <script src="https://www.styla.ca/chart-embed.js" async></script>
 *
 * Optional attributes:
 *   data-title="false"   hide the chart name
 *   data-units="cm"      display in centimetres (values are stored in inches)
 *   data-theme="dark"    light (default) or dark
 *
 * Inherits your page's font. No dependencies, no tracking.
 */
(function () {
  var API = 'https://www.styla.ca';
  var CSS_ID = 'styla-chart-css';

  function injectCss() {
    if (document.getElementById(CSS_ID)) return;
    var s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = [
      '.styla-chart{font-family:inherit;color:inherit;max-width:100%;}',
      '.styla-chart .sc-head{display:flex;align-items:baseline;gap:8px;margin-bottom:10px;flex-wrap:wrap;}',
      '.styla-chart .sc-name{font-weight:700;font-size:1rem;}',
      '.styla-chart .sc-unit{font-size:.75rem;opacity:.6;}',
      '.styla-chart .sc-wrap{overflow-x:auto;border:1px solid rgba(0,0,0,.12);border-radius:10px;}',
      '.styla-chart table{width:100%;border-collapse:collapse;font-size:.86rem;}',
      '.styla-chart th{text-align:left;font-weight:600;font-size:.72rem;letter-spacing:.04em;text-transform:uppercase;',
      '  padding:10px 12px;background:rgba(0,0,0,.04);border-bottom:1px solid rgba(0,0,0,.10);white-space:nowrap;}',
      '.styla-chart td{padding:9px 12px;border-bottom:1px solid rgba(0,0,0,.06);white-space:nowrap;}',
      '.styla-chart tbody tr:last-child td{border-bottom:none;}',
      '.styla-chart tbody tr:nth-child(even){background:rgba(0,0,0,.02);}',
      '.styla-chart td:first-child{font-weight:600;}',
      '.styla-chart .sc-notes{margin-top:10px;font-size:.82rem;opacity:.75;line-height:1.5;}',
      '.styla-chart .sc-lens{margin-top:10px;font-size:.82rem;opacity:.8;}',
      '.styla-chart .sc-foot{margin-top:8px;font-size:.7rem;opacity:.5;}',
      '.styla-chart.dark .sc-wrap{border-color:rgba(255,255,255,.16);}',
      '.styla-chart.dark th{background:rgba(255,255,255,.06);border-bottom-color:rgba(255,255,255,.14);}',
      '.styla-chart.dark td{border-bottom-color:rgba(255,255,255,.08);}',
      '.styla-chart.dark tbody tr:nth-child(even){background:rgba(255,255,255,.03);}',
    ].join('');
    document.head.appendChild(s);
  }

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  };

  // Values are stored in inches; convert only for display.
  function show(v, cm) {
    if (v == null || v === '') return '—';
    var one = function (n) {
      var x = parseFloat(n);
      if (isNaN(x)) return String(n);
      return cm ? String(Math.round(x * 2.54 * 10) / 10) : String(x);
    };
    return Array.isArray(v) ? (one(v[0]) + '–' + one(v[1])) : one(v);
  }
  function ftIn(inches) {
    var n = Number(inches); if (!n) return '';
    return Math.floor(n / 12) + "'" + Math.round(n % 12) + '"';
  }

  function render(host, data, opts) {
    var cm = opts.units === 'cm';
    var cols = data.columns || [];
    var head = '<tr><th>Size</th>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr>';
    var body = (data.sizes || []).map(function (s) {
      return '<tr><td>' + esc(s.name) + '</td>' +
        cols.map(function (c) {
          var v = s[c];
          if (v == null) { // tolerate case differences in column keys
            var k = Object.keys(s).filter(function (x) { return x.toLowerCase() === String(c).toLowerCase(); })[0];
            if (k) v = s[k];
          }
          return '<td>' + esc(show(v, cm)) + '</td>';
        }).join('') + '</tr>';
    }).join('');

    var lens = '';
    if (data.length_options && data.length_options.length) {
      lens = '<div class="sc-lens"><b>Lengths:</b> ' + data.length_options.map(function (o) {
        var band = (o.height_min || o.height_max)
          ? (' (' + (o.height_min ? ftIn(o.height_min) + '+' : '') + (o.height_min && o.height_max ? ' to ' : '') + (o.height_max ? 'up to ' + ftIn(o.height_max) : '') + ')')
          : '';
        return esc(o.name) + band;
      }).join(' · ') + '</div>';
    }

    host.className = 'styla-chart' + (opts.theme === 'dark' ? ' dark' : '');
    host.innerHTML =
      (opts.title !== false && data.name ? '<div class="sc-head"><span class="sc-name">' + esc(data.name) + '</span><span class="sc-unit">measurements in ' + (cm ? 'cm' : 'inches') + '</span></div>' : '') +
      '<div class="sc-wrap"><table><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
      lens +
      (data.notes ? '<div class="sc-notes">' + esc(data.notes) + '</div>' : '') +
      '<div class="sc-foot">Size guide by Styla</div>';
  }

  function mount(host) {
    if (host.getAttribute('data-styla-mounted')) return;
    host.setAttribute('data-styla-mounted', '1');
    var id = host.getAttribute('data-styla-chart');
    if (!id) return;
    injectCss();
    host.textContent = 'Loading size chart…';
    fetch(API + '/api/size-chart?id=' + encodeURIComponent(id))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || d.error) { host.textContent = ''; return; }
        render(host, d, {
          units: (host.getAttribute('data-units') || 'in').toLowerCase(),
          theme: (host.getAttribute('data-theme') || 'light').toLowerCase(),
          title: host.getAttribute('data-title') !== 'false',
        });
      })
      .catch(function () { host.textContent = ''; });
  }

  function init() { [].forEach.call(document.querySelectorAll('[data-styla-chart]'), mount); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
