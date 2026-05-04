// Black Clover Logistics — public site interactions

// Year in footer
document.getElementById('year').textContent = new Date().getFullYear();

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
  const payload = {
    name: (data.get('name') || '').toString().trim(),
    company: (data.get('company') || '').toString().trim(),
    email: (data.get('email') || '').toString().trim(),
    phone: (data.get('phone') || '').toString().trim(),
    origin: (data.get('origin') || '').toString().trim(),
    destination: (data.get('destination') || '').toString().trim(),
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
