/*
 * Premium TECHGURU Landing Page JavaScript
 *
 * Handles form submissions, rotating taglines, hamburger menu, FAQ accordion,
 * exit intent popup, smooth interactions, and theme toggle.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ============================================
  // API BASE URL - Cloudflare Worker
  // ============================================
  const API_BASE = 'https://techguru-api.lucas-a13.workers.dev';

  // ============================================
  // THEME TOGGLE WITH LOCALSTORAGE
  // ============================================
  const themeToggle = document.getElementById('theme-toggle');
  const body = document.body;

  // Check for saved theme preference or default to dark
  const currentTheme = localStorage.getItem('theme') || 'dark';

  // Apply saved theme on page load
  if (currentTheme === 'light') {
    body.classList.add('light-theme');
    body.classList.remove('dark-theme');
    if (themeToggle) themeToggle.checked = true;
  } else {
    body.classList.add('dark-theme');
    body.classList.remove('light-theme');
    if (themeToggle) themeToggle.checked = false;
  }

  // Theme toggle event listener
  if (themeToggle) {
    themeToggle.addEventListener('change', () => {
      if (themeToggle.checked) {
        // Switch to light theme
        body.classList.add('light-theme');
        body.classList.remove('dark-theme');
        localStorage.setItem('theme', 'light');
      } else {
        // Switch to dark theme
        body.classList.add('dark-theme');
        body.classList.remove('light-theme');
        localStorage.setItem('theme', 'dark');
      }
    });
  }

  // ============================================
  // HERO IMAGE/VIDEO ROTATION
  // ============================================
  const heroSlides = document.querySelectorAll('.hero-slide');
  const heroVideo = document.getElementById('hero-video');

  if (heroSlides.length > 1) {
    let currentSlide = 0;
    const totalSlides = heroSlides.length;
    const imageRotationInterval = 6000; // 6 seconds for images
    let rotationTimer = null;

    const rotateHeroSlides = () => {
      // Get current and next slide indices
      const prevSlide = currentSlide;
      currentSlide = (currentSlide + 1) % totalSlides;

      // Add fade-out class to current slide
      heroSlides[prevSlide].classList.add('fade-out');
      heroSlides[prevSlide].classList.remove('active');

      // Pause video if it was the previous slide
      if (heroSlides[prevSlide].tagName === 'VIDEO') {
        heroSlides[prevSlide].pause();
      }

      // Add active class to next slide
      heroSlides[currentSlide].classList.add('active');
      heroSlides[currentSlide].classList.remove('fade-out');

      // Play video if it's the current slide
      if (heroSlides[currentSlide].tagName === 'VIDEO') {
        heroSlides[currentSlide].currentTime = 0;
        heroSlides[currentSlide].play();
      }

      // Clean up fade-out class after transition completes
      setTimeout(() => {
        heroSlides[prevSlide].classList.remove('fade-out');
      }, 2500);

      // Schedule next rotation based on current slide type
      scheduleNextRotation();
    };

    const scheduleNextRotation = () => {
      // Clear any existing timer
      if (rotationTimer) {
        clearTimeout(rotationTimer);
      }

      // If current slide is video, wait for it to complete one loop
      if (heroSlides[currentSlide].tagName === 'VIDEO') {
        const video = heroSlides[currentSlide];
        // Use video duration or fallback to 6 seconds
        const videoDuration = video.duration ? (video.duration * 1000) : 6000;
        rotationTimer = setTimeout(rotateHeroSlides, videoDuration);
      } else {
        // For images, use standard interval
        rotationTimer = setTimeout(rotateHeroSlides, imageRotationInterval);
      }
    };

    // Handle video loaded to get accurate duration
    if (heroVideo) {
      heroVideo.addEventListener('loadedmetadata', () => {
        // If video is currently active, reschedule with correct duration
        if (heroVideo.classList.contains('active')) {
          scheduleNextRotation();
        }
      });

      // Ensure video plays on load
      heroVideo.play().catch(error => {
        console.log('Initial video autoplay prevented:', error);
      });
    }

    // Start the rotation after initial video plays
    scheduleNextRotation();
  }

  // ============================================
  // ROTATING TAGLINES
  // ============================================
  const taglines = [
    "Streamline. Automate. Elevate.",
    "Premium Automation & AI Systems.",
    "Tech‑driven solutions built fast.",
    "Where Automation Meets Elegance.",
    "Modern Systems. Premium Design.",
    "Faster Than Agencies. More Modern Than MSPs.",
    "Automation‑First. AI‑Enhanced.",
    "Apple‑Grade Clarity. LV‑Level Polish.",
    "Lightweight. Reliable. Scalable.",
    "Transform Complexity Into Beautiful Simplicity."
  ];

  const taglineEl = document.getElementById('rotating-tagline');
  if (taglineEl) {
    let currentIndex = 0;

    const rotateTagline = () => {
      taglineEl.classList.add('fade');

      setTimeout(() => {
        currentIndex = (currentIndex + 1) % taglines.length;
        taglineEl.textContent = taglines[currentIndex];
        taglineEl.classList.remove('fade');
      }, 500);
    };

    setInterval(rotateTagline, 4000);
  }

  // ============================================
  // HAMBURGER MENU
  // ============================================
  const navToggle = document.getElementById('nav-toggle');
  const navMenu = document.getElementById('nav-menu');

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      navToggle.classList.toggle('active');
      navMenu.classList.toggle('active');
    });

    // Close menu when clicking a link
    navMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navToggle.classList.remove('active');
        navMenu.classList.remove('active');
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
        navToggle.classList.remove('active');
        navMenu.classList.remove('active');
      }
    });
  }

  // ============================================
  // FAQ ACCORDION
  // ============================================
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');

    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      // Close all other items
      faqItems.forEach(otherItem => {
        otherItem.classList.remove('active');
        otherItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      });

      // Toggle current item
      if (!isActive) {
        item.classList.add('active');
        question.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // ============================================
  // PRICING DROPDOWN TOGGLES
  // ============================================
  const pricingToggles = document.querySelectorAll('.pricing-toggle');

  pricingToggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      const card = toggle.closest('.service-card-premium');
      const dropdown = card.querySelector('.pricing-dropdown');
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';

      // Toggle state
      toggle.setAttribute('aria-expanded', !isExpanded);
      card.classList.toggle('pricing-open');

      // Animate dropdown
      if (!isExpanded) {
        dropdown.style.maxHeight = dropdown.scrollHeight + 'px';
        dropdown.style.opacity = '1';
      } else {
        dropdown.style.maxHeight = '0';
        dropdown.style.opacity = '0';
      }
    });
  });

  // ============================================
  // EXIT INTENT POPUP - Only on Contact Form Abandonment
  // ============================================
  const exitPopup = document.getElementById('exit-popup');
  const exitPopupClose = document.getElementById('exit-popup-close');
  const exitPopupForm = document.getElementById('exit-popup-form');
  const contactForm = document.getElementById('contact-form');
  const contactSection = document.getElementById('contact');

  let hasShownExitPopup = sessionStorage.getItem('exitPopupShown');
  let hasInteractedWithContactForm = false;
  let hasSubmittedContactForm = false;

  // Track when user interacts with contact form fields
  if (contactForm) {
    const formInputs = contactForm.querySelectorAll('input, textarea, select');

    formInputs.forEach(input => {
      input.addEventListener('focus', () => {
        hasInteractedWithContactForm = true;
      });
      input.addEventListener('input', () => {
        hasInteractedWithContactForm = true;
      });
    });

    // Track successful form submission
    contactForm.addEventListener('submit', () => {
      hasSubmittedContactForm = true;
    });
  }

  // Show popup only when user clicks outside contact form after interacting with it
  if (exitPopup && contactSection) {
    document.addEventListener('click', (e) => {
      // Only trigger if:
      // 1. User has interacted with the contact form
      // 2. User has NOT submitted the form
      // 3. Popup hasn't been shown yet
      // 4. Click is outside the contact section
      // 5. Click is not on the exit popup itself
      if (
        hasInteractedWithContactForm &&
        !hasSubmittedContactForm &&
        !hasShownExitPopup &&
        !contactSection.contains(e.target) &&
        !exitPopup.contains(e.target) &&
        !e.target.closest('.exit-popup-overlay')
      ) {
        showExitPopup();
      }
    });
  }

  function showExitPopup() {
    if (exitPopup && !hasShownExitPopup) {
      exitPopup.classList.add('active');
      hasShownExitPopup = true;
      sessionStorage.setItem('exitPopupShown', 'true');
    }
  }

  if (exitPopupClose) {
    exitPopupClose.addEventListener('click', () => {
      exitPopup.classList.remove('active');
    });
  }

  if (exitPopup) {
    exitPopup.addEventListener('click', (e) => {
      if (e.target === exitPopup) {
        exitPopup.classList.remove('active');
      }
    });
  }

  if (exitPopupForm) {
    exitPopupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = exitPopupForm.querySelector('input[type="email"]');
      const email = emailInput.value.trim();

      if (!email) return;

      try {
        const res = await fetch(API_BASE + '/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, source: 'exit-popup' })
        });

        if (res.ok) {
          exitPopupForm.innerHTML = '<p style="color: var(--color-accent);">✓ You\'re in! Check your inbox.</p>';
          setTimeout(() => exitPopup.classList.remove('active'), 2000);
        } else {
          throw new Error('Subscription failed');
        }
      } catch (err) {
        console.error(err);
        exitPopupForm.innerHTML = '<p style="color: #ff6b6b;">Something went wrong. Try again later.</p>';
      }
    });
  }

  // ============================================
  // NEWSLETTER SUBSCRIPTION
  // ============================================
  const subscribeForm = document.getElementById('subscribe-form');
  if (subscribeForm) {
    subscribeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('subscribe-email');
      const email = emailInput.value.trim();
      const button = subscribeForm.querySelector('button');
      const originalText = button.textContent;

      if (!email) {
        showFormMessage(subscribeForm, 'Please enter a valid email address.', 'error');
        return;
      }

      button.textContent = 'Sending...';
      button.disabled = true;

      try {
        const res = await fetch(API_BASE + '/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        if (!res.ok) throw new Error('Network response was not ok');

        showFormMessage(subscribeForm, '✓ Success! Check your inbox for the starter kit.', 'success');
        subscribeForm.reset();
      } catch (err) {
        console.error(err);
        showFormMessage(subscribeForm, 'Something went wrong. Please try again.', 'error');
      } finally {
        button.textContent = originalText;
        button.disabled = false;
      }
    });
  }

  // ============================================
  // CONTACT FORM
  // ============================================
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(contactForm);
      const payload = Object.fromEntries(formData.entries());
      const button = contactForm.querySelector('button');
      const originalText = button.textContent;

      button.textContent = 'Sending...';
      button.disabled = true;

      try {
        const res = await fetch(API_BASE + '/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Network response was not ok');

        showFormMessage(contactForm, '✓ Message sent! We\'ll respond within 24 hours.', 'success');
        contactForm.reset();
      } catch (err) {
        console.error(err);
        showFormMessage(contactForm, 'Something went wrong. Please try again or contact us directly.', 'error');
      } finally {
        button.textContent = originalText;
        button.disabled = false;
      }
    });
  }

  // ============================================
  // FORM MESSAGE HELPER
  // ============================================
  function showFormMessage(form, message, type) {
    // Remove existing message
    const existingMsg = form.parentElement.querySelector('.form-message');
    if (existingMsg) existingMsg.remove();

    const msgEl = document.createElement('p');
    msgEl.className = 'form-message';
    msgEl.style.cssText = `
      margin-top: 1rem;
      padding: 0.8rem 1rem;
      border-radius: 8px;
      text-align: center;
      ${type === 'success'
        ? 'background: rgba(100, 222, 223, 0.1); color: #64dedf; border: 1px solid rgba(100, 222, 223, 0.3);'
        : 'background: rgba(255, 107, 107, 0.1); color: #ff6b6b; border: 1px solid rgba(255, 107, 107, 0.3);'
      }
    `;
    msgEl.textContent = message;
    form.parentElement.insertBefore(msgEl, form.nextSibling);

    // Auto-remove after 5 seconds
    setTimeout(() => msgEl.remove(), 5000);
  }

  // ============================================
  // NAVBAR HIDE/SHOW ON SCROLL
  // ============================================
  const navbar = document.querySelector('.navbar');
  let lastScrollY = window.scrollY;
  let ticking = false;

  const handleScroll = () => {
    const currentScrollY = window.scrollY;

    if (currentScrollY > lastScrollY && currentScrollY > 80) {
      navbar.classList.add('navbar-hidden');
    } else {
      navbar.classList.remove('navbar-hidden');
    }

    lastScrollY = currentScrollY;
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(handleScroll);
      ticking = true;
    }
  });

  // ============================================
  // SMOOTH SCROLL FOR ANCHOR LINKS
  // ============================================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ============================================
  // CAL.COM BOOKING MODAL
  // ============================================

  // Initialize Cal.com embed when modal opens
  let calInitialized = false;

  window.openBookingModal = function() {
    const modal = document.getElementById('booking-modal');
    if (!modal) return;

    // Show modal
    modal.hidden = false;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Focus trap - focus the close button
    const closeBtn = modal.querySelector('.booking-modal-close');
    if (closeBtn) closeBtn.focus();

    // Initialize Cal.com embed on first open
    if (!calInitialized) {
      initCalEmbed();
      calInitialized = true;
    }

    // Handle escape key
    document.addEventListener('keydown', handleModalEscape);
  };

  window.closeBookingModal = function() {
    const modal = document.getElementById('booking-modal');
    if (!modal) return;

    modal.classList.remove('active');
    // Wait for animation before hiding
    setTimeout(() => {
      modal.hidden = true;
    }, 300);
    document.body.style.overflow = '';

    // Remove escape key listener
    document.removeEventListener('keydown', handleModalEscape);

    // Return focus to the booking button
    const bookingBtn = document.querySelector('.btn-booking');
    if (bookingBtn) bookingBtn.focus();
  };

  function handleModalEscape(e) {
    if (e.key === 'Escape') {
      closeBookingModal();
    }
  }

  function initCalEmbed() {
    const embedContainer = document.getElementById('cal-embed');
    if (!embedContainer) return;

    // Create the Cal.com inline embed
    const calInline = document.createElement('cal-inline');
    calInline.setAttribute('calLink', 'techguru/strategy-call');
    calInline.style.width = '100%';
    calInline.style.height = '100%';
    calInline.style.overflow = 'auto';

    // Add Cal.com embed script if not already loaded
    if (!window.Cal) {
      const script = document.createElement('script');
      script.src = 'https://app.cal.com/embed/embed.js';
      script.async = true;
      script.onload = function() {
        // Initialize Cal.com
        window.Cal('init', { origin: 'https://app.cal.com' });

        // Add inline embed to container
        embedContainer.innerHTML = '';
        embedContainer.appendChild(calInline);

        // Configure embed with TechGuru branding
        window.Cal('inline', {
          calLink: 'techguru/strategy-call',
          elementOrSelector: '#cal-embed',
          config: {
            theme: document.body.classList.contains('light-theme') ? 'light' : 'dark',
            styles: {
              branding: {
                brandColor: '#4a6cf7'
              }
            }
          }
        });
      };
      document.head.appendChild(script);
    } else {
      // Cal.com already loaded, just initialize
      embedContainer.innerHTML = '';
      embedContainer.appendChild(calInline);
      window.Cal('inline', {
        calLink: 'techguru/strategy-call',
        elementOrSelector: '#cal-embed',
        config: {
          theme: document.body.classList.contains('light-theme') ? 'light' : 'dark',
          styles: {
            branding: {
              brandColor: '#4a6cf7'
            }
          }
        }
      });
    }
  }
});
