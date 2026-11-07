/**
 * SUPPORT DESK - ADMIN PANEL CONTROLLER
 * Full CRUD for Macros & Categories, Authentication, and Dashboard Analytics.
 */

const AdminState = {
  token: localStorage.getItem('support_admin_token') || null,
  username: localStorage.getItem('support_admin_user') || null,
  macros: [],
  categories: [],
  stats: null,
  editingMacroId: null
};

// Admin DOM Elements
const AdminDOM = {
  adminOpenBtn: document.getElementById('adminOpenBtn'),
  adminLoginModal: document.getElementById('adminLoginModal'),
  adminLoginForm: document.getElementById('adminLoginForm'),
  adminUsernameInput: document.getElementById('adminUsername'),
  adminPasswordInput: document.getElementById('adminPassword'),
  loginError: document.getElementById('loginError'),
  adminPanelModal: document.getElementById('adminPanelModal'),
  adminLogoutBtn: document.getElementById('adminLogoutBtn'),
  adminTabs: document.querySelectorAll('.admin-tab'),
  tabPanes: document.querySelectorAll('.tab-pane'),
  // Stats elements
  dashTotalMacros: document.getElementById('dashTotalMacros'),
  dashActiveMacros: document.getElementById('dashActiveMacros'),
  dashTotalCategories: document.getElementById('dashTotalCategories'),
  dashTotalUsage: document.getElementById('dashTotalUsage'),
  dashTopMacros: document.getElementById('dashTopMacros'),
  dashRecentCreated: document.getElementById('dashRecentCreated'),
  // Macros management
  adminMacroSearch: document.getElementById('adminMacroSearch'),
  adminCategoryFilter: document.getElementById('adminCategoryFilter'),
  adminStatusFilter: document.getElementById('adminStatusFilter'),
  adminMacrosTbody: document.getElementById('adminMacrosTbody'),
  openNewMacroBtn: document.getElementById('openNewMacroBtn'),
  // Macro form modal
  macroFormModal: document.getElementById('macroFormModal'),
  macroEditorForm: document.getElementById('macroEditorForm'),
  macroModalTitle: document.getElementById('macroModalTitle'),
  editMacroId: document.getElementById('editMacroId'),
  macroTitle: document.getElementById('macroTitle'),
  macroCategory: document.getElementById('macroCategory'),
  macroLanguage: document.getElementById('macroLanguage'),
  macroProblem: document.getElementById('macroProblem'),
  macroOperatorAction: document.getElementById('macroOperatorAction'),
  macroResponse: document.getElementById('macroResponse'),
  macroKeywords: document.getElementById('macroKeywords'),
  macroStatus: document.getElementById('macroStatus'),
  macroNotes: document.getElementById('macroNotes'),
  // Categories management
  newCategoryForm: document.getElementById('newCategoryForm'),
  newCategoryName: document.getElementById('newCategoryName'),
  newCategoryIcon: document.getElementById('newCategoryIcon'),
  adminCategoriesTbody: document.getElementById('adminCategoriesTbody')
};

// Initialize Admin logic
document.addEventListener('DOMContentLoaded', () => {
  setupAdminEvents();
});

function setupAdminEvents() {
  // Open Admin button
  AdminDOM.adminOpenBtn.addEventListener('click', async () => {
    if (AdminState.token) {
      const isValid = await verifyAdminSession();
      if (isValid) {
        openAdminPanel();
        return;
      }
    }
    openLoginModal();
  });

  // Admin login form submission
  AdminDOM.adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    AdminDOM.loginError.style.display = 'none';

    const username = AdminDOM.adminUsernameInput.value.trim();
    const password = AdminDOM.adminPasswordInput.value.trim();

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        AdminDOM.loginError.textContent = data.error || 'Kirishda xatolik yuz berdi';
        AdminDOM.loginError.style.display = 'block';
        return;
      }

      AdminState.token = data.token;
      AdminState.username = data.username;
      localStorage.setItem('support_admin_token', data.token);
      localStorage.setItem('support_admin_user', data.username);

      closeModal('adminLoginModal');
      openAdminPanel();
      window.SupportApp?.showToast('Admin panelga xush kelibsiz!', 'success');
    } catch (err) {
      console.error('Login error:', err);
      AdminDOM.loginError.textContent = 'Server bilan bog‘lanib bo‘lmadi';
      AdminDOM.loginError.style.display = 'block';
    }
  });

  // Admin logout
  AdminDOM.adminLogoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${AdminState.token}` }
      });
    } catch (err) {}

    AdminState.token = null;
    AdminState.username = null;
    localStorage.removeItem('support_admin_token');
    localStorage.removeItem('support_admin_user');

    closeModal('adminPanelModal');
    window.SupportApp?.showToast('Admin panelidan chiqildi', 'info');
  });

  // Tab switching
  AdminDOM.adminTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      AdminDOM.adminTabs.forEach(t => t.classList.remove('active'));
      AdminDOM.tabPanes.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const targetPane = document.getElementById(tab.dataset.tab);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Modal close buttons (data-close-modal)
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modalId = btn.getAttribute('data-close-modal');
      closeModal(modalId);
    });
  });

  // Open New Macro Form
  AdminDOM.openNewMacroBtn.addEventListener('click', () => {
    openMacroModal();
  });

  // Save Macro (Create or Update)
  AdminDOM.macroEditorForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveMacro();
  });

  // Filter in Admin Macros Table
  AdminDOM.adminMacroSearch.addEventListener('input', filterAdminMacros);
  AdminDOM.adminCategoryFilter.addEventListener('change', filterAdminMacros);
  AdminDOM.adminStatusFilter.addEventListener('change', filterAdminMacros);

  // New Category Form
  AdminDOM.newCategoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await createCategory();
  });
}

// Session check
async function verifyAdminSession() {
  if (!AdminState.token) return false;
  try {
    const res = await fetch('/api/admin/check', {
      headers: { 'Authorization': `Bearer ${AdminState.token}` }
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

function openLoginModal() {
  AdminDOM.loginError.style.display = 'none';
  AdminDOM.adminPasswordInput.value = '';
  AdminDOM.adminLoginModal.style.display = 'flex';
  setTimeout(() => AdminDOM.adminPasswordInput.focus(), 100);
}

function openAdminPanel() {
  AdminDOM.adminPanelModal.style.display = 'flex';
  loadAdminDashboard();
  loadAdminMacros();
  loadAdminCategories();
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'none';
}

// Load Dashboard Analytics
async function loadAdminDashboard() {
  try {
    const res = await fetch('/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${AdminState.token}` }
    });
    if (!res.ok) return;

    const stats = await res.json();
    AdminState.stats = stats;

    AdminDOM.dashTotalMacros.textContent = stats.totalMacros;
    AdminDOM.dashActiveMacros.textContent = stats.activeMacros;
    AdminDOM.dashTotalCategories.textContent = stats.totalCategories;
    AdminDOM.dashTotalUsage.textContent = stats.totalUsage;

    // Top Macros
    if (stats.topMacros && stats.topMacros.length > 0) {
      AdminDOM.dashTopMacros.innerHTML = stats.topMacros.map(m => `
        <li class="mini-list-item">
          <span>${escapeAdminHtml(m.title)} <small class="text-muted">(${m.language})</small></span>
          <strong>${m.usage_count} marta</strong>
        </li>
      `).join('');
    } else {
      AdminDOM.dashTopMacros.innerHTML = '<li class="empty-list">Hozircha foydalanish statistikasi yo‘q</li>';
    }

    // Recent Macros
    if (stats.recentCreated && stats.recentCreated.length > 0) {
      AdminDOM.dashRecentCreated.innerHTML = stats.recentCreated.map(m => `
        <li class="mini-list-item">
          <span>${escapeAdminHtml(m.title)}</span>
          <span class="badge badge-category">${m.language}</span>
        </li>
      `).join('');
    } else {
      AdminDOM.dashRecentCreated.innerHTML = '<li class="empty-list">Makroslar mavjud emas</li>';
    }

  } catch (err) {
    console.error('Error loading admin stats:', err);
  }
}

// Load Macros in Admin Table
async function loadAdminMacros() {
  try {
    const res = await fetch('/api/admin/macros', {
      headers: { 'Authorization': `Bearer ${AdminState.token}` }
    });
    if (!res.ok) return;

    AdminState.macros = await res.json();
    filterAdminMacros();
  } catch (err) {
    console.error('Error loading admin macros:', err);
  }
}

function filterAdminMacros() {
  const query = AdminDOM.adminMacroSearch.value.trim().toLowerCase();
  const categoryId = AdminDOM.adminCategoryFilter.value;
  const status = AdminDOM.adminStatusFilter.value;

  let filtered = AdminState.macros;

  if (categoryId !== 'all') {
    filtered = filtered.filter(m => m.category_id == categoryId);
  }

  if (status === 'active') {
    filtered = filtered.filter(m => m.is_active === 1);
  } else if (status === 'inactive') {
    filtered = filtered.filter(m => m.is_active === 0);
  }

  if (query) {
    filtered = filtered.filter(m => 
      (m.title && m.title.toLowerCase().includes(query)) ||
      (m.problem_description && m.problem_description.toLowerCase().includes(query)) ||
      (m.keywords && m.keywords.toLowerCase().includes(query))
    );
  }

  renderAdminMacrosTable(filtered);
}

function renderAdminMacrosTable(list) {
  if (!AdminDOM.adminMacrosTbody) return;

  if (list.length === 0) {
    AdminDOM.adminMacrosTbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center" style="padding: 2rem; color: var(--text-muted);">
          Mos keluvchi makros topilmadi
        </td>
      </tr>
    `;
    return;
  }

  AdminDOM.adminMacrosTbody.innerHTML = list.map(m => `
    <tr>
      <td>
        <strong style="display:block; margin-bottom: 2px;">${escapeAdminHtml(m.title)}</strong>
        <small style="color: var(--text-muted);">${escapeAdminHtml((m.problem_description || '').substring(0, 75))}...</small>
      </td>
      <td>
        <span class="badge badge-category">${m.category_icon || '📁'} ${escapeAdminHtml(m.category_name)}</span>
      </td>
      <td>
        <span class="badge badge-lang ${m.language.toLowerCase()}">${m.language}</span>
      </td>
      <td>
        <span class="status-badge ${m.is_active === 1 ? 'status-active' : 'status-inactive'}">
          ${m.is_active === 1 ? 'Faol' : 'Faolsiz'}
        </span>
      </td>
      <td>${m.usage_count || 0}</td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-sm btn-outline" title="Faollikni o‘zgartirish" onclick="toggleMacroStatus(${m.id})">
            ${m.is_active === 1 ? '⏸️' : '▶️'}
          </button>
          <button class="btn btn-sm btn-outline" title="Nusxa olish" onclick="duplicateMacro(${m.id})">
            📄
          </button>
          <button class="btn btn-sm btn-outline" title="Tahrirlash" onclick="openMacroModal(${m.id})">
            ✏️
          </button>
          <button class="btn btn-sm btn-outline" style="color: var(--danger);" title="O‘chirish" onclick="deleteMacro(${m.id})">
            🗑️
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Load Categories in Admin Panel
async function loadAdminCategories() {
  try {
    const res = await fetch('/api/categories');
    if (!res.ok) return;

    AdminState.categories = await res.json();
    populateCategoryDropdowns();
    renderAdminCategoriesTable();
  } catch (err) {
    console.error('Error loading admin categories:', err);
  }
}

function populateCategoryDropdowns() {
  // Populate filter dropdown
  const filterVal = AdminDOM.adminCategoryFilter.value;
  let options = '<option value="all">Barcha kategoriyalar</option>';
  AdminState.categories.forEach(cat => {
    options += `<option value="${cat.id}">${cat.icon || '📁'} ${escapeAdminHtml(cat.name)}</option>`;
  });
  AdminDOM.adminCategoryFilter.innerHTML = options;
  AdminDOM.adminCategoryFilter.value = filterVal || 'all';

  // Populate macro modal form category select
  let formOptions = '';
  AdminState.categories.forEach(cat => {
    formOptions += `<option value="${cat.id}">${cat.icon || '📁'} ${escapeAdminHtml(cat.name)}</option>`;
  });
  AdminDOM.macroCategory.innerHTML = formOptions;
}

function renderAdminCategoriesTable() {
  if (!AdminDOM.adminCategoriesTbody) return;

  AdminDOM.adminCategoriesTbody.innerHTML = AdminState.categories.map(cat => `
    <tr>
      <td class="text-center" style="font-size: 1.2rem;">${cat.icon || '📁'}</td>
      <td><strong>${escapeAdminHtml(cat.name)}</strong></td>
      <td><span class="count-badge">${cat.macro_count || 0} ta makros</span></td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-sm btn-outline" title="Tahrirlash" onclick="editCategoryPrompt(${cat.id}, '${escapeAdminHtml(cat.name)}', '${cat.icon || '📁'}')">
            ✏️ Tahrirlash
          </button>
          <button class="btn btn-sm btn-outline" style="color: var(--danger);" title="O‘chirish" onclick="deleteCategory(${cat.id})">
            🗑️ O‘chirish
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Open Macro Modal (New or Edit)
function openMacroModal(macroId = null) {
  AdminState.editingMacroId = macroId;
  populateCategoryDropdowns();

  if (macroId) {
    const macro = AdminState.macros.find(m => m.id === macroId);
    if (!macro) return;

    AdminDOM.macroModalTitle.textContent = 'Makrosni tahrirlash';
    AdminDOM.editMacroId.value = macro.id;
    AdminDOM.macroTitle.value = macro.title;
    AdminDOM.macroCategory.value = macro.category_id;
    AdminDOM.macroLanguage.value = macro.language || 'UZ';
    AdminDOM.macroProblem.value = macro.problem_description || '';
    AdminDOM.macroOperatorAction.value = macro.operator_action || '';
    AdminDOM.macroResponse.value = macro.response_template || '';
    AdminDOM.macroKeywords.value = macro.keywords || '';
    AdminDOM.macroStatus.value = String(macro.is_active);
    AdminDOM.macroNotes.value = macro.notes || '';
  } else {
    AdminDOM.macroModalTitle.textContent = 'Yangi makros qo‘shish';
    AdminDOM.macroEditorForm.reset();
    AdminDOM.editMacroId.value = '';
    AdminDOM.macroStatus.value = '1';
    AdminDOM.macroLanguage.value = 'UZ';
  }

  AdminDOM.macroFormModal.style.display = 'flex';
}

// Save Macro
async function saveMacro() {
  const isEdit = Boolean(AdminState.editingMacroId);
  const payload = {
    title: AdminDOM.macroTitle.value.trim(),
    category_id: Number(AdminDOM.macroCategory.value),
    language: AdminDOM.macroLanguage.value,
    problem_description: AdminDOM.macroProblem.value.trim(),
    operator_action: AdminDOM.macroOperatorAction.value.trim(),
    response_template: AdminDOM.macroResponse.value.trim(),
    keywords: AdminDOM.macroKeywords.value.trim(),
    is_active: Number(AdminDOM.macroStatus.value),
    notes: AdminDOM.macroNotes.value.trim()
  };

  try {
    const url = isEdit ? `/api/admin/macros/${AdminState.editingMacroId}` : '/api/admin/macros';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AdminState.token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Saqlashda xatolik yuz berdi');
      return;
    }

    closeModal('macroFormModal');
    window.SupportApp?.showToast(isEdit ? 'Makros yangilandi!' : 'Yangi makros saqlandi!', 'success');

    // Refresh Admin list, Dashboard, and live Operator panel
    await Promise.all([
      loadAdminMacros(),
      loadAdminDashboard(),
      window.SupportApp?.loadData()
    ]);

  } catch (err) {
    console.error('Error saving macro:', err);
    alert('Server bilan bog‘lanishda xatolik');
  }
}

// Toggle Macro Active Status
async function toggleMacroStatus(id) {
  try {
    const res = await fetch(`/api/admin/macros/${id}/toggle`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AdminState.token}` }
    });
    if (res.ok) {
      window.SupportApp?.showToast('Holat o‘zgartirildi', 'info');
      await Promise.all([
        loadAdminMacros(),
        loadAdminDashboard(),
        window.SupportApp?.loadData()
      ]);
    }
  } catch (err) {
    console.error('Error toggling macro:', err);
  }
}

// Duplicate Macro
async function duplicateMacro(id) {
  try {
    const res = await fetch(`/api/admin/macros/${id}/duplicate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AdminState.token}` }
    });
    if (res.ok) {
      window.SupportApp?.showToast('Makros nusxasi yaratildi!', 'success');
      await Promise.all([
        loadAdminMacros(),
        loadAdminDashboard(),
        window.SupportApp?.loadData()
      ]);
    }
  } catch (err) {
    console.error('Error duplicating macro:', err);
  }
}

// Delete Macro
async function deleteMacro(id) {
  if (!confirm('Rostdan ham ushbu makrosni o‘chirmoqchimisiz?')) return;

  try {
    const res = await fetch(`/api/admin/macros/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${AdminState.token}` }
    });
    if (res.ok) {
      window.SupportApp?.showToast('Makros o‘chirildi', 'info');
      await Promise.all([
        loadAdminMacros(),
        loadAdminDashboard(),
        window.SupportApp?.loadData()
      ]);
    }
  } catch (err) {
    console.error('Error deleting macro:', err);
  }
}

// Category CRUD
async function createCategory() {
  const name = AdminDOM.newCategoryName.value.trim();
  const icon = AdminDOM.newCategoryIcon.value.trim() || '📁';
  if (!name) return;

  try {
    const res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AdminState.token}`
      },
      body: JSON.stringify({ name, icon })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Kategoriya yaratishda xatolik');
      return;
    }

    AdminDOM.newCategoryName.value = '';
    AdminDOM.newCategoryIcon.value = '';
    window.SupportApp?.showToast('Yangi kategoriya qo‘shildi!', 'success');

    await Promise.all([
      loadAdminCategories(),
      loadAdminDashboard(),
      window.SupportApp?.loadData()
    ]);
  } catch (err) {
    console.error('Error creating category:', err);
  }
}

async function editCategoryPrompt(id, currentName, currentIcon) {
  const newName = prompt('Kategoriya yangi nomini kiriting:', currentName);
  if (!newName || newName.trim() === '') return;

  const newIcon = prompt('Kategoriya belgisini (icon) kiriting:', currentIcon) || currentIcon;

  try {
    const res = await fetch(`/api/admin/categories/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AdminState.token}`
      },
      body: JSON.stringify({ name: newName.trim(), icon: newIcon.trim() })
    });

    if (res.ok) {
      window.SupportApp?.showToast('Kategoriya yangilandi!', 'success');
      await Promise.all([
        loadAdminCategories(),
        loadAdminMacros(),
        window.SupportApp?.loadData()
      ]);
    }
  } catch (err) {
    console.error('Error updating category:', err);
  }
}

async function deleteCategory(id) {
  if (!confirm('Rostdan ham ushbu kategoriyani o‘chirmoqchimisiz?')) return;

  try {
    const res = await fetch(`/api/admin/categories/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${AdminState.token}` }
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Kategoriyani o‘chirib bo‘lmadi');
      return;
    }

    window.SupportApp?.showToast('Kategoriya o‘chirildi', 'info');
    await Promise.all([
      loadAdminCategories(),
      loadAdminDashboard(),
      window.SupportApp?.loadData()
    ]);
  } catch (err) {
    console.error('Error deleting category:', err);
  }
}

function escapeAdminHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Global exports for inline onclick attributes
window.openMacroModal = openMacroModal;
window.toggleMacroStatus = toggleMacroStatus;
window.duplicateMacro = duplicateMacro;
window.deleteMacro = deleteMacro;
window.editCategoryPrompt = editCategoryPrompt;
window.deleteCategory = deleteCategory;
