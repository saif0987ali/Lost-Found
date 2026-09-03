import { dbService } from './firebase-config.js';
import confetti from 'canvas-confetti';

// State Management
let state = {
  items: [],
  filteredItems: [],
  myItems: [],
  currentFilters: {
    search: '',
    type: 'all',
    category: 'all',
    location: 'all',
    date: 'all'
  },
  selectedItem: null,
  activeFormStep: 1,
  userEmail: ''
};

// DOM Elements cache
const el = {
  dbStatusBar: document.getElementById('db-status-bar'),
  dbStatusText: document.getElementById('db-status-text'),
  
  // Pages
  pages: {
    home: document.getElementById('page-home'),
    browse: document.getElementById('page-browse'),
    report: document.getElementById('page-report'),
    dashboard: document.getElementById('page-dashboard'),
    config: document.getElementById('page-config')
  },
  
  // Nav links
  navLinks: document.querySelectorAll('.nav-link'),
  
  // Browse elements
  searchBar: document.getElementById('search-bar'),
  filterTypeInputs: document.querySelectorAll('.radio-tab-input'),
  filterCategory: document.getElementById('filter-category'),
  filterLocation: document.getElementById('filter-location'),
  filterDate: document.getElementById('filter-date'),
  resetFiltersBtn: document.getElementById('reset-filters'),
  listingsGrid: document.getElementById('listings-grid'),
  resultsCount: document.getElementById('results-count'),
  
  // Stats
  statActive: document.getElementById('stat-active'),
  statResolved: document.getElementById('stat-resolved'),
  statLost: document.getElementById('stat-lost'),
  statFound: document.getElementById('stat-found'),
  
  // Modal
  modalOverlay: document.getElementById('modal-overlay'),
  modalClose: document.getElementById('modal-close'),
  modalHeaderHero: document.getElementById('modal-header-hero'),
  modalHeroImage: document.getElementById('modal-hero-image'),
  modalHeroBadge: document.getElementById('modal-hero-badge'),
  modalCategory: document.getElementById('modal-category'),
  modalTitle: document.getElementById('modal-title'),
  modalLocation: document.getElementById('modal-location'),
  modalDate: document.getElementById('modal-date'),
  modalDescription: document.getElementById('modal-description'),
  modalContactCard: document.getElementById('modal-contact-card'),
  modalClaimPanel: document.getElementById('modal-claim-panel'),
  
  // Report Form
  reportForm: document.getElementById('report-item-form'),
  formSections: document.querySelectorAll('.form-section'),
  stepDots: document.querySelectorAll('.step-dot'),
  btnPrevStep: document.getElementById('btn-prev-step'),
  btnNextStep: document.getElementById('btn-next-step'),
  btnSubmitForm: document.getElementById('btn-submit-form'),
  
  // My Dashboard
  myListingsTableBody: document.getElementById('my-listings-table-body'),
  userEmailInput: document.getElementById('user-email-input'),
  btnLoadDashboard: document.getElementById('btn-load-dashboard'),
  dashboardContent: document.getElementById('dashboard-content'),
  dashboardEmailPrompt: document.getElementById('dashboard-email-prompt'),
  
  // Config
  configForm: document.getElementById('firebase-setup-form'),
  apiKey: document.getElementById('cfg-apikey'),
  authDomain: document.getElementById('cfg-authdomain'),
  projectId: document.getElementById('cfg-projectid'),
  storageBucket: document.getElementById('cfg-storagebucket'),
  messagingSenderId: document.getElementById('cfg-messagingsenderid'),
  appId: document.getElementById('cfg-appid'),
  btnTestSaveConfig: document.getElementById('btn-save-config'),
  btnClearConfig: document.getElementById('btn-clear-config'),
  configStatusMsg: document.getElementById('config-status-msg')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Init Database Service (connects to Firestore or falls back)
  const isFirebaseConnected = await dbService.init();
  updateDbStatusUI(isFirebaseConnected);
  
  // 2. Load Init Configuration values if present
  populateConfigFields();
  
  // 3. Set Router
  window.addEventListener('hashchange', router);
  router(); // trigger initial route
  
  // 4. Register Event Listeners
  registerEventListeners();
  bindImageUploadEvents();
  
  // 5. Load Items & update stats
  await refreshData();
});

// SPA Client-side Router
function router() {
  const hash = window.location.hash || '#/';
  
  // Deactivate all page sections
  Object.values(el.pages).forEach(page => page.classList.remove('active'));
  el.navLinks.forEach(link => link.classList.remove('active'));
  
  // Reset scroll position
  window.scrollTo(0, 0);

  if (hash === '#/' || hash === '') {
    el.pages.home.classList.add('active');
    document.querySelector('[href="#/"]').classList.add('active');
    refreshStats();
  } else if (hash.startsWith('#/browse')) {
    el.pages.browse.classList.add('active');
    document.querySelector('[href="#/browse"]').classList.add('active');
    // Read optional search query parameter from hash
    const params = new URLSearchParams(hash.split('?')[1]);
    if (params.has('q')) {
      el.searchBar.value = params.get('q');
      state.currentFilters.search = params.get('q');
    }
    applyFilters();
  } else if (hash === '#/report') {
    el.pages.report.classList.add('active');
    document.querySelector('[href="#/report"]').classList.add('active');
    resetReportForm();
  } else if (hash === '#/dashboard') {
    el.pages.dashboard.classList.add('active');
    document.querySelector('[href="#/dashboard"]').classList.add('active');
    renderDashboard();
  } else if (hash === '#/config') {
    el.pages.config.classList.add('active');
    const configLink = document.querySelector('[href="#/config"]');
    if (configLink) configLink.classList.add('active');
  }
}

// Event Registration
function registerEventListeners() {
  // Navigation actions from home
  document.getElementById('cta-lost').addEventListener('click', () => {
    window.location.hash = '#/report';
    // Small delay to ensure route renders first
    setTimeout(() => {
      document.getElementById('item-type-lost').checked = true;
    }, 50);
  });
  
  document.getElementById('cta-found').addEventListener('click', () => {
    window.location.hash = '#/report';
    setTimeout(() => {
      document.getElementById('item-type-found').checked = true;
    }, 50);
  });
  
  document.getElementById('home-search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const query = document.getElementById('home-search-input').value.trim();
    window.location.hash = `#/browse?q=${encodeURIComponent(query)}`;
  });
  
  // Browse Filter Listeners
  el.searchBar.addEventListener('input', (e) => {
    state.currentFilters.search = e.target.value;
    applyFilters();
  });
  
  el.filterTypeInputs.forEach(input => {
    input.addEventListener('change', (e) => {
      state.currentFilters.type = e.target.value;
      applyFilters();
    });
  });
  
  el.filterCategory.addEventListener('change', (e) => {
    state.currentFilters.category = e.target.value;
    applyFilters();
  });
  
  el.filterLocation.addEventListener('change', (e) => {
    state.currentFilters.location = e.target.value;
    applyFilters();
  });
  
  el.filterDate.addEventListener('change', (e) => {
    state.currentFilters.date = e.target.value;
    applyFilters();
  });
  
  el.resetFiltersBtn.addEventListener('click', () => {
    el.searchBar.value = '';
    el.filterCategory.value = 'all';
    el.filterLocation.value = 'all';
    el.filterDate.value = 'all';
    document.getElementById('type-all').checked = true;
    
    state.currentFilters = {
      search: '',
      type: 'all',
      category: 'all',
      location: 'all',
      date: 'all'
    };
    applyFilters();
  });
  
  // Modal Close
  el.modalClose.addEventListener('click', closeModal);
  el.modalOverlay.addEventListener('click', (e) => {
    if (e.target === el.modalOverlay) closeModal();
  });
  
  // Report Form Navigation
  el.btnPrevStep.addEventListener('click', () => handleFormStep(-1));
  el.btnNextStep.addEventListener('click', () => handleFormStep(1));
  el.reportForm.addEventListener('submit', handleFormSubmit);
  
  // Dashboard Load
  el.btnLoadDashboard.addEventListener('click', () => {
    const email = el.userEmailInput.value.trim().toLowerCase();
    if (email && validateEmail(email)) {
      state.userEmail = email;
      localStorage.setItem('univ_lost_found_user_email', email);
      renderDashboard();
    } else {
      alert("Access Denied: Only student emails ending with @galgotiasuniversity.ac.in are authorized.");
    }
  });
  
  // Configuration save/clear
  el.configForm.addEventListener('submit', handleConfigSave);
  el.btnClearConfig.addEventListener('click', handleConfigClear);
}

// Refresh statistics & state items
async function refreshData() {
  try {
    state.items = await dbService.getItems();
    applyFilters();
    refreshStats();
  } catch (error) {
    console.error("Error refreshing data:", error);
  }
}

async function refreshStats() {
  const stats = await dbService.getStats();
  if (el.statActive) el.statActive.innerText = stats.active;
  if (el.statResolved) el.statResolved.innerText = stats.resolved;
  if (el.statLost) el.statLost.innerText = stats.lost;
  if (el.statFound) el.statFound.innerText = stats.found;
}

// Render Item Cards
function renderItemCards(items) {
  el.listingsGrid.innerHTML = '';
  
  if (items.length === 0) {
    el.listingsGrid.innerHTML = `
      <div class="no-results">
        <i class="fas fa-search"></i>
        <h3>No Listings Found</h3>
        <p>Try clearing your search query or adjusting your filters.</p>
      </div>
    `;
    el.resultsCount.innerText = '0 items';
    return;
  }
  
  el.resultsCount.innerText = `${items.length} item${items.length > 1 ? 's' : ''}`;
  
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.setAttribute('data-id', item.id);
    
    // Status color
    const isResolved = item.status === 'resolved' || item.status === 'claimed';
    const statusDotClass = isResolved ? 'card-status-dot resolved' : 'card-status-dot';
    
    const fallbackImages = {
      electronics: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=600&q=80",
      documents: "https://images.unsplash.com/photo-1598257006458-087169a1f08d?auto=format&fit=crop&w=600&q=80",
      accessories: "https://images.unsplash.com/photo-1581605405669-fcdf81165afa?auto=format&fit=crop&w=600&q=80",
      books: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80",
      clothing: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=600&q=80",
      keys: "https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=600&q=80",
      other: "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=600&q=80"
    };

    const imageUrl = item.image || fallbackImages[item.category] || fallbackImages.other;
    
    card.innerHTML = `
      <div class="card-image-wrapper">
        <span class="card-badge ${item.type}">${item.type}</span>
        <div class="${statusDotClass}" title="Status: ${item.status}"></div>
        <img class="card-image" src="${imageUrl}" alt="${escapeHtml(item.title)}" onerror="this.src='${fallbackImages.other}';">
      </div>
      <div class="card-content">
        <span class="card-category">${item.category}</span>
        <h3 class="card-title">${escapeHtml(item.title)}</h3>
        <p class="card-description">${escapeHtml(item.description)}</p>
        <div class="card-meta">
          <span><i class="fas fa-map-marker-alt"></i> ${escapeHtml(item.location)}</span>
          <span><i class="far fa-calendar-alt"></i> ${formatDate(item.date)}</span>
        </div>
      </div>
    `;
    
    card.addEventListener('click', () => openItemDetail(item));
    el.listingsGrid.appendChild(card);
  });
}

// Multi-criteria Filter engine
function applyFilters() {
  const { search, type, category, location, date } = state.currentFilters;
  
  state.filteredItems = state.items.filter(item => {
    // 1. Search text filter (matches title or description or location)
    if (search) {
      const q = search.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      const matchLoc = item.location.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchLoc) return false;
    }
    
    // 2. Type filter
    if (type !== 'all' && item.type !== type) return false;
    
    // 3. Category filter
    if (category !== 'all' && item.category !== category) return false;
    
    // 4. Location filter
    if (location !== 'all' && !item.location.toLowerCase().includes(location.toLowerCase())) return false;
    
    // 5. Date filter
    if (date !== 'all') {
      const itemDate = new Date(item.date);
      const today = new Date();
      const diffTime = Math.abs(today - itemDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (date === 'today' && diffDays > 1) return false;
      if (date === '3days' && diffDays > 3) return false;
      if (date === 'week' && diffDays > 7) return false;
      if (date === 'month' && diffDays > 30) return false;
    }
    
    return true;
  });
  
  renderItemCards(state.filteredItems);
}

// Modal Detail View
function openItemDetail(item) {
  state.selectedItem = item;
  
  const fallbackImages = {
    electronics: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=600&q=80",
    documents: "https://images.unsplash.com/photo-1598257006458-087169a1f08d?auto=format&fit=crop&w=600&q=80",
    accessories: "https://images.unsplash.com/photo-1581605405669-fcdf81165afa?auto=format&fit=crop&w=600&q=80",
    books: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80",
    clothing: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=600&q=80",
    keys: "https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=600&q=80",
    other: "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=600&q=80"
  };

  const imageUrl = item.image || fallbackImages[item.category] || fallbackImages.other;
  
  el.modalHeroImage.src = imageUrl;
  el.modalHeroImage.onerror = () => { el.modalHeroImage.src = fallbackImages.other; };
  
  el.modalHeroBadge.innerText = item.type;
  el.modalHeroBadge.className = `modal-hero-badge ${item.type}`;
  
  el.modalCategory.innerText = item.category;
  el.modalTitle.innerText = item.title;
  el.modalLocation.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${item.location}`;
  el.modalDate.innerHTML = `<i class="far fa-calendar-alt"></i> Found/Lost on: ${formatDate(item.date)}`;
  el.modalDescription.innerText = item.description;
  
  // Build contact card details
  const isClaimed = item.status === 'claimed' || item.status === 'resolved';
  
  if (isClaimed) {
    el.modalContactCard.style.display = 'none';
    el.modalClaimPanel.innerHTML = `
      <div style="text-align: center; color: var(--found-color); padding: 1rem; border: 1px solid var(--found-color); border-radius: var(--border-radius-md); background: rgba(16,185,129,0.05); font-weight: 600;">
        <i class="fas fa-check-circle"></i> This item has been successfully resolved and claimed!
      </div>
    `;
  } else {
    el.modalContactCard.style.display = 'block';
    document.getElementById('modal-contact-name').innerText = item.contactName;
    document.getElementById('modal-contact-email').innerText = item.contactEmail;
    document.getElementById('modal-contact-phone').innerText = item.contactPhone || 'N/A';
    
    // Setup Claiming/Contact Panel
    if (item.type === 'found') {
      // It's a found item, let's challenge them with the secret validation question if set
      if (item.secretQuestion) {
        el.modalClaimPanel.innerHTML = `
          <div class="claim-panel">
            <h4 style="margin-bottom: 0.5rem; font-size: 1rem;"><i class="fas fa-shield-alt" style="color: var(--primary);"></i> Owner Verification Needed</h4>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">The finder left a security question to verify ownership:</p>
            <blockquote style="background: rgba(255,255,255,0.02); border-left: 3px solid var(--primary); padding: 0.75rem; font-style: italic; font-size: 0.9rem; color: var(--text-main); margin-bottom: 1.25rem;">
              "${escapeHtml(item.secretQuestion)}"
            </blockquote>
            <div class="verify-form">
              <div class="verify-input-group">
                <label for="claim-owner-answer">Your Answer / Proof of Ownership</label>
                <textarea id="claim-owner-answer" class="input-control" placeholder="Describe the item details that prove it belongs to you..." style="min-height: 80px; font-size: 0.85rem;"></textarea>
              </div>
              <button id="btn-submit-claim" class="btn-primary">Submit Claim Request</button>
            </div>
          </div>
        `;
        document.getElementById('btn-submit-claim').addEventListener('click', () => submitClaimRequest(item, true));
      } else {
        el.modalClaimPanel.innerHTML = `
          <div class="claim-panel">
            <button id="btn-claim-direct" class="btn-primary"><i class="far fa-handshake"></i> Send Claim Request</button>
          </div>
        `;
        document.getElementById('btn-claim-direct').addEventListener('click', () => submitClaimRequest(item, false));
      }
    } else {
      // It's a lost item, they found it!
      el.modalClaimPanel.innerHTML = `
        <div class="claim-panel">
          <button id="btn-i-found-it" class="btn-primary" style="background: linear-gradient(135deg, var(--found-color) 0%, #059669 100%); box-shadow: 0 4px 15px var(--found-glow);"><i class="fas fa-gift"></i> I Found This Item!</button>
        </div>
      `;
      document.getElementById('btn-i-found-it').addEventListener('click', () => reportMatchingFoundItem(item));
    }
  }

  el.modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  el.modalOverlay.classList.remove('active');
  document.body.style.overflow = '';
  state.selectedItem = null;
}

// Claim Requests submission
function submitClaimRequest(item, hasSecretQuestion) {
  let userProof = "";
  if (hasSecretQuestion) {
    userProof = document.getElementById('claim-owner-answer').value.trim();
    if (!userProof) {
      alert("Please provide an answer to prove your ownership.");
      return;
    }
  }

  // Simulate claim submission email/db matching notification
  el.modalClaimPanel.innerHTML = `
    <div style="text-align: center; padding: 1.5rem 1rem; border: 1px solid var(--primary); border-radius: var(--border-radius-md); background: rgba(99,102,241,0.05); animation: pageFadeIn 0.3s;">
      <i class="fas fa-paper-plane" style="color: var(--primary); font-size: 2rem; margin-bottom: 0.75rem;"></i>
      <h4 style="margin-bottom: 0.5rem;">Claim Request Sent!</h4>
      <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">
        We have forwarded your request and contact details to <strong>${escapeHtml(item.contactName)}</strong>. They will verify your details and get in touch with you shortly.
      </p>
    </div>
  `;
  
  confetti({
    particleCount: 50,
    spread: 60,
    origin: { y: 0.8 }
  });
}

function reportMatchingFoundItem(lostItem) {
  // Guide user to the report form and pre-fill details to match
  closeModal();
  window.location.hash = '#/report';
  setTimeout(() => {
    document.getElementById('item-type-found').checked = true;
    document.getElementById('item-title').value = `Found: ${lostItem.title.replace('Lost: ', '').replace('Lost:', '')}`;
    document.getElementById('item-category').value = lostItem.category;
    document.getElementById('item-location').value = lostItem.location;
    document.getElementById('item-description').value = `Replying to listing ID ${lostItem.id}. I found this matching item...`;
  }, 100);
}

// Multi-step form controller
function handleFormStep(direction) {
  const steps = [1, 2, 3];
  const nextStep = state.activeFormStep + direction;
  
  if (nextStep < 1 || nextStep > 3) return;
  
  // Validation for Step 1 -> Step 2
  if (direction === 1 && state.activeFormStep === 1) {
    const title = document.getElementById('item-title').value.trim();
    const desc = document.getElementById('item-description').value.trim();
    if (!title || !desc) {
      alert("Please fill in the Item Title and Description.");
      return;
    }
  }
  
  // Validation for Step 2 -> Step 3
  if (direction === 1 && state.activeFormStep === 2) {
    const location = document.getElementById('item-location').value.trim();
    const date = document.getElementById('item-date').value;
    if (!location || !date) {
      alert("Please provide the Campus Location and Date.");
      return;
    }
  }
  
  // Update state & UI
  state.activeFormStep = nextStep;
  
  // Update section active classes
  el.formSections.forEach((section, index) => {
    section.classList.toggle('active', index === (state.activeFormStep - 1));
  });
  
  // Update step indicators
  el.stepDots.forEach((dot, index) => {
    dot.classList.remove('active', 'completed');
    if (index === (state.activeFormStep - 1)) {
      dot.classList.add('active');
    } else if (index < (state.activeFormStep - 1)) {
      dot.classList.add('completed');
    }
  });
  
  // Toggle navigation buttons
  el.btnPrevStep.style.display = state.activeFormStep === 1 ? 'none' : 'block';
  el.btnNextStep.style.display = state.activeFormStep === 3 ? 'none' : 'block';
  el.btnSubmitForm.style.display = state.activeFormStep === 3 ? 'block' : 'none';
}

function resetReportForm() {
  state.activeFormStep = 1;
  el.reportForm.reset();
  
  // Set default date in form
  const todayStr = new Date().toISOString().split('T')[0];
  document.getElementById('item-date').value = todayStr;
  
  // Reset UI
  el.formSections.forEach((section, index) => {
    section.classList.toggle('active', index === 0);
  });
  el.stepDots.forEach((dot, index) => {
    dot.classList.remove('active', 'completed');
    if (index === 0) dot.classList.add('active');
  });
  
  el.btnPrevStep.style.display = 'none';
  el.btnNextStep.style.display = 'block';
  el.btnSubmitForm.style.display = 'none';
  
  // Clear file upload previews
  const fileInput = document.getElementById('item-image-file');
  const hiddenInput = document.getElementById('item-image');
  const previewContainer = document.getElementById('image-preview-container');
  const previewImage = document.getElementById('image-upload-preview');
  if (fileInput) fileInput.value = '';
  if (hiddenInput) hiddenInput.value = '';
  if (previewImage) previewImage.src = '';
  if (previewContainer) previewContainer.style.display = 'none';

  // Clear any previous match notifications
  const matchContainer = document.getElementById('new-item-matches-container');
  if (matchContainer) matchContainer.innerHTML = '';
}

function bindImageUploadEvents() {
  const fileInput = document.getElementById('item-image-file');
  const hiddenInput = document.getElementById('item-image');
  const previewContainer = document.getElementById('image-preview-container');
  const previewImage = document.getElementById('image-upload-preview');
  const removeButton = document.getElementById('btn-remove-image');

  if (!fileInput) return;

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (limit to 1.5MB for storage economy)
      if (file.size > 1.5 * 1024 * 1024) {
        alert("Image is too large. Please select a picture smaller than 1.5MB.");
        fileInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target.result;
        hiddenInput.value = base64Data;
        previewImage.src = base64Data;
        previewContainer.style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
  });

  if (removeButton) {
    removeButton.addEventListener('click', () => {
      fileInput.value = '';
      hiddenInput.value = '';
      previewImage.src = '';
      previewContainer.style.display = 'none';
    });
  }
}

// Form Submission & Match Alert
async function handleFormSubmit(e) {
  e.preventDefault();
  
  const type = document.querySelector('input[name="item-type"]:checked').value;
  const title = document.getElementById('item-title').value.trim();
  const category = document.getElementById('item-category').value;
  const description = document.getElementById('item-description').value.trim();
  const location = document.getElementById('item-location').value.trim();
  const date = document.getElementById('item-date').value;
  
  const contactName = document.getElementById('reporter-name').value.trim();
  const contactEmail = document.getElementById('reporter-email').value.trim().toLowerCase();
  const contactPhone = document.getElementById('reporter-phone').value.trim();
  const image = document.getElementById('item-image').value.trim();
  const secretQuestion = document.getElementById('item-secret-question').value.trim();
  
  if (!contactName || !contactEmail) {
    alert("Please enter your name and email.");
    return;
  }
  
  if (!validateEmail(contactEmail)) {
    alert("Invalid Email: You must use your university email address ending with @galgotiasuniversity.ac.in to report items.");
    return;
  }
  
  const newItem = {
    title,
    type,
    category,
    description,
    location,
    date,
    contactName,
    contactEmail,
    contactPhone,
    image,
    secretQuestion
  };
  
  try {
    const savedItem = await dbService.addItem(newItem);
    await refreshData();
    
    // Confetti effect!
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 }
    });
    
    // Search for potential matches!
    const matches = findMatches(savedItem, state.items);
    
    // Render Success View inside form container
    renderSuccessScreen(savedItem, matches);
    
  } catch (error) {
    console.error("Submission failed", error);
    alert("Error submitting listing. Please try again.");
  }
}

// Success screen with AI Matcher results
function renderSuccessScreen(item, matches) {
  const container = el.pages.report.querySelector('.form-container');
  
  let matchesHtml = '';
  if (matches.length > 0) {
    matchesHtml = `
      <div class="ai-matches-section" style="margin-top: 1.5rem; text-align: left;">
        <h4><i class="fas fa-magic"></i> AI Matcher Alerts (${matches.length} matches found!)</h4>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.75rem;">
          Our system detected existing listings that closely match your item:
        </p>
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          ${matches.map(m => `
            <div class="ai-match-item">
              <div>
                <span class="ai-match-score">${m.score}% Match</span>
                <span class="ai-match-title" style="margin-left: 0.5rem;">${escapeHtml(m.item.title)}</span>
                <div class="ai-match-details" style="margin-top: 0.2rem;">
                  <i class="fas fa-map-marker-alt"></i> ${escapeHtml(m.item.location)} &nbsp;&bull;&nbsp; <i class="far fa-calendar-alt"></i> ${formatDate(m.item.date)}
                </div>
              </div>
              <button class="btn-nav-action claim-match-btn" data-id="${m.item.id}" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; border-radius: 6px;">View Item</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else {
    matchesHtml = `
      <div style="margin-top: 1.5rem; text-align: center; padding: 1rem; border: 1px dashed var(--border-color); border-radius: var(--border-radius-md); font-size: 0.85rem; color: var(--text-muted);">
        <i class="fas fa-search"></i> No immediate matches found. We will notify you if a matching listing is reported!
      </div>
    `;
  }
  
  container.innerHTML = `
    <div style="text-align: center; padding: 1.5rem 0;">
      <div style="width: 80px; height: 80px; border-radius: 50%; background: rgba(16, 185, 129, 0.1); border: 2px solid var(--found-color); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
        <i class="fas fa-check" style="font-size: 2.5rem; color: var(--found-color);"></i>
      </div>
      <h2 style="font-size: 2rem; margin-bottom: 0.5rem;">Listing Posted Successfully!</h2>
      <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 1.5rem;">
        Your listing <strong>"${escapeHtml(item.title)}"</strong> is now live on the University Portal.
      </p>
      
      ${matchesHtml}
      
      <div style="margin-top: 2.5rem; display: flex; gap: 1rem;">
        <button id="btn-success-browse" class="btn-primary">Browse All Listings</button>
        <button id="btn-success-new" class="btn-secondary">List Another Item</button>
      </div>
    </div>
  `;
  
  document.getElementById('btn-success-browse').addEventListener('click', () => {
    window.location.hash = '#/browse';
    restoreFormHTML();
  });
  
  document.getElementById('btn-success-new').addEventListener('click', () => {
    restoreFormHTML();
    resetReportForm();
  });
  
  // Wire up view buttons for AI matches
  const matchButtons = container.querySelectorAll('.claim-match-btn');
  matchButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const matchId = btn.getAttribute('data-id');
      const matchedItem = state.items.find(i => i.id === matchId);
      if (matchedItem) {
        openItemDetail(matchedItem);
      }
    });
  });
}

// Restore form skeleton after success view is dismissed
function restoreFormHTML() {
  const container = el.pages.report.querySelector('.form-container');
  // Re-inject form template
  container.innerHTML = `
    <div class="form-header">
      <h2>Report a Lost or Found Item</h2>
      <p>Fill out the forms to list a campus item or request matching reports.</p>
    </div>
    
    <div class="step-indicator">
      <div class="step-dot active">1</div>
      <div class="step-dot">2</div>
      <div class="step-dot">3</div>
    </div>
    
    <form id="report-item-form" onsubmit="return false;">
      <!-- Step 1 -->
      <div class="form-section active">
        <div class="form-group">
          <label>Listing Type</label>
          <div class="radio-tabs">
            <input type="radio" id="item-type-lost" name="item-type" value="lost" checked class="radio-tab-input">
            <label for="item-type-lost" class="radio-tab-label">Lost Item</label>
            
            <input type="radio" id="item-type-found" name="item-type" value="found" class="radio-tab-input">
            <label for="item-type-found" class="radio-tab-label">Found Item</label>
          </div>
        </div>
        
        <div class="form-group">
          <label for="item-title" class="required">Item Title</label>
          <input type="text" id="item-title" class="input-control" placeholder="e.g., Black Apple AirPods Pro">
        </div>
        
        <div class="form-group">
          <label for="item-category">Category</label>
          <select id="item-category" class="input-control">
            <option value="electronics">Electronics</option>
            <option value="documents">Documents / ID Cards</option>
            <option value="accessories">Accessories / Bottles</option>
            <option value="books">Books & Notebooks</option>
            <option value="clothing">Clothing & Apparel</option>
            <option value="keys">Keys</option>
            <option value="other">Other</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="item-description" class="required">Description</label>
          <textarea id="item-description" class="input-control" placeholder="Provide details like colors, stickers, scratches, case styles, etc..."></textarea>
        </div>
      </div>
      
      <!-- Step 2 -->
      <div class="form-section">
        <div class="form-group">
          <label for="item-location" class="required">Campus Location</label>
          <input type="text" id="item-location" class="input-control" placeholder="e.g., Library 3rd Floor, Student Union Gym">
        </div>
        
        <div class="form-group">
          <label for="item-date" class="required">Date Lost or Found</label>
          <input type="date" id="item-date" class="input-control">
        </div>
        
        <div class="form-group">
          <label for="item-image-file">Upload Image</label>
          <input type="file" id="item-image-file" class="input-control" accept="image/*" style="padding: 0.5rem 1rem; line-height: 1.5;">
          <input type="hidden" id="item-image" value="">
          <div id="image-preview-container" style="display: none; margin-top: 1rem; position: relative; width: 120px; height: 120px; border-radius: var(--border-radius-sm); overflow: hidden; border: 1px solid var(--border-color);">
            <img id="image-upload-preview" src="" style="width: 100%; height: 100%; object-fit: cover;">
            <button type="button" id="btn-remove-image" style="position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.6); border: none; color: white; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;"><i class="fas fa-times" style="font-size: 0.8rem;"></i></button>
          </div>
        </div>
      </div>
      
      <!-- Step 3 -->
      <div class="form-section">
        <div class="form-group">
          <label for="reporter-name" class="required">Your Full Name</label>
          <input type="text" id="reporter-name" class="input-control" placeholder="Alex Mercer">
        </div>
        
        <div class="form-group">
          <label for="reporter-email" class="required">University Email Address</label>
          <input type="email" id="reporter-email" class="input-control" placeholder="yourname.23scse1010538@galgotiasuniversity.ac.in">
        </div>
        
        <div class="form-group">
          <label for="reporter-phone">Phone Number (Optional)</label>
          <input type="tel" id="reporter-phone" class="input-control" placeholder="555-0192">
        </div>
        
        <div class="form-group">
          <label for="item-secret-question">Verification Question (For Found Items)</label>
          <input type="text" id="item-secret-question" class="input-control" placeholder="e.g., 'What is the sticker on the back of the case?'">
        </div>
      </div>
      
      <!-- Form Navigation Buttons -->
      <div class="form-navigation">
        <button type="button" id="btn-prev-step" class="btn-secondary" style="display: none; margin-top:0;">Back</button>
        <button type="button" id="btn-next-step" class="btn-primary">Next Step</button>
        <button type="submit" id="btn-submit-form" class="btn-primary" style="display: none;">Submit Listing</button>
      </div>
    </form>
  `;
  
  // Re-cache DOM elements and re-bind listeners
  el.reportForm = document.getElementById('report-item-form');
  el.formSections = document.querySelectorAll('.form-section');
  el.stepDots = document.querySelectorAll('.step-dot');
  el.btnPrevStep = document.getElementById('btn-prev-step');
  el.btnNextStep = document.getElementById('btn-next-step');
  el.btnSubmitForm = document.getElementById('btn-submit-form');
  
  el.btnPrevStep.addEventListener('click', () => handleFormStep(-1));
  el.btnNextStep.addEventListener('click', () => handleFormStep(1));
  el.reportForm.addEventListener('submit', handleFormSubmit);
  bindImageUploadEvents();
}

// Client-side AI Matcher similarity engine
function findMatches(newItem, allItems) {
  const matches = [];
  
  allItems.forEach(item => {
    // Only compare active items
    if (item.status !== 'active') return;
    
    // Ignore self
    if (item.id === newItem.id) return;
    
    // Check types must be opposite (one lost, one found)
    if (item.type === newItem.type) return;
    
    let score = 0;
    
    // 1. Categories match? (gives 35 points)
    if (item.category === newItem.category) {
      score += 35;
    } else {
      return; // If categories don't match, abort matching for safety
    }
    
    // 2. Location keyword overlap (gives up to 25 points)
    const loc1 = item.location.toLowerCase();
    const loc2 = newItem.location.toLowerCase();
    
    if (loc1 === loc2) {
      score += 25;
    } else {
      const words1 = loc1.split(/[\s,]+/);
      const words2 = loc2.split(/[\s,]+/);
      const commonWords = words1.filter(w => w.length > 2 && words2.includes(w));
      if (commonWords.length > 0) {
        score += Math.min(25, commonWords.length * 8);
      }
    }
    
    // 3. Title similarity (up to 30 points)
    const wordsTitle1 = item.title.toLowerCase().replace(/lost|found/gi, '').split(/[\s\-_,]+/);
    const wordsTitle2 = newItem.title.toLowerCase().replace(/lost|found/gi, '').split(/[\s\-_,]+/);
    const commonTitleWords = wordsTitle1.filter(w => w.length > 2 && wordsTitle2.includes(w));
    if (commonTitleWords.length > 0) {
      score += Math.min(30, commonTitleWords.length * 10);
    }
    
    // 4. Date proximity (up to 10 points)
    const date1 = new Date(item.date);
    const date2 = new Date(newItem.date);
    const daysDiff = Math.ceil(Math.abs(date1 - date2) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 1) score += 10;
    else if (daysDiff <= 3) score += 7;
    else if (daysDiff <= 7) score += 4;
    
    // Add if matching threshold met (e.g. 40%)
    if (score >= 40) {
      matches.push({ item, score });
    }
  });
  
  // Sort descending by score
  return matches.sort((a, b) => b.score - a.score);
}

// Student Dashboard controller (My Listings)
function renderDashboard() {
  const savedEmail = state.userEmail || localStorage.getItem('univ_lost_found_user_email');
  
  if (!savedEmail) {
    el.dashboardEmailPrompt.style.display = 'block';
    el.dashboardContent.style.display = 'none';
    return;
  }
  
  el.dashboardEmailPrompt.style.display = 'none';
  el.dashboardContent.style.display = 'block';
  document.getElementById('dashboard-subtitle').innerHTML = `Managing listings for <strong>${escapeHtml(savedEmail)}</strong>`;
  
  // Filter state items where reporter matches this email
  state.myItems = state.items.filter(item => item.contactEmail.toLowerCase() === savedEmail.toLowerCase());
  
  el.myListingsTableBody.innerHTML = '';
  
  if (state.myItems.length === 0) {
    el.myListingsTableBody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 3rem;">
          <i class="far fa-folder-open" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
          You have not reported any items yet.
        </td>
      </tr>
    `;
    return;
  }
  
  const fallbackImages = {
    electronics: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=600&q=80",
    documents: "https://images.unsplash.com/photo-1598257006458-087169a1f08d?auto=format&fit=crop&w=600&q=80",
    accessories: "https://images.unsplash.com/photo-1581605405669-fcdf81165afa?auto=format&fit=crop&w=600&q=80",
    books: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80",
    clothing: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=600&q=80",
    keys: "https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=600&q=80",
    other: "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=600&q=80"
  };

  state.myItems.forEach(item => {
    const row = document.createElement('tr');
    
    // Check for potential AI matches
    const matches = findMatches(item, state.items);
    let matchAlertHtml = '';
    if (matches.length > 0 && item.status === 'active') {
      matchAlertHtml = `
        <div class="ai-matches-section" style="margin-top: 0.5rem; padding: 0.5rem; font-size: 0.75rem;">
          <h4 style="font-size: 0.75rem; margin-bottom: 0.25rem;"><i class="fas fa-magic"></i> AI Match Suggestions (${matches.length})</h4>
          ${matches.map(m => `
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; background: rgba(255,255,255,0.02); padding: 0.2rem 0.5rem; border-radius: 4px;">
              <span>${escapeHtml(m.item.title)} (${m.score}%)</span>
              <a href="#" class="view-dashboard-match" data-id="${m.item.id}" style="color: var(--primary); text-decoration: none;">View</a>
            </div>
          `).join('')}
        </div>
      `;
    }
    
    const imageUrl = item.image || fallbackImages[item.category] || fallbackImages.other;
    
    row.innerHTML = `
      <td>
        <div class="listings-item-info">
          <img class="listings-item-img" src="${imageUrl}" alt="${escapeHtml(item.title)}" onerror="this.src='${fallbackImages.other}';">
          <div class="listings-item-details">
            <h4>${escapeHtml(item.title)}</h4>
            <span><i class="fas fa-map-marker-alt"></i> ${escapeHtml(item.location)} &bull; ${formatDate(item.date)}</span>
            ${matchAlertHtml}
          </div>
        </div>
      </td>
      <td>
        <span class="status-pill ${item.type}">${item.type}</span>
      </td>
      <td>
        <span class="status-pill ${item.status}">${item.status}</span>
      </td>
      <td>
        <select class="action-select dashboard-status-update" data-id="${item.id}">
          <option value="active" ${item.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="resolved" ${item.status === 'resolved' ? 'selected' : ''}>Resolved</option>
          <option value="claimed" ${item.status === 'claimed' ? 'selected' : ''}>Claimed</option>
        </select>
      </td>
    `;
    
    el.myListingsTableBody.appendChild(row);
  });
  
  // Bind events to action status dropdowns
  document.querySelectorAll('.dashboard-status-update').forEach(select => {
    select.addEventListener('change', async (e) => {
      const id = e.target.getAttribute('data-id');
      const newStatus = e.target.value;
      const success = await dbService.updateItemStatus(id, newStatus);
      if (success) {
        await refreshData();
        renderDashboard();
      } else {
        alert("Failed to update status.");
      }
    });
  });
  
  // Bind events to dashboard match links
  document.querySelectorAll('.view-dashboard-match').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const matchId = link.getAttribute('data-id');
      const matchedItem = state.items.find(i => i.id === matchId);
      if (matchedItem) {
        openItemDetail(matchedItem);
      }
    });
  });
}

// Configuration Form Handlers
function populateConfigFields() {
  const config = dbService.getSavedConfig();
  if (config) {
    el.apiKey.value = config.apiKey || '';
    el.authDomain.value = config.authDomain || '';
    el.projectId.value = config.projectId || '';
    el.storageBucket.value = config.storageBucket || '';
    el.messagingSenderId.value = config.messagingSenderId || '';
    el.appId.value = config.appId || '';
  }
}

async function handleConfigSave(e) {
  e.preventDefault();
  el.configStatusMsg.innerHTML = '<span style="color: var(--primary);">Connecting...</span>';
  
  const config = {
    apiKey: el.apiKey.value.trim(),
    authDomain: el.authDomain.value.trim(),
    projectId: el.projectId.value.trim(),
    storageBucket: el.storageBucket.value.trim(),
    messagingSenderId: el.messagingSenderId.value.trim(),
    appId: el.appId.value.trim()
  };
  
  const success = await dbService.saveConfig(config);
  updateDbStatusUI(success);
  
  if (success) {
    el.configStatusMsg.innerHTML = '<span style="color: var(--found-color);">Successfully connected to Firebase!</span>';
    confetti({ particleCount: 30, spread: 40 });
    await refreshData();
  } else {
    el.configStatusMsg.innerHTML = '<span style="color: var(--lost-color);">Failed to connect. Check credentials or network. Fallback Mode active.</span>';
  }
}

function handleConfigClear() {
  dbService.clearConfig();
  el.configForm.reset();
  updateDbStatusUI(false);
  el.configStatusMsg.innerHTML = '<span style="color: var(--text-muted);">Configuration cleared. Running in Demo Mode.</span>';
  refreshData();
}

function updateDbStatusUI(isFirebaseActive) {
  if (isFirebaseActive) {
    el.dbStatusBar.style.display = 'none';
  } else {
    el.dbStatusBar.style.display = 'flex';
    el.dbStatusBar.classList.remove('connected');
    el.dbStatusText.innerHTML = `<i class="fas fa-info-circle"></i> Running in <strong>Demo Mode</strong> (Local Mock Storage).`;
  }
}

// Utility Helpers
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
}

function validateEmail(email) {
  return /^[^\s@]+@galgotiasuniversity\.ac\.in$/.test(email);
}

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
