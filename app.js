/* app.js — BloodsRUs Router & Interactions */

(function () {
  'use strict';

  // ============================================
  // PAGE PRELOADER
  // ============================================
  var preloader = document.getElementById('preloader');
  if (preloader) {
    window.addEventListener('load', function () {
      setTimeout(function () {
        preloader.classList.add('loaded');
        setTimeout(function () { preloader.remove(); }, 600);
      }, 800);
    });
    // Safety fallback — always dismiss after 3s
    setTimeout(function () {
      if (preloader && preloader.parentNode) {
        preloader.classList.add('loaded');
        setTimeout(function () { if (preloader.parentNode) preloader.remove(); }, 600);
      }
    }, 3000);
  }

  // ============================================
  // THEME TOGGLE
  // ============================================
  const root = document.documentElement;
  let theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  root.setAttribute('data-theme', theme);

  document.querySelectorAll('[data-theme-toggle]').forEach(toggle => {
    updateToggleIcon(toggle, theme);
    toggle.addEventListener('click', () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', theme);
      document.querySelectorAll('[data-theme-toggle]').forEach(t => updateToggleIcon(t, theme));
    });
  });

  function updateToggleIcon(btn, t) {
    btn.setAttribute('aria-label', `Switch to ${t === 'dark' ? 'light' : 'dark'} mode`);
    btn.innerHTML = t === 'dark'
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }

  // ============================================
  // CONDITION NAMES MAP (for breadcrumbs/pills)
  // ============================================
  const conditionNames = {
    'thalassemia': 'Thalassemia',
    'sickle-cell': 'Sickle Cell Anemia',
    'aplastic-anemia': 'Aplastic Anemia',
    'all-leukemia': 'ALL (Leukemia)',
    'aml-leukemia': 'AML (Leukemia)',
    'cml-leukemia': 'CML (Leukemia)',
    'hodgkins-lymphoma': "Hodgkin's Lymphoma",
    'nhl-lymphoma': "Non-Hodgkin's Lymphoma",
    'mds': 'MDS',
    'autoimmune': 'Autoimmune Diseases',
    'primary-immunodeficiency': 'Primary Immunodeficiency',
    'inherited-metabolic': 'Inherited Metabolic Disorders',
    'bone-marrow-failure': 'Bone Marrow Failure',
    'non-malignant': 'Non-Malignant Conditions',
    'malignant': 'Malignant Conditions',
  };

  // ============================================
  // HASH ROUTER
  // ============================================
  const routes = {
    '': 'home',
    'home': 'home',
    'about': 'about',
    'conditions': 'conditions',
    'bmt': 'bmt',
    'physicians': 'physicians',
    'resources': 'resources',
    'contact': 'contact',
    'thalassemia': 'conditions',
    'sickle-cell': 'conditions',
    'aplastic-anemia': 'conditions',
    'all-leukemia': 'conditions',
    'aml-leukemia': 'conditions',
    'cml-leukemia': 'conditions',
    'hodgkins-lymphoma': 'conditions',
    'nhl-lymphoma': 'conditions',
    'mds': 'conditions',
    'autoimmune': 'conditions',
    'primary-immunodeficiency': 'conditions',
    'inherited-metabolic': 'conditions',
    'bone-marrow-failure': 'conditions',
    'non-malignant': 'conditions',
    'malignant': 'conditions',
  };

  // Condition category map for breadcrumbs
  const conditionCategories = {
    'thalassemia': 'Genetic Blood Disorders',
    'sickle-cell': 'Genetic Blood Disorders',
    'all-leukemia': 'Blood Cancers',
    'aml-leukemia': 'Blood Cancers',
    'cml-leukemia': 'Blood Cancers',
    'hodgkins-lymphoma': 'Lymphomas & MDS',
    'nhl-lymphoma': 'Lymphomas & MDS',
    'mds': 'Lymphomas & MDS',
    'aplastic-anemia': 'Bone Marrow & Immune Disorders',
    'bone-marrow-failure': 'Bone Marrow & Immune Disorders',
    'autoimmune': 'Bone Marrow & Immune Disorders',
    'primary-immunodeficiency': 'Bone Marrow & Immune Disorders',
    'inherited-metabolic': 'Bone Marrow & Immune Disorders',
  };

  // Stats animation state (declared early for hoisting)
  const statsBar = document.querySelector('.stats-bar');
  let statsAnimated = false;

  function checkStatsVisibility() {
    if (statsAnimated || !statsBar) return;
    const rect = statsBar.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      statsAnimated = true;
      statsBar.classList.add('animate-in');
      animateCounters();
    }
  }

  function getHash() {
    const h = window.location.hash || '';
    return h.replace(/^#\/?/, '') || '';
  }

  function navigate() {
    const hash = getHash();
    const pageId = routes[hash] || 'home';

    // Hide all pages first
    document.querySelectorAll('.page').forEach(p => {
      p.classList.remove('active');
      p.style.display = 'none';
    });

    // Show the target page
    if (pageId === 'conditions') {
      const cp = document.getElementById('page-conditions');
      if (cp) { cp.classList.add('active'); cp.style.display = 'block'; }

      const hub = document.getElementById('conditions-hub');
      const detail = document.getElementById('condition-detail');
      const breadcrumb = document.getElementById('condition-breadcrumb');
      const pills = document.querySelector('.condition-pills');

      if (hash === 'conditions') {
        // Show the hub landing page
        if (hub) hub.style.display = 'block';
        if (detail) detail.style.display = 'none';
        if (breadcrumb) breadcrumb.style.display = 'none';
        if (pills) pills.style.display = 'none';
        // Hide all individual conditions
        document.querySelectorAll('[data-condition]').forEach(el => el.style.display = 'none');
      } else {
        // Show individual condition detail
        if (hub) hub.style.display = 'none';
        if (detail) detail.style.display = 'block';
        if (breadcrumb) breadcrumb.style.display = '';
        if (pills) pills.style.display = '';
        showCondition(hash);
        updateBreadcrumb(hash);
        updateConditionPills(hash);
      }
    } else {
      const page = document.getElementById('page-' + pageId);
      if (page) { page.classList.add('active'); page.style.display = 'block'; }
    }

    // Update nav active states
    document.querySelectorAll('[data-nav-link]').forEach(link => {
      link.classList.remove('active');
      const linkHash = link.getAttribute('href').replace('#', '');
      if (linkHash === hash || (hash === '' && linkHash === 'home')) {
        link.classList.add('active');
      }
      // Highlight "Conditions" nav when on any condition page
      if (linkHash === 'conditions' && pageId === 'conditions') {
        link.classList.add('active');
      }
    });

    // Scroll to top of page
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    // Update reading progress
    updateReadingProgress();

    // Page content entrance stagger (Motion 1D)
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const activePage = document.querySelector('.page.active');
      if (activePage) {
        const sections = activePage.querySelectorAll('.section, .section--alt, .page-hero, .stats-bar, .cta-bar');
        sections.forEach((sec, i) => {
          sec.classList.add('page-section-stagger');
          sec.classList.remove('stagger-entered');
          // Force reflow so the initial state is painted
          void sec.offsetWidth;
          setTimeout(() => {
            sec.classList.add('stagger-entered');
          }, i * 80);
        });
      }
    }

    // Check stats animation visibility
    setTimeout(checkStatsVisibility, 300);
  }

  // Intercept all hash link clicks to prevent default scroll behavior
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a[href^="#"]');
    if (link) {
      e.preventDefault();
      const newHash = link.getAttribute('href');
      if (window.location.hash !== newHash) {
        history.pushState(null, '', newHash);
      }
      navigate();
    }
  });

  window.addEventListener('popstate', navigate);
  window.addEventListener('hashchange', navigate);
  // Run navigate immediately since script is at bottom of body
  navigate();

  // ============================================
  // CONDITIONS ROUTER
  // ============================================
  function showCondition(hash) {
    document.querySelectorAll('[data-condition]').forEach(el => el.style.display = 'none');
    const el = document.querySelector('[data-condition="' + hash + '"]');
    const target = el || document.querySelector('[data-condition]');
    if (target) {
      target.style.display = 'block';
      // Condition detail entrance animation (Motion 1J)
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        target.classList.add('condition-detail-enter');
        target.classList.remove('entered');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            target.classList.add('entered');
          });
        });
      }
    }
  }

  // ============================================
  // BREADCRUMBS
  // ============================================
  function updateBreadcrumb(hash) {
    const bc = document.getElementById('condition-breadcrumb');
    if (!bc) return;
    const name = conditionNames[hash] || 'Conditions';
    const category = conditionCategories[hash] || '';
    let html = '<a href="#home">Home</a><span class="breadcrumb__sep">/</span><a href="#conditions">Conditions</a>';
    if (category) {
      html += '<span class="breadcrumb__sep">/</span><span class="breadcrumb__category">' + category + '</span>';
    }
    html += '<span class="breadcrumb__sep">/</span><span class="breadcrumb__current">' + name + '</span>';
    bc.innerHTML = html;
  }

  // ============================================
  // CONDITION PILLS (mobile)
  // ============================================
  function updateConditionPills(hash) {
    document.querySelectorAll('.condition-pill').forEach(pill => {
      const pillHash = pill.getAttribute('href').replace('#', '');
      pill.classList.toggle('active', pillHash === hash);
    });
    // Scroll active pill into view
    const activePill = document.querySelector('.condition-pill.active');
    if (activePill) {
      activePill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  // ============================================
  // STICKY NAV
  // ============================================
  const nav = document.querySelector('.nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 20);
    }, { passive: true });
  }

  // ============================================
  // MOBILE HAMBURGER
  // ============================================
  const hamburger = document.querySelector('[data-hamburger]');
  const mobileMenu = document.querySelector('.nav__mobile');
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const open = mobileMenu.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', open);
    });

    // Close on link click
    mobileMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        hamburger.setAttribute('aria-expanded', false);
      });
    });
  }

  // ============================================
  // ACCORDION
  // ============================================
  window.toggleAccordion = function(btn) {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    // Close all siblings in same accordion
    const accordion = btn.closest('.accordion');
    if (accordion) {
      accordion.querySelectorAll('.accordion-header').forEach(h => {
        if (h !== btn) {
          h.setAttribute('aria-expanded', 'false');
          const b = h.nextElementSibling;
          if (b) b.classList.remove('open');
        }
      });
    }
    btn.setAttribute('aria-expanded', !expanded);
    const body = btn.nextElementSibling;
    if (body) body.classList.toggle('open', !expanded);
  };

  // ============================================
  // TABS
  // ============================================
  window.switchTab = function(btn, panelId) {
    const tabList = btn.closest('.tabs__list');
    const tabContainer = btn.closest('.tabs');
    if (!tabList || !tabContainer) return;

    tabList.querySelectorAll('.tabs__btn').forEach(b => b.setAttribute('aria-selected', 'false'));
    btn.setAttribute('aria-selected', 'true');

    const panels = tabContainer.parentElement.querySelectorAll('.tabs__panel');
    panels.forEach(p => p.classList.remove('active'));

    const panel = document.getElementById(panelId);
    if (panel) panel.classList.add('active');
  };

  // ============================================
  // BACK TO TOP BUTTON
  // ============================================
  const backToTop = document.getElementById('back-to-top');
  if (backToTop) {
    window.addEventListener('scroll', () => {
      backToTop.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });

    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ============================================
  // STAT COUNTER ANIMATION
  // ============================================
  if (statsBar) {
    statsBar.classList.add('stats-bar--animatable');
    window.addEventListener('scroll', checkStatsVisibility, { passive: true });
    // Also check on load and after a short delay in case it's already visible
    checkStatsVisibility();
    setTimeout(checkStatsVisibility, 500);
  }

  function animateCounters() {
    document.querySelectorAll('.stats-bar__number[data-count]').forEach(el => {
      const target = parseInt(el.getAttribute('data-count'), 10);
      const suffix = el.getAttribute('data-suffix') || '';
      const spanEl = el.querySelector('span');
      const duration = 1500;
      const startTime = performance.now();

      function step(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(target * eased);
        // Update just the number text before the span
        if (spanEl) {
          el.firstChild.textContent = current;
        } else {
          el.textContent = current + suffix;
        }
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  // ============================================
  // FORM SUBMISSION FEEDBACK
  // ============================================
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
      e.preventDefault();

      // Basic validation
      const name = document.getElementById('contact-name');
      let valid = true;

      // Clear previous errors
      contactForm.querySelectorAll('.form-group').forEach(g => g.classList.remove('has-error'));

      if (!name || !name.value.trim()) {
        const group = name ? name.closest('.form-group') : null;
        if (group) group.classList.add('has-error');
        valid = false;
      }

      if (!valid) return;

      // Show success
      const successEl = document.getElementById('form-success');
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      if (successEl) {
        successEl.classList.add('show');
        if (submitBtn) {
          submitBtn.textContent = 'Enquiry Sent';
          submitBtn.disabled = true;
          submitBtn.style.opacity = '0.6';
        }
        // Reset after 5 seconds
        setTimeout(() => {
          successEl.classList.remove('show');
          contactForm.reset();
          if (submitBtn) {
            submitBtn.textContent = 'Send Enquiry';
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
          }
        }, 5000);
      }
    });
  }

  // ============================================
  // CLIENT-SIDE SEARCH
  // ============================================
  const searchInput = document.getElementById('site-search');
  const searchResults = document.getElementById('search-results');

  if (searchInput && searchResults) {
    // Build search index from page content
    const searchIndex = buildSearchIndex();

    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const query = searchInput.value.trim().toLowerCase();
        if (query.length < 2) {
          searchResults.classList.remove('open');
          return;
        }
        const results = searchIndex.filter(item =>
          item.title.toLowerCase().includes(query) ||
          item.context.toLowerCase().includes(query)
        ).slice(0, 8);

        if (results.length > 0) {
          searchResults.innerHTML = results.map(r =>
            '<a class="search-result-item" href="' + r.href + '">' +
            '<div class="search-result-item__title">' + highlightMatch(r.title, query) + '</div>' +
            '<div class="search-result-item__context">' + highlightMatch(r.context.substring(0, 80), query) + '...</div>' +
            '<div class="search-result-item__tag">' + r.section + '</div>' +
            '</a>'
          ).join('');
          searchResults.classList.add('open');
        } else {
          searchResults.innerHTML = '<div class="search-no-results">No results found for "' + escapeHtml(query) + '"</div>';
          searchResults.classList.add('open');
        }
      }, 200);
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-wrapper')) {
        searchResults.classList.remove('open');
      }
    });

    // Close on Escape
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchResults.classList.remove('open');
        searchInput.blur();
      }
    });
  }

  function buildSearchIndex() {
    const index = [];

    // Index condition cards from home page
    document.querySelectorAll('.condition-card').forEach(card => {
      const title = card.querySelector('.condition-card__title');
      const desc = card.querySelector('.condition-card__desc');
      const href = card.getAttribute('href');
      if (title && href) {
        index.push({
          title: title.textContent,
          context: desc ? desc.textContent : '',
          href: href,
          section: 'Condition'
        });
      }
    });

    // Index accordion questions
    document.querySelectorAll('.accordion-header').forEach(header => {
      const titleEl = header.querySelector('.accordion-title');
      const body = header.nextElementSibling;
      const condDiv = header.closest('[data-condition]');
      const condName = condDiv ? (conditionNames[condDiv.getAttribute('data-condition')] || '') : '';
      if (titleEl) {
        index.push({
          title: titleEl.textContent,
          context: body ? body.textContent.substring(0, 100).trim() : '',
          href: condDiv ? '#' + condDiv.getAttribute('data-condition') : '#bmt',
          section: condName || 'FAQ'
        });
      }
    });

    // Index main pages
    const pages = [
      { title: 'About & Team', context: 'Dr. Suparno Chakrabarti, Dr. Mahak Agarwal, team profiles', href: '#about', section: 'Page' },
      { title: 'All Conditions', context: 'Find your condition, genetic blood disorders, blood cancers, lymphomas, bone marrow', href: '#conditions', section: 'Page' },
      { title: 'BMT Centre', context: 'Bone Marrow Transplantation information, types, process', href: '#bmt', section: 'Page' },
      { title: 'For Doctors', context: 'Clinical reference guide, when to refer for BMT', href: '#physicians', section: 'Page' },
      { title: 'For Patients', context: 'BMT journey, clean room guide, nutrition, donor guide, patient stories', href: '#resources', section: 'Page' },
      { title: 'Contact & Appointment', context: 'Book appointment, Action Cancer Hospital, New Delhi', href: '#contact', section: 'Page' },
      { title: 'Manashi Chakrabarti Foundation', context: 'Research activities, children with blood disorders', href: '#about', section: 'Foundation' },
    ];
    pages.forEach(p => index.push(p));

    return index;
  }

  function highlightMatch(text, query) {
    if (!query) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const regex = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return escaped.replace(regex, '<strong>$1</strong>');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ============================================
  // READING PROGRESS BAR
  // ============================================
  function updateReadingProgress() {
    const progressBar = document.getElementById('reading-progress');
    if (!progressBar) return;
    const activePage = document.querySelector('.page.active');
    if (!activePage) { progressBar.style.width = '0'; return; }

    const rect = activePage.getBoundingClientRect();
    const pageHeight = activePage.scrollHeight - window.innerHeight;
    if (pageHeight <= 0) { progressBar.style.width = '0'; return; }

    const scrolled = Math.max(0, -rect.top);
    const progress = Math.min(scrolled / pageHeight, 1);
    progressBar.style.width = (progress * 100) + '%';
  }

  window.addEventListener('scroll', updateReadingProgress, { passive: true });

  // ============================================
  // SCROLL REVEAL ANIMATIONS
  // ============================================
  const revealElements = document.querySelectorAll('.reveal');

  if (revealElements.length > 0 && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05, rootMargin: '0px 0px 50px 0px' });

    revealElements.forEach(el => {
      el.classList.add('reveal--ready');
      revealObserver.observe(el);
    });
  } else {
    // Fallback: show everything (no animation)
    revealElements.forEach(el => el.classList.add('revealed'));
  }

  // Also reveal elements when navigating between pages
  const origNavigate = window.navigate;
  if (typeof origNavigate === 'function') {
    // Patch: after page switch, observe new reveal elements
    setTimeout(() => {
      document.querySelectorAll('.reveal:not(.revealed)').forEach(el => {
        if ('IntersectionObserver' in window) {
          const obs = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                obs.unobserve(entry.target);
              }
            });
          }, { threshold: 0.1 });
          obs.observe(el);
        } else {
          el.classList.add('revealed');
        }
      });
    }, 500);
  }

  // ============================================
  // CONDITIONS HUB SEARCH
  // ============================================
  const hubSearch = document.getElementById('hub-search');
  if (hubSearch) {
    hubSearch.addEventListener('input', function() {
      const query = this.value.trim().toLowerCase();
      document.querySelectorAll('#conditions-hub .condition-card').forEach(card => {
        const title = (card.querySelector('.condition-card__title') || {}).textContent || '';
        const desc = (card.querySelector('.condition-card__desc') || {}).textContent || '';
        const match = !query || title.toLowerCase().includes(query) || desc.toLowerCase().includes(query);
        card.style.display = match ? '' : 'none';
      });
      // Hide empty categories
      document.querySelectorAll('#conditions-hub .hub-category').forEach(cat => {
        const visibleCards = cat.querySelectorAll('.condition-card[style=""], .condition-card:not([style])');
        const hiddenCards = cat.querySelectorAll('.condition-card[style*="display: none"]');
        cat.style.display = (hiddenCards.length === cat.querySelectorAll('.condition-card').length) ? 'none' : '';
      });
    });
  }

  // ============================================
  // HERO STAGGERED ENTRANCE (Motion 1B)
  // ============================================
  const hero = document.querySelector('.hero');
  if (hero) {
    // Add animatable class first, then trigger entrance
    hero.classList.add('hero--animatable');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        hero.classList.add('hero--entered');
      });
    });
  }

  // ============================================
  // HERO SCROLL HINT - hide on scroll
  // ============================================
  const scrollHint = document.querySelector('.hero__scroll-hint');
  if (scrollHint) {
    let hintHidden = false;
    window.addEventListener('scroll', () => {
      if (!hintHidden && window.scrollY > 100) {
        scrollHint.style.opacity = '0';
        scrollHint.style.transition = 'opacity 0.5s ease';
        hintHidden = true;
      }
    }, { passive: true });
  }

  // ============================================
  // FLOATING 3D ELEMENTS
  // ============================================
  (function FloatingElements() {
    // Bail immediately if user prefers reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const isMobile = window.innerWidth <= 768;

    // ---- Section Configuration ----
    const SECTION_CONFIG = {
      hero: {
        selector: '.hero',
        shapes: ['erythrocyte', 'dna', 'hexagon', 'platelet'],
        count: isMobile ? 4 : 8,
        depthWeights: { far: 0.3, mid: 0.4, near: 0.3 }
      },
      statsBar: {
        selector: '.stats-bar',
        shapes: ['platelet', 'hexagon'],
        count: isMobile ? 2 : 5,
        depthWeights: { far: 0.4, mid: 0.4, near: 0.2 }
      },
      aboutHome: {
        selector: '#page-home .section:first-of-type',
        shapes: ['molecule', 'hexagon', 'erythrocyte'],
        count: isMobile ? 2 : 5,
        depthWeights: { far: 0.3, mid: 0.5, near: 0.2 }
      },
      conditionsHome: {
        selector: '#page-home .conditions-grid',
        shapes: ['erythrocyte', 'molecule', 'stemcell', 'dna'],
        count: isMobile ? 3 : 6,
        depthWeights: { far: 0.3, mid: 0.4, near: 0.3 }
      },
      ctaBar: {
        selector: '.cta-bar',
        shapes: ['pulse', 'hexagon'],
        count: isMobile ? 2 : 4,
        depthWeights: { far: 0.3, mid: 0.5, near: 0.2 }
      },
      bmtHero: {
        selector: '#page-bmt .page-hero',
        shapes: ['stemcell', 'dna', 'molecule'],
        count: isMobile ? 2 : 5,
        depthWeights: { far: 0.3, mid: 0.4, near: 0.3 }
      },
      aboutHero: {
        selector: '#page-about .page-hero',
        shapes: ['molecule', 'hexagon'],
        count: isMobile ? 2 : 4,
        depthWeights: { far: 0.4, mid: 0.4, near: 0.2 }
      },
      contactHero: {
        selector: '#page-contact .page-hero',
        shapes: ['pulse', 'hexagon', 'erythrocyte'],
        count: isMobile ? 2 : 4,
        depthWeights: { far: 0.3, mid: 0.5, near: 0.2 }
      }
    };

    // ---- Depth parallax / mouse factors ----
    const DEPTH = {
      far:  { parallax: 0.03, mouse: 0.003 },
      mid:  { parallax: 0.06, mouse: 0.008 },
      near: { parallax: 0.10, mouse: 0.015 }
    };

    // ---- Create SVG for DNA helix ----
    function createDNASvg() {
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', '0 0 40 80');
      svg.setAttribute('width', '40');
      svg.setAttribute('height', '80');
      svg.setAttribute('fill', 'none');
      svg.style.overflow = 'visible';

      // Two helix strands
      const path1 = document.createElementNS(ns, 'path');
      path1.setAttribute('d', 'M10,0 C30,10 10,30 30,40 C10,50 30,70 10,80');
      path1.setAttribute('stroke', 'currentColor');
      path1.setAttribute('stroke-width', '1.5');
      path1.setAttribute('stroke-linecap', 'round');

      const path2 = document.createElementNS(ns, 'path');
      path2.setAttribute('d', 'M30,0 C10,10 30,30 10,40 C30,50 10,70 30,80');
      path2.setAttribute('stroke', 'currentColor');
      path2.setAttribute('stroke-width', '1.5');
      path2.setAttribute('stroke-linecap', 'round');

      svg.appendChild(path1);
      svg.appendChild(path2);

      // Crossing rungs
      var rungs = [10, 25, 40, 55, 70];
      rungs.forEach(function(y) {
        var circle = document.createElementNS(ns, 'circle');
        circle.setAttribute('cx', '20');
        circle.setAttribute('cy', String(y));
        circle.setAttribute('r', '2');
        circle.setAttribute('fill', 'currentColor');
        svg.appendChild(circle);
      });

      return svg;
    }

    // ---- Create a shape element ----
    function createShape(type) {
      var el = document.createElement('div');
      el.className = 'f3d-shape f3d-shape--' + type;
      el.setAttribute('aria-hidden', 'true');

      if (type === 'dna') {
        el.appendChild(createDNASvg());
      }

      return el;
    }

    // ---- Weighted random depth selection ----
    function assignDepth(weights) {
      var r = Math.random();
      if (r < weights.far) return 'far';
      if (r < weights.far + weights.mid) return 'mid';
      return 'near';
    }

    // ---- Random position biased toward edges ----
    function randomPosition() {
      // X: bias toward edges (0–20% or 80–100%) to avoid center content
      var x;
      if (Math.random() < 0.7) {
        // 70% chance: edges
        x = Math.random() < 0.5
          ? Math.random() * 20      // left 0–20%
          : 80 + Math.random() * 20; // right 80–100%
      } else {
        // 30% chance: anywhere (adds variety)
        x = Math.random() * 100;
      }

      // Y: full range with slight bias away from extremes
      var y = 5 + Math.random() * 90; // 5–95%

      return { x: x, y: y };
    }

    // ---- Track all active layers for parallax ----
    var activeLayers = [];

    // ---- Inject a floating layer into a section ----
    function injectLayer(sectionEl, config) {
      // Don't double-inject
      if (sectionEl.querySelector('.f3d-layer')) return null;

      // Add perspective to section
      sectionEl.classList.add('f3d-perspective');
      // Ensure section has position context
      var cs = getComputedStyle(sectionEl);
      if (cs.position === 'static') {
        sectionEl.style.position = 'relative';
      }

      var layer = document.createElement('div');
      layer.className = 'f3d-layer';
      layer.setAttribute('aria-hidden', 'true');

      var items = [];

      for (var i = 0; i < config.count; i++) {
        var shapeType = config.shapes[i % config.shapes.length];
        var depth = assignDepth(config.depthWeights);
        var pos = randomPosition();

        var item = document.createElement('div');
        item.className = 'f3d-item f3d-depth-' + depth;
        item.style.left = pos.x + '%';
        item.style.top = pos.y + '%';

        // Add a random animation delay so shapes don't sync
        var delay = -(Math.random() * 12).toFixed(2);
        item.style.animationDelay = delay + 's';

        var shape = createShape(shapeType);
        item.appendChild(shape);
        layer.appendChild(item);

        items.push({ el: item, depth: depth });
      }

      // Insert as first child so content sits above
      sectionEl.insertBefore(layer, sectionEl.firstChild);

      return { layer: layer, items: items, section: sectionEl };
    }

    // ---- Parallax: scroll handler ----
    var scrollTicking = false;

    function updateParallax() {
      var scrollY = window.scrollY;

      for (var i = 0; i < activeLayers.length; i++) {
        var data = activeLayers[i];
        if (!data.active) continue;

        var rect = data.section.getBoundingClientRect();
        // Offset relative to section center
        var sectionCenter = rect.top + rect.height / 2;
        var viewCenter = window.innerHeight / 2;
        var offset = sectionCenter - viewCenter;

        for (var j = 0; j < data.items.length; j++) {
          var item = data.items[j];
          var factor = DEPTH[item.depth].parallax;
          var py = (offset * factor).toFixed(1);
          item.el.style.setProperty('--f3d-parallax-y', py + 'px');
        }
      }

      scrollTicking = false;
    }

    window.addEventListener('scroll', function() {
      if (!scrollTicking) {
        scrollTicking = true;
        requestAnimationFrame(updateParallax);
      }
    }, { passive: true });

    // ---- Mouse reactivity (desktop only) ----
    if (!isMobile) {
      var mouseTicking = false;
      var mouseX = 0;
      var mouseY = 0;

      window.addEventListener('mousemove', function(e) {
        mouseX = e.clientX - window.innerWidth / 2;
        mouseY = e.clientY - window.innerHeight / 2;

        if (!mouseTicking) {
          mouseTicking = true;
          requestAnimationFrame(function() {
            for (var i = 0; i < activeLayers.length; i++) {
              var data = activeLayers[i];
              if (!data.active) continue;

              for (var j = 0; j < data.items.length; j++) {
                var item = data.items[j];
                var factor = DEPTH[item.depth].mouse;
                var mx = (mouseX * factor).toFixed(1);
                item.el.style.setProperty('--f3d-mouse-x', mx + 'px');
              }
            }
            mouseTicking = false;
          });
        }
      }, { passive: true });
    }

    // ---- IntersectionObserver: activate / deactivate layers ----
    var layerObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        // Find matching layer data
        for (var i = 0; i < activeLayers.length; i++) {
          if (activeLayers[i].layer === entry.target) {
            activeLayers[i].active = entry.isIntersecting;

            // Toggle will-change + animation-play-state for performance
            var items = activeLayers[i].items;
            for (var j = 0; j < items.length; j++) {
              if (entry.isIntersecting) {
                items[j].el.style.willChange = 'transform';
                items[j].el.style.animationPlayState = 'running';
              } else {
                items[j].el.style.willChange = 'auto';
                items[j].el.style.animationPlayState = 'paused';
              }
            }
            break;
          }
        }
      });
    }, { threshold: 0, rootMargin: '50px 0px' });

    // ---- Scan sections and initialize layers ----
    function scanAndInitialize() {
      Object.keys(SECTION_CONFIG).forEach(function(key) {
        var cfg = SECTION_CONFIG[key];
        var el = document.querySelector(cfg.selector);
        if (!el) return;

        // Skip if already processed
        if (el.querySelector('.f3d-layer')) return;

        var data = injectLayer(el, cfg);
        if (data) {
          data.active = false;
          activeLayers.push(data);
          layerObserver.observe(data.layer);
        }
      });
    }

    // ---- Initialize on load ----
    scanAndInitialize();

    // ---- Re-scan on hash navigation (SPA page switch) ----
    window.addEventListener('hashchange', function() {
      setTimeout(scanAndInitialize, 400);
    });

    // ---- Also re-scan after initial load for hash routes ----
    if (window.location.hash) {
      setTimeout(scanAndInitialize, 500);
    }

  })();

})();
