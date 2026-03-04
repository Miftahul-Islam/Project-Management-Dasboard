// ================================================
// ClientFlow Dashboard - Application Logic
// With Supabase Integration
// ================================================

// ================================================
// SUPABASE CONFIGURATION
// ================================================
const SUPABASE_URL = 'https://aoxktwsdcrqvnpvvzvpz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFveGt0d3NkY3Jxdm5wdnZ6dnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1Njc3MTksImV4cCI6MjA4ODE0MzcxOX0.KcVFSAP4BGQfaAHAYM9_pOV-Jdt0sRm8wqWRJLG9frs';

// Initialize Supabase client (renamed to avoid collision with CDN global)
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Offline sync queue
let offlineQueue = [];
let isOnline = navigator.onLine;

// ================================================
// OFFLINE MODE & SYNC
// ================================================
function initOfflineMode() {
    // Load offline queue from localStorage
    const savedQueue = localStorage.getItem('cf_offline_queue');
    if (savedQueue) {
        offlineQueue = JSON.parse(savedQueue);
    }
    
    // Listen for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Update UI
    updateOfflineIndicator();
}

function handleOnline() {
    isOnline = true;
    updateOfflineIndicator();
    syncOfflineData();
}

function handleOffline() {
    isOnline = false;
    updateOfflineIndicator();
}

function updateOfflineIndicator() {
    const indicator = document.getElementById('offlineIndicator');
    if (!isOnline) {
        indicator.classList.add('show');
    } else {
        indicator.classList.remove('show');
    }
}

async function syncOfflineData() {
    if (offlineQueue.length === 0) return;
    
    showToast(`Syncing ${offlineQueue.length} offline changes...`);
    
    for (const item of offlineQueue) {
        try {
            if (item.type === 'client') {
                if (item.action === 'insert') {
                    await db.from('clients').insert(item.data);
                } else if (item.action === 'update') {
                    await db.from('clients').update(item.data).eq('id', item.id);
                } else if (item.action === 'delete') {
                    await db.from('clients').delete().eq('id', item.id);
                }
            } else if (item.type === 'project') {
                if (item.action === 'insert') {
                    await db.from('projects').insert(item.data);
                } else if (item.action === 'update') {
                    await db.from('projects').update(item.data).eq('id', item.id);
                } else if (item.action === 'delete') {
                    await db.from('projects').delete().eq('id', item.id);
                }
            } else if (item.type === 'invoice') {
                if (item.action === 'insert') {
                    await db.from('invoices').insert(item.data);
                    if (item.items) {
                        await db.from('invoice_items').insert(item.items);
                    }
                } else if (item.action === 'update') {
                    await db.from('invoices').update(item.data).eq('id', item.id);
                } else if (item.action === 'delete') {
                    await db.from('invoices').delete().eq('id', item.id);
                }
            }
        } catch (error) {
            console.error('Sync error:', error);
        }
    }
    
    offlineQueue = [];
    localStorage.removeItem('cf_offline_queue');
    showToast('All offline changes synced!');
    
    // Refresh data
    updateDashboard();
    renderClients();
    renderProjects();
    renderInvoices();
}

function addToOfflineQueue(item) {
    offlineQueue.push({ ...item, timestamp: Date.now() });
    localStorage.setItem('cf_offline_queue', JSON.stringify(offlineQueue));
}

// ================================================
// PWA INSTALL
// ================================================
let deferredPrompt = null;

function initPWA() {
    const installBtn = document.getElementById('installAppBtn');
    
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        // Show install button on mobile
        if (window.innerWidth <= 768 && installBtn) {
            installBtn.style.display = 'inline-flex';
        }
    });
    
    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        if (installBtn) {
            installBtn.style.display = 'none';
        }
        showToast('App installed successfully!');
    });
    
    // Handle install button click
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    installBtn.style.display = 'none';
                }
                deferredPrompt = null;
            } else {
                // Fallback instructions for iOS
                showToast('Tap the share button and select "Add to Home Screen"');
            }
        });
    }
    
    // Check if running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
        console.log('Running as installed PWA');
        if (installBtn) installBtn.style.display = 'none';
    }
}

// ================================================
// KEYBOARD SHORTCUTS
// ================================================
const shortcuts = {
    'c': { action: () => openClientModal(), description: 'Add new client' },
    'p': { action: () => openProjectModal(), description: 'Add new project' },
    'i': { action: () => openInvoiceModal(), description: 'Create new invoice' },
    'd': { action: () => navigateTo('dashboard'), description: 'Go to Dashboard' },
    '/': { action: () => document.getElementById('globalSearch').focus(), description: 'Focus search' },
    'escape': { action: () => closeAllModals(), description: 'Close modals' },
    '?': { action: () => showShortcutsModal(), description: 'Show shortcuts' }
};

function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Don't trigger if typing in input/textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            if (e.key === 'Escape') {
                e.target.blur();
            }
            return;
        }
        
        const key = e.key.toLowerCase();
        
        // Ctrl/Cmd + key shortcuts
        if (e.ctrlKey || e.metaKey) {
            if (key === 'k') {
                e.preventDefault();
                document.getElementById('globalSearch').focus();
            }
            return;
        }
        
        // Single key shortcuts
        if (shortcuts[key]) {
            e.preventDefault();
            shortcuts[key].action();
        }
    });
}

function showShortcutsModal() {
    let modal = document.getElementById('shortcutsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'shortcutsModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content modal-small">
                <div class="modal-header">
                    <h2>⌨️ Keyboard Shortcuts</h2>
                    <button class="modal-close" onclick="closeModal('shortcutsModal')">×</button>
                </div>
                <div class="shortcuts-list">
                    ${Object.entries(shortcuts).map(([key, { description }]) => `
                        <div class="shortcut-item">
                            <kbd>${key === ' ' ? 'Space' : key.toUpperCase()}</kbd>
                            <span>${description}</span>
                        </div>
                    `).join('')}
                    <div class="shortcut-item">
                        <kbd>Ctrl+K</kbd>
                        <span>Focus search</span>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    openModal('shortcutsModal');
}

function openClientModal() {
    document.getElementById('clientForm').reset();
    document.getElementById('clientId').value = '';
    document.getElementById('clientModalTitle').textContent = 'Add Client';
    openModal('clientModal');
}

function openProjectModal() {
    document.getElementById('projectForm').reset();
    document.getElementById('projectId').value = '';
    document.getElementById('projectModalTitle').textContent = 'Add Project';
    populateClientSelect('projectClient');
    openModal('projectModal');
}

function openInvoiceModal() {
    resetInvoiceForm();
    populateClientSelect('invoiceClient');
    openModal('invoiceModal');
}

function closeAllModals() {
    document.querySelectorAll('.modal.active').forEach(modal => {
        modal.classList.remove('active');
    });
}

// ================================================
// DRAG & DROP DASHBOARD
// ================================================
let draggedCard = null;

function initDragAndDrop() {
    const containers = document.querySelectorAll('.stats-grid, .dashboard-grid');
    
    document.querySelectorAll('.stat-card, .card:not(.chart-card)').forEach(card => {
        card.setAttribute('draggable', 'true');
        card.style.cursor = 'grab';
        
        card.addEventListener('dragstart', (e) => {
            draggedCard = card;
            card.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
        });
        
        card.addEventListener('dragend', () => {
            draggedCard = null;
            card.style.opacity = '1';
            card.style.transform = '';
            saveDashboardLayout();
        });
        
        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (draggedCard && draggedCard !== card) {
                card.style.transform = 'scale(1.02)';
            }
        });
        
        card.addEventListener('dragleave', () => {
            card.style.transform = '';
        });
        
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.style.transform = '';
            
            if (draggedCard && draggedCard !== card) {
                const parent = card.parentNode;
                const children = [...parent.children];
                const draggedIndex = children.indexOf(draggedCard);
                const targetIndex = children.indexOf(card);
                
                if (draggedIndex < targetIndex) {
                    parent.insertBefore(draggedCard, card.nextSibling);
                } else {
                    parent.insertBefore(draggedCard, card);
                }
            }
        });
    });
}

function saveDashboardLayout() {
    const layout = {};
    document.querySelectorAll('.stats-grid, .dashboard-grid').forEach((grid, i) => {
        layout[`grid_${i}`] = [...grid.children].map(child => child.className);
    });
    localStorage.setItem('cf_dashboard_layout', JSON.stringify(layout));
}

// ================================================
// GROQ AI INTEGRATION
// ================================================
// Groq API Configuration - Loaded from Supabase settings
let GROQ_API_KEY = '';
const GROQ_MODEL = 'llama-3.1-8b-instant';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Load settings from Supabase
async function loadSettings() {
    try {
        const result = await db.from('settings').select('*').eq('key', 'groq_api_key').single();
        if (result.data && result.data.value) {
            GROQ_API_KEY = result.data.value.key || '';
        }
    } catch (error) {
        console.log('Could not load Groq API key from settings');
    }
}

// Save settings to Supabase
async function saveSettings(key, value) {
    try {
        await db.from('settings').upsert({ key, value: { key: value } }, { onConflict: 'key' });
        return true;
    } catch (error) {
        console.error('Error saving settings:', error);
        return false;
    }
}

async function organizeWithAI(text, type = 'description') {
    if (!text || text.trim().length === 0) {
        showToast('Please enter some text to organize');
        return null;
    }
    
    const prompts = {
        description: `You are a professional business writing assistant. Rewrite and organize the following text to be clear, professional, and well-structured. Keep it concise but informative. Remove any redundancy and improve clarity. Only return the rewritten text, nothing else:\n\n"${text}"`,
        notes: `You are a professional business writing assistant. Rewrite and organize the following notes to be clear and professional. Structure it properly with bullet points if needed. Only return the rewritten text, nothing else:\n\n"${text}"`,
        invoice: `You are a professional business writing assistant. Rewrite the following invoice notes/terms to be clear and professional. Make it well-structured. Only return the rewritten text, nothing else:\n\n"${text}"`
    };
    
    const prompt = prompts[type] || prompts.description;
    
    try {
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 500
            })
        });
        
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        
        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() || null;
    } catch (error) {
        console.error('Groq API error:', error);
        showToast('AI error. Please try again.');
        return null;
    }
}

// AI button handlers
document.querySelectorAll('.ai-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
        const targetId = this.dataset.target;
        const textarea = document.getElementById(targetId);
        if (!textarea) return;
        
        let type = 'description';
        if (targetId.includes('notes')) type = targetId.includes('invoice') ? 'invoice' : 'notes';
        
        this.classList.add('loading');
        this.disabled = true;
        const originalText = this.querySelector('span:last-child').textContent;
        this.querySelector('span:last-child').textContent = 'Processing...';
        
        const result = await organizeWithAI(textarea.value, type);
        
        this.classList.remove('loading');
        this.disabled = false;
        this.querySelector('span:last-child').textContent = originalText;
        
        if (result) {
            textarea.value = result;
            showToast('Text organized successfully!');
        }
    });
});

// ================================================
// AUTHENTICATION
// ================================================
const AUTH_PASSWORD = 'webigns';
const AUTH_KEY = 'cf_auth';

function checkAuth() {
    return localStorage.getItem(AUTH_KEY) === 'authenticated';
}

function login(password) {
    if (password === AUTH_PASSWORD) {
        localStorage.setItem(AUTH_KEY, 'authenticated');
        return true;
    }
    return false;
}

function logout() {
    localStorage.removeItem(AUTH_KEY);
    showLoginScreen();
}

function showLoginScreen() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('sidebar').style.display = 'none';
    document.querySelector('.main-content').style.display = 'none';
}

function hideLoginScreen() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('sidebar').style.display = 'flex';
    document.querySelector('.main-content').style.display = 'block';
}

// ================================================
// DATA STORE (Supabase)
// ================================================

// ================================================
// DATA STORE (Supabase)
// ================================================
const DB = {
    clients: [],
    projects: [],
    invoices: [],
    invoice_items: [],
    
    // Load all data from Supabase
    async loadAll() {
        try {
            const [clientsRes, projectsRes, invoicesRes, itemsRes] = await Promise.all([
                db.from('clients').select('*').order('created_at', { ascending: false }),
                db.from('projects').select('*').order('created_at', { ascending: false }),
                db.from('invoices').select('*').order('created_at', { ascending: false }),
                db.from('invoice_items').select('*')
            ]);
            
            this.clients = clientsRes.data || [];
            this.projects = projectsRes.data || [];
            this.invoices = invoicesRes.data || [];
            this.invoice_items = itemsRes.data || [];
            
            return true;
        } catch (error) {
            console.error('Error loading data:', error);
            // Try to load from localStorage cache
            this.loadFromCache();
            return false;
        }
    },
    
    loadFromCache() {
        this.clients = JSON.parse(localStorage.getItem('cf_clients_cache') || '[]');
        this.projects = JSON.parse(localStorage.getItem('cf_projects_cache') || '[]');
        this.invoices = JSON.parse(localStorage.getItem('cf_invoices_cache') || '[]');
        this.invoice_items = JSON.parse(localStorage.getItem('cf_invoice_items_cache') || '[]');
    },
    
    saveCache() {
        localStorage.setItem('cf_clients_cache', JSON.stringify(this.clients));
        localStorage.setItem('cf_projects_cache', JSON.stringify(this.projects));
        localStorage.setItem('cf_invoices_cache', JSON.stringify(this.invoices));
        localStorage.setItem('cf_invoice_items_cache', JSON.stringify(this.invoice_items));
    },
    
    // Clients
    async addClient(client) {
        try {
            console.log('Adding client to Supabase:', client);
            // Remove id field - let Supabase auto-generate UUID
            const { id, ...clientData } = client;
            const result = await db.from('clients').insert(clientData).select();
            console.log('Supabase result:', result);
            if (result.data && result.data.length > 0) {
                this.clients.unshift(result.data[0]);
                this.saveCache();
                return { data: result.data[0], error: null };
            }
            return { data: null, error: result.error };
        } catch (error) {
            console.error('Error adding client:', error);
            return { data: null, error };
        }
    },
    
    async updateClient(id, data) {
        try {
            console.log('Updating client:', id, data);
            const result = await db.from('clients').update(data).eq('id', id).select();
            if (result.data && result.data.length > 0) {
                const index = this.clients.findIndex(c => c.id === id);
                if (index !== -1) this.clients[index] = result.data[0];
                this.saveCache();
                return { data: result.data[0], error: null };
            }
            return { data: null, error: result.error };
        } catch (error) {
            console.error('Error updating client:', error);
            return { data: null, error };
        }
    },
    
    async deleteClient(id) {
        try {
            console.log('Deleting client:', id);
            const result = await db.from('clients').delete().eq('id', id);
            if (!result.error) {
                this.clients = this.clients.filter(c => c.id !== id);
                this.projects = this.projects.filter(p => p.client_id !== id);
                this.invoices = this.invoices.filter(i => i.client_id !== id);
                this.saveCache();
                return { error: null };
            }
            return { error: result.error };
        } catch (error) {
            console.error('Error deleting client:', error);
            return { error };
        }
    },
    
    // Projects
    async addProject(project) {
        try {
            console.log('Adding project to Supabase:', project);
            const { id, ...projectData } = project;
            const result = await db.from('projects').insert(projectData).select();
            console.log('Supabase result:', result);
            if (result.data && result.data.length > 0) {
                this.projects.unshift(result.data[0]);
                this.saveCache();
                return { data: result.data[0], error: null };
            }
            return { data: null, error: result.error };
        } catch (error) {
            console.error('Error adding project:', error);
            return { data: null, error };
        }
    },
    
    async updateProject(id, data) {
        try {
            console.log('Updating project:', id, data);
            const result = await db.from('projects').update(data).eq('id', id).select();
            if (result.data && result.data.length > 0) {
                const index = this.projects.findIndex(p => p.id === id);
                if (index !== -1) this.projects[index] = result.data[0];
                this.saveCache();
                return { data: result.data[0], error: null };
            }
            return { data: null, error: result.error };
        } catch (error) {
            console.error('Error updating project:', error);
            return { data: null, error };
        }
    },
    
    async deleteProject(id) {
        try {
            console.log('Deleting project:', id);
            const result = await db.from('projects').delete().eq('id', id);
            if (!result.error) {
                this.projects = this.projects.filter(p => p.id !== id);
                this.saveCache();
                return { error: null };
            }
            return { error: result.error };
        } catch (error) {
            console.error('Error deleting project:', error);
            return { error };
        }
    },
    
    // Invoices
    async addInvoice(invoice, items) {
        try {
            console.log('Adding invoice to Supabase:', invoice, items);
            const { id, ...invoiceData } = invoice;
            const result = await db.from('invoices').insert(invoiceData).select();
            console.log('Supabase result:', result);
            if (result.data && result.data.length > 0) {
                const newInvoice = result.data[0];
                // Insert items with invoice id
                if (items && items.length > 0) {
                    const itemsWithInvoiceId = items.map(item => {
                        const { id, ...itemData } = item;
                        return { ...itemData, invoice_id: newInvoice.id };
                    });
                    const itemsResult = await db.from('invoice_items').insert(itemsWithInvoiceId);
                    if (itemsResult.data) {
                        this.invoice_items.push(...itemsResult.data);
                    }
                }
                this.invoices.unshift(newInvoice);
                this.saveCache();
                return { data: newInvoice, error: null };
            }
            return { data: null, error: result.error };
        } catch (error) {
            console.error('Error adding invoice:', error);
            return { data: null, error };
        }
    },
    
    async updateInvoice(id, data, items) {
        try {
            console.log('Updating invoice:', id, data);
            const result = await db.from('invoices').update(data).eq('id', id).select();
            if (result.data && result.data.length > 0) {
                // Delete old items and insert new ones
                await db.from('invoice_items').delete().eq('invoice_id', id);
                if (items && items.length > 0) {
                    const itemsWithInvoiceId = items.map(item => {
                        const { id, ...itemData } = item;
                        return { ...itemData, invoice_id: id };
                    });
                    await db.from('invoice_items').insert(itemsWithInvoiceId);
                }
                const index = this.invoices.findIndex(i => i.id === id);
                if (index !== -1) this.invoices[index] = result.data[0];
                this.saveCache();
                return { data: result.data[0], error: null };
            }
            return { data: null, error: result.error };
        } catch (error) {
            console.error('Error updating invoice:', error);
            return { data: null, error };
        }
    },
    
    async deleteInvoice(id) {
        try {
            console.log('Deleting invoice:', id);
            const result = await db.from('invoices').delete().eq('id', id);
            if (!result.error) {
                this.invoices = this.invoices.filter(i => i.id !== id);
                this.invoice_items = this.invoice_items.filter(item => item.invoice_id !== id);
                this.saveCache();
                return { error: null };
            }
            return { error: result.error };
        } catch (error) {
            console.error('Error deleting invoice:', error);
            return { error };
        }
    },
    
    getInvoiceItems(invoiceId) {
        return this.invoice_items.filter(item => item.invoice_id === invoiceId);
    }
};

// Generate unique ID (UUID format for Supabase)
function generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

// Format currency
function formatCurrency(amount, currency = 'USD') {
    if (currency === 'TK') {
        return '৳' + parseFloat(amount || 0).toLocaleString('en-BD', { minimumFractionDigits: 2 });
    }
    return '$' + parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
}

// Format date
function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

// Show toast notification
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.querySelector('.toast-message').textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ================================================
// NAVIGATION
// ================================================
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');

function navigateTo(pageName) {
    navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.page === pageName);
    });
    pages.forEach(page => {
        page.classList.toggle('active', page.id === pageName + 'Page');
    });
    
    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');
    
    // Refresh data
    if (pageName === 'dashboard') updateDashboard();
    if (pageName === 'clients') renderClients();
    if (pageName === 'projects') renderProjects();
    if (pageName === 'invoices') renderInvoices();
    if (pageName === 'analytics') renderAnalytics();
}

// ================================================
// SETUP EVENT LISTENERS (called after DOM ready)
// ================================================
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(item.dataset.page);
        });
    });
    
    document.querySelectorAll('.view-all').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(link.dataset.page);
        });
    });
    
    // Menu toggle
    document.getElementById('menuToggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });
    
    // Sidebar overlay click to close
    document.getElementById('sidebarOverlay').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('open');
    });
    
    // Modals
    document.querySelectorAll('.modal-close, [data-modal]').forEach(btn => {
        if (btn.dataset.modal) {
            btn.addEventListener('click', () => closeModal(btn.dataset.modal));
        }
    });
    
    // Quick Add Modal
    document.getElementById('quickAddBtn').addEventListener('click', () => {
        openModal('quickAddModal');
    });
    
    document.querySelectorAll('.quick-add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal('quickAddModal');
            const type = btn.dataset.type;
            if (type === 'client') openClientModal();
            else if (type === 'project') openProjectModal();
            else if (type === 'invoice') openInvoiceModal();
        });
    });
    
    // Clients
    document.getElementById('addClientBtn').addEventListener('click', openClientModal);
    
    document.getElementById('clientForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('clientId').value;
        const clientData = {
            name: document.getElementById('clientName').value,
            email: document.getElementById('clientEmail').value,
            phone: document.getElementById('clientPhone').value || null,
            company: document.getElementById('clientCompany').value || null,
            address: document.getElementById('clientAddress').value || null,
            notes: document.getElementById('clientNotes').value || null,
            status: document.getElementById('clientStatus').value
        };
        
        if (id) {
            await DB.updateClient(id, clientData);
            showToast('Client updated successfully!');
        } else {
            await DB.addClient(clientData);
            showToast('Client added successfully!');
        }
        
        closeModal('clientModal');
        renderClients();
        updateDashboard();
    });
    
    // Projects
    document.getElementById('addProjectBtn').addEventListener('click', openProjectModal);
    
    document.getElementById('projectForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('projectId').value;
        const projectData = {
            name: document.getElementById('projectName').value,
            client_id: document.getElementById('projectClient').value,
            status: document.getElementById('projectStatus').value,
            value: parseFloat(document.getElementById('projectValue').value) || 0,
            currency: document.getElementById('projectCurrency').value,
            start_date: document.getElementById('projectStartDate').value || null,
            end_date: document.getElementById('projectEndDate').value || null,
            description: document.getElementById('projectDescription').value || null
        };
        
        if (id) {
            await DB.updateProject(id, projectData);
            showToast('Project updated successfully!');
        } else {
            await DB.addProject(projectData);
            showToast('Project added successfully!');
        }
        
        closeModal('projectModal');
        renderProjects();
        updateDashboard();
    });
    
    // Invoices
    document.getElementById('createInvoiceBtn').addEventListener('click', openInvoiceModal);
    
    document.getElementById('addItemBtn').addEventListener('click', () => {
        const itemsContainer = document.getElementById('invoiceItems');
        const newItem = document.createElement('div');
        newItem.className = 'invoice-item';
        newItem.innerHTML = `
            <input type="text" placeholder="Description" class="item-desc">
            <input type="number" placeholder="Qty" class="item-qty" value="1">
            <input type="number" placeholder="Price" class="item-price" step="0.01">
            <span class="item-total">$0.00</span>
            <button type="button" class="btn-icon remove-item">×</button>
        `;
        itemsContainer.appendChild(newItem);
    });
    
    document.getElementById('invoiceItems').addEventListener('input', (e) => {
        if (e.target.classList.contains('item-qty') || e.target.classList.contains('item-price')) {
            updateInvoiceTotals();
        }
    });
    
    document.getElementById('invoiceItems').addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-item')) {
            e.target.closest('.invoice-item').remove();
            updateInvoiceTotals();
        }
    });
    
    document.getElementById('invoiceTax').addEventListener('input', updateInvoiceTotals);
    document.getElementById('invoiceCurrency').addEventListener('change', updateInvoiceTotals);
    
    document.getElementById('invoiceForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const invoiceId = document.getElementById('invoiceId').value;
        const items = [];
        document.querySelectorAll('.invoice-item').forEach(item => {
            const desc = item.querySelector('.item-desc').value;
            if (desc) {
                items.push({
                    description: desc,
                    quantity: parseFloat(item.querySelector('.item-qty').value) || 1,
                    price: parseFloat(item.querySelector('.item-price').value) || 0
                });
            }
        });
        
        const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
        const taxRate = parseFloat(document.getElementById('invoiceTax').value) || 0;
        const tax = subtotal * (taxRate / 100);
        
        const invoiceData = {
            invoice_number: document.getElementById('invoiceNumber').value,
            client_id: document.getElementById('invoiceClient').value,
            currency: document.getElementById('invoiceCurrency').value,
            date: document.getElementById('invoiceDate').value,
            due_date: document.getElementById('invoiceDueDate').value || null,
            subtotal,
            tax_rate: taxRate,
            tax,
            total: subtotal + tax,
            notes: document.getElementById('invoiceNotes').value || null,
            payment_status: 'pending'
        };
        
        if (invoiceId) {
            await DB.updateInvoice(invoiceId, invoiceData, items);
            showToast('Invoice updated successfully!');
        } else {
            await DB.addInvoice(invoiceData, items);
            showToast('Invoice created successfully!');
        }
        
        closeModal('invoiceModal');
        renderInvoices();
        updateDashboard();
    });
    
    // Search
    document.getElementById('globalSearch').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) return;
        
        const results = [];
        
        DB.clients.forEach(client => {
            if (client.name.toLowerCase().includes(query) || 
                (client.email && client.email.toLowerCase().includes(query)) ||
                (client.company && client.company.toLowerCase().includes(query))) {
                results.push({ type: 'client', data: client });
            }
        });
        
        DB.projects.forEach(project => {
            if (project.name.toLowerCase().includes(query)) {
                results.push({ type: 'project', data: project });
            }
        });
        
        DB.invoices.forEach(invoice => {
            if (invoice.invoice_number.toLowerCase().includes(query)) {
                results.push({ type: 'invoice', data: invoice });
            }
        });
        
        console.log('Search results:', results);
    });
    
    // Settings
    document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);
    
    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const groqKey = document.getElementById('groqApiKey').value;
        const businessName = document.getElementById('businessName').value;
        const businessEmail = document.getElementById('businessEmail').value;
        
        // Save settings
        if (groqKey) {
            await saveSettings('groq_api_key', groqKey);
            GROQ_API_KEY = groqKey;
        }
        if (businessName) {
            await saveSettings('business_name', businessName);
        }
        if (businessEmail) {
            await saveSettings('business_email', businessEmail);
        }
        
        showToast('Settings saved successfully!');
        closeModal('settingsModal');
    });
}

// Open settings modal and load current settings
async function openSettingsModal() {
    // Load current settings
    try {
        const [groqRes, nameRes, emailRes] = await Promise.all([
            db.from('settings').select('*').eq('key', 'groq_api_key').single(),
            db.from('settings').select('*').eq('key', 'business_name').single(),
            db.from('settings').select('*').eq('key', 'business_email').single()
        ]);
        
        document.getElementById('groqApiKey').value = groqRes.data?.value?.key || '';
        document.getElementById('businessName').value = nameRes.data?.value?.value || '';
        document.getElementById('businessEmail').value = emailRes.data?.value?.value || '';
    } catch (error) {
        console.log('Could not load settings');
    }
    
    openModal('settingsModal');
}

// ================================================
// MODALS
// ================================================
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function renderClients() {
    const tbody = document.getElementById('clientsTableBody');
    tbody.innerHTML = '';
    
    if (DB.clients.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-muted);">No clients yet. Click "Add Client" to get started.</td></tr>`;
        return;
    }
    
    DB.clients.forEach(client => {
        const projectCount = DB.projects.filter(p => p.client_id === client.id).length;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div class="client-avatar">${client.name.charAt(0).toUpperCase()}</div>
                    <span>${client.name}</span>
                </div>
            </td>
            <td>${client.email || '-'}</td>
            <td>${client.phone || '-'}</td>
            <td>${client.company || '-'}</td>
            <td>${projectCount}</td>
            <td><span class="status-badge status-${client.status}">${client.status}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn-icon" onclick="editClient('${client.id}')" title="Edit">✎</button>
                    <button class="btn-icon" onclick="deleteClient('${client.id}')" title="Delete">🗑</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function editClient(id) {
    const client = DB.clients.find(c => c.id === id);
    if (!client) return;
    
    document.getElementById('clientId').value = client.id;
    document.getElementById('clientName').value = client.name;
    document.getElementById('clientEmail').value = client.email || '';
    document.getElementById('clientPhone').value = client.phone || '';
    document.getElementById('clientCompany').value = client.company || '';
    document.getElementById('clientAddress').value = client.address || '';
    document.getElementById('clientNotes').value = client.notes || '';
    document.getElementById('clientStatus').value = client.status;
    document.getElementById('clientModalTitle').textContent = 'Edit Client';
    
    openModal('clientModal');
}

async function deleteClient(id) {
    if (!confirm('Are you sure you want to delete this client? This will also delete related projects and invoices.')) return;
    
    await DB.deleteClient(id);
    showToast('Client deleted successfully!');
    renderClients();
    updateDashboard();
}

// ================================================
// PROJECTS HELPER FUNCTIONS
// ================================================
function renderProjects() {
    const tbody = document.getElementById('projectsTableBody');
    tbody.innerHTML = '';
    
    if (DB.projects.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-muted);">No projects yet. Click "Add Project" to get started.</td></tr>`;
        return;
    }
    
    DB.projects.forEach(project => {
        const client = DB.clients.find(c => c.id === project.client_id);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${project.name}</strong></td>
            <td>${client ? client.name : 'Unknown'}</td>
            <td>${formatCurrency(project.value, project.currency)}</td>
            <td><span class="status-badge status-${project.status.replace(' ', '-')}">${project.status}</span></td>
            <td>${formatDate(project.start_date)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-icon" onclick="editProject('${project.id}')" title="Edit">✎</button>
                    <button class="btn-icon" onclick="deleteProject('${project.id}')" title="Delete">🗑</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function editProject(id) {
    const project = DB.projects.find(p => p.id === id);
    if (!project) return;
    
    populateClientSelect('projectClient');
    
    document.getElementById('projectId').value = project.id;
    document.getElementById('projectName').value = project.name;
    document.getElementById('projectClient').value = project.client_id;
    document.getElementById('projectStatus').value = project.status;
    document.getElementById('projectValue').value = project.value;
    document.getElementById('projectCurrency').value = project.currency;
    document.getElementById('projectStartDate').value = project.start_date || '';
    document.getElementById('projectEndDate').value = project.end_date || '';
    document.getElementById('projectDescription').value = project.description || '';
    document.getElementById('projectModalTitle').textContent = 'Edit Project';
    
    openModal('projectModal');
}

async function deleteProject(id) {
    if (!confirm('Are you sure you want to delete this project?')) return;
    
    await DB.deleteProject(id);
    showToast('Project deleted successfully!');
    renderProjects();
    updateDashboard();
}

// ================================================
// INVOICES HELPER FUNCTIONS
// ================================================
function updateInvoiceTotals() {
    const currency = document.getElementById('invoiceCurrency').value;
    const items = document.querySelectorAll('.invoice-item');
    let subtotal = 0;
    
    items.forEach(item => {
        const qty = parseFloat(item.querySelector('.item-qty').value) || 0;
        const price = parseFloat(item.querySelector('.item-price').value) || 0;
        const total = qty * price;
        item.querySelector('.item-total').textContent = formatCurrency(total, currency);
        subtotal += total;
    });
    
    const taxRate = parseFloat(document.getElementById('invoiceTax').value) || 0;
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    
    document.getElementById('invoiceSubtotal').textContent = formatCurrency(subtotal, currency);
    document.getElementById('invoiceTotal').textContent = formatCurrency(total, currency);
}

function resetInvoiceForm() {
    document.getElementById('invoiceForm').reset();
    document.getElementById('invoiceNumber').value = generateInvoiceNumber();
    const itemsContainer = document.getElementById('invoiceItems');
    itemsContainer.innerHTML = `
        <div class="invoice-item">
            <input type="text" placeholder="Description" class="item-desc">
            <input type="number" placeholder="Qty" class="item-qty" value="1">
            <input type="number" placeholder="Price" class="item-price" step="0.01">
            <span class="item-total">$0.00</span>
            <button type="button" class="btn-icon remove-item">×</button>
        </div>
    `;
    document.getElementById('invoiceSubtotal').textContent = '$0.00';
    document.getElementById('invoiceTotal').textContent = '$0.00';
    document.getElementById('invoiceModalTitle').textContent = 'Create Invoice';
}

function generateInvoiceNumber() {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const num = (DB.invoices.length + 1).toString().padStart(4, '0');
    return `INV-${year}${month}-${num}`;
}

function populateClientSelect(selectId) {
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">Select Client</option>';
    DB.clients.forEach(client => {
        const option = document.createElement('option');
        option.value = client.id;
        option.textContent = client.name;
        select.appendChild(option);
    });
}

function renderInvoices() {
    const tbody = document.getElementById('invoicesTableBody');
    tbody.innerHTML = '';
    
    if (DB.invoices.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-muted);">No invoices yet. Click "Create Invoice" to get started.</td></tr>`;
        return;
    }
    
    DB.invoices.forEach(invoice => {
        const client = DB.clients.find(c => c.id === invoice.client_id);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${invoice.invoice_number}</strong></td>
            <td>${client ? client.name : 'Unknown'}</td>
            <td>${formatCurrency(invoice.total, invoice.currency)}</td>
            <td>${formatDate(invoice.date)}</td>
            <td><span class="status-badge status-${invoice.payment_status}">${invoice.payment_status}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn-icon" onclick="viewInvoice('${invoice.id}')" title="View">👁</button>
                    <button class="btn-icon" onclick="downloadInvoice('${invoice.id}')" title="Download PDF">📥</button>
                    <button class="btn-icon" onclick="deleteInvoice('${invoice.id}')" title="Delete">🗑</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function viewInvoice(id) {
    const invoice = DB.invoices.find(i => i.id === id);
    if (!invoice) return;
    
    const client = DB.clients.find(c => c.id === invoice.client_id);
    const items = DB.getInvoiceItems(id);
    
    const content = document.getElementById('invoicePreviewContent');
    content.innerHTML = `
        <div class="invoice-preview">
            <div class="invoice-preview-header">
                <div>
                    <h1>INVOICE</h1>
                    <p><strong>${invoice.invoice_number}</strong></p>
                </div>
                <div style="text-align: right;">
                    <p><strong>Date:</strong> ${formatDate(invoice.date)}</p>
                    <p><strong>Due:</strong> ${formatDate(invoice.due_date)}</p>
                </div>
            </div>
            <div style="margin-bottom: 2rem;">
                <h3>Bill To:</h3>
                <p>${client?.name || 'Unknown'}</p>
                ${client?.company ? `<p>${client.company}</p>` : ''}
                ${client?.email ? `<p>${client.email}</p>` : ''}
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem;">
                <thead>
                    <tr style="border-bottom: 2px solid var(--accent-warm);">
                        <th style="text-align: left; padding: 0.5rem;">Description</th>
                        <th style="text-align: right; padding: 0.5rem;">Qty</th>
                        <th style="text-align: right; padding: 0.5rem;">Price</th>
                        <th style="text-align: right; padding: 0.5rem;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr style="border-bottom: 1px solid var(--border-color);">
                            <td style="padding: 0.5rem;">${item.description}</td>
                            <td style="padding: 0.5rem; text-align: right;">${item.quantity}</td>
                            <td style="padding: 0.5rem; text-align: right;">${formatCurrency(item.price, invoice.currency)}</td>
                            <td style="padding: 0.5rem; text-align: right;">${formatCurrency(item.quantity * item.price, invoice.currency)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div style="display: flex; justify-content: flex-end;">
                <div style="width: 250px;">
                    <div style="display: flex; justify-content: space-between; padding: 0.5rem 0;">
                        <span>Subtotal:</span>
                        <span>${formatCurrency(invoice.subtotal, invoice.currency)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.5rem 0;">
                        <span>Tax (${invoice.tax_rate}%):</span>
                        <span>${formatCurrency(invoice.tax, invoice.currency)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-top: 2px solid var(--accent-warm); font-size: 1.25rem; font-weight: bold;">
                        <span>Total:</span>
                        <span>${formatCurrency(invoice.total, invoice.currency)}</span>
                    </div>
                </div>
            </div>
            ${invoice.notes ? `<div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border-color);"><strong>Notes:</strong><p>${invoice.notes}</p></div>` : ''}
        </div>
    `;
    
    openModal('invoicePreviewModal');
}

async function downloadInvoice(id) {
    const invoice = DB.invoices.find(i => i.id === id);
    if (!invoice) return;
    
    const client = DB.clients.find(c => c.id === invoice.client_id);
    const items = DB.getInvoiceItems(id);
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(24);
    doc.setTextColor(233, 69, 96);
    doc.text('INVOICE', 20, 30);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(invoice.invoice_number, 20, 40);
    
    // Date info
    doc.setFontSize(10);
    doc.setTextColor(60);
    doc.text(`Date: ${formatDate(invoice.date)}`, 150, 30);
    doc.text(`Due: ${formatDate(invoice.due_date)}`, 150, 38);
    
    // Client info
    doc.setFontSize(12);
    doc.setTextColor(60);
    doc.text('Bill To:', 20, 60);
    doc.setFontSize(14);
    doc.text(client?.name || 'Unknown', 20, 70);
    if (client?.company) doc.text(client.company, 20, 78);
    if (client?.email) doc.text(client.email, 20, 86);
    
    // Items table
    let y = 110;
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Description', 20, y);
    doc.text('Qty', 100, y);
    doc.text('Price', 130, y);
    doc.text('Total', 170, y);
    
    y += 10;
    doc.setTextColor(60);
    items.forEach(item => {
        doc.text(item.description, 20, y);
        doc.text(String(item.quantity), 100, y);
        doc.text(formatCurrency(item.price, invoice.currency), 130, y);
        doc.text(formatCurrency(item.quantity * item.price, invoice.currency), 170, y);
        y += 8;
    });
    
    // Totals
    y += 10;
    doc.line(20, y, 190, y);
    y += 10;
    doc.text('Subtotal:', 130, y);
    doc.text(formatCurrency(invoice.subtotal, invoice.currency), 170, y);
    y += 8;
    doc.text(`Tax (${invoice.tax_rate}%):`, 130, y);
    doc.text(formatCurrency(invoice.tax, invoice.currency), 170, y);
    y += 10;
    doc.setFontSize(14);
    doc.setTextColor(233, 69, 96);
    doc.text('Total:', 130, y);
    doc.text(formatCurrency(invoice.total, invoice.currency), 170, y);
    
    // Notes
    if (invoice.notes) {
        y += 20;
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text('Notes:', 20, y);
        y += 6;
        doc.text(invoice.notes, 20, y);
    }
    
    doc.save(`${invoice.invoice_number}.pdf`);
    showToast('Invoice downloaded!');
}

async function deleteInvoice(id) {
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    
    await DB.deleteInvoice(id);
    showToast('Invoice deleted successfully!');
    renderInvoices();
    updateDashboard();
}

// ================================================
// DASHBOARD
// ================================================
function updateDashboard() {
    // Stats
    const totalClients = DB.clients.length;
    const activeProjects = DB.projects.filter(p => p.status === 'active').length;
    const completedProjects = DB.projects.filter(p => p.status === 'completed').length;
    const totalRevenue = DB.invoices.filter(i => i.payment_status === 'paid').reduce((sum, i) => sum + i.total, 0);
    
    // Update stat cards
    const totalClientsEl = document.getElementById('totalClients');
    const activeProjectsEl = document.getElementById('activeProjects');
    const completedProjectsEl = document.getElementById('completedProjects');
    const totalRevenueEl = document.getElementById('totalRevenue');
    
    if (totalClientsEl) totalClientsEl.textContent = totalClients;
    if (activeProjectsEl) activeProjectsEl.textContent = activeProjects;
    if (completedProjectsEl) completedProjectsEl.textContent = completedProjects;
    if (totalRevenueEl) totalRevenueEl.textContent = formatCurrency(totalRevenue);
    
    // Recent clients
    const recentClientsContainer = document.getElementById('recentClientsList');
    if (recentClientsContainer) {
        recentClientsContainer.innerHTML = '';
        if (DB.clients.length === 0) {
            recentClientsContainer.innerHTML = '<p class="empty-state">No clients yet. Add your first client!</p>';
        } else {
            DB.clients.slice(0, 5).forEach(client => {
                const div = document.createElement('div');
                div.className = 'client-list-item';
                div.innerHTML = `
                    <div class="client-avatar">${client.name.charAt(0).toUpperCase()}</div>
                    <div class="client-info">
                        <div class="client-name">${client.name}</div>
                        <div class="client-company">${client.company || client.email || ''}</div>
                    </div>
                `;
                recentClientsContainer.appendChild(div);
            });
        }
    }
    
    // Recent projects
    const recentProjectsContainer = document.getElementById('recentProjectsList');
    if (recentProjectsContainer) {
        recentProjectsContainer.innerHTML = '';
        if (DB.projects.length === 0) {
            recentProjectsContainer.innerHTML = '<p class="empty-state">No projects yet. Add your first project!</p>';
        } else {
            DB.projects.slice(0, 5).forEach(project => {
                const client = DB.clients.find(c => c.id === project.client_id);
                const div = document.createElement('div');
                div.className = 'project-list-item';
                div.innerHTML = `
                    <div class="project-info">
                        <div class="project-name">${project.name}</div>
                        <div class="project-client">${client?.name || 'Unknown'}</div>
                    </div>
                    <div class="project-meta">
                        <span class="project-value">${formatCurrency(project.value, project.currency)}</span>
                        <span class="status-badge status-${project.status}">${project.status}</span>
                    </div>
                `;
                recentProjectsContainer.appendChild(div);
            });
        }
    }
    
    // Pending invoices
    const pendingInvoicesContainer = document.getElementById('pendingInvoicesList');
    if (pendingInvoicesContainer) {
        const pendingInvoices = DB.invoices.filter(i => i.payment_status === 'pending');
        pendingInvoicesContainer.innerHTML = '';
        if (pendingInvoices.length === 0) {
            pendingInvoicesContainer.innerHTML = '<p class="empty-state">No pending invoices.</p>';
        } else {
            pendingInvoices.slice(0, 5).forEach(invoice => {
                const client = DB.clients.find(c => c.id === invoice.client_id);
                const div = document.createElement('div');
                div.className = 'invoice-list-item';
                div.innerHTML = `
                    <div class="invoice-info">
                        <div class="invoice-number">${invoice.invoice_number}</div>
                        <div class="invoice-client">${client?.name || 'Unknown'}</div>
                    </div>
                    <span class="status-badge status-${invoice.payment_status}">${invoice.payment_status}</span>
                `;
                pendingInvoicesContainer.appendChild(div);
            });
        }
    }
}

// ================================================
// ANALYTICS
// ================================================
function renderAnalytics() {
    renderRevenueChart();
    renderProjectStatusChart();
    renderClientDistribution();
    renderProjectsOverview();
}

let revenueChart = null;
let projectStatusChart = null;
let projectsOverviewChart = null;

function renderRevenueChart() {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;
    
    // Get monthly data
    const monthlyData = {};
    DB.invoices.filter(i => i.payment_status === 'paid').forEach(invoice => {
        const month = new Date(invoice.date).toLocaleString('default', { month: 'short' });
        monthlyData[month] = (monthlyData[month] || 0) + invoice.total;
    });
    
    const labels = Object.keys(monthlyData).slice(-6);
    const data = labels.map(l => monthlyData[l] || 0);
    
    if (revenueChart) revenueChart.destroy();
    
    revenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Revenue',
                data,
                borderColor: '#e94560',
                backgroundColor: 'rgba(233, 69, 96, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => '$' + value.toLocaleString()
                    }
                }
            }
        }
    });
}

function renderProjectStatusChart() {
    const ctx = document.getElementById('projectStatusChart');
    if (!ctx) return;
    
    const statusCounts = {
        active: DB.projects.filter(p => p.status === 'active').length,
        'on-hold': DB.projects.filter(p => p.status === 'on-hold').length,
        completed: DB.projects.filter(p => p.status === 'completed').length,
        cancelled: DB.projects.filter(p => p.status === 'cancelled').length
    };
    
    if (projectStatusChart) projectStatusChart.destroy();
    
    projectStatusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Active', 'On Hold', 'Completed', 'Cancelled'],
            datasets: [{
                data: [statusCounts.active, statusCounts['on-hold'], statusCounts.completed, statusCounts.cancelled],
                backgroundColor: ['#e94560', '#f4a261', '#2a9d8f', '#6b7280']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function renderClientDistribution() {
    const container = document.getElementById('clientDistribution');
    if (!container) return;
    
    const clientRevenue = {};
    DB.invoices.filter(i => i.payment_status === 'paid').forEach(invoice => {
        clientRevenue[invoice.client_id] = (clientRevenue[invoice.client_id] || 0) + invoice.total;
    });
    
    const sorted = Object.entries(clientRevenue)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    container.innerHTML = sorted.map(([clientId, revenue]) => {
        const client = DB.clients.find(c => c.id === clientId);
        const total = DB.invoices.filter(i => i.payment_status === 'paid').reduce((s, i) => s + i.total, 0);
        const percent = total > 0 ? (revenue / total * 100).toFixed(1) : 0;
        
        return `
            <div style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                    <span>${client?.name || 'Unknown'}</span>
                    <span>${formatCurrency(revenue)}</span>
                </div>
                <div style="background: var(--bg-secondary); border-radius: 4px; height: 8px; overflow: hidden;">
                    <div style="background: linear-gradient(90deg, var(--accent-warm), var(--accent-coral)); height: 100%; width: ${percent}%;"></div>
                </div>
            </div>
        `;
    }).join('') || '<p style="color: var(--text-muted);">No data yet</p>';
}

function renderProjectsOverview() {
    const ctx = document.getElementById('projectsOverviewChart');
    if (!ctx) return;
    
    // Get active projects sorted by value
    const activeProjects = DB.projects
        .filter(p => p.status === 'active')
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);
    
    if (activeProjects.length === 0) {
        ctx.parentElement.innerHTML = '<p class="empty-state">No active projects to display</p>';
        return;
    }
    
    const labels = activeProjects.map(p => {
        const client = DB.clients.find(c => c.id === p.client_id);
        return p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name;
    });
    
    const values = activeProjects.map(p => p.value);
    const currencies = activeProjects.map(p => p.currency);
    
    // Calculate days remaining for each project
    const progressData = activeProjects.map(p => {
        if (!p.start_date || !p.end_date) return 50;
        const start = new Date(p.start_date);
        const end = new Date(p.end_date);
        const today = new Date();
        const total = (end - start) / (1000 * 60 * 60 * 24);
        const elapsed = (today - start) / (1000 * 60 * 60 * 24);
        if (total <= 0) return 100;
        return Math.min(100, Math.max(0, (elapsed / total) * 100));
    });
    
    if (projectsOverviewChart) projectsOverviewChart.destroy();
    
    projectsOverviewChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Project Value',
                data: values,
                backgroundColor: activeProjects.map((p, i) => {
                    const colors = [
                        'rgba(233, 69, 96, 0.8)',
                        'rgba(42, 157, 143, 0.8)',
                        'rgba(244, 162, 97, 0.8)',
                        'rgba(107, 114, 128, 0.8)',
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(168, 85, 247, 0.8)'
                    ];
                    return colors[i % colors.length];
                }),
                borderColor: 'transparent',
                borderRadius: 6,
                barThickness: 28
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const project = activeProjects[context.dataIndex];
                            const progress = progressData[context.dataIndex];
                            return [
                                `Value: ${formatCurrency(context.raw, project.currency)}`,
                                `Progress: ${progress.toFixed(0)}%`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        callback: value => '$' + value.toLocaleString(),
                        color: '#9ca3af'
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#e5e7eb' }
                }
            }
        }
    });
}

// ================================================
// INITIALIZATION
// ================================================
async function initApp() {
    console.log('initApp() called');
    
    try {
        // Setup all event listeners
        setupEventListeners();
        console.log('Event listeners set up');
        
        // Load data from Supabase
        await DB.loadAll();
        console.log('Data loaded from Supabase');
        
        // Load settings (including Groq API key)
        await loadSettings();
        console.log('Settings loaded');
        
        // Initialize features
        initPWA();
        initKeyboardShortcuts();
        initDragAndDrop();
        initOfflineMode();
        console.log('Features initialized');
        
        // Render initial data
        updateDashboard();
        renderClients();
        renderProjects();
        renderInvoices();
        console.log('UI rendered');
        
        showToast('Welcome back!');
    } catch (error) {
        console.error('initApp error:', error);
        showToast('Error: ' + error.message);
    }
}

// Check auth on load
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, setting up app...');
    
    // Setup login form
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Login form submitted');
        const password = document.getElementById('loginPassword').value;
        const errorEl = document.getElementById('loginError');
        
        if (login(password)) {
            console.log('Login successful!');
            hideLoginScreen();
            document.getElementById('loginPassword').value = '';
            errorEl.classList.remove('show');
            try {
                await initApp();
                console.log('App initialized!');
            } catch (err) {
                console.error('Error initializing app:', err);
                showToast('Error loading app: ' + err.message);
            }
        } else {
            console.log('Login failed - wrong password');
            errorEl.classList.add('show');
            document.getElementById('loginPassword').value = '';
        }
    });
    
    // Setup logout button
    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (confirm('Are you sure you want to logout?')) {
            logout();
        }
    });
    
    // Check auth
    if (checkAuth()) {
        console.log('Already authenticated, loading app...');
        hideLoginScreen();
        initApp().catch(err => console.error('Init error:', err));
    } else {
        console.log('Not authenticated, showing login...');
        showLoginScreen();
    }
});

// Register service worker for PWA (after page loads)
window.addEventListener('load', () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(console.error);
    }
});