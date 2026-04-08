/* ==========================================================================
   Alcove Reference Lookbook — Application Logic
   ========================================================================== */
(function () {
  'use strict';

  // ---- Constants ----
  const STORAGE_KEY = 'alcove-favorites';
  const HEART_SVG_OUTLINE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  const HEART_SVG_FILLED = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';

  // ---- State ----
  let favorites = [];
  try {
    favorites = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(favorites)) favorites = [];
  } catch (e) {
    favorites = [];
  }

  let filmData = [];
  let activeFilter = 'All';

  // ---- DOM References (cached after init) ----
  let $filmsContainer;
  let $filterBar;
  let $filmCount;
  let $compareBtn;
  let $favCountNum;
  let $lightbox;
  let $lightboxImg;
  let $lightboxTitle;
  let $lightboxCounter;
  let $comparePanel;
  let $compareGrid;

  // ==========================================================================
  // Favorites
  // ==========================================================================
  function saveFavorites() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    updateFavBadge();
    updateCompareBtn();
  }

  function isFavorited(imageId) {
    return favorites.indexOf(imageId) !== -1;
  }

  function toggleFavorite(imageId) {
    const idx = favorites.indexOf(imageId);
    if (idx === -1) {
      favorites.push(imageId);
    } else {
      favorites.splice(idx, 1);
    }
    saveFavorites();

    // Update all fav buttons for this image
    const btns = document.querySelectorAll('.fav-btn[data-id="' + imageId + '"]');
    btns.forEach(function (btn) {
      const nowFav = isFavorited(imageId);
      btn.classList.toggle('favorited', nowFav);
      btn.innerHTML = nowFav ? HEART_SVG_FILLED : HEART_SVG_OUTLINE;
      // Pop animation
      btn.classList.remove('pop');
      void btn.offsetWidth; // force reflow
      if (nowFav) btn.classList.add('pop');
    });
  }

  function updateFavBadge() {
    if ($favCountNum) {
      $favCountNum.textContent = favorites.length;
    }
  }

  function updateCompareBtn() {
    if (!$compareBtn) return;
    if (favorites.length >= 2) {
      $compareBtn.classList.add('visible');
    } else {
      $compareBtn.classList.remove('visible');
    }
  }

  // ==========================================================================
  // Lightbox
  // ==========================================================================
  let lightboxImages = [];
  let lightboxIndex = 0;

  function openLightbox(images, index) {
    lightboxImages = images;
    lightboxIndex = index;
    showLightboxImage();
    $lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    $lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  function showLightboxImage() {
    const item = lightboxImages[lightboxIndex];
    if (!item) return;

    // Reset animation state
    $lightboxImg.style.transition = 'none';
    $lightboxImg.style.transform = 'scale(0.92)';
    $lightboxImg.style.opacity = '0';

    $lightboxImg.src = item.fullres;
    $lightboxImg.alt = item.film + ' reference image';
    $lightboxTitle.textContent = item.film;
    $lightboxCounter.textContent = (lightboxIndex + 1) + ' / ' + lightboxImages.length;

    // Trigger spring entrance
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        $lightboxImg.style.transition = 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.35s cubic-bezier(0, 0, 0.2, 1)';
        $lightboxImg.style.transform = 'scale(1)';
        $lightboxImg.style.opacity = '1';
      });
    });
  }

  function lightboxPrev() {
    lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
    showLightboxImage();
  }

  function lightboxNext() {
    lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
    showLightboxImage();
  }

  // ==========================================================================
  // Compare
  // ==========================================================================
  function openCompare() {
    $compareGrid.innerHTML = '';

    favorites.forEach(function (id) {
      const parts = id.split('/');
      const slug = parts[0];
      const num = parseInt(parts[1], 10);
      const film = filmData.find(function (f) { return f.slug === slug; });
      if (!film) return;

      const img = film.images.find(function (i) { return i.num === num; });
      if (!img) return;

      var cell = document.createElement('div');
      cell.className = 'compare-cell';
      cell.innerHTML =
        '<img src="' + img.fullres + '" alt="' + film.title + '" loading="lazy" decoding="async">' +
        '<div class="compare-label">' + film.title + '</div>';
      $compareGrid.appendChild(cell);
    });

    $comparePanel.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeCompare() {
    $comparePanel.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ==========================================================================
  // Filters
  // ==========================================================================
  function setFilter(studio) {
    activeFilter = studio;
    var btns = document.querySelectorAll('.filter-btn');
    btns.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.studio === studio);
    });

    var sections = document.querySelectorAll('.film-section');
    var visibleCount = 0;
    sections.forEach(function (section) {
      if (studio === 'All' || section.dataset.studio === studio) {
        section.classList.remove('hidden');
        visibleCount++;
      } else {
        section.classList.add('hidden');
      }
    });

    $filmCount.textContent = visibleCount + ' film' + (visibleCount !== 1 ? 's' : '');
  }

  // ==========================================================================
  // Carousel Scroll Edge Detection
  // ==========================================================================
  function setupCarouselEdges(carousel) {
    var wrapper = carousel.parentElement;

    function updateEdges() {
      var scrollLeft = carousel.scrollLeft;
      var maxScroll = carousel.scrollWidth - carousel.clientWidth;

      if (scrollLeft > 10) {
        wrapper.classList.add('scrolled-start');
      } else {
        wrapper.classList.remove('scrolled-start');
      }

      if (scrollLeft >= maxScroll - 10) {
        wrapper.classList.add('scrolled-end');
      } else {
        wrapper.classList.remove('scrolled-end');
      }
    }

    carousel.addEventListener('scroll', updateEdges, { passive: true });
    // Initial check
    updateEdges();
  }

  // ==========================================================================
  // Render
  // ==========================================================================
  function renderFilm(film) {
    var section = document.createElement('section');
    section.className = 'film-section scroll-reveal';
    section.dataset.studio = film.studio;

    var card = document.createElement('div');
    card.className = 'film-card';

    // Header
    var header = document.createElement('div');
    header.className = 'film-header';
    header.innerHTML =
      '<h2 class="film-title">' + escapeHtml(film.title) + '</h2>' +
      '<span class="studio-tag">' + escapeHtml(film.studio) + '</span>';

    // Style description
    var desc = document.createElement('p');
    desc.className = 'style-desc';
    desc.textContent = film.styleDesc || '';

    // Carousel
    var carouselWrapper = document.createElement('div');
    carouselWrapper.className = 'carousel-wrapper';

    var carousel = document.createElement('div');
    carousel.className = 'carousel';

    film.images.forEach(function (img, i) {
      var id = film.slug + '/' + img.num;
      var fav = isFavorited(id);

      var item = document.createElement('div');
      item.className = 'carousel-item';
      item.style.setProperty('--i', i);
      item.dataset.index = i;

      var imgEl = document.createElement('img');
      imgEl.src = img.thumb;
      imgEl.alt = film.title + ' reference ' + (i + 1);
      imgEl.loading = 'lazy';
      imgEl.decoding = 'async';

      // Image loaded transition
      imgEl.addEventListener('load', function () {
        imgEl.classList.add('loaded');
      });

      // If already cached
      if (imgEl.complete && imgEl.naturalWidth > 0) {
        imgEl.classList.add('loaded');
      }

      var favBtn = document.createElement('button');
      favBtn.className = 'fav-btn' + (fav ? ' favorited' : '');
      favBtn.dataset.id = id;
      favBtn.setAttribute('aria-label', 'Toggle favorite');
      favBtn.innerHTML = fav ? HEART_SVG_FILLED : HEART_SVG_OUTLINE;

      favBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleFavorite(id);
      });

      item.addEventListener('click', function (e) {
        if (e.target.closest('.fav-btn')) return;
        var allImages = film.images.map(function (im) {
          return { fullres: im.fullres, film: film.title };
        });
        openLightbox(allImages, i);
      });

      item.appendChild(imgEl);
      item.appendChild(favBtn);
      carousel.appendChild(item);
    });

    carouselWrapper.appendChild(carousel);

    card.appendChild(header);
    card.appendChild(desc);
    card.appendChild(carouselWrapper);
    section.appendChild(card);

    // Setup carousel edge detection after appending
    requestAnimationFrame(function () {
      setupCarouselEdges(carousel);
    });

    return section;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderAll() {
    $filmsContainer.innerHTML = '';

    var fragment = document.createDocumentFragment();
    filmData.forEach(function (film) {
      fragment.appendChild(renderFilm(film));
    });
    $filmsContainer.appendChild(fragment);

    $filmCount.textContent = filmData.length + ' films';
    updateFavBadge();
    updateCompareBtn();

    // Setup scroll-reveal fallback for browsers without CSS scroll-driven animations
    setupScrollRevealFallback();
  }

  // ==========================================================================
  // Scroll Reveal Fallback (IntersectionObserver)
  // ==========================================================================
  function setupScrollRevealFallback() {
    // Test if scroll-driven animations are supported
    if (CSS.supports && CSS.supports('animation-timeline', 'view()')) {
      return; // Native support, no fallback needed
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.05,
      rootMargin: '0px 0px -50px 0px'
    });

    document.querySelectorAll('.scroll-reveal').forEach(function (el) {
      observer.observe(el);
    });
  }

  // ==========================================================================
  // Build Filter Pills
  // ==========================================================================
  function buildFilters() {
    // Count films per studio
    var studioCounts = {};
    filmData.forEach(function (film) {
      studioCounts[film.studio] = (studioCounts[film.studio] || 0) + 1;
    });

    var studios = ['All'].concat(Object.keys(studioCounts).sort());

    studios.forEach(function (studio) {
      var btn = document.createElement('button');
      btn.className = 'filter-btn' + (studio === 'All' ? ' active' : '');
      btn.dataset.studio = studio;

      var label = studio;
      if (studio === 'All') {
        label = 'All';
        btn.innerHTML = label + '<span class="filter-count">' + filmData.length + '</span>';
      } else {
        btn.innerHTML = label + '<span class="filter-count">' + studioCounts[studio] + '</span>';
      }

      btn.addEventListener('click', function () {
        setFilter(studio);
      });

      $filterBar.appendChild(btn);
    });
  }

  // ==========================================================================
  // Event Listeners
  // ==========================================================================
  function setupEventListeners() {
    // Compare
    $compareBtn.addEventListener('click', openCompare);
    document.getElementById('compare-close').addEventListener('click', closeCompare);

    // Lightbox backdrop click
    $lightbox.querySelector('.lightbox-backdrop').addEventListener('click', closeLightbox);

    // Lightbox close button
    document.getElementById('lightbox-close').addEventListener('click', closeLightbox);

    // Lightbox navigation
    document.getElementById('lightbox-prev').addEventListener('click', function (e) {
      e.stopPropagation();
      lightboxPrev();
    });

    document.getElementById('lightbox-next').addEventListener('click', function (e) {
      e.stopPropagation();
      lightboxNext();
    });

    // Keyboard navigation
    document.addEventListener('keydown', function (e) {
      // Lightbox keyboard controls
      if ($lightbox.classList.contains('open')) {
        if (e.key === 'Escape') {
          closeLightbox();
          e.preventDefault();
        }
        if (e.key === 'ArrowLeft') {
          lightboxPrev();
          e.preventDefault();
        }
        if (e.key === 'ArrowRight') {
          lightboxNext();
          e.preventDefault();
        }
        return;
      }

      // Compare panel keyboard controls
      if ($comparePanel.classList.contains('open')) {
        if (e.key === 'Escape') {
          closeCompare();
          e.preventDefault();
        }
      }
    });
  }

  // ==========================================================================
  // Init
  // ==========================================================================
  async function init() {
    // Cache DOM references
    $filmsContainer = document.getElementById('films-container');
    $filterBar = document.getElementById('filter-bar');
    $filmCount = document.getElementById('film-count');
    $compareBtn = document.getElementById('compare-btn');
    $favCountNum = document.getElementById('fav-count-num');
    $lightbox = document.getElementById('lightbox');
    $lightboxImg = document.getElementById('lightbox-img');
    $lightboxTitle = document.getElementById('lightbox-title');
    $lightboxCounter = document.getElementById('lightbox-counter');
    $comparePanel = document.getElementById('compare-panel');
    $compareGrid = document.getElementById('compare-grid');

    // Fetch data
    try {
      var resp = await fetch('data.json');
      filmData = await resp.json();
    } catch (e) {
      console.error('Failed to load film data:', e);
      $filmsContainer.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:60px 20px;">Failed to load film data. Please refresh the page.</p>';
      return;
    }

    // Render everything
    renderAll();
    buildFilters();
    setupEventListeners();
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
