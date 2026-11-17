(function () {
  'use strict';
  var SITES = window.DATA.sites;

  // ---------- presenter settings ----------
  var LINES_IN_COLUMN = 60;     // lines per site on the screen that shows all three
  var W = 1440, SCREEN = 900;   // every page picture is this wide; one screenful of it is this high
  // How many pixels of picture each piece keeps when the page is shown "as the agent sees it".
  // The number of pieces is measured (see collect/build-guess.mjs). This number is not: what a model
  // keeps of a piece is not a small picture. It is an illustration; raise it and the page gets sharper.
  var PIXELS_PER_PIECE = 32;
  // How many pieces of the array go on one row of the screen. Keep it different from the number of
  // pieces across each page (9, 23 and 16), or that page will simply appear whole.
  var PIECES_PER_ROW = 12;
  // On a phone held upright everything is narrower: fewer pieces to a row, and the lit screenful of
  // the page is shown closer.
  var NARROW = window.matchMedia('(max-width: 700px)');
  var PIECES_PER_ROW_NARROW = 6, CLOSER_NARROW = 2.5;

  var $ = function (id) { return document.getElementById(id); };
  function line(text) { var d = document.createElement('div'); d.textContent = text; return d; }

  // The order of the piece: the premise, one round per site, all three together, the bill, the end.
  // Each stop has steps; Space moves one step, then on to the next stop.
  var STOPS = [{ el: 'screen-1', steps: 1 }];
  SITES.forEach(function (s, i) { STOPS.push({ el: 'screen-round', steps: 4, site: i }); });
  STOPS.push({ el: 'screen-all', steps: 2 }, { el: 'screen-sum', steps: SITES.length + 1 }, { el: 'screen-end', steps: 1 });

  var at = 0, step = 0;
  var screens = Array.prototype.slice.call(document.querySelectorAll('.screen'));

  // ---------- a round: a task and the whole text; then the whole real page; then both together ----------
  var feed = $('round-text'), pageEl = $('round-page'), seenEl = $('round-seen');
  var shownSite = -1;
  // The clock: how long the room has been inside each site's text. It runs only while the text is up.
  var spent = SITES.map(function () { return 0; }), clock = null;
  function mmss(ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  function showClock(i) { $('round-count').textContent = (misses[i] ? misses[i] + ' ✕  ·  ' : '') + mmss(spent[i]) + '  ·  ' + (i + 1) + ' / ' + SITES.length; }
  function stopClock() { clearInterval(clock); clock = null; }
  function startClock(i) {
    var last = Date.now();
    clock = setInterval(function () { var now = Date.now(); spent[i] += now - last; last = now; showClock(i); }, 250);
  }
  // The page as an agent that looks gets it: cut into pieces, each piece shrunk to PIXELS_PER_PIECE
  // pixels a side, and the pieces put one after another, numbered, in one array. The array is shown
  // PIECES_PER_ROW to a row, which is not how many the page had across, so the page does not come
  // back together on the screen: where a piece was on the page is something the agent has to be told.
  // The room has to find the answer in the array too: it calls out a piece, the presenter clicks it.
  // A piece that holds none of the answer goes dim and is counted. A piece that holds some of it
  // lights every piece the answer is spread over.
  var pictures = SITES.map(function (s) { var im = new Image(); im.src = s.image; return im; });
  var misses = SITES.map(function () { return 0; });
  function holdsAnswer(i, n) {
    var g = SITES[i].grid, t = SITES[i].task.spot, side = W / g.cols, edge = 8;   // a sliver under 8 pixels does not count
    var x = (n % g.cols) * side, y = Math.floor(n / g.cols) * side;
    return x + side > t[0] + edge && x < t[0] + t[2] - edge && y + side > t[1] + edge && y < t[1] + t[3] - edge;
  }
  function pick(i, n, tile) {
    if (tile.classList.contains('miss') || tile.classList.contains('hit')) return;
    if (!holdsAnswer(i, n)) { tile.classList.add('miss'); misses[i]++; return showClock(i); }
    Array.prototype.forEach.call($('seen-array').children, function (t, k) { if (holdsAnswer(i, k)) t.classList.add('hit'); });
    $('seen-array').classList.add('found');
  }
  function drawSeen(i) {
    var g = SITES[i].grid, im = pictures[i], box = $('seen-array'), P = PIXELS_PER_PIECE;
    box.textContent = ''; box.classList.remove('found');
    box.style.gridTemplateColumns = 'repeat(' + (NARROW.matches ? PIECES_PER_ROW_NARROW : PIECES_PER_ROW) + ', 1fr)';
    $('round-array').textContent = '';
    var paint = function () {
      if (shownSite !== i || box.firstChild) return;
      var side = W / g.cols, first = null;
      for (var n = 0; n < g.cols * g.rows; n++) {
        var tile = document.createElement('div'); tile.className = 'tile';
        var c = document.createElement('canvas'); c.width = c.height = P;
        var ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(im, (n % g.cols) * side, Math.floor(n / g.cols) * side, side, side, 0, 0, P, P);
        var label = document.createElement('span'); label.textContent = n;
        tile.appendChild(c); tile.appendChild(label); box.appendChild(tile);
        tile.onclick = pick.bind(null, i, n, tile);
        if (!first) first = ctx;
      }
      // What one piece is, to the agent: numbers. The first twelve of piece 0, read from the picture.
      try {
        var d = first.getImageData(0, 0, 4, 1).data, nums = [];
        for (var k = 0; k < 16; k++) if (k % 4 !== 3) nums.push(d[k]);
        $('round-array').textContent = '[0] = [' + nums.join(', ') + ', … ' + (P * P * 3).toLocaleString('en-US') + ']';
      } catch (e) {}   // opened from separate files, the browser will not let the picture be read back
    };
    if (im.complete && im.naturalWidth) paint(); else im.onload = paint;
  }
  function pct(n) { return n + '%'; }
  function renderRound(stop) {
    var site = SITES[stop.site], task = site.task;
    if (shownSite !== stop.site) {
      shownSite = stop.site; spent[stop.site] = 0; misses[stop.site] = 0;
      $('round-ask').textContent = task.ask;
      // the whole text at once, from its first line
      feed.textContent = '';
      site.lines.forEach(function (l) { feed.appendChild(line(l)); });
      feed.scrollTop = 0;
      seenEl.scrollTop = 0;
      drawSeen(stop.site);
      $('look-seen').textContent = task.seenNote;
      $('page-img').src = site.image;
      // The last step, made ready: one screenful of the page with only the answer lit, beside the
      // lines the agent had. The screenful is the one with the answer at its middle; on a narrow
      // screen it is a smaller part of the page, shown closer.
      var x = task.spot[0], y = task.spot[1], w = task.spot[2], h = task.spot[3];
      var closer = NARROW.matches ? CLOSER_NARROW : 1, vw = W / closer, vh = SCREEN / closer;
      var left = Math.max(0, Math.min(W - vw, Math.round(x + w / 2 - vw / 2)));
      var top = Math.max(0, Math.min(site.height - vh, Math.round(y + h / 2 - vh / 2)));
      $('look-img').src = site.image;
      $('look-img').style.width = pct(100 * closer);
      $('look-img').style.left = pct(-100 * left / vw);
      $('look-img').style.top = pct(-100 * top / vh);
      var spot = $('look-spot').style;
      spot.left = pct(100 * (x - left) / vw); spot.width = pct(100 * w / vw);
      spot.top = pct(100 * (y - top) / vh); spot.height = pct(100 * h / vh);
      $('look-text').textContent = '';
      task.lines.forEach(function (l) { $('look-text').appendChild(line(l)); });
      $('look-caption').textContent = task.caption;
    }
    // the text and the picture-in-pieces share one place under the task
    feed.hidden = step === 1; seenEl.hidden = step !== 1;
    $('round-array').hidden = step !== 1;
    var pieces = (site.grid.cols * site.grid.rows).toLocaleString('en-US');
    $('round-mode').textContent = step === 1
      ? 'סוכן שרואה: העמוד כולו כתמונה אחת, חתוכה ל-' + pieces + ' חלקים, אחד אחרי השני. באיזה חלק התשובה?'
      : 'סוכן שקורא: כל הטקסט של העמוד, ' + site.lines.length + ' שורות';
    if (step === 2 && !pageEl.classList.contains('on')) { pageEl.scrollTop = 0; pageEl.scrollLeft = 0; }
    pageEl.classList.toggle('on', step === 2);
    showClock(stop.site);
    if (step <= 1) startClock(stop.site);
    var wrong = misses[stop.site];
    $('look-time').textContent = spent[stop.site] >= 1000 ? 'הייתם הסוכן ' + mmss(spent[stop.site]) + (wrong ? ', ו' + (wrong === 1 ? 'הצבעתם פעם אחת על חלק לא נכון' : 'הצבעתם ' + wrong + ' פעמים על חלק לא נכון') : '') + '. בעמוד זה לקח מבט.' : '';
    $('round-look').classList.toggle('on', step === 3);
  }
  // What the up and down keys scroll: whichever of the text, the pieces and the page is up.
  function scroller() {
    if (STOPS[at].el !== 'screen-round') return null;
    return [feed, seenEl, pageEl][step] || null;
  }

  // ---------- all three: the texts side by side, then each one's page over it ----------
  var cols = $('all-cols');
  SITES.forEach(function (s) {
    var col = document.createElement('div'); col.className = 'col';
    var text = document.createElement('div'); text.className = 'agent';
    s.lines.slice(0, LINES_IN_COLUMN).forEach(function (l) { text.appendChild(line(l)); });
    var img = document.createElement('img'); img.src = s.image; img.alt = '';   // CSS shows its first screenful
    col.appendChild(text); col.appendChild(img);
    cols.appendChild(col);
  });
  // When the pictures arrive, each column's text moves down to sit under its picture.
  function renderAll() {
    var seen = step === 1;
    cols.classList.toggle('seen', seen);
    Array.prototype.forEach.call(cols.children, function (col) {
      var img = col.querySelector('img');
      col.querySelector('.agent').style.paddingTop = seen ? (img.offsetWidth * SCREEN / W + 16) + 'px' : '0';
    });
  }

  // ---------- the bill: a cut-out of each page where the design spoke, and what the agent got ----------
  var sumRows = SITES.map(function (s) {
    var x = s.task.spot[0], y = s.task.spot[1], w = s.task.spot[2], h = s.task.spot[3];
    var row = document.createElement('div'); row.className = 'sum-row';
    var crop = document.createElement('div'); crop.className = 'crop';
    crop.style.aspectRatio = w + ' / ' + h;
    var img = document.createElement('img'); img.src = s.image; img.alt = '';
    img.style.width = (100 * W / w) + '%';
    img.style.left = (-100 * x / w) + '%';
    img.style.top = (-100 * y / h) + '%';
    crop.appendChild(img);
    var arrow = document.createElement('div'); arrow.className = 'small'; arrow.textContent = '←';
    var got = document.createElement('div');
    if (s.task.got.length) { got.className = 'agent'; s.task.got.forEach(function (l) { got.appendChild(line(l)); }); }
    else { got.className = 'small'; got.textContent = 'לא הגיע'; }
    row.appendChild(crop); row.appendChild(arrow); row.appendChild(got);
    $('sum-rows').appendChild(row);
    return row;
  });
  function renderSum() {
    sumRows.forEach(function (row, i) { row.classList.toggle('on', i <= step); });
    $('sum-foot').classList.toggle('on', step === SITES.length);
    var total = spent.reduce(function (a, b) { return a + b; }, 0);
    $('sum-time').textContent = total >= 1000 ? 'הייתם סוכן במשך ' + mmss(total) + '.' : '';
  }

  // ---------- presenter hint ----------
  var hintEl = $('hint');
  var hintsOn = true;
  try { hintsOn = localStorage.getItem('hints') !== 'off'; } catch (e) {}
  function updateHint() {
    var stop = STOPS[at], t = 'רווח: להמשיך';
    if (stop.el === 'screen-round') t = ['גלילה או ↓↑: לעבור על הטקסט · רווח: אותו עמוד כתמונה', 'גלילה או ↓↑ · קליק על חלק: לבדוק אותו · רווח: לגלות את האתר', 'גלילה או ↓↑: לעבור על העמוד · רווח: מה העיצוב עשה כאן', 'רווח: להמשיך'][step];
    if (stop.el === 'screen-all') t = step === 0 ? 'רווח: להראות את שלושת האתרים' : 'רווח: להמשיך';
    if (stop.el === 'screen-sum') t = step < SITES.length - 1 ? 'רווח: האתר הבא' : step === SITES.length - 1 ? 'רווח: המשפט' : 'רווח: להמשיך';
    if (stop.el === 'screen-end') t = 'סוף · 1: להתחלה';
    hintEl.textContent = t + ' · Backspace: צעד אחורה · H: להסתיר';
    hintEl.hidden = !hintsOn;
    // the touch buttons
    var last = at === STOPS.length - 1 && step === stop.steps - 1;
    $('nav-at').textContent = (at + 1) + ' / ' + STOPS.length;
    $('nav-next').textContent = last ? 'להתחלה' : 'המשך';
    $('nav-back').disabled = at === 0 && step === 0;
  }
  $('nav-next').onclick = function () { if (at === STOPS.length - 1 && step === STOPS[at].steps - 1) go(0); else advance(1); };
  $('nav-back').onclick = function () { advance(-1); };

  // ---------- navigation ----------
  function render() {
    var stop = STOPS[at], target = $(stop.el);
    stopClock();
    screens.forEach(function (s) { s.hidden = s !== target; });
    if (stop.el === 'screen-round') renderRound(stop);
    else shownSite = -1;
    if (stop.el === 'screen-all') renderAll();
    if (stop.el === 'screen-sum') renderSum();
    if (location.hash !== '#' + (at + 1)) history.replaceState(null, '', '#' + (at + 1));
    updateHint();
  }
  function go(n) { if (n < 0 || n >= STOPS.length) return; at = n; step = 0; render(); }
  function advance(dir) {
    var s = step + dir;
    if (s >= STOPS[at].steps) return go(at + 1);
    if (s < 0) { if (at > 0) { at--; step = STOPS[at].steps - 1; render(); } return; }
    step = s; render();
  }

  window.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[1-9]$/.test(e.key)) return go(parseInt(e.key, 10) - 1);
    if (e.key === 'h' || e.key === 'H' || e.key === 'י') { hintsOn = !hintsOn; try { localStorage.setItem('hints', hintsOn ? 'on' : 'off'); } catch (err) {} return updateHint(); }
    var sc = scroller(), far = { ArrowDown: 0.5, ArrowUp: -0.5, PageDown: 0.9, PageUp: -0.9 }[e.key];
    if (sc && far) { e.preventDefault(); return sc.scrollBy({ top: far * sc.clientHeight, behavior: 'smooth' }); }
    if (sc && (e.key === 'Home' || e.key === 'End')) { e.preventDefault(); return sc.scrollTo({ top: e.key === 'Home' ? 0 : sc.scrollHeight, behavior: 'smooth' }); }
    if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter' || e.key === 'ArrowLeft') { e.preventDefault(); advance(1); }
    else if (e.key === 'Backspace' || e.key === 'ArrowRight') { e.preventDefault(); advance(-1); }
  });
  window.addEventListener('resize', function () { if (STOPS[at].el === 'screen-all') renderAll(); });

  var first = parseInt(location.hash.slice(1), 10);
  go(first >= 1 && first <= STOPS.length ? first - 1 : 0);
})();
