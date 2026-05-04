// Black Clover Logistics — public site interactions

// Year in footer (only if the placeholder span exists — currently hard-coded in HTML)
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Mobile menu toggle
const header = document.querySelector('.site-header');
const toggle = document.querySelector('.menu-toggle');
toggle?.addEventListener('click', () => {
  const open = header.classList.toggle('menu-open');
  toggle.setAttribute('aria-expanded', String(open));
});

// Close mobile menu when a link is tapped
document.querySelectorAll('.primary-nav a').forEach((link) => {
  link.addEventListener('click', () => header.classList.remove('menu-open'));
});

// Quote form — sends submissions to the Google Apps Script web app
// which writes a new row to the connected Google Sheet.
const QUOTE_FORM_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbzDdKRz_TUJLOLCxKlHDt4f_48x441ay6yFEEmRX6XM-Vqq7g_y8B-wX4MtLS3Y1TMv6A/exec';

const form = document.getElementById('quoteForm');
const status = document.getElementById('formStatus');

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  status.classList.remove('error');
  status.textContent = '';

  const data = new FormData(form);
  const join = (city, state) => {
    city = (city || '').toString().trim();
    state = (state || '').toString().trim();
    return city && state ? `${city}, ${state}` : (city || state || '');
  };
  const payload = {
    name: (data.get('name') || '').toString().trim(),
    company: (data.get('company') || '').toString().trim(),
    email: (data.get('email') || '').toString().trim(),
    phone: (data.get('phone') || '').toString().trim(),
    origin: join(data.get('origin_city'), data.get('origin_state')),
    destination: join(data.get('destination_city'), data.get('destination_state')),
    service: (data.get('service') || '').toString().trim(),
    message: (data.get('message') || '').toString().trim(),
  };

  if (!payload.name || !payload.email || !payload.message) {
    status.classList.add('error');
    status.textContent = 'Please fill in name, email, and shipment details.';
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  status.textContent = 'Sending your request…';

  try {
    // text/plain avoids the CORS preflight that Google Apps Script
    // doesn't respond to. The script reads e.postData.contents either way.
    await fetch(QUOTE_FORM_ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    status.textContent = "Thanks — we got your request and will be in touch shortly.";
    form.reset();
  } catch (err) {
    status.classList.add('error');
    status.textContent =
      "Something went wrong. Please try again, or call us at (708) 945-0228.";
  } finally {
    submitBtn.disabled = false;
  }
});

// City autocomplete — suggests "City, ST" as the user types.
// Uses the free Photon (Komoot) geocoding API, no key required.
const US_STATES = {
  'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA',
  'Colorado':'CO','Connecticut':'CT','Delaware':'DE','District of Columbia':'DC',
  'Florida':'FL','Georgia':'GA','Hawaii':'HI','Idaho':'ID','Illinois':'IL',
  'Indiana':'IN','Iowa':'IA','Kansas':'KS','Kentucky':'KY','Louisiana':'LA',
  'Maine':'ME','Maryland':'MD','Massachusetts':'MA','Michigan':'MI','Minnesota':'MN',
  'Mississippi':'MS','Missouri':'MO','Montana':'MT','Nebraska':'NE','Nevada':'NV',
  'New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY',
  'North Carolina':'NC','North Dakota':'ND','Ohio':'OH','Oklahoma':'OK','Oregon':'OR',
  'Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD',
  'Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT','Virginia':'VA',
  'Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY'
};

function setupCityAutocomplete(input) {
  const wrap = input.closest('.autocomplete');
  if (!wrap) return;
  const list = wrap.querySelector('.autocomplete-list');
  let timer;
  let activeIndex = -1;
  let currentHits = [];

  const hide = () => {
    list.hidden = true;
    list.innerHTML = '';
    activeIndex = -1;
    currentHits = [];
  };

  const setActive = (i) => {
    const items = list.querySelectorAll('li');
    activeIndex = i;
    items.forEach((li, idx) => li.classList.toggle('active', idx === i));
  };

  // Splits "Atlanta, GA" — fills the city input with just the city,
  // and fills the linked state field (data-state-field="origin_state") with the state.
  const applyChoice = (label) => {
    const [city, state] = label.split(',').map(s => s.trim());
    input.value = city || label;
    const stateFieldName = input.dataset.stateField;
    if (stateFieldName) {
      const stateInput = document.getElementById(stateFieldName)
        || document.querySelector(`[name="${stateFieldName}"]`);
      if (stateInput) stateInput.value = state || '';
    }
    hide();
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { hide(); return; }
    timer = setTimeout(async () => {
      try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=10&layer=city&layer=town&layer=village`;
        const res = await fetch(url);
        const json = await res.json();
        const seen = new Set();
        const hits = [];
        for (const f of json.features || []) {
          const p = f.properties || {};
          if (p.countrycode !== 'US') continue;
          const state = US_STATES[p.state] || '';
          if (!state) continue;
          const label = `${p.name}, ${state}`;
          if (seen.has(label)) continue;
          seen.add(label);
          hits.push(label);
          if (hits.length >= 6) break;
        }
        if (hits.length === 0) { hide(); return; }
        currentHits = hits;
        list.innerHTML = hits.map((h, i) =>
          `<li role="option" data-i="${i}">${h}</li>`
        ).join('');
        list.hidden = false;
        activeIndex = -1;
        list.querySelectorAll('li').forEach((li, i) => {
          li.addEventListener('mousedown', (e) => {
            e.preventDefault();
            applyChoice(currentHits[i]);
          });
        });
      } catch (err) { hide(); }
    }, 220);
  });

  input.addEventListener('keydown', (e) => {
    if (list.hidden) return;
    const items = list.querySelectorAll('li');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((activeIndex + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((activeIndex - 1 + items.length) % items.length);
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      applyChoice(currentHits[activeIndex]);
    } else if (e.key === 'Escape') {
      hide();
    }
  });

  input.addEventListener('blur', () => {
    setTimeout(hide, 180);
  });
}

document.querySelectorAll('[data-city-autocomplete]').forEach(setupCityAutocomplete);

// Hero video — playlist that cycles through every clip you drop into /assets.
// Just add files named hero-1.mp4, hero-2.mp4, hero-3.mp4 ... and they'll auto-play in order.
const heroVideo = document.querySelector('.hero-video');

if (heroVideo) {
  const raw = (heroVideo.dataset.playlist || '').split(',').map((s) => s.trim()).filter(Boolean);

  // Probe each candidate file with HEAD; only keep the ones that actually exist.
  Promise.all(
    raw.map((src) =>
      fetch(src, { method: 'HEAD' })
        .then((r) => (r.ok ? src : null))
        .catch(() => null)
    )
  ).then((results) => {
    const playlist = results.filter(Boolean);
    if (playlist.length === 0) {
      // No videos in /assets — hide the <video> element entirely so no
      // play-button overlay or media chrome can render. The hero-overlay
      // div behind it still shows the green gradient.
      heroVideo.style.display = 'none';
      heroVideo.removeAttribute('src');
      return;
    }

    let idx = 0;
    const playNext = () => {
      idx = (idx + 1) % playlist.length;
      heroVideo.src = playlist[idx];
      heroVideo.play().catch(() => {});
    };

    heroVideo.removeAttribute('loop'); // we handle looping manually so 'ended' fires
    heroVideo.src = playlist[0];
    heroVideo.play().catch(() => {});
    heroVideo.addEventListener('ended', playNext);

    // If a clip 404s mid-playlist, skip past it.
    heroVideo.addEventListener('error', () => {
      if (playlist.length > 1) playNext();
    });
  });

  // Pause on tab blur to save battery
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) heroVideo.pause();
    else heroVideo.play().catch(() => {});
  });
}
