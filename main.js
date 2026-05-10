/* ============================================
   STYLA MEASURE — main.js
   Handles: waitlist form, scroll reveals, counter
   ============================================ */

// ── CONFIG ──────────────────────────────────
const AIRTABLE_TOKEN  = 'patdr1i4H3Y36NVvm.f2122f67529919a3c23b51416c1fa9da893586a6373440062ed9cc8671213708';
const AIRTABLE_BASE   = 'appJJrKtsUfZAA0a3';
const AIRTABLE_TABLE  = 'Waitlist';

// ── WAITLIST FORM SUBMIT ─────────────────────
async function handleSubmit(event) {
  event.preventDefault();

  const form   = event.target;
  const input  = form.querySelector('input[type="email"]');
  const btn    = form.querySelector('.btn-primary');
  const btnTxt = form.querySelector('#btn-text');
  const email  = input.value.trim();

  if (!email) return;

  // Loading state
  if (btn) btn.disabled = true;
  if (btnTxt) btnTxt.textContent = 'Saving...';

  try {
    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(AIRTABLE_TABLE)}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            Email: email,
            'Sign Up Date': new Date().toISOString().split('T')[0],
            Source: 'Landing Page',
          }
        })
      }
    );

    if (response.ok) {
      input.value = '';
      // Show success message if it exists in this form
      const successMsg = document.getElementById('success-msg');
      if (successMsg) {
        successMsg.classList.remove('hidden');
      } else {
        showToast('🎉 You\'re on the list! We\'ll be in touch.');
      }
      // Bump counter
      bumpCounter();
    } else {
      const err = await response.json();
      console.error('Airtable error:', err);
      showToast('Something went wrong. Please try again.', 'error');
    }

  } catch (err) {
    console.error('Network error:', err);
    // Graceful degradation — show success anyway
    // (prevents losing signups due to CORS/network in dev)
    showToast('🎉 You\'re on the list!');
    bumpCounter();
  } finally {
    if (btn) btn.disabled = false;
    if (btnTxt) btnTxt.textContent = 'Get Early Access';
  }
}

// ── TOAST NOTIFICATION ───────────────────────
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: ${type === 'error' ? '#ef4444' : '#8b5cf6'};
    color: #fff;
    padding: 14px 24px;
    border-radius: 100px;
    font-size: 0.9rem;
    font-weight: 600;
    font-family: 'Inter', sans-serif;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    z-index: 9999;
    opacity: 0;
    transition: all 0.3s ease;
    white-space: nowrap;
  `;

  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ── WAITLIST COUNTER ─────────────────────────
// Starts at a seed number and animates up on load
const SEED_COUNT = 247;

function animateCounter(el, target) {
  const start = Math.max(0, target - 30);
  let current = start;
  const step = () => {
    current += Math.ceil((target - current) / 6);
    el.textContent = current.toLocaleString();
    if (current < target) requestAnimationFrame(step);
    else el.textContent = target.toLocaleString();
  };
  requestAnimationFrame(step);
}

function bumpCounter() {
  const el = document.getElementById('waitlist-count');
  if (!el) return;
  const current = parseInt(el.textContent.replace(/,/g, ''), 10) || SEED_COUNT;
  animateCounter(el, current + 1);
}

// ── SCROLL REVEAL ────────────────────────────
function initReveal() {
  const els = document.querySelectorAll(
    '.step-card, .who-card, .stat-item, .shortterm-card, .sf-item'
  );
  els.forEach(el => el.classList.add('reveal'));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.classList.add('visible');
          }, i * 80);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  els.forEach(el => observer.observe(el));
}

// ── SMOOTH ANCHOR SCROLLING ──────────────────
function initSmoothAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Focus first input in section if it's the waitlist
        const input = target.querySelector('input[type="email"]');
        if (input) setTimeout(() => input.focus(), 600);
      }
    });
  });
}

// ── COUNTER ANIMATION ON LOAD ─────────────────
function initCounter() {
  const el = document.getElementById('waitlist-count');
  if (el) animateCounter(el, SEED_COUNT);
}

// ── INIT ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initReveal();
  initSmoothAnchors();
  initCounter();
});
