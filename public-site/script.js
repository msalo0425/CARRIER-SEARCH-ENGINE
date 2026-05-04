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

// Quote form — client-side validation + mailto fallback
// Replace the action below with your real endpoint (Formspree, Netlify, your API, etc.)
const form = document.getElementById('quoteForm');
const status = document.getElementById('formStatus');

form?.addEventListener('submit', (e) => {
  e.preventDefault();
  status.classList.remove('error');
  status.textContent = '';

  const data = new FormData(form);
  const name = (data.get('name') || '').toString().trim();
  const email = (data.get('email') || '').toString().trim();
  const message = (data.get('message') || '').toString().trim();

  if (!name || !email || !message) {
    status.classList.add('error');
    status.textContent = 'Please fill in name, email, and shipment details.';
    return;
  }

  const subject = `Quote request from ${name}`;
  const body = [
    `Name: ${name}`,
    `Company: ${data.get('company') || ''}`,
    `Email: ${email}`,
    `Phone: ${data.get('phone') || ''}`,
    `Origin: ${data.get('origin') || ''}`,
    `Destination: ${data.get('destination') || ''}`,
    `Service: ${data.get('service') || ''}`,
    '',
    'Details:',
    message,
  ].join('\n');

  // Mailto fallback. Swap this for fetch() to your backend when ready.
  window.location.href =
    `mailto:dispatch@blackcloverlogistics.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  status.textContent = 'Opening your email client to send the request…';
  form.reset();
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
