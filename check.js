// Shows a seller's probe summary carried in the link after "#".
//
// The summary is not signed and anyone can edit a link, so the page says so
// and points the buyer to the real check: running probe on the computer.
// Everything from the link is inserted as text, never as HTML.

(function () {
  const root = document.querySelector('[data-check]');
  const titleEl = document.querySelector('[data-check-title]');
  const subEl = document.querySelector('[data-check-sub]');
  if (!root) return;

  /** base64url -> object, or null. */
  function decode(code) {
    try {
      const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return null;
    }
  }

  const pct = (v) => (Number.isInteger(v) && v >= 0 && v <= 100 ? v : null);
  const text = (v, max = 120) => (typeof v === 'string' ? v.slice(0, max) : '');

  function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else e.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      e.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return e;
  }

  function ring(score, tone) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.setAttribute('aria-hidden', 'true');
    const circle = (cls, dash) => {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', '60');
      c.setAttribute('cy', '60');
      c.setAttribute('r', '52');
      c.setAttribute('class', cls);
      if (dash) {
        c.setAttribute('stroke-dasharray', dash);
        c.setAttribute('transform', 'rotate(-90 60 60)');
      }
      return c;
    };
    svg.append(circle('track'), circle(`arc ${tone}`, `${(326.7 * (score ?? 0)) / 100} 326.7`));
    return el('div', { class: 'ring' }, svg, el('div', {}, el('b', {}, score ?? '–'), el('span', {}, 'out of 100')));
  }

  function bar(label, value, tone, note) {
    return el(
      'div',
      { class: 'area' },
      el('div', { class: 'area-head' }, el('span', {}, label), el('b', {}, value ?? '–')),
      el('div', { class: 'bar' }, value == null ? null : el('i', { class: tone, style: `width:${value}%` })),
      note ? el('p', { class: 'small muted' }, note) : null,
    );
  }

  const VERDICT = {
    green: ['green', 'No faults detected'],
    amber: ['amber', 'Needs attention'],
    red: ['red', 'Problems found'],
    not_graded: ['grey', 'Not graded'],
  };
  const W11 = {
    ready: 'Can run Windows 11',
    fixable: 'Can run Windows 11 after a firmware setting change',
    not_supported: 'Does not meet Windows 11 requirements',
    unknown: 'Windows 11 support not known',
    not_applicable: '',
  };
  const toneFor = (v) => (v == null ? 'grey' : v >= 80 ? 'green' : v >= 55 ? 'amber' : 'red');

  function render(s) {
    const [tone, verdict] = VERDICT[s.h] ?? VERDICT.not_graded;
    const name = text(s.m) || 'Unidentified computer';
    const date = Number.isInteger(s.t) && s.t > 0 ? new Date(s.t * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : 'an unknown date';
    titleEl.textContent = name;
    subEl.textContent = `Scanned with probe on ${date}${s.s ? ` · serial ${text(s.s, 40)}` : ''}`;
    document.title = `${name} · seller's report`;

    const areas = Array.isArray(s.a) ? s.a.map(pct) : [null, null, null];
    const specs = [text(s.p), Number.isInteger(s.r) ? `${s.r} GB memory` : '', Number.isInteger(s.g) ? `${s.g} GB storage` : ''].filter(Boolean);
    const tests = Array.isArray(s.x) ? s.x : [0, 0];
    const problems = Array.isArray(s.xp) ? s.xp.slice(0, 6).map((p) => text(p, 160)) : [];

    const summary = el(
      'section',
      { class: 'card check-score' },
      ring(pct(s.c), tone),
      el(
        'div',
        { class: 'check-text' },
        el('span', { class: `pill ${tone}` }, verdict),
        el('div', { class: 'areas' }, bar('Drives', areas[0], toneFor(areas[0]), pct(s.d) != null ? `About ${s.d}% of drive life left` : null), bar('Battery', areas[1], toneFor(areas[1]), pct(s.b) != null ? `Holds ${s.b}% of its original capacity` : null), bar('Ownership', areas[2], toneFor(areas[2]), s.l ? 'A lock or management setting was found' : 'No locks or management found')),
      ),
    );

    const facts = el(
      'section',
      { class: 'card check-facts' },
      el('h2', {}, 'About it'),
      el('ul', {}, specs.map((x) => el('li', {}, x)), W11[s.w] ? el('li', {}, W11[s.w]) : null, el('li', {}, tests[1] ? `${tests[0]} of ${tests[1]} hands-on tests passed` : 'No hands-on tests were run')),
      problems.length ? el('div', { class: 'check-problems' }, el('h3', {}, 'Problems the tests found'), el('ul', {}, problems.map((p) => el('li', {}, p)))) : null,
    );

    const copy = el('button', { class: 'pill pill-dark', type: 'button' }, 'Copy this link');
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        copy.textContent = 'Copied';
      } catch {
        copy.textContent = 'Copy it from the address bar';
      }
    });

    const verify = el(
      'section',
      { class: 'card check-verify' },
      el('h2', {}, 'Check it yourself before you pay'),
      el('p', { class: 'body' }, 'This summary comes from the seller’s copy of probe. It is not signed, so it could have been edited. probe can confirm it in about a minute:'),
      el(
        'ol',
        {},
        el('li', {}, 'Download probe and run it on the computer you are buying.'),
        el('li', {}, 'In the report, find “Selling or buying?” and paste this page’s link.'),
        el('li', {}, 'probe tells you whether it is the same computer and whether anything has got worse.'),
      ),
      el('div', { class: 'check-actions' }, el('a', { class: 'pill pill-red', href: 'index.html#download' }, 'Download probe free'), copy),
    );

    root.replaceChildren(summary, facts, verify);
  }

  function invalid() {
    titleEl.textContent = 'This link does not hold a probe report';
    subEl.textContent = 'It may have been cut short when it was copied. Ask the seller for the link again, or scan the QR code on their report.';
    root.replaceChildren(el('p', { class: 'body' }, el('a', { href: 'index.html' }, 'What is probe?')));
  }

  const code = location.hash.slice(1);
  const s = code ? decode(code) : null;
  if (!s || typeof s !== 'object' || s.v !== 1) invalid();
  else render(s);
  window.addEventListener('hashchange', () => location.reload());
})();
