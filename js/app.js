/**
 * SUPPORT DESK - OPERATOR PANEL LOGIC
 * High performance, zero-dependency, accessible vanilla JS
 */

const AppState = {
  macros: [],
  categories: [],
  currentCategory: 'all',
  currentLang: 'all',
  currentView: 'all', // 'all', 'favorites', 'recent'
  searchQuery: '',
  favorites: new Set(JSON.parse(localStorage.getItem('support_favorites') || '[]')),
  recentIds: JSON.parse(localStorage.getItem('support_recent') || '[]'),
  theme: localStorage.getItem('support_theme') || 'dark'
};

// DOM Elements
const DOM = {
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  themeIcon: document.querySelector('.theme-icon'),
  searchInput: document.getElementById('searchInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  macrosGrid: document.getElementById('macrosGrid'),
  emptyState: document.getElementById('emptyState'),
  resultsCount: document.getElementById('resultsCount'),
  currentFilterLabel: document.getElementById('currentFilterLabel'),
  activeFilterPills: document.getElementById('activeFilterPills'),
  categoryNav: document.getElementById('categoryNav'),
  langFilter: document.getElementById('langFilter'),
  countAll: document.getElementById('countAll'),
  countFavorites: document.getElementById('countFavorites'),
  countRecent: document.getElementById('countRecent'),
  totalMacrosCount: document.getElementById('totalMacrosCount'),
  totalCategoriesCount: document.getElementById('totalCategoriesCount'),
  resetFiltersBtn: document.getElementById('resetFiltersBtn'),
  toastContainer: document.getElementById('toastContainer'),
  mobileFilterToggle: document.getElementById('mobileFilterToggle'),
  closeSidebarBtn: document.getElementById('closeSidebarBtn'),
  sidebar: document.getElementById('sidebar'),
  viewButtons: document.querySelectorAll('.sidebar [data-view]')
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupEventListeners();
  loadData();
});

// Theme Management
function initTheme() {
  document.documentElement.setAttribute('data-theme', AppState.theme);
  updateThemeIcon();
}

function toggleTheme() {
  AppState.theme = AppState.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('support_theme', AppState.theme);
  document.documentElement.setAttribute('data-theme', AppState.theme);
  updateThemeIcon();
  showToast(`Mavzu: ${AppState.theme === 'dark' ? 'Qorong‘i' : 'Yorug‘'} rejimga o‘zgartirildi`, 'info');
}

function updateThemeIcon() {
  if (DOM.themeIcon) {
    DOM.themeIcon.textContent = AppState.theme === 'dark' ? '🌙' : '☀️';
  }
}

// Data Fetching
async function loadData() {
  try {
    const [macrosRes, categoriesRes] = await Promise.all([
      fetch('/api/macros'),
      fetch('/api/categories')
    ]);

    if (macrosRes.ok && categoriesRes.ok) {
      AppState.macros = await macrosRes.json();
      AppState.categories = await categoriesRes.json();
      renderCategories();
      applyFilters();
      updateSidebarCounts();
    } else {
      console.warn('API javob bermadi, demo ma\'lumotlar kutilmoqda.');
    }
  } catch (err) {
    console.error('Ma\'lumotlarni yuklashda xatolik:', err);
  }
}

// Event Listeners
function setupEventListeners() {
  // Theme toggle
  DOM.themeToggleBtn.addEventListener('click', toggleTheme);

  // Search input with instant responsive filtering
  DOM.searchInput.addEventListener('input', (e) => {
    AppState.searchQuery = e.target.value.trim().toLowerCase();
    DOM.clearSearchBtn.style.display = AppState.searchQuery ? 'block' : 'none';
    applyFilters();
  });

  // Press Enter inside search to instantly copy first match
  DOM.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const firstCard = DOM.macrosGrid.querySelector('.macro-card');
      if (firstCard) {
        const macroId = Number(firstCard.dataset.macroId);
        copyMacroResponse(macroId);
      }
    }
  });

  DOM.clearSearchBtn.addEventListener('click', () => {
    DOM.searchInput.value = '';
    AppState.searchQuery = '';
    DOM.clearSearchBtn.style.display = 'none';
    DOM.searchInput.focus();
    applyFilters();
  });

  // Global Keyboard Shortcuts (Ctrl+K or / to search, Esc to clear)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA')) {
      e.preventDefault();
      DOM.searchInput.focus();
      DOM.searchInput.select();
    } else if (e.key === 'Escape' && document.activeElement === DOM.searchInput) {
      DOM.searchInput.value = '';
      AppState.searchQuery = '';
      DOM.clearSearchBtn.style.display = 'none';
      DOM.searchInput.blur();
      applyFilters();
    }
  });

  // Language filter
  DOM.langFilter.addEventListener('click', (e) => {
    const btn = e.target.closest('.segment');
    if (!btn) return;
    DOM.langFilter.querySelectorAll('.segment').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    AppState.currentLang = btn.dataset.lang;
    applyFilters();
  });

  // View modes (all, favorites, recent)
  DOM.viewButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.viewButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.currentView = btn.dataset.view;
      applyFilters();
    });
  });

  // Reset filters button
  DOM.resetFiltersBtn.addEventListener('click', () => {
    AppState.searchQuery = '';
    AppState.currentCategory = 'all';
    AppState.currentLang = 'all';
    AppState.currentView = 'all';
    DOM.searchInput.value = '';
    DOM.clearSearchBtn.style.display = 'none';
    DOM.langFilter.querySelectorAll('.segment').forEach(s => s.classList.toggle('active', s.dataset.lang === 'all'));
    DOM.viewButtons.forEach(b => b.classList.toggle('active', b.dataset.view === 'all'));
    
    document.querySelectorAll('.sidebar .category-nav-item').forEach(b => {
      b.classList.toggle('active', b.dataset.category === 'all');
    });

    applyFilters();
  });

  // Mobile drawer toggles
  if (DOM.mobileFilterToggle) {
    DOM.mobileFilterToggle.addEventListener('click', () => DOM.sidebar.classList.add('mobile-open'));
  }
  if (DOM.closeSidebarBtn) {
    DOM.closeSidebarBtn.addEventListener('click', () => DOM.sidebar.classList.remove('mobile-open'));
  }
}

// Render Category Navigation
function renderCategories() {
  if (!DOM.categoryNav) return;

  const totalCount = AppState.macros.filter(m => m.is_active === 1).length;
  
  let html = `
    <button class="nav-item category-nav-item ${AppState.currentCategory === 'all' ? 'active' : ''}" data-category="all">
      <span class="nav-icon">📂</span>
      <span class="nav-label">Barcha mavzular</span>
      <span class="count-badge">${totalCount}</span>
    </button>
  `;

  AppState.categories.forEach(cat => {
    const count = AppState.macros.filter(m => m.category_id === cat.id && m.is_active === 1).length;
    const isActive = AppState.currentCategory == cat.id ? 'active' : '';
    const icon = cat.icon || '📁';
    html += `
      <button class="nav-item category-nav-item ${isActive}" data-category="${cat.id}">
        <span class="nav-icon">${escapeHtml(icon)}</span>
        <span class="nav-label">${escapeHtml(cat.name)}</span>
        <span class="count-badge">${count}</span>
      </button>
    `;
  });

  DOM.categoryNav.innerHTML = html;

  // Add click handlers
  DOM.categoryNav.querySelectorAll('.category-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.categoryNav.querySelectorAll('.category-nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.currentCategory = btn.dataset.category;
      
      // Close sidebar if on mobile
      if (DOM.sidebar.classList.contains('mobile-open')) {
        DOM.sidebar.classList.remove('mobile-open');
      }

      applyFilters();
    });
  });
}

// Dual-Script Transliteration Helper (Latin <-> Cyrillic)
function getSearchVariants(query) {
  if (!query) return [];
  const q = query.toLowerCase().trim();
  const variants = new Set([q]);

  const cyrToLatMap = {
    'а':'a', 'б':'b', 'в':'v', 'г':'g', 'д':'d', 'е':'e', 'ё':'yo', 'ж':'j',
    'з':'z', 'и':'i', 'й':'y', 'к':'k', 'л':'l', 'м':'m', 'н':'n', 'о':'o',
    'п':'p', 'р':'r', 'с':'s', 'т':'t', 'у':'u', 'ф':'f', 'х':'x', 'ц':'ts',
    'ч':'ch', 'ш':'sh', 'щ':'sh', 'ъ':'', 'ы':'i', 'ь':'', 'э':'e', 'ю':'yu',
    'я':'ya', 'ў':'o', 'қ':'q', 'ғ':'g', 'ҳ':'h'
  };

  const latToCyrMap = {
    'yo':'ё', 'ch':'ч', 'sh':'ш', 'yu':'ю', 'ya':'я', 'ts':'ц',
    'a':'а', 'b':'б', 'v':'в', 'g':'г', 'd':'д', 'e':'е', 'j':'ж', 'z':'з',
    'i':'и', 'y':'й', 'k':'к', 'l':'л', 'm':'м', 'n':'н', 'o':'о', 'p':'п',
    'r':'р', 's':'с', 't':'т', 'u':'у', 'f':'ф', 'x':'х', 'q':'қ', 'h':'ҳ'
  };

  // Convert Cyrillic to Latin
  let asLatin = '';
  for (let i = 0; i < q.length; i++) {
    const char = q[i];
    asLatin += cyrToLatMap[char] !== undefined ? cyrToLatMap[char] : char;
  }
  variants.add(asLatin);

  // Convert Latin to Cyrillic
  let asCyr = q;
  // Multi-char mappings first
  ['yo', 'ch', 'sh', 'yu', 'ya', 'ts'].forEach(m => {
    asCyr = asCyr.replaceAll(m, latToCyrMap[m]);
  });
  let finalCyr = '';
  for (let i = 0; i < asCyr.length; i++) {
    const char = asCyr[i];
    finalCyr += latToCyrMap[char] !== undefined ? latToCyrMap[char] : char;
  }
  variants.add(finalCyr);

  return Array.from(variants).filter(Boolean);
}

// Filtering & Relevance Scoring
function applyFilters() {
  let filtered = AppState.macros.filter(m => m.is_active === 1);

  // 1. View Filter (Favorites / Recent)
  if (AppState.currentView === 'favorites') {
    filtered = filtered.filter(m => AppState.favorites.has(m.id));
  } else if (AppState.currentView === 'recent') {
    filtered = filtered.filter(m => AppState.recentIds.includes(m.id));
    filtered.sort((a, b) => AppState.recentIds.indexOf(a.id) - AppState.recentIds.indexOf(b.id));
  }

  // 2. Category Filter
  if (AppState.currentCategory !== 'all') {
    filtered = filtered.filter(m => m.category_id == AppState.currentCategory);
  }

  // 3. Language Filter
  if (AppState.currentLang !== 'all') {
    filtered = filtered.filter(m => m.language === AppState.currentLang);
  }

  // 4. Advanced Search with Relevance Scoring and Multi-Script support
  if (AppState.searchQuery) {
    const searchVariants = getSearchVariants(AppState.searchQuery);

    const scored = [];
    filtered.forEach(m => {
      let score = 0;
      const title = (m.title || '').toLowerCase();
      const problem = (m.problem_description || '').toLowerCase();
      const keywords = (m.keywords || '').toLowerCase();
      const action = (m.operator_action || '').toLowerCase();
      const response = (m.response_template || '').toLowerCase();

      searchVariants.forEach(q => {
        if (!q) return;
        if (title === q) score += 100;
        else if (title.includes(q)) score += 50;

        if (keywords.includes(q)) score += 40;
        if (problem.includes(q)) score += 25;
        if (action.includes(q)) score += 15;
        if (response.includes(q)) score += 10;
      });

      if (score > 0) {
        // Boost by usage count so frequently used macros float to top
        score += Math.min((m.usage_count || 0) * 0.5, 20);
        scored.push({ macro: m, score });
      }
    });

    // Sort by highest relevance score
    scored.sort((a, b) => b.score - a.score);
    filtered = scored.map(item => item.macro);
  }

  renderMacros(filtered);
  updateActiveFilterPills();
  updateSidebarCounts();
}

// Render Macro Cards
function renderMacros(macros) {
  if (!DOM.macrosGrid) return;

  DOM.resultsCount.textContent = `${macros.length} ta natija topildi`;

  if (macros.length === 0) {
    DOM.macrosGrid.innerHTML = '';
    DOM.emptyState.style.display = 'flex';
    return;
  }

  DOM.emptyState.style.display = 'none';

  const categoryMap = new Map(AppState.categories.map(c => [c.id, c.name]));
  const categoryIconMap = new Map(AppState.categories.map(c => [c.id, c.icon || '📁']));

  DOM.macrosGrid.innerHTML = macros.map(macro => {
    const isFavorite = AppState.favorites.has(macro.id);
    const catName = categoryMap.get(macro.category_id) || 'Umumiy';
    const catIcon = categoryIconMap.get(macro.category_id) || '📁';
    const langClass = (macro.language || 'UZ').toLowerCase();

    return `
      <article class="macro-card" data-macro-id="${macro.id}">
        <div class="macro-card-top">
          <div class="macro-badges">
            <span class="badge badge-category">${catIcon} ${escapeHtml(catName)}</span>
            <span class="badge badge-lang ${langClass}">${escapeHtml(macro.language || 'UZ')}</span>
          </div>
          <div class="macro-actions-top">
            <button class="favorite-btn ${isFavorite ? 'active' : ''}" 
                    title="${isFavorite ? 'Sevimlilardan o‘chirish' : 'Sevimlilarga qo‘shish'}"
                    onclick="toggleFavorite(${macro.id})">
              ${isFavorite ? '★' : '☆'}
            </button>
          </div>
        </div>

        <h3 class="macro-title">${highlightMatch(escapeHtml(macro.title), AppState.searchQuery)}</h3>

        <div class="macro-section">
          <span class="section-label">Muammo tavsifi:</span>
          <p class="macro-problem">${highlightMatch(escapeHtml(macro.problem_description), AppState.searchQuery)}</p>
        </div>

        <div class="macro-section">
          <span class="section-label">Operator nima qilishi kerak:</span>
          <div class="macro-action-box">${highlightMatch(escapeHtml(macro.operator_action), AppState.searchQuery)}</div>
        </div>

        <div class="macro-response-container">
          <span class="section-label">Mijozga yuboriladigan tayyor javob:</span>
          <div class="response-box" id="response-text-${macro.id}">${highlightMatch(escapeHtml(macro.response_template), AppState.searchQuery)}</div>
          <button class="copy-btn" onclick="copyMacroResponse(${macro.id})">
            <span class="btn-icon-inner">📋</span>
            <span class="copy-label">Javobni nusxalash</span>
          </button>
        </div>

        ${macro.notes ? `
          <div class="macro-footer">
            <span class="macro-notes" title="${escapeHtml(macro.notes)}">💡 ${escapeHtml(macro.notes)}</span>
            <span class="usage-count">${macro.usage_count || 0} marta</span>
          </div>
        ` : `
          <div class="macro-footer">
            <span></span>
            <span class="usage-count">${macro.usage_count || 0} marta nusxalandi</span>
          </div>
        `}
      </article>
    `;
  }).join('');
}

// Copy Action + Toast + Usage Record
async function copyMacroResponse(macroId) {
  const macro = AppState.macros.find(m => m.id === macroId);
  if (!macro) return;

  try {
    await navigator.clipboard.writeText(macro.response_template);

    // Visual button feedback
    const card = document.querySelector(`.macro-card[data-macro-id="${macroId}"]`);
    if (card) {
      const copyBtn = card.querySelector('.copy-btn');
      const originalHtml = copyBtn.innerHTML;
      copyBtn.classList.add('copied');
      copyBtn.innerHTML = `<span>✓</span> <span>Nusxalandi!</span>`;
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyBtn.innerHTML = originalHtml;
      }, 1500);
    }

    showToast(`"${macro.title}" javobi nusxalandi!`, 'success');

    // Add to Recent
    addToRecent(macroId);

    // Call API to increment usage
    fetch(`/api/macros/${macroId}/use`, { method: 'POST' }).catch(() => {});
    macro.usage_count = (macro.usage_count || 0) + 1;
    
    // Update usage badge on card if present
    if (card) {
      const usageEl = card.querySelector('.usage-count');
      if (usageEl) usageEl.textContent = `${macro.usage_count} marta nusxalandi`;
    }

  } catch (err) {
    console.error('Nusxalashda xatolik:', err);
    showToast('Clipboardga nusxalash amalga oshmadi!', 'error');
  }
}

// Favorites Toggle
function toggleFavorite(macroId) {
  if (AppState.favorites.has(macroId)) {
    AppState.favorites.delete(macroId);
    showToast('Sevimlilardan olib tashlandi', 'info');
  } else {
    AppState.favorites.add(macroId);
    showToast('Sevimlilarga qo‘shildi ⭐', 'success');
  }

  localStorage.setItem('support_favorites', JSON.stringify(Array.from(AppState.favorites)));
  applyFilters();
}

// Recent Tracker
function addToRecent(macroId) {
  // Remove if exists and put at beginning
  AppState.recentIds = [macroId, ...AppState.recentIds.filter(id => id !== macroId)].slice(0, 20);
  localStorage.setItem('support_recent', JSON.stringify(AppState.recentIds));
  updateSidebarCounts();
}

// Filter pills badge
function updateActiveFilterPills() {
  if (!DOM.activeFilterPills) return;

  const pills = [];

  if (AppState.currentCategory !== 'all') {
    const cat = AppState.categories.find(c => c.id == AppState.currentCategory);
    if (cat) {
      pills.push(`
        <span class="filter-pill">
          ${cat.icon || '📁'} ${escapeHtml(cat.name)}
          <span class="filter-pill-remove" onclick="resetCategoryFilter()">✕</span>
        </span>
      `);
    }
  }

  if (AppState.currentLang !== 'all') {
    pills.push(`
      <span class="filter-pill">
        Til: ${AppState.currentLang}
        <span class="filter-pill-remove" onclick="resetLangFilter()">✕</span>
      </span>
    `);
  }

  if (AppState.currentView !== 'all') {
    const viewName = AppState.currentView === 'favorites' ? '⭐ Sevimlilar' : '🕒 Oxirgi ishlatilganlar';
    pills.push(`
      <span class="filter-pill">
        ${viewName}
        <span class="filter-pill-remove" onclick="resetViewFilter()">✕</span>
      </span>
    `);
  }

  DOM.activeFilterPills.innerHTML = pills.join('');
}

function resetCategoryFilter() {
  AppState.currentCategory = 'all';
  DOM.categoryNav.querySelectorAll('.category-nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.category === 'all');
  });
  applyFilters();
}

function resetLangFilter() {
  AppState.currentLang = 'all';
  DOM.langFilter.querySelectorAll('.segment').forEach(s => {
    s.classList.toggle('active', s.dataset.lang === 'all');
  });
  applyFilters();
}

function resetViewFilter() {
  AppState.currentView = 'all';
  DOM.viewButtons.forEach(b => {
    b.classList.toggle('active', b.dataset.view === 'all');
  });
  applyFilters();
}

// Update counts in sidebar
function updateSidebarCounts() {
  const activeMacros = AppState.macros.filter(m => m.is_active === 1);
  if (DOM.countAll) DOM.countAll.textContent = activeMacros.length;
  if (DOM.countFavorites) DOM.countFavorites.textContent = activeMacros.filter(m => AppState.favorites.has(m.id)).length;
  if (DOM.countRecent) DOM.countRecent.textContent = activeMacros.filter(m => AppState.recentIds.includes(m.id)).length;
  if (DOM.totalMacrosCount) DOM.totalMacrosCount.textContent = activeMacros.length;
  if (DOM.totalCategoriesCount) DOM.totalCategoriesCount.textContent = AppState.categories.length;
}

// Toast Notification
function showToast(message, type = 'info') {
  if (!DOM.toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '⚠️' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;

  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 2200);
}

// Utilities
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function highlightMatch(text, query) {
  if (!query || !text) return text;
  const variants = getSearchVariants(query);
  if (variants.length === 0) return text;

  // Escape each variant for regex and join with |
  const escaped = variants.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.replace(regex, '<mark style="background: rgba(234, 179, 8, 0.35); color: inherit; padding: 0 2px; border-radius: 2px;">$1</mark>');
}

// Export for Admin Panel access
window.SupportApp = {
  AppState,
  loadData,
  showToast,
  renderCategories,
  applyFilters
};
