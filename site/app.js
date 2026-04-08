// Alcove Animation Reference Lookbook
(function () {
  'use strict';

  const STORAGE_KEY = 'alcove-favorites';
  let favorites = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  let filmData = [];
  let activeFilter = 'All';

  // --- Favorites ---
  function saveFavorites() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    updateCompareBtn();
  }

  function toggleFavorite(imageId) {
    const idx = favorites.indexOf(imageId);
    if (idx === -1) favorites.push(imageId);
    else favorites.splice(idx, 1);
    saveFavorites();
    document.querySelectorAll(`.fav-btn[data-id="${imageId}"]`).forEach(btn => {
      btn.classList.toggle('favorited', favorites.includes(imageId));
    });
  }

  function updateCompareBtn() {
    const btn = document.getElementById('compare-btn');
    if (favorites.length >= 2) {
      btn.classList.add('visible');
      btn.textContent = `Compare (${favorites.length})`;
    } else {
      btn.classList.remove('visible');
    }
  }

  // --- Lightbox ---
  let lightboxImages = [];
  let lightboxIndex = 0;

  function openLightbox(images, index) {
    lightboxImages = images;
    lightboxIndex = index;
    showLightboxImage();
    document.getElementById('lightbox').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    document.getElementById('lightbox').classList.remove('open');
    document.body.style.overflow = '';
  }

  function showLightboxImage() {
    const img = document.getElementById('lightbox-img');
    const info = document.getElementById('lightbox-info');
    const item = lightboxImages[lightboxIndex];
    img.src = item.fullres;
    info.textContent = `${item.film} (${lightboxIndex + 1}/${lightboxImages.length})`;
  }

  function lightboxPrev() {
    lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
    showLightboxImage();
  }

  function lightboxNext() {
    lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
    showLightboxImage();
  }

  // --- Compare ---
  function openCompare() {
    const panel = document.getElementById('compare-panel');
    const grid = document.getElementById('compare-grid');
    grid.innerHTML = '';

    favorites.forEach(id => {
      const [slug, num] = id.split('/');
      const film = filmData.find(f => f.slug === slug);
      if (!film) return;

      const img = film.images.find(i => i.num === parseInt(num));
      if (!img) return;

      const cell = document.createElement('div');
      cell.className = 'compare-cell';
      cell.innerHTML = `
        <img src="${img.fullres}" alt="${film.title}" loading="lazy">
        <div class="label">${film.title}</div>
      `;
      grid.appendChild(cell);
    });

    panel.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeCompare() {
    document.getElementById('compare-panel').classList.remove('open');
    document.body.style.overflow = '';
  }

  // --- Filters ---
  function setFilter(studio) {
    activeFilter = studio;
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.studio === studio);
    });
    document.querySelectorAll('.film-card').forEach(card => {
      if (studio === 'All' || card.dataset.studio === studio) {
        card.classList.remove('hidden');
      } else {
        card.classList.add('hidden');
      }
    });
    const visible = document.querySelectorAll('.film-card:not(.hidden)').length;
    document.getElementById('film-count').textContent = `${visible} films`;
  }

  // --- Render ---
  function renderFilm(film) {
    const card = document.createElement('div');
    card.className = 'film-card';
    card.dataset.studio = film.studio;

    const images = film.images.map((img, i) => {
      const id = `${film.slug}/${img.num}`;
      const isFav = favorites.includes(id);
      return `
        <div class="carousel-item" data-index="${i}">
          <img src="${img.thumb}" alt="${film.title}" loading="lazy">
          <button class="fav-btn ${isFav ? 'favorited' : ''}" data-id="${id}" title="Favorite">&#9829;</button>
        </div>
      `;
    }).join('');

    card.innerHTML = `
      <div class="film-header">
        <h2>${film.title}</h2>
        <span class="studio-tag">${film.studio}</span>
      </div>
      <p class="style-desc">${film.styleDesc || ''}</p>
      <div class="carousel-wrapper">
        <div class="carousel">${images}</div>
      </div>
    `;

    // Favorite button clicks
    card.querySelectorAll('.fav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(btn.dataset.id);
      });
    });

    // Lightbox clicks
    card.querySelectorAll('.carousel-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.fav-btn')) return;
        const allImages = film.images.map(img => ({
          fullres: img.fullres,
          film: film.title,
        }));
        openLightbox(allImages, parseInt(item.dataset.index));
      });
    });

    return card;
  }

  function renderAll() {
    const container = document.getElementById('films-container');
    container.innerHTML = '';
    filmData.forEach(film => {
      container.appendChild(renderFilm(film));
    });
    document.getElementById('film-count').textContent = `${filmData.length} films`;
    updateCompareBtn();
  }

  // --- Init ---
  async function init() {
    const resp = await fetch('data.json');
    filmData = await resp.json();
    renderAll();

    // Build filter buttons
    const studios = ['All', ...new Set(filmData.map(f => f.studio))];
    const filterBar = document.getElementById('filter-bar');
    studios.forEach(studio => {
      const btn = document.createElement('button');
      btn.className = `filter-btn ${studio === 'All' ? 'active' : ''}`;
      btn.dataset.studio = studio;
      btn.textContent = studio;
      btn.addEventListener('click', () => setFilter(studio));
      filterBar.appendChild(btn);
    });

    // Compare button
    document.getElementById('compare-btn').addEventListener('click', openCompare);
    document.getElementById('compare-close').addEventListener('click', closeCompare);

    // Lightbox
    document.getElementById('lightbox').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeLightbox();
    });
    document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
    document.getElementById('lightbox-prev').addEventListener('click', (e) => {
      e.stopPropagation();
      lightboxPrev();
    });
    document.getElementById('lightbox-next').addEventListener('click', (e) => {
      e.stopPropagation();
      lightboxNext();
    });

    // Keyboard nav
    document.addEventListener('keydown', (e) => {
      if (document.getElementById('lightbox').classList.contains('open')) {
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') lightboxPrev();
        if (e.key === 'ArrowRight') lightboxNext();
      }
      if (document.getElementById('compare-panel').classList.contains('open')) {
        if (e.key === 'Escape') closeCompare();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
