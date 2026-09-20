/**
 * app.js - Main Application Engine for Meera Heights
 * Co-owned by Sajida (1st & 2nd Floors) and Jeelani (3rd, 4th & 5th Floors)
 * 
 * Features:
 * - Floor Ownership: Sajida owns 1st & 2nd Floors; Jeelani owns 3rd, 4th & 5th Floors.
 * - Dynamic Floor-to-Wallet routing for rent and tenant advance deposits.
 * - Full Wallet History with dedicated Breakup views:
 *     1. All Transactions (with Edit & Delete on EVERY item!)
 *     2. Tenant Advances / Security Deposits Breakup (Held, Deductions, Refunds)
 *     3. Rent Collections Ledger
 *     4. Maintenance & Expense Debits
 *     5. Capital Adjustments
 * - Tenant Advance Lifecycle: One-time deposit, terms & conditions deductions, refund before vacating or upon tenure completion.
 * - Automated Recurring Building Expenses Engine.
 * - Multi-Sheet Excel & CSV Exports.
 */

// Application State
const App = {
    data: null,
    activeTab: 'dashboard',
    walletSubTab: 'all',          // 'all', 'advances', 'rents', 'expenses', 'capital'
    walletOwnerFilter: 'all',      // 'all', 'sajida', 'jeelani'
    expenseCategoryFilter: 'all',
    tenantSearchQuery: '',
    expenseSearchQuery: '',
    selectedMonthFilter: 'all',
    expenseFilters: {
        search: '',
        dateMode: 'all',          // 'all', 'specific', 'range', 'year'
        dateSpecific: '',
        dateStart: '',
        dateEnd: '',
        dateYear: '',
        categoryId: 'all',
        subCategory: 'all',
        minAmount: null,
        maxAmount: null,
        splitType: 'all',         // 'all', 'ratio', 'sajida_only', 'jeelani_only', 'custom'
        wallet: 'all',            // 'all', 'both', 'sajida', 'jeelani'
        quickPreset: 'all'
    },
    isExpenseFilterDrawerOpen: false,
    activeFloorFilter: 'all',     // 'all', '1', '2', '3', '4', '5'
    floorMonthFilter: 'all',
    floorSearchQuery: '',
    sortState: {
        expenses: 'date-desc',
        floor: 'date-desc',
        rent: 'date-desc',
        wallet: 'date-desc'
    },
    expenseCalendarMonth: new Date().toISOString().slice(0, 7),
    _isSavingBankTransfer: false,
    _isSavingWalletTransfer: false,
    editingTenantId: null,
    editingExpenseId: null,
    editingRecurringId: null,
    editingRentId: null,
    editingCapitalId: null,
    editingBankTransferId: null,
    editingWalletTransferId: null,
    settlingTenantId: null,
    charts: {
        expenseCategory: null,
        monthlyCashflow: null
    },

    init() {
        this.initTheme();
        if (!AuthManager.isAuthenticated()) {
            document.body.classList.add('portal-locked');
        }
        this.initAuthGate();
        this.data = StorageManager.getData();
        this.setupEventListeners();
        this.populateMonthFilter();
        this.populateExpenseFilterDropdowns();
        
        // Auto-post recurring expenses if enabled
        this.checkAndAutoPostRecurring();

        // Initialize Real-Time Cloud Sync Engine (Firebase)
        this.initCloudSync();

        // Initialize Automated Backup Scheduler & Monitor
        this.initBackupScheduler();

        this.renderAll();

        console.log('Meera Heights App Initialized with Floor Ownership & Advance Management.');
    },

    escapeHtml(str) {
        if (!str && str !== 0) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    // -------------------------------------------------------------
    // FLOOR OWNERSHIP HELPERS
    // -------------------------------------------------------------
    getFloorOwner(floor) {
        const f = parseInt(floor) || 1;
        if (f === 1 || f === 2) {
            return { id: 'sajida', name: 'Sajida', floors: '1st & 2nd Floors', color: 'emerald' };
        }
        return { id: 'jeelani', name: 'Jeelani', floors: '3rd, 4th & 5th Floors', color: 'blue' };
    },

    detectFloorFromFlat(flatStr) {
        if (!flatStr) return 1;
        const s = flatStr.toString().toLowerCase().trim();
        if (s.includes('1st') || s.startsWith('10') || (s.length === 3 && s.startsWith('1'))) return 1;
        if (s.includes('2nd') || s.startsWith('20') || (s.length === 3 && s.startsWith('2'))) return 2;
        if (s.includes('3rd') || s.startsWith('30') || (s.length === 3 && s.startsWith('3'))) return 3;
        if (s.includes('4th') || s.startsWith('40') || (s.length === 3 && s.startsWith('4'))) return 4;
        if (s.includes('5th') || s.startsWith('50') || (s.length === 3 && s.startsWith('5'))) return 5;
        return 1;
    },

    // -------------------------------------------------------------
    // WALLET DEFINITIONS & HELPERS (4 WALLETS SYSTEM)
    // -------------------------------------------------------------
    getWalletInfo(walletId) {
        if (typeof WALLET_DEFINITIONS !== 'undefined' && WALLET_DEFINITIONS[walletId]) {
            return WALLET_DEFINITIONS[walletId];
        }
        const map = {
            sajida_advance: { id: 'sajida_advance', name: 'Sajida Advance Wallet', shortName: 'Sajida Advance', ownerId: 'sajida', ownerName: 'Sajida', type: 'advance', floors: '1st & 2nd Floors', color: 'emerald' },
            sajida_rent: { id: 'sajida_rent', name: 'Sajida Rent Wallet', shortName: 'Sajida Rent', ownerId: 'sajida', ownerName: 'Sajida', type: 'rent', floors: '1st & 2nd Floors', color: 'teal' },
            jeelani_advance: { id: 'jeelani_advance', name: 'Jeelani Advance Wallet', shortName: 'Jeelani Advance', ownerId: 'jeelani', ownerName: 'Jeelani', type: 'advance', floors: '3rd, 4th & 5th Floors', color: 'blue' },
            jeelani_rent: { id: 'jeelani_rent', name: 'Jeelani Rent Wallet', shortName: 'Jeelani Rent', ownerId: 'jeelani', ownerName: 'Jeelani', type: 'rent', floors: '3rd, 4th & 5th Floors', color: 'indigo' }
        };
        return map[walletId] || { id: walletId, name: walletId, shortName: walletId, ownerId: 'sajida', ownerName: 'Owner', type: 'wallet', color: 'slate' };
    },

    getWalletBalance(walletId, stats = null) {
        const s = stats || this.getStats();
        if (walletId === 'sajida_advance') return s.sajidaAdvanceBalance || 0;
        if (walletId === 'sajida_rent') return s.sajidaRentBalance || 0;
        if (walletId === 'jeelani_advance') return s.jeelaniAdvanceBalance || 0;
        if (walletId === 'jeelani_rent') return s.jeelaniRentBalance || 0;
        return 0;
    },

    // -------------------------------------------------------------
    // TOAST NOTIFICATION SYSTEM
    // -------------------------------------------------------------
    showToast(message, type = 'success') {
        let toast = document.getElementById('app-floating-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'app-floating-toast';
            toast.className = 'fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl text-xs font-bold transition-all transform duration-300 pointer-events-none opacity-0 translate-y-[-10px]';
            document.body.appendChild(toast);
        }

        let icon = 'fa-check-circle';
        let bg = 'bg-slate-900 text-white border border-slate-700';
        if (type === 'success') {
            bg = 'bg-emerald-600 text-white shadow-emerald-600/30';
            icon = 'fa-circle-check';
        } else if (type === 'info') {
            bg = 'bg-blue-600 text-white shadow-blue-600/30';
            icon = 'fa-info-circle';
        } else if (type === 'warning') {
            bg = 'bg-amber-600 text-white shadow-amber-600/30';
            icon = 'fa-triangle-exclamation';
        } else if (type === 'error') {
            bg = 'bg-rose-600 text-white shadow-rose-600/30';
            icon = 'fa-circle-xmark';
        }

        toast.className = `fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl text-xs font-bold transition-all transform duration-300 ${bg}`;
        toast.innerHTML = `<i class="fa-solid ${icon} text-base"></i><span>${message}</span>`;

        setTimeout(() => {
            toast.classList.remove('opacity-0', 'translate-y-[-10px]');
            toast.classList.add('opacity-100', 'translate-y-0');
        }, 10);

        setTimeout(() => {
            toast.classList.remove('opacity-100', 'translate-y-0');
            toast.classList.add('opacity-0', 'translate-y-[-10px]');
        }, 3500);
    },

    copyMobileAccessUrl() {
        const host = window.location.hostname;
        if (!host || host === 'localhost' || host === '127.0.0.1' || host === '::1') {
            this.showToast('Use the LAN URL printed by server.py, for example http://192.168.1.15:8000.', 'info');
            return;
        }
        const url = `${window.location.protocol}//${host}${window.location.port ? `:${window.location.port}` : ''}`;
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(url).then(() => this.showToast(`Mobile URL copied: ${url}`, 'success'))
                .catch(() => window.prompt('Copy this mobile URL:', url));
        } else {
            window.prompt('Copy this mobile URL:', url);
        }
    },

    // -------------------------------------------------------------
    // REAL-TIME CLOUD SYNC (FIREBASE FIRESTORE) METHODS
    // -------------------------------------------------------------
    initCloudSync() {
        if (typeof CloudSyncManager === 'undefined') return;

        CloudSyncManager.onStatusChange((status, detail) => {
            this.updateCloudSyncUI(status, detail);
        });

        CloudSyncManager.onDataUpdated((newData, meta) => {
            this.handleCloudDataUpdated(newData, meta);
        });

        CloudSyncManager.init();
    },

    updateCloudSyncUI(status, detail = '') {
        // Mobile & Desktop Pill Indicators
        const dot = document.getElementById('nav-cloud-sync-dot');
        const text = document.getElementById('nav-cloud-sync-text');
        const dotDesktop = document.getElementById('nav-cloud-sync-dot-desktop');
        const textDesktop = document.getElementById('nav-cloud-sync-text-desktop');
        const badge = document.getElementById('cloud-sync-status-badge');
        const statusText = document.getElementById('cloud-sync-status-text');
        const lastTime = document.getElementById('cloud-sync-last-time');

        // Modal elements
        const modalDot = document.getElementById('modal-cloud-status-dot');
        const modalLabel = document.getElementById('modal-cloud-status-label');
        const modalDetails = document.getElementById('modal-cloud-status-details');
        const btnDisconnect = document.getElementById('btn-cloud-disconnect');

        const cfg = typeof CloudSyncManager !== 'undefined' ? CloudSyncManager.getConfig() : null;
        if (btnDisconnect) {
            btnDisconnect.classList.toggle('hidden', !cfg);
        }

        // Format last synced time
        let formattedLast = 'Never';
        if (typeof CloudSyncManager !== 'undefined') {
            const rawLast = CloudSyncManager.getLastSynced();
            if (rawLast) {
                const d = new Date(rawLast);
                formattedLast = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' (' + d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ')';
            }
        }
        if (lastTime) lastTime.textContent = formattedLast;

        const updatePill = (dotEl, textEl, dotClass, textStr) => {
            if (dotEl) dotEl.className = dotClass;
            if (textEl) textEl.textContent = textStr;
        };

        if (status === 'connected') {
            updatePill(dot, text, 'w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50', 'Sync Live');
            updatePill(dotDesktop, textDesktop, 'w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50', 'Sync Live');
            if (badge) {
                badge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
                badge.textContent = 'Connected (Live)';
            }
            if (statusText) statusText.textContent = 'Connected & Listening';
            if (modalDot) modalDot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0';
            if (modalLabel) modalLabel.textContent = 'Connected & Syncing';
            if (modalDetails) modalDetails.textContent = detail || 'Firestore real-time listener active';
        } else if (status === 'syncing') {
            updatePill(dot, text, 'w-2 h-2 rounded-full bg-blue-500 animate-pulse', 'Syncing...');
            updatePill(dotDesktop, textDesktop, 'w-2 h-2 rounded-full bg-blue-500 animate-pulse', 'Syncing...');
            if (badge) {
                badge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-blue-500/20 text-blue-300 border border-blue-500/30';
                badge.textContent = 'Syncing...';
            }
            if (statusText) statusText.textContent = detail || 'Synchronizing with cloud...';
            if (modalDot) modalDot.className = 'w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shrink-0';
            if (modalLabel) modalLabel.textContent = 'Syncing...';
            if (modalDetails) modalDetails.textContent = detail;
        } else if (status === 'offline') {
            updatePill(dot, text, 'w-2 h-2 rounded-full bg-amber-500', 'Offline');
            updatePill(dotDesktop, textDesktop, 'w-2 h-2 rounded-full bg-amber-500', 'Offline');
            if (badge) {
                badge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-amber-500/20 text-amber-300 border border-amber-500/30';
                badge.textContent = 'Offline';
            }
            if (statusText) statusText.textContent = 'Offline (Local persistence active)';
            if (modalDot) modalDot.className = 'w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0';
            if (modalLabel) modalLabel.textContent = 'Device Offline';
            if (modalDetails) modalDetails.textContent = detail || 'Changes queued locally';
        } else if (status === 'error') {
            updatePill(dot, text, 'w-2 h-2 rounded-full bg-rose-500', 'Sync Error');
            updatePill(dotDesktop, textDesktop, 'w-2 h-2 rounded-full bg-rose-500', 'Sync Error');
            if (badge) {
                badge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-rose-500/20 text-rose-300 border border-rose-500/30';
                badge.textContent = 'Sync Error';
            }
            if (statusText) statusText.textContent = detail || 'Database error';
            if (modalDot) modalDot.className = 'w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0';
            if (modalLabel) modalLabel.textContent = 'Connection Error';
            if (modalDetails) modalDetails.textContent = detail;
        } else {
            // Disconnected
            updatePill(dot, text, 'w-2 h-2 rounded-full bg-slate-400', 'Sync Off');
            updatePill(dotDesktop, textDesktop, 'w-2 h-2 rounded-full bg-slate-400', 'Sync Off');
            if (badge) {
                badge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-slate-700 text-slate-300';
                badge.textContent = 'Not Configured';
            }
            if (statusText) statusText.textContent = 'Disconnected';
            if (modalDot) modalDot.className = 'w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0';
            if (modalLabel) modalLabel.textContent = 'Not Connected';
            if (modalDetails) modalDetails.textContent = 'Cloud sync not configured';
        }
    },

    handleCloudDataUpdated(newData, meta) {
        if (!newData) return;
        // Anti-wipe safeguard: Never replace populated local state with empty tenants
        if ((!newData.tenants || newData.tenants.length === 0) && (this.data && this.data.tenants && this.data.tenants.length > 0)) {
            console.warn('Ignored cloud update with empty tenants array.');
            return;
        }
        if (!newData.tenants || newData.tenants.length === 0) {
            newData.tenants = JSON.parse(JSON.stringify(INITIAL_DATA.tenants));
        }
        if (!newData.rentCollections || newData.rentCollections.length === 0) {
            newData.rentCollections = JSON.parse(JSON.stringify(INITIAL_DATA.rentCollections));
        }
        if (!newData.expenses || newData.expenses.length === 0) {
            newData.expenses = JSON.parse(JSON.stringify(INITIAL_DATA.expenses));
        }
        if (!newData.bankTransactions || newData.bankTransactions.length === 0) {
            newData.bankTransactions = JSON.parse(JSON.stringify(INITIAL_DATA.bankTransactions));
        }
        this.data = newData;
        this.renderAll();

        const platform = meta && meta.clientPlatform ? meta.clientPlatform : 'paired device';
        this.showToast(`Cloud data updated from ${platform}! Synchronized successfully.`, 'info');
    },

    openCloudSyncModal() {
        try {
            this.showModal('modal-cloud-sync-setup');
            const textarea = document.getElementById('cloud-sync-config-input');
            if (textarea && typeof CloudSyncManager !== 'undefined') {
                const currentCfg = CloudSyncManager.getConfig() || DEFAULT_FIREBASE_CONFIG;
                textarea.value = JSON.stringify(currentCfg, null, 2);
            }
            if (typeof CloudSyncManager !== 'undefined') {
                this.updateCloudSyncUI(CloudSyncManager.syncStatus, CloudSyncManager.lastStatusDetail);
            }
        } catch (err) {
            console.error('openCloudSyncModal error:', err);
            this.showModal('modal-cloud-sync-setup');
        }
    },

    saveCloudSyncConfig() {
        const textarea = document.getElementById('cloud-sync-config-input');
        if (!textarea) return;
        const val = textarea.value.trim();
        if (!val) {
            alert('Please paste your Firebase configuration snippet or JSON.');
            return;
        }

        const parsed = CloudSyncManager.parseFirebaseSnippet(val);
        if (!parsed) {
            alert('Invalid Firebase configuration! Please ensure you paste the full Firebase credentials (including apiKey and projectId).');
            return;
        }

        const connected = CloudSyncManager.connect(parsed, true);
        if (connected) {
            // Seed cloud with current local dataset
            CloudSyncManager.pushToCloud(this.data, true);
            this.hideModal('modal-cloud-sync-setup');
            this.showToast('Cloud Sync connected! Your building data is now synced.', 'success');
        } else {
            this.showToast('Could not initialize Firebase. Check browser console.', 'error');
        }
    },

    disconnectCloudSync() {
        if (!confirm('Are you sure you want to disconnect Cloud Sync? Your current building records on this device will stay saved locally, but real-time multi-device sync will stop.')) {
            return;
        }
        CloudSyncManager.disconnect();
        const textarea = document.getElementById('cloud-sync-config-input');
        if (textarea) textarea.value = '';
        this.hideModal('modal-cloud-sync-setup');
        this.showToast('Cloud Sync disconnected.', 'info');
    },

    openCloudPairQrModal() {
        try {
            this.showModal('modal-cloud-sync-qr');

            const pairingUrl = (typeof CloudSyncManager !== 'undefined' && CloudSyncManager.generatePairingUrl)
                ? CloudSyncManager.generatePairingUrl()
                : 'https://sameerprince152-ship-it.github.io/meera-height-app/#cloud-sync=active';

            const urlInput = document.getElementById('cloud-pair-url-input');
            if (urlInput) urlInput.value = pairingUrl;

            const qrContainer = document.getElementById('cloud-sync-qrcode');
            if (qrContainer) {
                const encodedUrl = encodeURIComponent(pairingUrl);
                qrContainer.innerHTML = `
                    <div class="flex flex-col items-center justify-center">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=4&data=${encodedUrl}" 
                             alt="Mobile Pairing QR Code" 
                             class="w-48 h-48 sm:w-52 sm:h-52 rounded-2xl border border-slate-200 shadow-sm object-contain bg-white p-2"
                             onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\'p-4 text-xs text-slate-500\'>Scan via camera or copy link below.</div>';" />
                    </div>
                `;
            }

            const waBtn = document.getElementById('btn-share-pair-whatsapp');
            if (waBtn) {
                const waText = `Open Meera Heights Building Management on your phone:\n${pairingUrl}`;
                waBtn.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}`;
            }
        } catch (err) {
            console.error('openCloudPairQrModal error:', err);
            this.showModal('modal-cloud-sync-qr');
        }
    },

    copyCloudPairUrl() {
        const urlInput = document.getElementById('cloud-pair-url-input');
        if (!urlInput || !urlInput.value) return;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(urlInput.value)
                .then(() => this.showToast('Mobile pairing link copied to clipboard! Open it on your phone.', 'success'))
                .catch(() => window.prompt('Copy pairing URL:', urlInput.value));
        } else {
            urlInput.select();
            document.execCommand('copy');
            this.showToast('Mobile pairing link copied to clipboard!', 'success');
        }
    },

    async forceSyncNow() {
        if (typeof CloudSyncManager === 'undefined') {
            this.showToast('Cloud Sync manager not loaded.', 'error');
            return;
        }

        const btn = document.querySelector('button[onclick="App.forceSyncNow()"]');
        const originalHtml = btn ? btn.innerHTML : 'Sync Now';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-arrows-rotate animate-spin mr-1"></i> Syncing...';
        }

        try {
            if (!CloudSyncManager.db && CloudSyncManager.getConfig()) {
                CloudSyncManager.connect(CloudSyncManager.getConfig());
            }

            this.showToast('Connecting and uploading latest building records...', 'info');
            await CloudSyncManager.pushToCloud(this.data, true);

            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            CloudSyncManager.setLastSynced(now);

            const lastTimeEl = document.getElementById('cloud-sync-last-time');
            if (lastTimeEl) lastTimeEl.textContent = `${timeStr} (Just now)`;

            this.updateCloudSyncUI('connected', 'Live Cloud Sync Connected');
            this.showToast('✓ Cloud Sync complete! All records uploaded to cloud database.', 'success');
        } catch (e) {
            console.error('Manual sync error:', e);
            this.showToast('Sync error: ' + (e.message || e), 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    },

    // -------------------------------------------------------------
    // CALCULATION & STATS ENGINE
    // -------------------------------------------------------------
    getStats() {
        // --- 1. Capital Adjustments ---
        let sajidaCapital = 0;
        let jeelaniCapital = 0;
        let sajidaAdvCapital = 0;
        let sajidaRentCapital = 0;
        let jeelaniAdvCapital = 0;
        let jeelaniRentCapital = 0;

        (this.data.walletAdjustments || []).forEach(adj => {
            const amt = parseFloat(adj.amount) || 0;
            const delta = (adj.type === 'withdrawal' ? -amt : amt);
            if (adj.ownerId === 'sajida') {
                sajidaCapital += delta;
                if (adj.walletId === 'sajida_rent') {
                    sajidaRentCapital += delta;
                } else {
                    sajidaAdvCapital += delta;
                }
            } else if (adj.ownerId === 'jeelani') {
                jeelaniCapital += delta;
                if (adj.walletId === 'jeelani_rent') {
                    jeelaniRentCapital += delta;
                } else {
                    jeelaniAdvCapital += delta;
                }
            }
        });

        // --- 2. Rent Collections ---
        let totalRent = 0;
        let sajidaRentTotal = 0;
        let jeelaniRentTotal = 0;
        let sajidaRentWallet = 0;
        let sajidaRentBank = 0;
        let jeelaniRentWallet = 0;
        let jeelaniRentBank = 0;
        let totalRentWallet = 0;
        let totalRentBank = 0;

        (this.data.rentCollections || []).forEach(rent => {
            const amt = parseFloat(rent.amount) || 0;
            const isBank = (rent.creditDestination === 'bank');
            totalRent += amt;

            if (isBank) totalRentBank += amt;
            else totalRentWallet += amt;

            if (rent.ownerCredited === 'sajida') {
                sajidaRentTotal += amt;
                if (isBank) sajidaRentBank += amt;
                else sajidaRentWallet += amt;
            } else if (rent.ownerCredited === 'jeelani') {
                jeelaniRentTotal += amt;
                if (isBank) jeelaniRentBank += amt;
                else jeelaniRentWallet += amt;
            } else {
                const sajShare = Math.round((amt * 40) / 100);
                const jeeShare = amt - sajShare;
                sajidaRentTotal += sajShare;
                jeelaniRentTotal += jeeShare;
                if (isBank) {
                    sajidaRentBank += sajShare;
                    jeelaniRentBank += jeeShare;
                } else {
                    sajidaRentWallet += sajShare;
                    jeelaniRentWallet += jeeShare;
                }
            }
        });

        // --- 3. Expenses Debited (ALL Expenses Deducted from Advance Wallet by Requirement) ---
        let totalExpenses = 0;
        let sajidaExpTotal = 0;
        let jeelaniExpTotal = 0;
        let sajidaExpAdvance = 0;
        let sajidaExpRent = 0;
        let jeelaniExpAdvance = 0;
        let jeelaniExpRent = 0;

        (this.data.expenses || []).forEach(exp => {
            const amt = parseFloat(exp.amount) || 0;
            const sAmt = parseFloat(exp.sajidaAmount) || 0;
            const jAmt = parseFloat(exp.jeelaniAmount) || 0;
            totalExpenses += amt;
            sajidaExpTotal += sAmt;
            jeelaniExpTotal += jAmt;

            // Default debited source is advance wallet
            const source = exp.debitedSource || 'advance';
            if (source === 'rent') {
                sajidaExpRent += sAmt;
                jeelaniExpRent += jAmt;
            } else {
                sajidaExpAdvance += sAmt;
                jeelaniExpAdvance += jAmt;
            }
        });

        // --- 4. Tenant Advance Deposits & Settlements ---
        let sajidaAdvancesCollected = 0;
        let jeelaniAdvancesCollected = 0;
        let sajidaAdvancesHeld = 0;
        let jeelaniAdvancesHeld = 0;
        let totalDeductions = 0;
        let totalRefunds = 0;
        let sajidaRefunds = 0;
        let jeelaniRefunds = 0;
        let sajidaDeductions = 0;
        let jeelaniDeductions = 0;

        (this.data.tenants || []).forEach(t => {
            const deposit = parseFloat(t.advanceDeposit) || 0;
            const refunded = parseFloat(t.advanceRefunded) || 0;
            const deductions = parseFloat(t.advanceDeductions) || 0;
            const activeHeld = Math.max(0, deposit - refunded - deductions);

            const floor = parseInt(t.floor) || this.detectFloorFromFlat(t.flat);
            const isSajida = (floor === 1 || floor === 2);

            if (isSajida) {
                sajidaAdvancesCollected += deposit;
                sajidaAdvancesHeld += activeHeld;
                sajidaRefunds += refunded;
                sajidaDeductions += deductions;
            } else {
                jeelaniAdvancesCollected += deposit;
                jeelaniAdvancesHeld += activeHeld;
                jeelaniRefunds += refunded;
                jeelaniDeductions += deductions;
            }

            totalRefunds += refunded;
            totalDeductions += deductions;
        });

        // --- 5. Internal Wallet Transfers (Advance ⇄ Rent Interactions) ---
        let sajidaAdvTransfersIn = 0;
        let sajidaAdvTransfersOut = 0;
        let sajidaRentTransfersIn = 0;
        let sajidaRentTransfersOut = 0;
        let jeelaniAdvTransfersIn = 0;
        let jeelaniAdvTransfersOut = 0;
        let jeelaniRentTransfersIn = 0;
        let jeelaniRentTransfersOut = 0;
        let totalInternalTransfers = 0;

        (this.data.walletTransfers || []).forEach(wt => {
            const amt = parseFloat(wt.amount) || 0;
            totalInternalTransfers += amt;

            // Debited from source wallet
            if (wt.fromWallet === 'sajida_advance') sajidaAdvTransfersOut += amt;
            else if (wt.fromWallet === 'sajida_rent') sajidaRentTransfersOut += amt;
            else if (wt.fromWallet === 'jeelani_advance') jeelaniAdvTransfersOut += amt;
            else if (wt.fromWallet === 'jeelani_rent') jeelaniRentTransfersOut += amt;

            // Credited to destination wallet
            if (wt.toWallet === 'sajida_advance') sajidaAdvTransfersIn += amt;
            else if (wt.toWallet === 'sajida_rent') sajidaRentTransfersIn += amt;
            else if (wt.toWallet === 'jeelani_advance') jeelaniAdvTransfersIn += amt;
            else if (wt.toWallet === 'jeelani_rent') jeelaniRentTransfersIn += amt;
        });

        const sajidaAdvTransfersNet = sajidaAdvTransfersIn - sajidaAdvTransfersOut;
        const sajidaRentTransfersNet = sajidaRentTransfersIn - sajidaRentTransfersOut;
        const jeelaniAdvTransfersNet = jeelaniAdvTransfersIn - jeelaniAdvTransfersOut;
        const jeelaniRentTransfersNet = jeelaniRentTransfersIn - jeelaniRentTransfersOut;

        // --- 6. Wallet ⇄ Bank Interactions ---
        let sajidaAdvBankIn = 0, sajidaAdvBankOut = 0;
        let sajidaRentBankIn = 0, sajidaRentBankOut = 0;
        let jeelaniAdvBankIn = 0, jeelaniAdvBankOut = 0;
        let jeelaniRentBankIn = 0, jeelaniRentBankOut = 0;

        let sajidaBankInflow = 0;   // Owner total Bank -> Wallet (+)
        let sajidaBankOutflow = 0;  // Owner total Wallet -> Bank (-)
        let jeelaniBankInflow = 0;  // Owner total Bank -> Wallet (+)
        let jeelaniBankOutflow = 0; // Owner total Wallet -> Bank (-)

        (this.data.bankTransactions || []).forEach(tx => {
            const amt = parseFloat(tx.amount) || 0;
            const isB2W = (tx.type === 'bank_to_wallet');

            let wId = tx.walletId;
            if (!wId) {
                if (tx.notes && tx.notes.toLowerCase().includes('advance')) {
                    wId = (tx.ownerId === 'sajida') ? 'sajida_advance' : 'jeelani_advance';
                } else {
                    wId = (tx.ownerId === 'sajida') ? 'sajida_rent' : 'jeelani_rent';
                }
            }

            if (wId === 'sajida_advance') {
                if (isB2W) sajidaAdvBankIn += amt;
                else sajidaAdvBankOut += amt;
            } else if (wId === 'sajida_rent') {
                if (isB2W) sajidaRentBankIn += amt;
                else sajidaRentBankOut += amt;
            } else if (wId === 'jeelani_advance') {
                if (isB2W) jeelaniAdvBankIn += amt;
                else jeelaniAdvBankOut += amt;
            } else if (wId === 'jeelani_rent') {
                if (isB2W) jeelaniRentBankIn += amt;
                else jeelaniRentBankOut += amt;
            }

            if (tx.ownerId === 'sajida' || (wId && wId.startsWith('sajida'))) {
                if (isB2W) sajidaBankInflow += amt;
                else sajidaBankOutflow += amt;
            } else {
                if (isB2W) jeelaniBankInflow += amt;
                else jeelaniBankOutflow += amt;
            }
        });

        const totalWalletToBank = sajidaBankOutflow + jeelaniBankOutflow;
        const totalBankToWallet = sajidaBankInflow + jeelaniBankInflow;

        // --- 7. INDIVIDUAL 4 WALLET LIQUID BALANCES ---
        // 1) Sajida Advance Wallet (Security deposits held in trust + advance capital/transfers)
        const sajidaAdvanceBalance = (sajidaAdvCapital + sajidaAdvancesCollected + sajidaAdvBankIn + sajidaAdvTransfersIn)
            - sajidaExpAdvance - sajidaRefunds - sajidaDeductions - sajidaAdvBankOut - sajidaAdvTransfersOut;

        // 2) Sajida Rent Wallet (Rent collections + retained advance deductions + rent capital/transfers)
        const sajidaRentBalance = (sajidaRentCapital + sajidaRentWallet + sajidaDeductions + sajidaRentBankIn + sajidaRentTransfersIn)
            - sajidaExpRent - sajidaRentBankOut - sajidaRentTransfersOut;

        // 3) Jeelani Advance Wallet (Security deposits held in trust + advance capital/transfers)
        const jeelaniAdvanceBalance = (jeelaniAdvCapital + jeelaniAdvancesCollected + jeelaniAdvBankIn + jeelaniAdvTransfersIn)
            - jeelaniExpAdvance - jeelaniRefunds - jeelaniDeductions - jeelaniAdvBankOut - jeelaniAdvTransfersOut;

        // 4) Jeelani Rent Wallet (Rent collections + retained advance deductions + rent capital/transfers)
        const jeelaniRentBalance = (jeelaniRentCapital + jeelaniRentWallet + jeelaniDeductions + jeelaniRentBankIn + jeelaniRentTransfersIn)
            - jeelaniExpRent - jeelaniRentBankOut - jeelaniRentTransfersOut;

        // Owner Aggregates
        const sajidaBalance = sajidaAdvanceBalance + sajidaRentBalance;
        const jeelaniBalance = jeelaniAdvanceBalance + jeelaniRentBalance;
        const netBuildingBalance = sajidaBalance + jeelaniBalance;

        // Free Capital (Advance balance minus active held deposit liability)
        const sajidaFreeAdvance = sajidaAdvanceBalance - sajidaAdvancesHeld;
        const jeelaniFreeAdvance = jeelaniAdvanceBalance - jeelaniAdvancesHeld;
        const sajidaFreeCapital = sajidaBalance - sajidaAdvancesHeld;
        const jeelaniFreeCapital = jeelaniBalance - jeelaniAdvancesHeld;

        // Total active security deposits held across building
        const totalDeposits = sajidaAdvancesHeld + jeelaniAdvancesHeld;
        const totalAdvancesCollected = sajidaAdvancesCollected + jeelaniAdvancesCollected;

        // Settlement analysis
        let settlementText = "Even / Balanced";
        let settlementNote = "Both owners' wallets are balanced based on floor collections, expenses, and transfers.";
        const diff = sajidaBalance - jeelaniBalance;

        if (diff > 500) {
            settlementText = `Jeelani owes Sajida ₹${Math.abs(Math.round(diff / 2)).toLocaleString('en-IN')}`;
            settlementNote = `Sajida holds higher net liquid funds from Floors 1 & 2 after expense share.`;
        } else if (diff < -500) {
            settlementText = `Sajida owes Jeelani ₹${Math.abs(Math.round(diff / 2)).toLocaleString('en-IN')}`;
            settlementNote = `Jeelani holds higher net liquid funds from Floors 3, 4 & 5 after expense share.`;
        }

        return {
            // 4 Wallets
            sajidaAdvanceBalance,
            sajidaRentBalance,
            jeelaniAdvanceBalance,
            jeelaniRentBalance,
            sajidaFreeAdvance,
            jeelaniFreeAdvance,

            // Owner & Building Totals
            sajidaBalance,
            jeelaniBalance,
            netBuildingBalance,
            sajidaFreeCapital,
            jeelaniFreeCapital,

            // Rent Collections
            totalRent,
            sajidaRentTotal,
            jeelaniRentTotal,
            sajidaRentWallet,
            sajidaRentBank,
            jeelaniRentWallet,
            jeelaniRentBank,
            totalRentWallet,
            totalRentBank,

            // Expenses
            totalExpenses,
            sajidaExpTotal,
            jeelaniExpTotal,
            sajidaExpAdvance,
            sajidaExpRent,
            jeelaniExpAdvance,
            jeelaniExpRent,

            // Advances
            sajidaAdvancesCollected,
            jeelaniAdvancesCollected,
            totalAdvancesCollected,
            sajidaAdvancesHeld,
            jeelaniAdvancesHeld,
            totalDeposits,
            totalDeductions,
            totalRefunds,
            sajidaRefunds,
            jeelaniRefunds,
            sajidaDeductions,
            jeelaniDeductions,

            // Internal Transfers
            totalInternalTransfers,
            sajidaAdvTransfersIn,
            sajidaAdvTransfersOut,
            sajidaAdvTransfersNet,
            sajidaRentTransfersIn,
            sajidaRentTransfersOut,
            sajidaRentTransfersNet,
            jeelaniAdvTransfersIn,
            jeelaniAdvTransfersOut,
            jeelaniAdvTransfersNet,
            jeelaniRentTransfersIn,
            jeelaniRentTransfersOut,
            jeelaniRentTransfersNet,

            // Bank Transfers
            sajidaAdvBankIn,
            sajidaAdvBankOut,
            sajidaRentBankIn,
            sajidaRentBankOut,
            jeelaniAdvBankIn,
            jeelaniAdvBankOut,
            jeelaniRentBankIn,
            jeelaniRentBankOut,
            sajidaBankInflow,
            sajidaBankOutflow,
            jeelaniBankInflow,
            jeelaniBankOutflow,
            totalWalletToBank,
            totalBankToWallet,

            // Capital
            sajidaCapital,
            jeelaniCapital,
            sajidaAdvCapital,
            sajidaRentCapital,
            jeelaniAdvCapital,
            jeelaniRentCapital,

            // Settlement
            settlementText,
            settlementNote
        };
    },

    // -------------------------------------------------------------
    // AUTOMATED RECURRING EXPENSES ENGINE
    // -------------------------------------------------------------
    getCurrentMonthKey() {
        return new Date().toISOString().slice(0, 7);
    },

    getDueRecurringExpenses(monthKey = null) {
        const m = monthKey || this.getCurrentMonthKey();
        const activeRules = (this.data.recurringExpenses || []).filter(r => r.active !== false);

        return activeRules.filter(rule => {
            const alreadyPosted = this.data.expenses.some(e => 
                (e.recurringRuleId === rule.id && (e.monthKey === m || (e.date && e.date.startsWith(m)))) ||
                (e.title && e.title.trim().toLowerCase() === rule.title.trim().toLowerCase() && e.date && e.date.startsWith(m))
            );
            return !alreadyPosted;
        });
    },

    checkAndAutoPostRecurring() {
        if (this.data.autoPostRecurring === false) return;

        const currentMonth = this.getCurrentMonthKey();
        const due = this.getDueRecurringExpenses(currentMonth);

        if (due.length > 0) {
            this.postDueRecurringExpenses(currentMonth, false);
            this.showToast(`Auto-posted ${due.length} recurring expenses for this month!`, 'info');
        }
    },

    postDueRecurringExpenses(monthKey = null, showNotification = true) {
        const m = monthKey || this.getCurrentMonthKey();
        const due = this.getDueRecurringExpenses(m);

        if (due.length === 0) {
            if (showNotification) alert(`All recurring expenses for ${m} have already been posted!`);
            return;
        }

        let totalAmount = 0;
        due.forEach(rule => {
            const amt = parseFloat(rule.amount) || 0;
            totalAmount += amt;

            let sajidaRatio = (rule.sajidaRatio !== undefined) ? rule.sajidaRatio : 40;
            let jeelaniRatio = (rule.jeelaniRatio !== undefined) ? rule.jeelaniRatio : 60;
            let sajidaAmount = Math.round((amt * sajidaRatio) / 100);
            let jeelaniAmount = amt - sajidaAmount;

            if (rule.splitType === 'sajida_only') {
                sajidaRatio = 100;
                jeelaniRatio = 0;
                sajidaAmount = amt;
                jeelaniAmount = 0;
            } else if (rule.splitType === 'jeelani_only') {
                sajidaRatio = 0;
                jeelaniRatio = 100;
                sajidaAmount = 0;
                jeelaniAmount = amt;
            } else if (rule.splitType === 'custom') {
                sajidaAmount = Math.round((amt * sajidaRatio) / 100);
                jeelaniAmount = amt - sajidaAmount;
            }

            const day = String(rule.dayOfMonth || 1).padStart(2, '0');
            const expDate = `${m}-${day}`;

            const newExp = {
                id: 'exp_rec_' + rule.id + '_' + m.replace('-', ''),
                title: rule.title,
                categoryId: rule.categoryId,
                amount: amt,
                date: expDate,
                monthKey: m,
                recurringRuleId: rule.id,
                isRecurring: true,
                targetFloor: rule.targetFloor || 'all',
                splitType: rule.splitType || 'ratio',
                sajidaRatio,
                jeelaniRatio,
                sajidaAmount,
                jeelaniAmount,
                debitedWallet: rule.debitedWallet || 'both',
                debitedSource: 'advance',
                paidBy: rule.paidBy || 'Wallet Split',
                notes: rule.notes ? `${rule.notes} (Auto-posted for ${m})` : `Automated recurring expense for ${m}`
            };

            this.data.expenses.push(newExp);
        });

        StorageManager.saveData(this.data);
        this.renderAll();

        if (showNotification) {
            if (typeof confetti === 'function') {
                confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
            }
            this.showToast(`Successfully posted ${due.length} recurring expenses (₹${totalAmount.toLocaleString('en-IN')}) for ${m}!`, 'success');
        }
    },

    toggleAutoPostSetting(checked) {
        this.data.autoPostRecurring = checked;
        StorageManager.saveData(this.data);
        this.showToast(checked ? 'Automatic monthly auto-posting enabled.' : 'Auto-posting set to manual approval.', 'info');
    },

    toggleRecurringRuleActive(ruleId) {
        const rule = (this.data.recurringExpenses || []).find(r => r.id === ruleId);
        if (rule) {
            rule.active = !rule.active;
            StorageManager.saveData(this.data);
            this.renderRecurringBanner();
            this.renderRecurringExpensesManager();
            this.showToast(`"${rule.title}" is now ${rule.active ? 'Active' : 'Paused'}.`);
        }
    },

    openAddRecurringModal(editId = null) {
        this.populateRecurringCategoriesDropdown();
        this.editingRecurringId = editId;

        const floorSelect = document.getElementById('rec-target-floor');

        if (editId) {
            const rule = this.data.recurringExpenses.find(r => r.id === editId);
            if (rule) {
                document.getElementById('rec-modal-title').textContent = 'Edit Recurring Expense Rule';
                document.getElementById('rec-title').value = rule.title || '';
                document.getElementById('rec-amount').value = rule.amount || '';
                document.getElementById('rec-category').value = rule.categoryId || 'cat_watchman';
                document.getElementById('rec-day').value = rule.dayOfMonth || 1;
                document.getElementById('rec-notes').value = rule.notes || '';
                if (floorSelect) floorSelect.value = rule.targetFloor || 'all';
                
                const radio = document.querySelector(`input[name="rec-split-type"][value="${rule.splitType}"]`);
                if (radio) radio.checked = true;
                this.onRecurringSplitChanged(rule.splitType);
                if (rule.splitType === 'custom') {
                    document.getElementById('rec-sajida-pct').value = rule.sajidaRatio || 40;
                    document.getElementById('rec-jeelani-pct').value = rule.jeelaniRatio || 60;
                }
            }
        } else {
            document.getElementById('rec-modal-title').textContent = 'Add Automated Recurring Expense';
            document.getElementById('rec-title').value = '';
            document.getElementById('rec-amount').value = '';
            document.getElementById('rec-day').value = 1;
            document.getElementById('rec-notes').value = '';
            document.getElementById('rec-sajida-pct').value = 40;
            document.getElementById('rec-jeelani-pct').value = 60;
            if (floorSelect) floorSelect.value = 'all';
            const defRadio = document.querySelector('input[name="rec-split-type"][value="ratio"]');
            if (defRadio) defRadio.checked = true;
            this.onRecurringSplitChanged('ratio');
        }

        this.showModal('modal-add-recurring');
    },

    populateRecurringCategoriesDropdown() {
        const select = document.getElementById('rec-category');
        if (!select) return;

        let html = '';
        this.data.categories.forEach(cat => {
            html += `<option value="${cat.id}">${cat.name}</option>`;
        });
        select.innerHTML = html;
    },

    onRecurringTargetFloorChanged(val) {
        if (val === '1' || val === '2' || val === 'sajida_floors') {
            const rad = document.querySelector('input[name="rec-split-type"][value="sajida_only"]');
            if (rad) { rad.checked = true; this.onRecurringSplitChanged('sajida_only'); }
        } else if (val === '3' || val === '4' || val === '5' || val === 'jeelani_floors') {
            const rad = document.querySelector('input[name="rec-split-type"][value="jeelani_only"]');
            if (rad) { rad.checked = true; this.onRecurringSplitChanged('jeelani_only'); }
        } else if (val === 'all') {
            const rad = document.querySelector('input[name="rec-split-type"][value="ratio"]');
            if (rad) { rad.checked = true; this.onRecurringSplitChanged('ratio'); }
        }
    },

    onRecurringSplitChanged(val) {
        const customBox = document.getElementById('rec-custom-ratio-controls');
        if (customBox) {
            customBox.classList.toggle('hidden', val !== 'custom');
        }
    },

    saveRecurringRule(e) {
        e.preventDefault();

        const title = document.getElementById('rec-title').value.trim();
        const amount = parseFloat(document.getElementById('rec-amount').value);
        const categoryId = document.getElementById('rec-category').value;
        const dayOfMonth = parseInt(document.getElementById('rec-day').value) || 1;
        const notes = document.getElementById('rec-notes').value.trim();
        const splitType = document.querySelector('input[name="rec-split-type"]:checked').value;
        const targetFloor = document.getElementById('rec-target-floor')?.value || 'all';

        if (!title || isNaN(amount) || amount <= 0) {
            alert('Please enter a valid title and amount.');
            return;
        }

        let sajidaRatio = 40;
        let jeelaniRatio = 60;
        let debitedWallet = 'both';
        let paidBy = 'Wallet Split (60:40 Floor Ratio)';

        if (splitType === 'sajida_only') {
            sajidaRatio = 100;
            jeelaniRatio = 0;
            debitedWallet = 'sajida';
            paidBy = '100% Sajida (Floors 1-2)';
        } else if (splitType === 'jeelani_only') {
            sajidaRatio = 0;
            jeelaniRatio = 100;
            debitedWallet = 'jeelani';
            paidBy = '100% Jeelani (Floors 3-5)';
        } else if (splitType === 'custom') {
            sajidaRatio = parseFloat(document.getElementById('rec-sajida-pct').value) || 40;
            jeelaniRatio = 100 - sajidaRatio;
            debitedWallet = 'both';
            paidBy = `Custom Split (${sajidaRatio}% : ${jeelaniRatio}%)`;
        }

        if (this.editingRecurringId) {
            const idx = this.data.recurringExpenses.findIndex(r => r.id === this.editingRecurringId);
            if (idx >= 0) {
                this.data.recurringExpenses[idx] = {
                    ...this.data.recurringExpenses[idx],
                    title,
                    categoryId,
                    amount,
                    dayOfMonth,
                    targetFloor,
                    splitType,
                    sajidaRatio,
                    jeelaniRatio,
                    debitedWallet,
                    paidBy,
                    notes
                };
            }
        } else {
            const newRule = {
                id: 'rec_' + Date.now(),
                title,
                categoryId,
                amount,
                dayOfMonth,
                frequency: 'monthly',
                targetFloor,
                splitType,
                sajidaRatio,
                jeelaniRatio,
                debitedWallet,
                paidBy,
                active: true,
                notes
            };
            if (!this.data.recurringExpenses) this.data.recurringExpenses = [];
            this.data.recurringExpenses.push(newRule);
        }

        StorageManager.saveData(this.data);
        this.hideModal('modal-add-recurring');
        this.renderAll();
        this.showToast(`Recurring expense rule "${title}" saved!`);
    },

    deleteRecurringRule(ruleId) {
        if (!confirm('Are you sure you want to delete this recurring expense template? Past posted expenses will remain in the ledger.')) return;
        this.data.recurringExpenses = this.data.recurringExpenses.filter(r => r.id !== ruleId);
        StorageManager.saveData(this.data);
        this.renderAll();
        this.showToast('Recurring expense rule deleted.');
    },

    // -------------------------------------------------------------
    // EXCEL & CSV EXPORTS
    // -------------------------------------------------------------
    openExportModal() {
        this.showModal('modal-export-sheets');
        this.renderExportCategoryWorkbooksList();
    },

    downloadSingleSheet(sheetKey) {
        const cfg = ExcelExporter.getSheetConfig(sheetKey, { data: this.data, stats: this.getStats() });
        const title = cfg ? cfg.name : sheetKey;
        this.showToast(`Generating ${title} (.xlsx)...`, 'info');
        const success = ExcelExporter.exportSheet(sheetKey, {
            data: this.data,
            stats: this.getStats()
        });
        if (success) {
            this.showToast(`${title} exported successfully!`, 'success');
        }
    },

    downloadAllSheetsSeparately() {
        this.showToast('Generating all 7 separate Excel files in sequence...', 'info');
        ExcelExporter.exportAllSheetsSeparately({
            data: this.data,
            stats: this.getStats()
        }, (current, total, key) => {
            if (current === total) {
                this.showToast(`All ${total} separate Excel files downloaded successfully!`, 'success');
            }
        });
    },

    downloadExcel() {
        this.showToast('Generating multi-sheet Excel statement...', 'info');
        const success = ExcelExporter.exportWorkbook({
            data: this.data,
            stats: this.getStats()
        });
        if (success) {
            this.showToast('Meera_Heights_Building_Accounts.xlsx downloaded successfully!', 'success');
        }
    },

    downloadCSV() {
        this.showToast('Generating CSV ledger...', 'info');
        const success = ExcelExporter.exportCSV({
            data: this.data,
            stats: this.getStats()
        });
        if (success) {
            this.showToast('CSV Ledger downloaded successfully!', 'success');
        }
    },

    // Universal Mobile/Desktop PDF Save Helper (Web Share API for Android/iOS, direct download for desktop)
    savePDFUniversally(doc, fileName) {
        try {
            if (typeof ExcelExporter !== 'undefined' && ExcelExporter.downloadBlobUniversal) {
                const blob = doc.output('blob');
                ExcelExporter.downloadBlobUniversal(blob, fileName);
                return;
            }
        } catch (e) {
            console.warn('Universal blob download failed, falling back to doc.save:', e);
        }
        try {
            doc.save(fileName);
        } catch (err) {
            console.error('doc.save failed:', err);
        }
    },

    // -------------------------------------------------------------
    // DYNAMIC WALLET EXPORT (PDF, EXCEL .xlsx, CSV)
    // -------------------------------------------------------------
    walletExportPeriodState: 'all',

    openWalletExportModal() {
        this.walletExportPeriodState = 'all';
        const mInput = document.getElementById('wallet-export-month-input');
        if (mInput) mInput.value = (this.selectedMonthFilter && this.selectedMonthFilter !== 'all') ? this.selectedMonthFilter : this.getCurrentMonthKey();
        const ySelect = document.getElementById('wallet-export-year-select');
        if (ySelect) ySelect.value = new Date().getFullYear().toString();
        const sDate = document.getElementById('wallet-export-start-date');
        const eDate = document.getElementById('wallet-export-end-date');
        if (sDate) sDate.value = '';
        if (eDate) eDate.value = '';
        this.setWalletExportPeriod('all');
        this.showModal('modal-export-wallet');
    },

    setWalletExportPeriod(period) {
        this.walletExportPeriodState = period;
        ['all', 'weekly', 'monthly', 'yearly', 'custom'].forEach(p => {
            const btn = document.getElementById(`btn-wallet-period-${p}`);
            if (btn) {
                if (p === period) {
                    btn.className = 'wallet-period-btn py-2 px-2 rounded-xl text-xs font-bold transition text-center border bg-slate-900 text-white border-slate-900 shadow-sm';
                } else {
                    btn.className = 'wallet-period-btn py-2 px-2 rounded-xl text-xs font-bold transition text-center border bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200';
                }
            }
        });

        const mPicker = document.getElementById('wallet-export-monthly-picker');
        const yPicker = document.getElementById('wallet-export-yearly-picker');
        const cPicker = document.getElementById('wallet-export-custom-picker');
        if (mPicker) mPicker.classList.toggle('hidden', period !== 'monthly');
        if (yPicker) yPicker.classList.toggle('hidden', period !== 'yearly');
        if (cPicker) cPicker.classList.toggle('hidden', period !== 'custom');

        this.updateWalletExportPreview();
    },

    getWalletExportOptions() {
        const period = this.walletExportPeriodState;
        const scope = document.getElementById('wallet-export-scope')?.value || 'all';
        const type = document.getElementById('wallet-export-type')?.value || 'all';
        const month = document.getElementById('wallet-export-month-input')?.value || this.getCurrentMonthKey();
        const year = document.getElementById('wallet-export-year-select')?.value || new Date().getFullYear().toString();
        const startDate = document.getElementById('wallet-export-start-date')?.value || '';
        const endDate = document.getElementById('wallet-export-end-date')?.value || '';

        return {
            period,
            walletScope: scope,
            type,
            month,
            year,
            startDate,
            endDate
        };
    },

    updateWalletExportPreview() {
        const options = this.getWalletExportOptions();
        const txs = this.getWalletTransactionsStream(options);
        const countEl = document.getElementById('wallet-export-preview-count');
        if (countEl) {
            countEl.textContent = `${txs.length} entries`;
        }
    },

    executeWalletExport(format) {
        const options = this.getWalletExportOptions();
        this.hideModal('modal-export-wallet');

        if (format === 'pdf') {
            this.showToast('Generating Wallet PDF Statement...', 'info');
            this.generateWalletPDF(options);
        } else if (format === 'xlsx') {
            this.showToast('Generating Wallet Excel Workbook...', 'info');
            ExcelExporter.exportWalletWorkbook(options, this);
            this.showToast('Wallet Excel (.xlsx) downloaded successfully!', 'success');
        } else if (format === 'csv') {
            this.showToast('Generating Wallet CSV Ledger...', 'info');
            ExcelExporter.exportWalletCSV(options, this);
            this.showToast('Wallet CSV Ledger downloaded successfully!', 'success');
        }
    },

    generateWalletPDF(options = {}) {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            this.showToast('PDF library is loading. Please check internet connection.', 'error');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const txs = this.getWalletTransactionsStream(options);
        const stats = this.getStats();

        // Scope Label
        let scopeLabel = 'All 4 Wallets (Combined)';
        const scope = options.walletScope || 'all';
        if (scope === 'sajida_advance') scopeLabel = 'Sajida Advance Account (Fl 1-2)';
        else if (scope === 'sajida_rent') scopeLabel = 'Sajida Rent Account (Fl 1-2)';
        else if (scope === 'jeelani_advance') scopeLabel = 'Jeelani Advance Account (Fl 3-5)';
        else if (scope === 'jeelani_rent') scopeLabel = 'Jeelani Rent Account (Fl 3-5)';
        else if (scope === 'owner_sajida') scopeLabel = 'Sajida Accounts (Advance + Rent)';
        else if (scope === 'owner_jeelani') scopeLabel = 'Jeelani Accounts (Advance + Rent)';

        // Period Label
        let periodLabel = 'All-Time Statement';
        if (options.period === 'weekly') {
            const past7 = new Date();
            past7.setDate(past7.getDate() - 7);
            periodLabel = `Weekly Report: ${past7.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} to ${new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        } else if (options.period === 'monthly') {
            periodLabel = `Monthly Statement: ${options.month || this.getCurrentMonthKey()}`;
        } else if (options.period === 'yearly') {
            periodLabel = `Annual Statement: ${options.year || new Date().getFullYear()}`;
        } else if (options.period === 'custom') {
            periodLabel = `Custom Range: ${options.startDate || 'Start'} to ${options.endDate || 'Present'}`;
        }

        // Header Background Banner
        doc.setFillColor(7, 18, 35); // Deep navy #071223
        doc.rect(0, 0, pageWidth, 40, 'F');

        // Gold Accent Stripe
        doc.setFillColor(217, 119, 6); // amber-600
        doc.rect(0, 40, pageWidth, 2, 'F');

        // Brand Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(17);
        doc.setTextColor(255, 255, 255);
        doc.text('MEERA HEIGHTS', 14, 15);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(203, 213, 225);
        doc.text('4 CAPITAL WALLETS & LEDGER STATEMENT', 14, 21);

        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text('Co-owned by Sajida (1st-2nd Fl) & Jeelani (3rd-5th Fl)', 14, 27);
        doc.text(`Scope: ${scopeLabel}`, 14, 33);

        // Right side metadata
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        doc.text(periodLabel, pageWidth - 14, 15, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(203, 213, 225);
        doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`, pageWidth - 14, 21, { align: 'right' });
        doc.text(`Total Records: ${txs.length}`, pageWidth - 14, 27, { align: 'right' });

        // 4 Wallets KPI Cards
        const cardY = 46;
        const cardW = (pageWidth - 28 - 9) / 4;
        const cardH = 18;

        const walletsMeta = [
            { name: 'Sajida Adv (Fl 1-2)', bal: stats.wallets.sajidaAdvance, color: [16, 185, 129], bg: [236, 253, 245] },
            { name: 'Sajida Rent (Fl 1-2)', bal: stats.wallets.sajidaRent, color: [13, 148, 136], bg: [240, 253, 250] },
            { name: 'Jeelani Adv (Fl 3-5)', bal: stats.wallets.jeelaniAdvance, color: [59, 130, 246], bg: [239, 246, 255] },
            { name: 'Jeelani Rent (Fl 3-5)', bal: stats.wallets.jeelaniRent, color: [99, 102, 241], bg: [238, 242, 255] }
        ];

        walletsMeta.forEach((w, i) => {
            const x = 14 + i * (cardW + 3);
            doc.setFillColor(w.bg[0], w.bg[1], w.bg[2]);
            doc.roundedRect(x, cardY, cardW, cardH, 2, 2, 'F');
            doc.setDrawColor(w.color[0], w.color[1], w.color[2]);
            doc.setLineWidth(0.3);
            doc.roundedRect(x, cardY, cardW, cardH, 2, 2, 'D');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(w.color[0], w.color[1], w.color[2]);
            doc.text(w.name, x + 3, cardY + 5);

            doc.setFontSize(9.5);
            doc.setTextColor(15, 23, 42);
            doc.text(`INR ${w.bal.toLocaleString('en-IN')}`, x + 3, cardY + 12);
        });

        // Summary Net Bar
        const netY = cardY + cardH + 3;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, netY, pageWidth - 28, 9, 2, 2, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(14, netY, pageWidth - 28, 9, 2, 2, 'D');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(51, 65, 85);
        doc.text(`Total Liquid Treasury: INR ${stats.wallets.totalTreasury.toLocaleString('en-IN')}`, 18, netY + 6);
        doc.text(`Tenant Advances Held: INR ${stats.wallets.totalAdvancesHeld.toLocaleString('en-IN')}`, 85, netY + 6);
        doc.text(`Net Free Capital: INR ${stats.wallets.netFreeCapital.toLocaleString('en-IN')}`, 145, netY + 6);

        // Transaction Ledger Table
        let totalInflow = 0;
        let totalOutflow = 0;

        const tableRows = txs.map((t, idx) => {
            const amt = parseFloat(t.amount) || 0;
            let cashflow = '+ Inflow';
            if (t.type === 'expense' || (t.type === 'capital' && !t.isDeposit) || (t.type === 'advance_settlement' && !t.isDeductOnly) || (t.type === 'bank_transfer' && !t.isCredit)) {
                cashflow = '- Outflow';
                totalOutflow += amt;
            } else {
                totalInflow += amt;
            }

            return [
                idx + 1,
                t.date || '',
                t.title || 'Transaction',
                t.category || '',
                cashflow,
                `INR ${amt.toLocaleString('en-IN')}`,
                t.ownerDisplay || ''
            ];
        });

        // Footer Summary Row
        tableRows.push([
            '',
            'TOTALS',
            `Net Cashflow: INR ${(totalInflow - totalOutflow).toLocaleString('en-IN')}`,
            '',
            `+ INR ${totalInflow.toLocaleString('en-IN')} / - INR ${totalOutflow.toLocaleString('en-IN')}`,
            `INR ${(totalInflow - totalOutflow).toLocaleString('en-IN')}`,
            ''
        ]);

        doc.autoTable({
            startY: netY + 13,
            head: [['#', 'Date', 'Description / Title', 'Category', 'Flow', 'Amount', 'Wallet / Owner']],
            body: tableRows,
            theme: 'striped',
            headStyles: {
                fillColor: [15, 23, 42],
                textColor: [255, 255, 255],
                fontSize: 7.5,
                fontStyle: 'bold',
                halign: 'left',
                cellPadding: 2.5
            },
            bodyStyles: {
                fontSize: 7,
                cellPadding: 2,
                textColor: [30, 41, 59]
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            },
            columnStyles: {
                0: { cellWidth: 8, halign: 'center' },
                1: { cellWidth: 18 },
                2: { cellWidth: 'auto' },
                3: { cellWidth: 28 },
                4: { cellWidth: 18, fontStyle: 'bold' },
                5: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
                6: { cellWidth: 32 }
            },
            didParseCell: (data) => {
                if (data.section === 'body') {
                    if (data.row.index === tableRows.length - 1) {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fillColor = [241, 245, 249];
                        data.cell.styles.textColor = [15, 23, 42];
                    } else if (data.column.index === 4) {
                        if (data.cell.raw === '+ Inflow') {
                            data.cell.styles.textColor = [16, 185, 129];
                        } else {
                            data.cell.styles.textColor = [225, 29, 72];
                        }
                    }
                }
            },
            margin: { left: 14, right: 14, bottom: 18 }
        });

        // Add Signatures on Last Page
        let finalY = doc.lastAutoTable.finalY + 12;
        if (finalY + 25 > pageHeight) {
            doc.addPage();
            finalY = 25;
        }

        const sigWidth = 70;
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.4);

        // Sajida Signature
        doc.line(14, finalY, 14 + sigWidth, finalY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text('Co-Owner: Sajida (1st & 2nd Floors)', 14, finalY + 4);
        doc.text('Authorized Signature & Date', 14, finalY + 8);

        // Jeelani Signature
        const jX = pageWidth - 14 - sigWidth;
        doc.line(jX, finalY, jX + sigWidth, finalY);
        doc.text('Co-Owner: Jeelani (3rd, 4th & 5th Floors)', jX, finalY + 4);
        doc.text('Authorized Signature & Date', jX, finalY + 8);

        this.drawPdfPageFooter(doc, pageWidth, pageHeight);

        const cleanPeriod = periodLabel.slice(0, 25).replace(/[^a-zA-Z0-9]+/g, '_');
        const fileName = `Meera_Heights_Wallet_Report_${cleanPeriod}.pdf`;
        this.savePDFUniversally(doc, fileName);
        this.showToast(`✓ Wallet PDF "${fileName}" exported successfully!`, 'success');
    },

    setSort(view, value) {
        if (!this.sortState[view]) return;
        this.sortState[view] = value;
        if (view === 'expenses') this.renderExpenses();
        if (view === 'floor') this.renderFloorBreakupPage();
        if (view === 'rent') this.renderRentLedger();
        if (view === 'wallet') this.renderWalletPage(this.getStats());
    },

    sortRecords(records, sortKey, titleKey = 'title') {
        const list = [...records];
        const text = value => String(value || '').toLowerCase();
        return list.sort((a, b) => {
            if (sortKey === 'amount-desc') return (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0);
            if (sortKey === 'amount-asc') return (parseFloat(a.amount) || 0) - (parseFloat(b.amount) || 0);
            if (sortKey === 'title-asc') return text(a[titleKey]).localeCompare(text(b[titleKey]));
            const dateA = new Date(a.date || a.paymentDate || 0).getTime();
            const dateB = new Date(b.date || b.paymentDate || 0).getTime();
            return sortKey === 'date-asc' ? dateA - dateB : dateB - dateA;
        });
    },

    // -------------------------------------------------------------
    // EXECUTIVE PDF REPORTING & EXPORT SUITE
    // (Weekly, Monthly, Yearly, Custom Range & Individual Vouchers)
    // -------------------------------------------------------------
    pdfReportTypeState: 'statement',
    pdfPeriodState: 'monthly',

    openPDFExportModal(defaultType = 'statement', defaultCategory = 'all') {
        this.pdfReportTypeState = defaultType;
        this.pdfPeriodState = 'monthly';

        // Populate Categories dropdown
        const catSelect = document.getElementById('pdf-select-category');
        if (catSelect) {
            let catOptions = `<option value="all">All Categories (Combined)</option>`;
            (this.data.categories || []).forEach(c => {
                const count = (this.data.expenses || []).filter(e => e.categoryId === c.id).length;
                catOptions += `<option value="${c.id}" ${c.id === defaultCategory ? 'selected' : ''}>${c.name} (${count} entries)</option>`;
            });
            catSelect.innerHTML = catOptions;
            if (defaultCategory && defaultCategory !== 'all') catSelect.value = defaultCategory;
        }

        // Set default month & year inputs
        const monthInput = document.getElementById('pdf-input-month');
        if (monthInput) {
            monthInput.value = (this.selectedMonthFilter && this.selectedMonthFilter !== 'all') 
                ? this.selectedMonthFilter 
                : this.getCurrentMonthKey();
        }
        const yearSelect = document.getElementById('pdf-select-year');
        if (yearSelect) {
            yearSelect.value = new Date().getFullYear().toString();
        }

        const today = new Date().toISOString().slice(0, 10);
        const past7 = new Date();
        past7.setDate(past7.getDate() - 7);
        const startInput = document.getElementById('pdf-input-start-date');
        const endInput = document.getElementById('pdf-input-end-date');
        if (startInput) startInput.value = past7.toISOString().slice(0, 10);
        if (endInput) endInput.value = today;

        this.setPdfReportType(defaultType);
        this.setPdfPeriod('monthly');
        this.showModal('modal-export-pdf');
    },

    setPdfReportType(type) {
        this.pdfReportTypeState = type;
        const types = ['statement', 'expenses', 'rents', 'category'];
        types.forEach(t => {
            const btn = document.getElementById(`btn-pdf-type-${t}`);
            if (btn) {
                const active = (t === type);
                btn.className = `pdf-type-btn p-2.5 rounded-xl border-2 text-xs font-bold text-center transition ${
                    active ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`;
            }
        });

        const catPicker = document.getElementById('pdf-category-picker-container');
        if (catPicker) {
            catPicker.classList.toggle('hidden', type !== 'category');
        }
    },

    setPdfPeriod(period) {
        this.pdfPeriodState = period;
        const periods = ['weekly', 'monthly', 'yearly', 'custom'];
        periods.forEach(p => {
            const btn = document.getElementById(`btn-pdf-period-${p}`);
            if (btn) {
                const active = (p === period);
                btn.className = `pdf-period-btn p-2 rounded-xl border text-xs font-semibold text-center transition ${
                    active ? 'border-2 border-emerald-500 bg-emerald-50 text-emerald-800 font-bold' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`;
            }
        });

        const monthBox = document.getElementById('pdf-period-monthly-container');
        const yearBox = document.getElementById('pdf-period-yearly-container');
        const customBox = document.getElementById('pdf-period-custom-container');

        if (monthBox) monthBox.classList.toggle('hidden', period !== 'monthly');
        if (yearBox) yearBox.classList.toggle('hidden', period !== 'yearly');
        if (customBox) customBox.classList.toggle('hidden', period !== 'custom');
    },

    executePdfExport() {
        const catSelect = document.getElementById('pdf-select-category');
        const monthInput = document.getElementById('pdf-input-month');
        const yearSelect = document.getElementById('pdf-select-year');
        const startInput = document.getElementById('pdf-input-start-date');
        const endInput = document.getElementById('pdf-input-end-date');

        const options = {
            reportType: this.pdfReportTypeState,
            periodType: this.pdfPeriodState,
            categoryId: catSelect ? catSelect.value : 'all',
            month: monthInput ? monthInput.value : this.getCurrentMonthKey(),
            year: yearSelect ? yearSelect.value : new Date().getFullYear().toString(),
            startDate: startInput ? startInput.value : '',
            endDate: endInput ? endInput.value : ''
        };

        this.generateAdvancedPDF(options);
        this.hideModal('modal-export-pdf');
    },

    numberToIndianWords(num) {
        num = Math.round(Number(num) || 0);
        if (num === 0) return 'Zero Rupees';
        const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        const inWords = (n) => {
            if (n < 20) return a[n];
            if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
            if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + inWords(n % 100) : '');
            if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
            if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
            return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + inWords(n % 10000000) : '');
        };
        return inWords(num).trim() + ' Rupees Only';
    },

    downloadMonthlyPDF(type = 'expense') {
        this.generateAdvancedPDF({
            reportType: type === 'rent' ? 'rents' : (type === 'all' ? 'statement' : 'expenses'),
            periodType: 'monthly',
            month: this.selectedMonthFilter || 'all'
        });
    },

    downloadCategoryPDF(categoryId = 'all') {
        this.generateAdvancedPDF({
            reportType: 'category',
            categoryId: categoryId,
            periodType: 'all'
        });
    },

    downloadCategoryExcel(categoryId = 'all') {
        const cat = this.data.categories.find(c => c.id === categoryId);
        const name = cat ? cat.name : 'Expenses';
        const success = ExcelExporter.exportCategorySheet(categoryId, this);
        if (success) {
            this.showToast(`Excel (.xlsx) downloaded for "${name}".`, 'success');
        }
    },

    async downloadAllCategoryExcels() {
        this.showToast('Generating individual Excel sheets for all categories...', 'info');
        const count = await ExcelExporter.exportAllCategoriesSeparately(this);
        this.showToast(`✓ Completed! ${count} separate category workbooks downloaded.`, 'success');
    },

    renderExportCategoryWorkbooksList() {
        const container = document.getElementById('export-modal-category-list');
        if (!container) return;

        let html = '';
        (this.data.categories || []).forEach(cat => {
            const items = (this.data.expenses || []).filter(e => e.categoryId === cat.id);
            const total = items.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
            html += `
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-emerald-300 transition">
                    <div class="flex items-center gap-2 min-w-0">
                        <div class="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 text-xs" style="background-color: ${cat.color || '#10B981'}">
                            <i class="fa-solid ${cat.icon || 'fa-receipt'}"></i>
                        </div>
                        <div class="min-w-0">
                            <div class="font-bold text-xs text-slate-800 truncate">${cat.name}</div>
                            <div class="text-[10px] text-slate-400">${items.length} items • ₹${total.toLocaleString('en-IN')}</div>
                        </div>
                    </div>
                    <button onclick="App.downloadCategoryExcel('${cat.id}')" class="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold text-[11px] rounded-lg transition shrink-0 flex items-center gap-1 shadow-sm" title="Export this sheet (.xlsx)">
                        <i class="fa-solid fa-file-excel"></i>
                        <span>.xlsx</span>
                    </button>
                </div>
            `;
        });
        container.innerHTML = html;
    },

    // -------------------------------------------------------------
    // EXECUTIVE PDF GENERATOR (jspdf + autotable)
    // -------------------------------------------------------------
    generateAdvancedPDF(options = {}) {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            this.showToast('PDF library is loading. Please check internet connection.', 'error');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const reportType = options.reportType || 'statement';
        const periodType = options.periodType || 'monthly';
        const selectedMonth = options.month || this.selectedMonthFilter || this.getCurrentMonthKey();
        const selectedYear = options.year || new Date().getFullYear().toString();
        const customStart = options.startDate || '';
        const customEnd = options.endDate || '';
        const categoryId = options.categoryId || 'all';

        // Date Filter Helper
        const isDateInPeriod = (dateStr) => {
            if (!dateStr) return false;
            if (periodType === 'all') return true;

            if (periodType === 'weekly') {
                const d = new Date(dateStr + 'T00:00:00');
                const now = new Date();
                const past7 = new Date();
                past7.setDate(now.getDate() - 7);
                return d >= past7 && d <= now;
            } else if (periodType === 'monthly') {
                if (selectedMonth === 'all') return true;
                return dateStr.startsWith(selectedMonth);
            } else if (periodType === 'yearly') {
                return dateStr.startsWith(selectedYear);
            } else if (periodType === 'custom') {
                if (customStart && dateStr < customStart) return false;
                if (customEnd && dateStr > customEnd) return false;
                return true;
            }
            return true;
        };

        // Determine Period Label
        let periodLabel = 'All Recorded Months';
        if (periodType === 'weekly') {
            const past7 = new Date();
            past7.setDate(past7.getDate() - 7);
            periodLabel = `Weekly Report: ${past7.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} to ${new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        } else if (periodType === 'monthly') {
            periodLabel = selectedMonth === 'all' ? 'All Months' : `Monthly Statement: ${selectedMonth}`;
        } else if (periodType === 'yearly') {
            periodLabel = `Annual Statement: Calendar Year ${selectedYear}`;
        } else if (periodType === 'custom') {
            periodLabel = `Custom Range: ${customStart || 'Start'} to ${customEnd || 'Present'}`;
        }

        // Filter Data
        let expenses = (this.data.expenses || []).filter(e => isDateInPeriod(e.date));
        if (reportType === 'category' && categoryId !== 'all') {
            expenses = expenses.filter(e => e.categoryId === categoryId);
        }
        expenses.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        let rents = (this.data.rentCollections || []).filter(r => isDateInPeriod(r.paymentDate || r.month));
        rents.sort((a, b) => new Date(b.paymentDate || 0) - new Date(a.paymentDate || 0));

        const totalExpense = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        const totalRent = rents.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
        const netSurplus = totalRent - totalExpense;

        const sajidaExpenseShare = expenses.reduce((s, e) => s + (parseFloat(e.sajidaAmount) || 0), 0);
        const jeelaniExpenseShare = expenses.reduce((s, e) => s + (parseFloat(e.jeelaniAmount) || 0), 0);

        let reportTitle = 'CONSOLIDATED FINANCIAL STATEMENT';
        let reportSubtitle = 'Income, Maintenance Outflows, Treasury Balance & Owner Shares';
        let catObj = null;

        if (reportType === 'expenses') {
            reportTitle = 'BUILDING EXPENDITURE REGISTER';
            reportSubtitle = 'Itemized Maintenance, Utility & Operational Expenses';
        } else if (reportType === 'rents') {
            reportTitle = 'RENT COLLECTIONS REGISTER';
            reportSubtitle = 'Resident Tenant Rental Inflows & Credited Wallets';
        } else if (reportType === 'category') {
            catObj = this.data.categories.find(c => c.id === categoryId);
            const catName = catObj ? catObj.name : 'All Categories';
            reportTitle = `${catName.toUpperCase()} EXPENDITURE SHEET`;
            reportSubtitle = `Dedicated Category Spending Breakdown & 60:40 Split Details`;
        }

        let y = 14;

        // 1. BRAND HEADER BANNER (Deep Emerald)
        doc.setFillColor(4, 120, 87); // #047857
        doc.roundedRect(14, y, pageWidth - 28, 26, 3, 3, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.text('MEERA HEIGHTS RESIDENTIAL APARTMENTS', 20, y + 9);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(209, 250, 229);
        doc.text('Property Management, Multi-Floor Expenditure Ledger & Split Settlement', 20, y + 16);
        doc.text('Co-Owners: Sajida (1st & 2nd Floors • 40%)  |  Jeelani (3rd, 4th & 5th Floors • 60%)', 20, y + 21);

        y += 30;

        // 2. REPORT TITLE & METADATA BAR
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(14, y, pageWidth - 28, 14, 2, 2, 'FD');

        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.text(reportTitle, 18, y + 6);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(reportSubtitle, 18, y + 10.5);

        const metaRight = `Period: ${periodLabel}  |  Generated: ${new Date().toLocaleString('en-IN')}`;
        doc.setFontSize(7.5);
        doc.text(metaRight, pageWidth - 18, y + 8.5, { align: 'right' });

        y += 18;

        // 3. EXECUTIVE KPI SUMMARY BOXES (4-Card Grid)
        const boxWidth = (pageWidth - 28 - 9) / 4;
        const boxHeight = 16;
        const cards = [
            { label: 'TOTAL RENT INFLOW', val: `Rs. ${totalRent.toLocaleString('en-IN')}`, color: [5, 150, 105], bg: [236, 253, 245] },
            { label: 'TOTAL MAINTENANCE', val: `Rs. ${totalExpense.toLocaleString('en-IN')}`, color: [225, 29, 72], bg: [255, 241, 242] },
            { label: 'NET TREASURY SURPLUS', val: `Rs. ${netSurplus.toLocaleString('en-IN')}`, color: [2, 132, 199], bg: [240, 249, 255] },
            { label: 'SAJIDA / JEELANI EXP', val: `Rs. ${sajidaExpenseShare.toLocaleString('en-IN')} / ${jeelaniExpenseShare.toLocaleString('en-IN')}`, color: [124, 58, 237], bg: [245, 243, 255] }
        ];

        cards.forEach((c, idx) => {
            const bx = 14 + idx * (boxWidth + 3);
            doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(bx, y, boxWidth, boxHeight, 2, 2, 'FD');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.setTextColor(100, 116, 139);
            doc.text(c.label, bx + 3, y + 5);

            doc.setFontSize(8.5);
            doc.setTextColor(c.color[0], c.color[1], c.color[2]);
            doc.text(c.val, bx + 3, y + 11.5);
        });

        y += boxHeight + 6;

        // 4. DATA TABLE RENDERING
        const hasAutoTable = typeof doc.autoTable === 'function';

        if (reportType === 'statement' || reportType === 'expenses' || reportType === 'category') {
            // Expenses Section Table
            const expHeaders = ['#', 'Date', 'Expense Title / Purpose', 'Category', 'Total (Rs.)', 'Sajida (40%)', 'Jeelani (60%)', 'Debited Wallet', 'Notes'];
            const expRows = expenses.map((e, idx) => {
                const c = this.data.categories.find(x => x.id === e.categoryId);
                return [
                    idx + 1,
                    e.date || '-',
                    e.title || 'Expense',
                    c?.name || 'General',
                    Number(e.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
                    Number(e.sajidaAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
                    Number(e.jeelaniAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
                    e.debitedWallet || e.debitedSource || 'both',
                    e.notes || '-'
                ];
            });

            if (reportType === 'statement') {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(15, 23, 42);
                doc.text(`Expenditure Breakdown (${expenses.length} Records)`, 14, y);
                y += 3;
            }

            if (hasAutoTable) {
                doc.autoTable({
                    startY: y,
                    head: [expHeaders],
                    body: expRows,
                    theme: 'striped',
                    headStyles: { fillColor: [4, 120, 87], textColor: 255, fontSize: 7.5, fontStyle: 'bold', halign: 'left' },
                    bodyStyles: { fontSize: 7, textColor: [15, 23, 42], cellPadding: 2 },
                    alternateRowStyles: { fillColor: [248, 250, 252] },
                    columnStyles: {
                        0: { cellWidth: 8, halign: 'center' },
                        1: { cellWidth: 18 },
                        2: { cellWidth: 42 },
                        3: { cellWidth: 26 },
                        4: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
                        5: { cellWidth: 18, halign: 'right' },
                        6: { cellWidth: 18, halign: 'right' },
                        7: { cellWidth: 18 },
                        8: { cellWidth: 'auto' }
                    },
                    foot: [[
                        'TOTAL', '', `${expenses.length} Entries`, '',
                        `Rs. ${totalExpense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                        `Rs. ${sajidaExpenseShare.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                        `Rs. ${jeelaniExpenseShare.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                        '', ''
                    ]],
                    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5 },
                    margin: { left: 14, right: 14 },
                    didDrawPage: (data) => {
                        // Footer on every page
                        this.drawPdfPageFooter(doc, pageWidth, pageHeight);
                    }
                });
                y = doc.lastAutoTable.finalY + 8;
            } else {
                // Fallback manual table rendering
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                expenses.forEach((e, idx) => {
                    if (y > pageHeight - 20) { doc.addPage(); y = 18; }
                    doc.text(`${idx + 1}. ${e.date || ''} | ${e.title || ''} | Rs. ${Number(e.amount || 0).toLocaleString('en-IN')}`, 14, y);
                    y += 5;
                });
                y += 6;
            }
        }

        if (reportType === 'statement' || reportType === 'rents') {
            // Rent Collections Section Table
            if (reportType === 'statement') {
                if (y > pageHeight - 45) { doc.addPage(); y = 18; }
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(15, 23, 42);
                doc.text(`Rent Collections Ledger (${rents.length} Records)`, 14, y);
                y += 3;
            }

            const rentHeaders = ['#', 'Date', 'Tenant Name', 'Flat', 'Floor', 'Month', 'Amount (Rs.)', 'Credited Owner', 'Mode'];
            const rentRows = rents.map((r, idx) => {
                const t = this.data.tenants.find(x => x.id === r.tenantId);
                return [
                    idx + 1,
                    r.paymentDate || '-',
                    t?.name || r.tenantName || 'Tenant',
                    t?.flat || r.flat || '-',
                    t?.floor ? `${t.floor} Fl` : (r.floor ? `${r.floor} Fl` : '-'),
                    r.month || '-',
                    Number(r.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
                    r.ownerCredited || (r.floor <= 2 ? 'Sajida (Fl 1-2)' : 'Jeelani (Fl 3-5)'),
                    r.paymentMode || r.mode || 'UPI'
                ];
            });

            if (hasAutoTable) {
                doc.autoTable({
                    startY: y,
                    head: [rentHeaders],
                    body: rentRows,
                    theme: 'striped',
                    headStyles: { fillColor: [5, 150, 105], textColor: 255, fontSize: 7.5, fontStyle: 'bold', halign: 'left' },
                    bodyStyles: { fontSize: 7, textColor: [15, 23, 42], cellPadding: 2 },
                    alternateRowStyles: { fillColor: [248, 250, 252] },
                    columnStyles: {
                        0: { cellWidth: 8, halign: 'center' },
                        1: { cellWidth: 20 },
                        2: { cellWidth: 38 },
                        3: { cellWidth: 16 },
                        4: { cellWidth: 16 },
                        5: { cellWidth: 18 },
                        6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
                        7: { cellWidth: 24 },
                        8: { cellWidth: 'auto' }
                    },
                    foot: [[
                        'TOTAL', '', `${rents.length} Collections`, '', '', '',
                        `Rs. ${totalRent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                        '', ''
                    ]],
                    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5 },
                    margin: { left: 14, right: 14 },
                    didDrawPage: (data) => {
                        this.drawPdfPageFooter(doc, pageWidth, pageHeight);
                    }
                });
                y = doc.lastAutoTable.finalY + 10;
            }
        }

        // 5. SIGNATURE / VERIFICATION BLOCK
        if (y > pageHeight - 35) { doc.addPage(); y = 20; }
        
        doc.setDrawColor(203, 213, 225);
        doc.line(14, y, pageWidth - 14, y);
        y += 6;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text('VERIFICATION & SIGN-OFF', 14, y);

        y += 12;

        const sigWidth = 70;
        // Sajida Signature Line
        doc.setDrawColor(148, 163, 184);
        doc.line(20, y, 20 + sigWidth, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text('Co-Owner: Sajida (1st & 2nd Floors)', 20, y + 4);
        doc.text('Signature & Date', 20, y + 8);

        // Jeelani Signature Line
        const jX = pageWidth - 20 - sigWidth;
        doc.line(jX, y, jX + sigWidth, y);
        doc.text('Co-Owner: Jeelani (3rd, 4th & 5th Floors)', jX, y + 4);
        doc.text('Signature & Date', jX, y + 8);

        // Draw final page footer
        this.drawPdfPageFooter(doc, pageWidth, pageHeight);

        // Generate Filename & Download
        const cleanTitle = reportTitle.replace(/[^a-zA-Z0-9]+/g, '_');
        const cleanPeriod = periodLabel.slice(0, 20).replace(/[^a-zA-Z0-9]+/g, '_');
        const fileName = `Meera_Heights_${cleanTitle}_${cleanPeriod}.pdf`;

        this.savePDFUniversally(doc, fileName);
        this.showToast(`✓ PDF Report "${fileName}" downloaded successfully!`, 'success');
    },

    drawPdfPageFooter(doc, pageWidth, pageHeight) {
        const pageCount = doc.internal.getNumberOfPages();
        const currentPage = doc.internal.getCurrentPageInfo().pageNumber;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
            'Meera Heights Building Management System  •  Official & Confidential Record',
            14,
            pageHeight - 8
        );
        doc.text(
            `Page ${currentPage} of ${pageCount}`,
            pageWidth - 14,
            pageHeight - 8,
            { align: 'right' }
        );
    },

    // Individual Expense Payment Voucher (PDF)
    downloadExpenseVoucherPDF(expenseId) {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            this.showToast('PDF library loading...', 'error');
            return;
        }

        const exp = (this.data.expenses || []).find(e => e.id === expenseId);
        if (!exp) {
            this.showToast('Expense record not found.', 'error');
            return;
        }

        const cat = this.data.categories.find(c => c.id === exp.categoryId) || { name: 'General Expenditure' };
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const pageWidth = doc.internal.pageSize.getWidth();

        let y = 16;

        // Header Band
        doc.setFillColor(4, 120, 87);
        doc.roundedRect(14, y, pageWidth - 28, 22, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('MEERA HEIGHTS RESIDENTIAL APARTMENTS', 20, y + 9);
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(209, 250, 229);
        doc.text('Co-owned by Sajida (Fl 1-2 • 40%) & Jeelani (Fl 3-5 • 60%)', 20, y + 16);

        y += 28;

        // Title box
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(14, y, pageWidth - 28, 12, 2, 2, 'FD');
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('PAYMENT & MAINTENANCE VOUCHER', 18, y + 7.5);
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        const voucherNo = `VOUCHER-${(exp.id || '').slice(-6).toUpperCase()}`;
        doc.text(`Voucher No: ${voucherNo}  |  Date: ${exp.date || '-'}`, pageWidth - 18, y + 7.5, { align: 'right' });

        y += 18;

        // Voucher Body Table
        const rows = [
            ['Expense Purpose / Item:', exp.title || 'Building Expense'],
            ['Expenditure Category:', cat.name],
            ['Total Amount Debited:', `Rs. ${Number(exp.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
            ['Amount in Words:', this.numberToIndianWords(exp.amount)],
            ['Debited Account / Wallet:', exp.debitedWallet || exp.debitedSource || 'Both Wallets'],
            ['Sajida Co-Owner Share (40%):', `Rs. ${Number(exp.sajidaAmount || 0).toLocaleString('en-IN')}`],
            ['Jeelani Co-Owner Share (60%):', `Rs. ${Number(exp.jeelaniAmount || 0).toLocaleString('en-IN')}`],
            ['Recurring Automation?:', exp.isRecurring ? 'Yes (Monthly Automated Engine)' : 'One-Time Payment'],
            ['Notes & Details:', exp.notes || 'None recorded']
        ];

        if (typeof doc.autoTable === 'function') {
            doc.autoTable({
                startY: y,
                body: rows,
                theme: 'plain',
                styles: { fontSize: 8.5, cellPadding: 3, textColor: [15, 23, 42] },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 55, textColor: [71, 85, 105] },
                    1: { cellWidth: 'auto' }
                },
                margin: { left: 14, right: 14 }
            });
            y = doc.lastAutoTable.finalY + 18;
        }

        // Signatures
        doc.setDrawColor(203, 213, 225);
        doc.line(14, y, pageWidth - 14, y);
        y += 14;

        doc.line(20, y, 80, y);
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text('Prepared By / Caretaker', 20, y + 4);

        doc.line(pageWidth - 80, y, pageWidth - 20, y);
        doc.text('Authorized Signatory (Sajida / Jeelani)', pageWidth - 80, y + 4);

        const cleanTitle = (exp.title || 'Expense').replace(/[^a-zA-Z0-9]+/g, '_');
        this.savePDFUniversally(doc, `Meera_Heights_Voucher_${exp.date || ''}_${cleanTitle}.pdf`);
        this.showToast(`✓ Payment voucher for "${exp.title}" downloaded!`, 'success');
    },

    // Individual Tenant Rent Receipt (PDF)
    downloadRentReceiptPDF(rentId) {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            this.showToast('PDF library loading...', 'error');
            return;
        }

        const rent = (this.data.rentCollections || []).find(r => r.id === rentId);
        if (!rent) {
            this.showToast('Rent collection record not found.', 'error');
            return;
        }

        const tenant = (this.data.tenants || []).find(t => t.id === rent.tenantId) || {
            name: rent.tenantName || 'Resident Tenant',
            flat: rent.flat || 'Flat',
            floor: rent.floor || 1
        };

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const pageWidth = doc.internal.pageSize.getWidth();

        let y = 16;

        // Header Band
        doc.setFillColor(4, 120, 87);
        doc.roundedRect(14, y, pageWidth - 28, 22, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('MEERA HEIGHTS RESIDENTIAL APARTMENTS', 20, y + 9);
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(209, 250, 229);
        doc.text('Official Rental Acknowledgment & Money Receipt', 20, y + 16);

        y += 28;

        // Receipt title bar
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(14, y, pageWidth - 28, 12, 2, 2, 'FD');
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('OFFICIAL RENT RECEIPT', 18, y + 7.5);
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        const receiptNo = `RECEIPT-${(rent.id || '').slice(-6).toUpperCase()}`;
        doc.text(`Receipt No: ${receiptNo}  |  Date: ${rent.paymentDate || '-'}`, pageWidth - 18, y + 7.5, { align: 'right' });

        y += 18;

        const floorName = tenant.floor ? `${tenant.floor}${tenant.floor == 1 ? 'st' : tenant.floor == 2 ? 'nd' : tenant.floor == 3 ? 'rd' : 'th'} Floor` : 'Residential Floor';
        const floorOwner = rent.ownerCredited || (tenant.floor <= 2 ? 'Sajida (Floors 1 & 2)' : 'Jeelani (Floors 3, 4 & 5)');

        const rows = [
            ['Received With Thanks From:', tenant.name || rent.tenantName],
            ['Apartment / Flat Number:', `Flat ${tenant.flat || rent.flat} (${floorName})`],
            ['Rental Billing Period / Month:', rent.month || 'Current Month'],
            ['Amount Received (in figures):', `Rs. ${Number(rent.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
            ['Amount Received (in words):', this.numberToIndianWords(rent.amount)],
            ['Payment Mode / Channel:', rent.paymentMode || rent.mode || 'UPI / Online Transfer'],
            ['Credited Floor Owner:', floorOwner],
            ['Receipt Status:', 'Payment Cleared & Credited to Building Account']
        ];

        if (typeof doc.autoTable === 'function') {
            doc.autoTable({
                startY: y,
                body: rows,
                theme: 'plain',
                styles: { fontSize: 8.5, cellPadding: 3, textColor: [15, 23, 42] },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 55, textColor: [71, 85, 105] },
                    1: { cellWidth: 'auto' }
                },
                margin: { left: 14, right: 14 }
            });
            y = doc.lastAutoTable.finalY + 18;
        }

        // Signature section
        doc.setDrawColor(203, 213, 225);
        doc.line(14, y, pageWidth - 14, y);
        y += 14;

        doc.line(pageWidth - 85, y, pageWidth - 20, y);
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`Authorized Receiver (${floorOwner})`, pageWidth - 85, y + 4);
        doc.text('Meera Heights Management', pageWidth - 85, y + 8);

        const cleanTenant = (tenant.name || 'Tenant').replace(/[^a-zA-Z0-9]+/g, '_');
        this.savePDFUniversally(doc, `Meera_Heights_Rent_Receipt_${cleanTenant}_${rent.month || ''}.pdf`);
        this.showToast(`✓ Official rent receipt for "${tenant.name}" downloaded!`, 'success');
    },

    // -------------------------------------------------------------
    // RENDER DISPATCHER
    // -------------------------------------------------------------
    renderAll() {
        const stats = this.getStats();
        this.renderStatsCards(stats);
        this.renderRecurringBanner();
        this.populateExpenseFilterDropdowns();
        this.renderCategoryPills();
        this.renderCategoryExportActions();
        this.renderExpenses();
        this.renderExpenseCalendar();
        this.renderTenants();
        this.renderRentLedger();
        this.renderFloorBreakupPage();
        this.renderWalletPage(stats);
        this.renderSettingsPage();
        this.renderRecurringExpensesManager();
        this.renderCharts();
    },

    // -------------------------------------------------------------
    // RECURRING EXPENSE BANNER
    // -------------------------------------------------------------
    renderRecurringBanner() {
        const currentMonth = this.getCurrentMonthKey();
        const due = this.getDueRecurringExpenses(currentMonth);
        const container = document.getElementById('recurring-banner-container');
        if (!container) return;

        if (due.length === 0) {
            container.innerHTML = '';
            container.classList.add('hidden');
            return;
        }

        const totalDue = due.reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0);
        const dueTitles = due.map(r => r.title.split('-')[0].trim()).slice(0, 3).join(', ');

        container.classList.remove('hidden');
        container.innerHTML = `
            <div class="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all animate-subtle-pulse">
                <div class="flex items-center gap-3">
                    <div class="w-11 h-11 rounded-xl bg-white/20 backdrop-blur text-white flex items-center justify-center shrink-0">
                        <i class="fa-solid fa-arrows-rotate text-xl animate-spin" style="animation-duration: 6s;"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-emerald-800 uppercase tracking-wide">
                                Automated Engine
                            </span>
                            <span class="text-xs font-semibold text-emerald-100">${due.length} Expenses Due for ${currentMonth}</span>
                        </div>
                        <h4 class="text-base font-extrabold text-white mt-0.5">
                            ₹${totalDue.toLocaleString('en-IN')} in Recurring Expenses Pending
                        </h4>
                        <p class="text-xs text-emerald-100 mt-0.5 max-w-xl">
                            Includes: ${dueTitles}${due.length > 3 ? ` + ${due.length - 3} more` : ''}.
                        </p>
                    </div>
                </div>
                <div class="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                    <button onclick="App.postDueRecurringExpenses(null, true)" class="flex-1 sm:flex-none px-4 py-2.5 bg-white text-emerald-900 hover:bg-emerald-50 text-xs font-black rounded-xl transition shadow-md flex items-center justify-center gap-2">
                        <i class="fa-solid fa-bolt text-amber-500"></i>
                        <span>1-Click Post All (₹${totalDue.toLocaleString('en-IN')})</span>
                    </button>
                    <button onclick="App.openManageRecurringModal()" class="px-3 py-2.5 bg-emerald-800/60 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl transition" title="Manage recurring rules">
                        <i class="fa-solid fa-gear"></i>
                    </button>
                </div>
            </div>
        `;
    },

    renderRecurringExpensesManager() {
        const container = document.getElementById('recurring-rules-list-container');
        if (!container) return;

        const rules = this.data.recurringExpenses || [];
        if (rules.length === 0) {
            container.innerHTML = `<p class="text-xs text-slate-400 py-4 text-center">No recurring rules configured yet.</p>`;
            return;
        }

        let html = '<div class="space-y-3">';
        rules.forEach(rule => {
            const cat = this.data.categories.find(c => c.id === rule.categoryId) || { name: 'General', icon: 'fa-tag', color: '#10B981' };
            const isActive = rule.active !== false;

            let splitText = "60:40 Floor Ratio";
            if (rule.splitType === 'sajida_only') splitText = "100% Sajida (Fl 1-2)";
            else if (rule.splitType === 'jeelani_only') splitText = "100% Jeelani (Fl 3-5)";
            else if (rule.splitType === 'custom') splitText = `${rule.sajidaRatio}% : ${rule.jeelaniRatio}%`;

            html += `
                <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm gap-3 ${!isActive ? 'opacity-60 bg-slate-50' : ''}">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0" style="background-color: ${cat.color || '#10B981'}">
                            <i class="fa-solid ${cat.icon || 'fa-tag'}"></i>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <h5 class="font-bold text-sm text-slate-900 dark:text-white">${rule.title}</h5>
                                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}">
                                    ${isActive ? 'Active' : 'Paused'}
                                </span>
                            </div>
                            <div class="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                                <span>Day ${rule.dayOfMonth || 1} of month</span>
                                <span>•</span>
                                <span class="font-medium text-slate-600 dark:text-slate-300">${splitText}</span>
                                <span>•</span>
                                <span>${cat.name}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
                        <div class="text-right sm:mr-2">
                            <span class="block text-[10px] text-slate-400 uppercase font-semibold">Monthly Amount</span>
                            <div class="font-black text-sm text-slate-900 dark:text-white">₹${parseFloat(rule.amount).toLocaleString('en-IN')}</div>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <button onclick="App.toggleRecurringRuleActive('${rule.id}')" class="p-2 rounded-xl text-xs font-semibold ${isActive ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}" title="${isActive ? 'Pause rule' : 'Activate rule'}">
                                <i class="fa-solid ${isActive ? 'fa-pause' : 'fa-play'}"></i>
                            </button>
                            <button onclick="App.openAddRecurringModal('${rule.id}')" class="p-2 text-slate-400 hover:text-emerald-600 rounded-xl transition" title="Edit rule">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button onclick="App.deleteRecurringRule('${rule.id}')" class="p-2 text-slate-400 hover:text-red-500 rounded-xl transition" title="Delete rule">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;
    },

    openManageRecurringModal() {
        this.switchTab('settings');
        const target = document.getElementById('settings-recurring-section');
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    },

    // -------------------------------------------------------------
    // STATS CARDS
    // -------------------------------------------------------------
    renderStatsCards(stats) {
        // --- 4 Wallets Dashboard Breakup ---
        // Sajida Wallets
        this.setElementText('stat-sajida-advance-wallet', `₹${stats.sajidaAdvanceBalance.toLocaleString('en-IN')}`);
        this.setElementText('stat-sajida-rent-wallet', `₹${stats.sajidaRentBalance.toLocaleString('en-IN')}`);
        this.setElementText('stat-sajida-total-wallet', `₹${stats.sajidaBalance.toLocaleString('en-IN')}`);
        this.setElementText('stat-sajida-wallet', `₹${stats.sajidaBalance.toLocaleString('en-IN')}`);
        this.setElementText('stat-sajida-adv-collected', `+₹${stats.sajidaAdvancesCollected.toLocaleString('en-IN')}`);
        this.setElementText('stat-sajida-adv-expenses', `-₹${stats.sajidaExpAdvance.toLocaleString('en-IN')}`);
        this.setElementText('stat-sajida-adv-refunds', `-₹${stats.sajidaRefunds.toLocaleString('en-IN')}`);
        this.setElementText('stat-sajida-adv-deductions', `-₹${stats.sajidaDeductions.toLocaleString('en-IN')}`);
        this.setElementText('stat-sajida-adv-transfers', `${stats.sajidaAdvTransfersNet >= 0 ? '+' : ''}₹${stats.sajidaAdvTransfersNet.toLocaleString('en-IN')}`);
        this.setElementText('stat-sajida-adv-bank', `${(stats.sajidaAdvBankIn - stats.sajidaAdvBankOut) >= 0 ? '+' : ''}₹${(stats.sajidaAdvBankIn - stats.sajidaAdvBankOut).toLocaleString('en-IN')}`);
        this.setElementText('stat-sajida-adv-held', `₹${stats.sajidaAdvancesHeld.toLocaleString('en-IN')}`);
        this.setElementText('stat-sajida-adv-free', `₹${stats.sajidaFreeAdvance.toLocaleString('en-IN')}`);
        this.setElementText('stat-sajida-adv-free-card', `₹${stats.sajidaFreeAdvance.toLocaleString('en-IN')}`);
        this.setElementText('stat-sajida-rent-collected', `+₹${stats.sajidaRentTotal.toLocaleString('en-IN')}`);
        this.setElementText('stat-sajida-rent-deductions', `+₹${stats.sajidaDeductions.toLocaleString('en-IN')}`);
        this.setElementText('stat-sajida-rent-transfers', `${stats.sajidaRentTransfersNet >= 0 ? '+' : ''}₹${stats.sajidaRentTransfersNet.toLocaleString('en-IN')}`);
        this.setElementText('stat-sajida-rent-bank', `${(stats.sajidaRentBankIn - stats.sajidaRentBankOut) >= 0 ? '+' : ''}₹${(stats.sajidaRentBankIn - stats.sajidaRentBankOut).toLocaleString('en-IN')}`);

        // Jeelani Wallets
        this.setElementText('stat-jeelani-advance-wallet', `₹${stats.jeelaniAdvanceBalance.toLocaleString('en-IN')}`);
        this.setElementText('stat-jeelani-rent-wallet', `₹${stats.jeelaniRentBalance.toLocaleString('en-IN')}`);
        this.setElementText('stat-jeelani-total-wallet', `₹${stats.jeelaniBalance.toLocaleString('en-IN')}`);
        this.setElementText('stat-jeelani-wallet', `₹${stats.jeelaniBalance.toLocaleString('en-IN')}`);
        this.setElementText('stat-jeelani-adv-collected', `+₹${stats.jeelaniAdvancesCollected.toLocaleString('en-IN')}`);
        this.setElementText('stat-jeelani-adv-expenses', `-₹${stats.jeelaniExpAdvance.toLocaleString('en-IN')}`);
        this.setElementText('stat-jeelani-adv-refunds', `-₹${stats.jeelaniRefunds.toLocaleString('en-IN')}`);
        this.setElementText('stat-jeelani-adv-deductions', `-₹${stats.jeelaniDeductions.toLocaleString('en-IN')}`);
        this.setElementText('stat-jeelani-adv-transfers', `${stats.jeelaniAdvTransfersNet >= 0 ? '+' : ''}₹${stats.jeelaniAdvTransfersNet.toLocaleString('en-IN')}`);
        this.setElementText('stat-jeelani-adv-bank', `${(stats.jeelaniAdvBankIn - stats.jeelaniAdvBankOut) >= 0 ? '+' : ''}₹${(stats.jeelaniAdvBankIn - stats.jeelaniAdvBankOut).toLocaleString('en-IN')}`);
        this.setElementText('stat-jeelani-adv-held', `₹${stats.jeelaniAdvancesHeld.toLocaleString('en-IN')}`);
        this.setElementText('stat-jeelani-adv-free', `₹${stats.jeelaniFreeAdvance.toLocaleString('en-IN')}`);
        this.setElementText('stat-jeelani-adv-free-card', `₹${stats.jeelaniFreeAdvance.toLocaleString('en-IN')}`);
        this.setElementText('stat-jeelani-rent-collected', `+₹${stats.jeelaniRentTotal.toLocaleString('en-IN')}`);
        this.setElementText('stat-jeelani-rent-deductions', `+₹${stats.jeelaniDeductions.toLocaleString('en-IN')}`);
        this.setElementText('stat-jeelani-rent-transfers', `${stats.jeelaniRentTransfersNet >= 0 ? '+' : ''}₹${stats.jeelaniRentTransfersNet.toLocaleString('en-IN')}`);
        this.setElementText('stat-jeelani-rent-bank', `${(stats.jeelaniRentBankIn - stats.jeelaniRentBankOut) >= 0 ? '+' : ''}₹${(stats.jeelaniRentBankIn - stats.jeelaniRentBankOut).toLocaleString('en-IN')}`);

        // Treasury & Totals
        this.setElementText('stat-building-treasury', `₹${stats.netBuildingBalance.toLocaleString('en-IN')}`);
        this.setElementText('stat-total-rent', `₹${stats.totalRent.toLocaleString('en-IN')}`);
        this.setElementText('stat-total-expenses', `₹${stats.totalExpenses.toLocaleString('en-IN')}`);
        this.setElementText('stat-total-deposits', `₹${stats.totalDeposits.toLocaleString('en-IN')}`);
        this.setElementText('settlement-headline', stats.settlementText);
        this.setElementText('settlement-subtext', stats.settlementNote);

        // Header mini balance badge (Mobile & Desktop)
        this.setElementText('header-treasury-badge', `₹${stats.netBuildingBalance.toLocaleString('en-IN')}`);
        this.setElementText('header-treasury-badge-desktop', `₹${stats.netBuildingBalance.toLocaleString('en-IN')}`);
    },

    // -------------------------------------------------------------
    // DYNAMIC CATEGORIES / SHEETS PILLS
    // -------------------------------------------------------------
    renderCategoryPills() {
        const container = document.getElementById('category-pills-container');
        if (!container) return;

        const allSpent = this.data.expenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);

        let html = `
            <button onclick="App.setExpenseCategory('all')" 
                class="px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 shadow-sm ${
                    this.expenseCategoryFilter === 'all' 
                    ? 'bg-slate-900 text-white dark:bg-emerald-600' 
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }">
                <i class="fa-solid fa-layer-group text-amber-500"></i>
                <span>All Master Sheets</span>
                <span class="ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${this.expenseCategoryFilter === 'all' ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}">
                    ₹${allSpent.toLocaleString('en-IN')}
                </span>
            </button>
        `;

        this.data.categories.forEach(cat => {
            const catExpenses = this.data.expenses.filter(e => e.categoryId === cat.id);
            const spent = catExpenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
            const isSelected = this.expenseCategoryFilter === cat.id;

            html += `
                <button onclick="App.setExpenseCategory('${cat.id}')" 
                    class="px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 shadow-sm ${
                        isSelected 
                        ? 'bg-emerald-600 text-white shadow-emerald-200' 
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                    }">
                    <i class="fa-solid ${cat.icon || 'fa-tag'}" style="color: ${isSelected ? '#ffffff' : (cat.color || '#10B981')}"></i>
                    <span>${cat.name}</span>
                    <span class="ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${isSelected ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}">
                        ₹${spent.toLocaleString('en-IN')}
                    </span>
                </button>
            `;
        });

        html += `
            <button onclick="App.openAddCategoryModal()" 
                class="px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                <i class="fa-solid fa-plus-circle"></i>
                <span>+ Add New Sheet/Category</span>
            </button>
        `;

        container.innerHTML = html;
        this.renderQuickExpenseCategoryBar();
    },

    // ⚡ 1-Tap Quick Expense Creator by Category
    renderQuickExpenseCategoryBar() {
        const container = document.getElementById('quick-expense-category-chips');
        if (!container) return;
        let html = '';
        (this.data.categories || []).forEach(cat => {
            html += `
                <button onclick="App.openQuickExpenseForCategory('${cat.id}')" 
                    class="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 bg-white hover:bg-emerald-50 text-slate-800 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 shadow-sm active:scale-95 cursor-pointer" 
                    title="1-Tap record ${this.escapeHtml(cat.name)} expense">
                    <span class="w-4 h-4 rounded-full flex items-center justify-center text-[9px] text-white shrink-0" style="background-color: ${cat.color || '#10B981'}">
                        <i class="fa-solid fa-plus"></i>
                    </span>
                    <span>${this.escapeHtml(cat.name)}</span>
                </button>
            `;
        });
        container.innerHTML = html;
    },

    openQuickExpenseForCategory(categoryId) {
        this.openExpenseModal();
        if (categoryId && categoryId !== 'all') {
            const catSelect = document.getElementById('exp-category');
            if (catSelect) {
                catSelect.value = categoryId;
                this.onExpenseCategoryChanged(categoryId);
            }
        }
        setTimeout(() => {
            const amtInput = document.getElementById('exp-amount');
            if (amtInput) amtInput.focus();
        }, 120);
    },

    setExpenseCategory(catId) {
        this.expenseCategoryFilter = catId;
        this.expenseFilters.categoryId = catId;
        this.expenseFilters.subCategory = 'all';
        const catSelect = document.getElementById('filter-exp-category');
        if (catSelect) catSelect.value = catId;
        this.populateFilterSubcategoriesDropdown(catId);
        this.renderCategoryPills();
        this.renderExpenses();
        this.renderCategoryExportActions();
        this.renderExpenseCalendar();
    },

    renderCategoryExportActions() {
        const container = document.getElementById('category-export-actions');
        if (!container) return;
        const cat = this.data.categories.find(c => c.id === this.expenseCategoryFilter);
        const label = cat ? cat.name : 'All Expense Categories';
        const categoryArg = cat ? `'${cat.id}'` : "'all'";
        container.innerHTML = `
            <div class="flex items-center gap-2 min-w-0">
                <div class="w-9 h-9 rounded-xl bg-white border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0"><i class="fa-solid ${cat?.icon || 'fa-layer-group'}"></i></div>
                <div class="min-w-0"><p class="text-[10px] uppercase tracking-wide font-extrabold text-emerald-700">Selected sheet</p><p class="text-sm font-extrabold text-slate-900 truncate">${label}</p></div>
            </div>
            <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <button onclick="App.openQuickExpenseForCategory(${categoryArg})" class="category-export-btn quick-add px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer" title="Quickly record expense under ${label}"><i class="fa-solid fa-plus-circle"></i> + Record in ${cat ? this.escapeHtml(cat.name) : 'Sheet'}</button>
                <button onclick="App.downloadCategoryExcel(${categoryArg})" class="category-export-btn excel" title="Download formatted Excel workbook (.xlsx)"><i class="fa-solid fa-file-excel"></i> Excel (.xlsx)</button>
                <button onclick="App.downloadCategoryPDF(${categoryArg})" class="category-export-btn pdf" title="Download Executive PDF"><i class="fa-solid fa-file-pdf"></i> PDF</button>
                <button onclick="App.openPDFExportModal('category', ${categoryArg})" class="category-export-btn period" title="Custom Period PDF (Weekly, Monthly, Yearly)"><i class="fa-solid fa-calendar-days"></i> Period PDF</button>
                <button onclick="App.downloadCategoryCSV(${categoryArg})" class="category-export-btn csv" title="Export CSV"><i class="fa-solid fa-file-csv"></i> CSV</button>
            </div>`;
    },

    downloadCategoryCSV(categoryId = 'all') {
        const rows = this.data.expenses.filter(e => categoryId === 'all' || e.categoryId === categoryId);
        const category = this.data.categories.find(c => c.id === categoryId);
        const name = category ? category.name : 'All_Categories';
        const q = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const header = ['Date', 'Expense', 'Category', 'Amount', 'Sajida Share', 'Jeelani Share', 'Debited Wallet', 'Recurring', 'Notes'];
        const body = rows.map(e => {
            const c = this.data.categories.find(x => x.id === e.categoryId);
            return [e.date, e.title, c?.name || '', e.amount, e.sajidaAmount || 0, e.jeelaniAmount || 0, e.debitedWallet || e.debitedSource || '', e.isRecurring ? 'Yes' : 'No', e.notes || ''];
        });
        const csv = [header, ...body].map(row => row.map(q).join(',')).join('\r\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const fileName = `Meera_Heights_${name.replace(/[^a-z0-9]+/gi, '-')}_Expenses.csv`;
        ExcelExporter.downloadBlobUniversal(blob, fileName);
        this.showToast(`${name} CSV downloaded.`, 'success');
    },

    shiftExpenseCalendar(delta) {
        const current = new Date(`${this.expenseCalendarMonth}-01T00:00:00`);
        current.setMonth(current.getMonth() + delta);
        this.expenseCalendarMonth = current.toISOString().slice(0, 7);
        this.renderExpenseCalendar();
    },

    renderExpenseCalendar() {
        const container = document.getElementById('expense-calendar');
        const monthInput = document.getElementById('expense-calendar-month');
        if (!container || !monthInput) return;
        monthInput.value = this.expenseCalendarMonth;
        const [year, month] = this.expenseCalendarMonth.split('-').map(Number);
        const first = new Date(year, month - 1, 1);
        const days = new Date(year, month, 0).getDate();
        const start = first.getDay();
        const monthRows = this.data.expenses.filter(e => (e.date || '').startsWith(this.expenseCalendarMonth));
        const byDay = {};
        monthRows.forEach(e => { const day = Number((e.date || '').slice(8, 10)); (byDay[day] ||= []).push(e); });
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        let html = `<div class="expense-calendar-grid weekdays">${weekdays.map(d => `<div>${d}</div>`).join('')}</div><div class="expense-calendar-grid">`;
        for (let i = 0; i < start; i++) html += '<div class="calendar-day empty-day"></div>';
        for (let day = 1; day <= days; day++) {
            const items = byDay[day] || [];
            const sum = items.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
            html += `<button class="calendar-day ${items.length ? 'has-expenses' : ''}" onclick="App.focusCalendarDay(${day})"><span class="calendar-day-number">${day}</span>${items.length ? `<span class="calendar-count">${items.length} item${items.length > 1 ? 's' : ''}</span><strong>₹${sum.toLocaleString('en-IN')}</strong>` : '<span class="calendar-empty-label">No bills</span>'}</button>`;
        }
        html += '</div>';
        container.innerHTML = html;
    },

    focusCalendarDay(day) {
        const date = `${this.expenseCalendarMonth}-${String(day).padStart(2, '0')}`;
        const items = this.data.expenses.filter(e => e.date === date);
        if (!items.length) return this.showToast(`No expenses recorded on ${date}.`, 'info');
        const names = items.map(e => `${e.title || 'Expense'} (₹${Number(e.amount || 0).toLocaleString('en-IN')})`).join(' • ');
        this.showToast(`${date}: ${names}`, 'info');
    },

    // -------------------------------------------------------------
    // EXPENSES LISTING
    // -------------------------------------------------------------
    toggleExpenseAdvancedFilters() {
        const drawer = document.getElementById('expense-advanced-filters-drawer');
        const btn = document.getElementById('btn-toggle-expense-filters');
        if (!drawer) return;
        this.isExpenseFilterDrawerOpen = !this.isExpenseFilterDrawerOpen;
        drawer.classList.toggle('hidden', !this.isExpenseFilterDrawerOpen);
        if (btn) {
            btn.classList.toggle('bg-slate-200', this.isExpenseFilterDrawerOpen);
            btn.classList.toggle('border-emerald-500', this.isExpenseFilterDrawerOpen);
        }
    },

    onExpenseSearchInput(val) {
        this.expenseFilters.search = (val || '').trim();
        this.expenseSearchQuery = this.expenseFilters.search;
        const clearBtn = document.getElementById('btn-clear-search-text');
        if (clearBtn) {
            clearBtn.classList.toggle('hidden', !this.expenseFilters.search);
        }
        this.renderExpenses();
    },

    clearExpenseSearchText() {
        const searchInput = document.getElementById('expense-search-input');
        if (searchInput) searchInput.value = '';
        this.onExpenseSearchInput('');
    },

    onExpenseSortChange(val) {
        this.sortState.expenses = val;
        this.renderExpenses();
    },

    setExpenseDateMode(mode) {
        this.expenseFilters.dateMode = mode;
        const modes = ['all', 'specific', 'range', 'year'];
        modes.forEach(m => {
            const btn = document.getElementById(`btn-date-mode-${m}`);
            if (btn) btn.classList.toggle('active', m === mode);
        });

        const specBox = document.getElementById('filter-date-specific-box');
        const rangeBox = document.getElementById('filter-date-range-box');
        const yearBox = document.getElementById('filter-date-year-box');

        if (specBox) specBox.classList.toggle('hidden', mode !== 'specific');
        if (rangeBox) rangeBox.classList.toggle('hidden', mode !== 'range');
        if (yearBox) yearBox.classList.toggle('hidden', mode !== 'year');

        if (mode === 'all') {
            this.expenseFilters.dateSpecific = '';
            this.expenseFilters.dateStart = '';
            this.expenseFilters.dateEnd = '';
            this.expenseFilters.dateYear = '';
            const ds = document.getElementById('filter-exp-date-specific');
            const dstart = document.getElementById('filter-exp-date-start');
            const dend = document.getElementById('filter-exp-date-end');
            if (ds) ds.value = '';
            if (dstart) dstart.value = '';
            if (dend) dend.value = '';
        } else if (mode === 'specific') {
            const ds = document.getElementById('filter-exp-date-specific');
            if (ds && !ds.value) {
                ds.value = new Date().toISOString().slice(0, 10);
                this.expenseFilters.dateSpecific = ds.value;
            }
        } else if (mode === 'year') {
            const ySelect = document.getElementById('filter-exp-year');
            if (ySelect && !this.expenseFilters.dateYear) {
                this.expenseFilters.dateYear = ySelect.value || new Date().getFullYear().toString();
                ySelect.value = this.expenseFilters.dateYear;
            }
        }

        this.renderExpenses();
    },

    onFilterCategoryChanged(categoryId) {
        this.expenseCategoryFilter = categoryId;
        this.expenseFilters.categoryId = categoryId;
        this.expenseFilters.subCategory = 'all';
        this.populateFilterSubcategoriesDropdown(categoryId);
        this.renderCategoryPills();
        this.renderCategoryExportActions();
        this.renderExpenses();
        this.renderExpenseCalendar();
    },

    populateFilterSubcategoriesDropdown(categoryId) {
        const select = document.getElementById('filter-exp-subcategory');
        if (!select) return;

        let optionsHtml = '<option value="all">All Subcategories</option>';
        let subSet = new Set();

        if (categoryId === 'all') {
            this.data.categories.forEach(c => {
                if (Array.isArray(c.subcategories)) {
                    c.subcategories.forEach(s => subSet.add(s));
                } else if (typeof DEFAULT_CATEGORY_SUBCATEGORIES !== 'undefined' && DEFAULT_CATEGORY_SUBCATEGORIES[c.id]) {
                    DEFAULT_CATEGORY_SUBCATEGORIES[c.id].forEach(s => subSet.add(s));
                }
            });
            this.data.expenses.forEach(e => {
                if (e.subCategory) subSet.add(e.subCategory);
            });
        } else {
            const cat = this.data.categories.find(c => c.id === categoryId);
            if (cat && Array.isArray(cat.subcategories)) {
                cat.subcategories.forEach(s => subSet.add(s));
            } else if (typeof DEFAULT_CATEGORY_SUBCATEGORIES !== 'undefined' && DEFAULT_CATEGORY_SUBCATEGORIES[categoryId]) {
                DEFAULT_CATEGORY_SUBCATEGORIES[categoryId].forEach(s => subSet.add(s));
            }
            this.data.expenses.filter(e => e.categoryId === categoryId).forEach(e => {
                if (e.subCategory) subSet.add(e.subCategory);
            });
        }

        Array.from(subSet).sort().forEach(sub => {
            optionsHtml += `<option value="${this.escapeHtml(sub)}">${this.escapeHtml(sub)}</option>`;
        });

        select.innerHTML = optionsHtml;
        select.value = this.expenseFilters.subCategory || 'all';
    },

    populateExpenseFilterDropdowns() {
        const catSelect = document.getElementById('filter-exp-category');
        if (catSelect) {
            let catHtml = '<option value="all">All Categories</option>';
            this.data.categories.forEach(cat => {
                catHtml += `<option value="${cat.id}">${this.escapeHtml(cat.name)}</option>`;
            });
            catSelect.innerHTML = catHtml;
            catSelect.value = this.expenseFilters.categoryId || 'all';
        }

        const yearSelect = document.getElementById('filter-exp-year');
        if (yearSelect) {
            const curYear = new Date().getFullYear();
            const yearsSet = new Set([curYear, curYear - 1]);
            this.data.expenses.forEach(e => {
                if (e.date && e.date.length >= 4) {
                    const y = parseInt(e.date.slice(0, 4));
                    if (!isNaN(y)) yearsSet.add(y);
                }
            });
            const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
            let yHtml = '';
            sortedYears.forEach(y => {
                yHtml += `<option value="${y}">${y}</option>`;
            });
            yearSelect.innerHTML = yHtml;
            if (!this.expenseFilters.dateYear) {
                this.expenseFilters.dateYear = curYear.toString();
            }
            yearSelect.value = this.expenseFilters.dateYear;
        }

        this.populateFilterSubcategoriesDropdown(this.expenseFilters.categoryId || 'all');
    },

    onExpenseFilterFieldChanged() {
        this.expenseFilters.dateSpecific = document.getElementById('filter-exp-date-specific')?.value || '';
        this.expenseFilters.dateStart = document.getElementById('filter-exp-date-start')?.value || '';
        this.expenseFilters.dateEnd = document.getElementById('filter-exp-date-end')?.value || '';
        this.expenseFilters.dateYear = document.getElementById('filter-exp-year')?.value || '';
        this.expenseFilters.subCategory = document.getElementById('filter-exp-subcategory')?.value || 'all';
        
        const minVal = parseFloat(document.getElementById('filter-exp-min-amount')?.value);
        this.expenseFilters.minAmount = isNaN(minVal) ? null : minVal;
        
        const maxVal = parseFloat(document.getElementById('filter-exp-max-amount')?.value);
        this.expenseFilters.maxAmount = isNaN(maxVal) ? null : maxVal;
        
        this.expenseFilters.splitType = document.getElementById('filter-exp-split')?.value || 'all';
        this.expenseFilters.wallet = document.getElementById('filter-exp-wallet')?.value || 'all';

        document.querySelectorAll('.expense-preset-chip').forEach(btn => btn.classList.remove('active'));

        this.renderExpenses();
    },

    applyExpenseQuickPreset(preset) {
        document.querySelectorAll('.expense-preset-chip').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-preset') === preset);
        });
        this.expenseFilters.quickPreset = preset;

        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;

        if (preset === 'all') {
            this.clearAllExpenseFilters();
            return;
        } else if (preset === 'this_month') {
            this.setExpenseDateMode('range');
            const startMonth = `${y}-${m}-01`;
            const lastDay = new Date(y, today.getMonth() + 1, 0).getDate();
            const endMonth = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
            const startInp = document.getElementById('filter-exp-date-start');
            const endInp = document.getElementById('filter-exp-date-end');
            if (startInp) startInp.value = startMonth;
            if (endInp) endInp.value = endMonth;
            this.expenseFilters.dateStart = startMonth;
            this.expenseFilters.dateEnd = endMonth;
        } else if (preset === 'last_7_days') {
            this.setExpenseDateMode('range');
            const d7 = new Date();
            d7.setDate(d7.getDate() - 7);
            const start7 = `${d7.getFullYear()}-${String(d7.getMonth() + 1).padStart(2, '0')}-${String(d7.getDate()).padStart(2, '0')}`;
            const startInp = document.getElementById('filter-exp-date-start');
            const endInp = document.getElementById('filter-exp-date-end');
            if (startInp) startInp.value = start7;
            if (endInp) endInp.value = todayStr;
            this.expenseFilters.dateStart = start7;
            this.expenseFilters.dateEnd = todayStr;
        } else if (preset === 'this_year') {
            this.setExpenseDateMode('year');
            const ySelect = document.getElementById('filter-exp-year');
            if (ySelect) ySelect.value = y.toString();
            this.expenseFilters.dateYear = y.toString();
        } else if (preset === 'high_value') {
            const minInp = document.getElementById('filter-exp-min-amount');
            if (minInp) minInp.value = '10000';
            this.expenseFilters.minAmount = 10000;
        } else if (preset === 'maintenance') {
            const maintCat = this.data.categories.find(c => c.id === 'cat_maintenance' || c.name.toLowerCase().includes('maintenance'));
            const maintId = maintCat ? maintCat.id : 'cat_maintenance';
            this.onFilterCategoryChanged(maintId);
            const catSelect = document.getElementById('filter-exp-category');
            if (catSelect) catSelect.value = maintId;
        }

        this.renderExpenses();
    },

    clearAllExpenseFilters() {
        this.expenseFilters = {
            search: '',
            dateMode: 'all',
            dateSpecific: '',
            dateStart: '',
            dateEnd: '',
            dateYear: '',
            categoryId: 'all',
            subCategory: 'all',
            minAmount: null,
            maxAmount: null,
            splitType: 'all',
            wallet: 'all',
            quickPreset: 'all'
        };
        this.expenseSearchQuery = '';
        this.expenseCategoryFilter = 'all';

        const searchInput = document.getElementById('expense-search-input');
        if (searchInput) searchInput.value = '';
        const clearBtn = document.getElementById('btn-clear-search-text');
        if (clearBtn) clearBtn.classList.add('hidden');

        const catSelect = document.getElementById('filter-exp-category');
        if (catSelect) catSelect.value = 'all';

        const subSelect = document.getElementById('filter-exp-subcategory');
        if (subSelect) subSelect.value = 'all';

        const minInp = document.getElementById('filter-exp-min-amount');
        if (minInp) minInp.value = '';

        const maxInp = document.getElementById('filter-exp-max-amount');
        if (maxInp) maxInp.value = '';

        const splitSelect = document.getElementById('filter-exp-split');
        if (splitSelect) splitSelect.value = 'all';

        const walletSelect = document.getElementById('filter-exp-wallet');
        if (walletSelect) walletSelect.value = 'all';

        const ds = document.getElementById('filter-exp-date-specific');
        if (ds) ds.value = '';
        const dstart = document.getElementById('filter-exp-date-start');
        if (dstart) dstart.value = '';
        const dend = document.getElementById('filter-exp-date-end');
        if (dend) dend.value = '';

        this.setExpenseDateMode('all');

        document.querySelectorAll('.expense-preset-chip').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-preset') === 'all');
        });

        this.populateFilterSubcategoriesDropdown('all');
        this.renderCategoryPills();
        this.renderCategoryExportActions();
        this.renderExpenses();
        this.renderExpenseCalendar();
    },

    removeExpenseFilterTag(tagKey) {
        if (tagKey === 'search') {
            this.clearExpenseSearchText();
        } else if (tagKey === 'date') {
            this.setExpenseDateMode('all');
        } else if (tagKey === 'category') {
            this.onFilterCategoryChanged('all');
            const catSelect = document.getElementById('filter-exp-category');
            if (catSelect) catSelect.value = 'all';
        } else if (tagKey === 'subCategory') {
            this.expenseFilters.subCategory = 'all';
            const subSelect = document.getElementById('filter-exp-subcategory');
            if (subSelect) subSelect.value = 'all';
            this.renderExpenses();
        } else if (tagKey === 'minAmount') {
            this.expenseFilters.minAmount = null;
            const inp = document.getElementById('filter-exp-min-amount');
            if (inp) inp.value = '';
            this.renderExpenses();
        } else if (tagKey === 'maxAmount') {
            this.expenseFilters.maxAmount = null;
            const inp = document.getElementById('filter-exp-max-amount');
            if (inp) inp.value = '';
            this.renderExpenses();
        } else if (tagKey === 'splitType') {
            this.expenseFilters.splitType = 'all';
            const sel = document.getElementById('filter-exp-split');
            if (sel) sel.value = 'all';
            this.renderExpenses();
        } else if (tagKey === 'wallet') {
            this.expenseFilters.wallet = 'all';
            const sel = document.getElementById('filter-exp-wallet');
            if (sel) sel.value = 'all';
            this.renderExpenses();
        }
    },

    renderExpenses() {
        const container = document.getElementById('expenses-list-container');
        if (!container) return;

        // Build active filter tags
        const activeTags = [];
        if (this.expenseFilters.search) {
            activeTags.push({ key: 'search', label: `Search: "${this.expenseFilters.search}"` });
        }
        if (this.expenseFilters.dateMode === 'specific' && this.expenseFilters.dateSpecific) {
            activeTags.push({ key: 'date', label: `Date: ${this.expenseFilters.dateSpecific}` });
        } else if (this.expenseFilters.dateMode === 'range') {
            if (this.expenseFilters.dateStart && this.expenseFilters.dateEnd) {
                activeTags.push({ key: 'date', label: `${this.expenseFilters.dateStart} to ${this.expenseFilters.dateEnd}` });
            } else if (this.expenseFilters.dateStart) {
                activeTags.push({ key: 'date', label: `From: ${this.expenseFilters.dateStart}` });
            } else if (this.expenseFilters.dateEnd) {
                activeTags.push({ key: 'date', label: `Up to: ${this.expenseFilters.dateEnd}` });
            }
        } else if (this.expenseFilters.dateMode === 'year' && this.expenseFilters.dateYear) {
            activeTags.push({ key: 'date', label: `Year: ${this.expenseFilters.dateYear}` });
        }
        if (this.expenseFilters.categoryId && this.expenseFilters.categoryId !== 'all') {
            const catObj = this.data.categories.find(c => c.id === this.expenseFilters.categoryId);
            activeTags.push({ key: 'category', label: `Sheet: ${catObj ? catObj.name : this.expenseFilters.categoryId}` });
        }
        if (this.expenseFilters.subCategory && this.expenseFilters.subCategory !== 'all') {
            activeTags.push({ key: 'subCategory', label: `Sub: ${this.expenseFilters.subCategory}` });
        }
        if (this.expenseFilters.minAmount !== null && !isNaN(this.expenseFilters.minAmount)) {
            activeTags.push({ key: 'minAmount', label: `Min ₹${this.expenseFilters.minAmount.toLocaleString('en-IN')}` });
        }
        if (this.expenseFilters.maxAmount !== null && !isNaN(this.expenseFilters.maxAmount)) {
            activeTags.push({ key: 'maxAmount', label: `Max ₹${this.expenseFilters.maxAmount.toLocaleString('en-IN')}` });
        }
        if (this.expenseFilters.splitType && this.expenseFilters.splitType !== 'all') {
            const splitLabels = {
                ratio: '60:40 Ratio',
                sajida_only: '100% Sajida',
                jeelani_only: '100% Jeelani',
                custom: 'Custom Split'
            };
            activeTags.push({ key: 'splitType', label: splitLabels[this.expenseFilters.splitType] || this.expenseFilters.splitType });
        }
        if (this.expenseFilters.wallet && this.expenseFilters.wallet !== 'all') {
            const walletLabels = {
                both: 'Both Wallets',
                sajida: "Sajida's Wallet",
                jeelani: "Jeelani's Wallet"
            };
            activeTags.push({ key: 'wallet', label: walletLabels[this.expenseFilters.wallet] || this.expenseFilters.wallet });
        }

        const activeCount = activeTags.length;
        const badge = document.getElementById('expense-active-filter-badge');
        if (badge) {
            badge.textContent = activeCount;
            badge.classList.toggle('hidden', activeCount === 0);
        }
        const resetBtn = document.getElementById('btn-clear-all-expense-filters');
        if (resetBtn) {
            resetBtn.classList.toggle('hidden', activeCount === 0);
        }
        const activeBar = document.getElementById('expense-active-filters-bar');
        if (activeBar) {
            activeBar.classList.toggle('hidden', activeCount === 0);
        }
        const chipsContainer = document.getElementById('expense-active-chips-container');
        if (chipsContainer) {
            let chipsHtml = '';
            activeTags.forEach(t => {
                chipsHtml += `
                    <span class="expense-filter-chip">
                        <span>${this.escapeHtml(t.label)}</span>
                        <button type="button" onclick="App.removeExpenseFilterTag('${t.key}')" title="Remove filter">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </span>
                `;
            });
            chipsContainer.innerHTML = chipsHtml;
        }

        // Multi-criteria filter pipeline
        let filtered = [...this.data.expenses];

        // 1. Text Search (description, notes, subCategory, category name)
        if (this.expenseFilters.search) {
            const q = this.expenseFilters.search.toLowerCase();
            filtered = filtered.filter(e => {
                const cat = this.data.categories.find(c => c.id === e.categoryId);
                const catName = cat ? cat.name.toLowerCase() : '';
                const title = (e.title || '').toLowerCase();
                const notes = (e.notes || '').toLowerCase();
                const sub = (e.subCategory || '').toLowerCase();
                return title.includes(q) || notes.includes(q) || sub.includes(q) || catName.includes(q);
            });
        }

        // 2. Category
        if (this.expenseFilters.categoryId !== 'all') {
            filtered = filtered.filter(e => e.categoryId === this.expenseFilters.categoryId);
        }

        // 3. Subcategory
        if (this.expenseFilters.subCategory !== 'all') {
            filtered = filtered.filter(e => (e.subCategory || '').toLowerCase() === this.expenseFilters.subCategory.toLowerCase());
        }

        // 4. Date Search Modes
        if (this.expenseFilters.dateMode === 'specific' && this.expenseFilters.dateSpecific) {
            filtered = filtered.filter(e => e.date === this.expenseFilters.dateSpecific);
        } else if (this.expenseFilters.dateMode === 'range') {
            if (this.expenseFilters.dateStart) {
                filtered = filtered.filter(e => e.date && e.date >= this.expenseFilters.dateStart);
            }
            if (this.expenseFilters.dateEnd) {
                filtered = filtered.filter(e => e.date && e.date <= this.expenseFilters.dateEnd);
            }
        } else if (this.expenseFilters.dateMode === 'year' && this.expenseFilters.dateYear) {
            filtered = filtered.filter(e => e.date && e.date.startsWith(this.expenseFilters.dateYear));
        }

        // Backward compatibility for selectedMonthFilter if active
        if (this.selectedMonthFilter !== 'all' && this.expenseFilters.dateMode === 'all') {
            filtered = filtered.filter(e => e.date && e.date.startsWith(this.selectedMonthFilter));
        }

        // 5. Min / Max Amount
        if (this.expenseFilters.minAmount !== null) {
            filtered = filtered.filter(e => (parseFloat(e.amount) || 0) >= this.expenseFilters.minAmount);
        }
        if (this.expenseFilters.maxAmount !== null) {
            filtered = filtered.filter(e => (parseFloat(e.amount) || 0) <= this.expenseFilters.maxAmount);
        }

        // 6. Split Type
        if (this.expenseFilters.splitType !== 'all') {
            filtered = filtered.filter(e => e.splitType === this.expenseFilters.splitType);
        }

        // 7. Debited Wallet
        if (this.expenseFilters.wallet !== 'all') {
            filtered = filtered.filter(e => e.debitedWallet === this.expenseFilters.wallet);
        }

        // Update count label
        const countLabel = document.getElementById('expense-filtered-count-label');
        if (countLabel) {
            countLabel.textContent = `Showing ${filtered.length} of ${this.data.expenses.length} expenses`;
        }

        // Sorting
        filtered = this.sortRecords(filtered, this.sortState.expenses, 'title');
        const expenseSort = document.getElementById('expense-sort');
        if (expenseSort) expenseSort.value = this.sortState.expenses;

        if (filtered.length === 0) {
            const hasActiveFilters = activeCount > 0;
            container.innerHTML = `
                <div class="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8">
                    <div class="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                        <i class="fa-solid fa-filter-circle-xmark text-2xl"></i>
                    </div>
                    <h3 class="text-base font-bold text-slate-800 dark:text-slate-200">${hasActiveFilters ? 'No Matching Expenses' : 'No Expenses Recorded'}</h3>
                    <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">${hasActiveFilters ? 'No expense matches your active filters. Try clearing some filters or searching for another keyword.' : 'Tap the button below to add building maintenance or bill payment.'}</p>
                    <div class="mt-4 flex items-center justify-center gap-2">
                        ${hasActiveFilters ? `
                            <button onclick="App.clearAllExpenseFilters()" class="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm">
                                <i class="fa-solid fa-rotate-left"></i> Reset All Filters
                            </button>
                        ` : `
                            <button onclick="App.openExpenseModal()" class="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition flex items-center gap-1.5 shadow-sm">
                                <i class="fa-solid fa-plus"></i> Add New Expense
                            </button>
                        `}
                    </div>
                </div>
            `;
            return;
        }

        const expenseCalendarMonth = document.getElementById('expense-calendar-month');
        if (expenseCalendarMonth) {
            expenseCalendarMonth.addEventListener('change', e => {
                this.expenseCalendarMonth = e.target.value || new Date().toISOString().slice(0, 7);
                this.renderExpenseCalendar();
            });
        }

        // 1. Desktop Table View (visible on md and above)
        let desktopHtml = `
            <div class="hidden md:block overflow-x-auto rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
                <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                    <thead class="bg-slate-50 dark:bg-slate-700/60 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            <th class="px-4 py-3.5">Date & Item</th>
                            <th class="px-4 py-3.5">Category & Subcategory</th>
                            <th class="px-4 py-3.5">Amount</th>
                            <th class="px-4 py-3.5">Split Allocation</th>
                            <th class="px-4 py-3.5">Debited Wallet</th>
                            <th class="px-4 py-3.5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
        `;

        // 2. Mobile Cards View (visible on screens < md)
        let mobileHtml = `<div class="md:hidden space-y-3">`;

        filtered.forEach(exp => {
            const cat = this.data.categories.find(c => c.id === exp.categoryId) || { name: 'General', icon: 'fa-tag', color: '#10B981' };
            
            let splitBadge = '';
            let splitSummaryText = '60:40 Floor Ratio';
            if (exp.splitType === 'sajida_only') {
                splitBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">100% Sajida (Fl 1-2)</span>`;
                splitSummaryText = '100% Sajida (Floors 1-2)';
            } else if (exp.splitType === 'jeelani_only') {
                splitBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">100% Jeelani (Fl 3-5)</span>`;
                splitSummaryText = '100% Jeelani (Floors 3-5)';
            } else if (exp.splitType === 'custom') {
                splitBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">Custom (${exp.sajidaRatio}% : ${exp.jeelaniRatio}%)</span>
                              <div class="text-[11px] text-slate-500 mt-0.5">S: ₹${exp.sajidaAmount} | J: ₹${exp.jeelaniAmount}</div>`;
                splitSummaryText = `S: ₹${exp.sajidaAmount} | J: ₹${exp.jeelaniAmount}`;
            } else {
                splitBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">60:40 Floor Ratio</span>
                              <div class="text-[11px] text-slate-500 mt-0.5">S(40%): ₹${exp.sajidaAmount} | J(60%): ₹${exp.jeelaniAmount}</div>`;
                splitSummaryText = `S(40%): ₹${exp.sajidaAmount} | J(60%): ₹${exp.jeelaniAmount}`;
            }

            let walletText = `<span class="font-medium text-slate-700 dark:text-slate-300">Both Wallets</span>`;
            if (exp.debitedWallet === 'sajida') walletText = `<span class="font-medium text-emerald-600">Sajida's Wallet</span>`;
            if (exp.debitedWallet === 'jeelani') walletText = `<span class="font-medium text-blue-600">Jeelani's Wallet</span>`;

            // Desktop Table Row
            desktopHtml += `
                <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition">
                    <td class="px-4 py-3.5">
                        <div class="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>${this.escapeHtml(exp.title)}</span>
                            ${exp.isRecurring ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200"><i class="fa-solid fa-arrows-rotate text-[8px]"></i> Auto-Recurring</span>` : ''}
                        </div>
                        <div class="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <i class="fa-regular fa-calendar"></i> ${exp.date || 'N/A'}
                            ${exp.notes ? `<span class="text-slate-300 dark:text-slate-600">•</span> <span class="truncate max-w-xs">${this.escapeHtml(exp.notes)}</span>` : ''}
                        </div>
                    </td>
                    <td class="px-4 py-3.5">
                        <div class="flex flex-col gap-1 items-start">
                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                                <i class="fa-solid ${cat.icon}" style="color: ${cat.color}"></i>
                                <span>${this.escapeHtml(cat.name)}</span>
                            </span>
                            ${exp.subCategory ? `
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                                    <i class="fa-solid fa-tag text-[9px] text-emerald-600"></i>
                                    <span>${this.escapeHtml(exp.subCategory)}</span>
                                </span>
                            ` : ''}
                        </div>
                    </td>
                    <td class="px-4 py-3.5">
                        <div class="font-bold text-slate-900 dark:text-white text-base">₹${parseFloat(exp.amount).toLocaleString('en-IN')}</div>
                    </td>
                    <td class="px-4 py-3.5">${splitBadge}</td>
                    <td class="px-4 py-3.5 text-xs">${walletText}</td>
                    <td class="px-4 py-3.5 text-right whitespace-nowrap">
                        <button onclick="App.downloadExpenseVoucherPDF('${exp.id}')" class="p-1.5 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition cursor-pointer" title="Download Payment Voucher (PDF)">
                            <i class="fa-solid fa-file-invoice"></i>
                        </button>
                        <button onclick="App.editExpense('${exp.id}')" class="p-1.5 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition cursor-pointer" title="Edit">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button onclick="App.deleteExpense('${exp.id}')" class="p-1.5 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition ml-1 cursor-pointer" title="Delete">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;

            // Mobile Card (touch targets >= 42px, zero horizontal overflow)
            mobileHtml += `
                <div class="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
                    <div class="flex items-center justify-between gap-2 flex-wrap">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
                                <i class="fa-solid ${cat.icon}" style="color: ${cat.color}"></i>
                                <span>${this.escapeHtml(cat.name)}</span>
                            </span>
                            ${exp.subCategory ? `
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                                    <i class="fa-solid fa-tag text-[8px] text-emerald-600"></i>
                                    <span>${this.escapeHtml(exp.subCategory)}</span>
                                </span>
                            ` : ''}
                        </div>
                        <div class="text-right shrink-0">
                            <div class="text-base font-black text-slate-900">₹${parseFloat(exp.amount).toLocaleString('en-IN')}</div>
                            <span class="text-[10px] text-slate-400 font-medium">${exp.date || 'N/A'}</span>
                        </div>
                    </div>
                    <div>
                        <h4 class="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 flex-wrap">
                            <span>${this.escapeHtml(exp.title)}</span>
                            ${exp.isRecurring ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800"><i class="fa-solid fa-arrows-rotate text-[8px]"></i> Auto</span>` : ''}
                        </h4>
                        ${exp.notes ? `<p class="text-xs text-slate-500 mt-1">${this.escapeHtml(exp.notes)}</p>` : ''}
                    </div>
                    <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <div class="text-[11px] leading-tight min-w-0">
                            <div>${walletText}</div>
                            <div class="text-[10px] text-slate-400 mt-0.5">${splitSummaryText}</div>
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                            <button onclick="App.downloadExpenseVoucherPDF('${exp.id}')" class="w-9 h-9 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs transition cursor-pointer" title="Download Voucher (PDF)">
                                <i class="fa-solid fa-file-invoice"></i>
                            </button>
                            <button onclick="App.editExpense('${exp.id}')" class="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs transition cursor-pointer" title="Edit">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button onclick="App.deleteExpense('${exp.id}')" class="w-9 h-9 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center text-xs transition cursor-pointer" title="Delete">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        desktopHtml += `
                    </tbody>
                </table>
            </div>
        `;
        mobileHtml += `</div>`;

        container.innerHTML = desktopHtml + mobileHtml;
    },

    // -------------------------------------------------------------
    // FLOOR-WISE EXPENSES & BREAKUPS PAGE
    // -------------------------------------------------------------
    setFloorFilter(floor) {
        this.activeFloorFilter = floor;
        this.renderFloorBreakupPage();
    },

    onFloorMonthFilterChanged(month) {
        this.floorMonthFilter = month;
        this.renderFloorBreakupPage();
    },

    onFloorSearchInput(query) {
        this.floorSearchQuery = (query || '').toLowerCase().trim();
        this.renderFloorBreakupPage();
    },

    renderFloorBreakupPage() {
        const kpiContainer = document.getElementById('floor-kpi-cards');
        const costStructureContainer = document.getElementById('floor-cost-structure-container');
        const ledgerContainer = document.getElementById('floor-ledger-container');
        const monthFilterSelect = document.getElementById('floor-month-filter');

        if (!kpiContainer || !costStructureContainer || !ledgerContainer) return;

        // 1. Setup Floor Data dictionary with full financial lifecycle metrics
        const floorData = {
            1: { floor: 1, name: '1st Floor', owner: 'Sajida', floorsDesc: 'Floors 1 & 2', color: 'emerald', sharePct: '20%', expenses: 0, directExp: 0, sharedExp: 0, rent: 0, activeTenants: 0, advancePayment: 0, refundAdvance: 0, settleDeductions: 0, advanceHeld: 0, rentToBank: 0, rentToAdvance: 0, rentOutflow: 0, items: [], categories: {} },
            2: { floor: 2, name: '2nd Floor', owner: 'Sajida', floorsDesc: 'Floors 1 & 2', color: 'emerald', sharePct: '20%', expenses: 0, directExp: 0, sharedExp: 0, rent: 0, activeTenants: 0, advancePayment: 0, refundAdvance: 0, settleDeductions: 0, advanceHeld: 0, rentToBank: 0, rentToAdvance: 0, rentOutflow: 0, items: [], categories: {} },
            3: { floor: 3, name: '3rd Floor', owner: 'Jeelani', floorsDesc: 'Floors 3, 4 & 5', color: 'sky', sharePct: '20%', expenses: 0, directExp: 0, sharedExp: 0, rent: 0, activeTenants: 0, advancePayment: 0, refundAdvance: 0, settleDeductions: 0, advanceHeld: 0, rentToBank: 0, rentToAdvance: 0, rentOutflow: 0, items: [], categories: {} },
            4: { floor: 4, name: '4th Floor', owner: 'Jeelani', floorsDesc: 'Floors 3, 4 & 5', color: 'sky', sharePct: '20%', expenses: 0, directExp: 0, sharedExp: 0, rent: 0, activeTenants: 0, advancePayment: 0, refundAdvance: 0, settleDeductions: 0, advanceHeld: 0, rentToBank: 0, rentToAdvance: 0, rentOutflow: 0, items: [], categories: {} },
            5: { floor: 5, name: '5th Floor', owner: 'Jeelani', floorsDesc: 'Floors 3, 4 & 5', color: 'sky', sharePct: '20%', expenses: 0, directExp: 0, sharedExp: 0, rent: 0, activeTenants: 0, advancePayment: 0, refundAdvance: 0, settleDeductions: 0, advanceHeld: 0, rentToBank: 0, rentToAdvance: 0, rentOutflow: 0, items: [], categories: {} },
        };

        // 2. Count Active Tenants & Calculate Advance Payment, Refunded, Deductions, and Held
        (this.data.tenants || []).forEach(t => {
            const fl = parseInt(t.floor) || this.detectFloorFromFlat(t.flat);
            if (floorData[fl]) {
                const adv = parseFloat(t.advanceDeposit) || 0;
                floorData[fl].advancePayment += adv;
                const ref = parseFloat(t.advanceRefunded) || 0;
                floorData[fl].refundAdvance += ref;
                const ded = parseFloat(t.advanceDeductions) || 0;
                floorData[fl].settleDeductions += ded;
                if (t.status !== 'vacated') {
                    floorData[fl].activeTenants++;
                }
            }
        });

        [1, 2, 3, 4, 5].forEach(fl => {
            floorData[fl].advanceHeld = Math.max(0, floorData[fl].advancePayment - floorData[fl].refundAdvance - floorData[fl].settleDeductions);
        });

        // 3. Populate Month Filter options if needed
        if (monthFilterSelect) {
            const currentSelected = this.floorMonthFilter || 'all';
            const monthsMap = {};
            [...this.data.rentCollections, ...this.data.expenses].forEach(item => {
                const m = item.month || (item.date ? item.date.slice(0, 7) : '');
                if (m) monthsMap[m] = true;
            });
            const sortedMonths = Object.keys(monthsMap).sort().reverse();
            let monthOpts = `<option value="all" ${currentSelected === 'all' ? 'selected' : ''}>All Months</option>`;
            sortedMonths.forEach(m => {
                monthOpts += `<option value="${m}" ${currentSelected === m ? 'selected' : ''}>${m}</option>`;
            });
            monthFilterSelect.innerHTML = monthOpts;
        }

        // 4. Rent Collections per floor (respecting month filter)
        (this.data.rentCollections || []).forEach(r => {
            if (this.floorMonthFilter !== 'all' && r.month !== this.floorMonthFilter) return;
            const fl = parseInt(r.floor) || 1;
            if (floorData[fl]) {
                floorData[fl].rent += (parseFloat(r.amount) || 0);
            }
        });

        // 5. Rent Owner Wallet to Owner Bank Inflow & Rent Outflows
        // Helper to detect a single floor attribution from a transaction
        const detectSingleFloor = (item) => {
            if (!item) return null;
            // 1. Direct floorCode
            if (item.floorCode !== undefined && item.floorCode !== null) {
                const fc = String(item.floorCode).trim();
                if (/^[1-5]$/.test(fc)) return parseInt(fc);
            }
            // 2. Direct floor field
            if (item.floor && typeof item.floor === 'string') {
                const flStr = item.floor.trim();
                if (!/floors|all|split|&|,/i.test(flStr)) {
                    const m = flStr.match(/\b(?:floor\s*)?([1-5])(?:st|nd|rd|th)?(?:\s*floor)?\b/i);
                    if (m && /^[1-5]$/.test(m[1])) return parseInt(m[1]);
                }
            }
            // 3. Notes / Reference (only if not referring to multiple floors)
            const text = `${item.notes || ''} ${item.reference || ''}`.trim();
            if (text && !/floors\s*[1-5]\s*(?:&|,|\band\b)\s*[1-5]/i.test(text)) {
                const m = text.match(/\b(?:floor|fl|flat|flr)\s*([1-5])\b/i) || 
                          text.match(/\b([1-5])(?:st|nd|rd|th)\s*(?:floor|fl|flr)\b/i) ||
                          text.match(/\bflat\s*([1-5])\d{2}\b/i);
                if (m && /^[1-5]$/.test(m[1])) return parseInt(m[1]);
            }
            return null;
        };

        // Helper to allocate an unassigned outflow across an owner's floors in proportion to rent collected
        const allocateUnassigned = (amt, ownerFloors, targetField) => {
            if (amt <= 0) return;
            const ownerRent = ownerFloors.reduce((sum, fl) => sum + (floorData[fl].rent || 0), 0);
            if (ownerRent > 0) {
                const activeFloors = ownerFloors.filter(fl => (floorData[fl].rent || 0) > 0);
                if (activeFloors.length === 1) {
                    floorData[activeFloors[0]][targetField] += amt;
                } else {
                    let rem = amt;
                    ownerFloors.forEach((fl, idx) => {
                        if (idx === ownerFloors.length - 1) {
                            floorData[fl][targetField] += rem;
                        } else {
                            const share = Math.round(amt * ((floorData[fl].rent || 0) / ownerRent));
                            rem -= share;
                            floorData[fl][targetField] += share;
                        }
                    });
                }
            } else {
                // If no rent collected on this owner's floors, split equally
                let rem = amt;
                const equalShare = Math.round(amt / ownerFloors.length);
                ownerFloors.forEach((fl, idx) => {
                    const cur = (idx === ownerFloors.length - 1) ? rem : equalShare;
                    rem -= cur;
                    floorData[fl][targetField] += cur;
                });
            }
        };

        // Process Bank Transactions (wallet_to_bank from rent wallets)
        let sajidaUnassignedBank = 0;
        let jeelaniUnassignedBank = 0;

        (this.data.bankTransactions || []).forEach(tx => {
            const txMonth = tx.date ? tx.date.slice(0, 7) : '';
            if (this.floorMonthFilter !== 'all' && txMonth && txMonth !== this.floorMonthFilter) return;
            if (tx.type !== 'wallet_to_bank') return;
            const amt = parseFloat(tx.amount) || 0;
            if (amt <= 0) return;

            const wId = tx.walletId || (tx.ownerId === 'sajida' ? 'sajida_rent' : 'jeelani_rent');
            const isSajida = (wId === 'sajida_rent');
            const isJeelani = (wId === 'jeelani_rent');
            if (!isSajida && !isJeelani) return;

            const ownerFloors = isSajida ? [1, 2] : [3, 4, 5];
            const detectedFl = detectSingleFloor(tx);

            if (detectedFl && ownerFloors.includes(detectedFl)) {
                floorData[detectedFl].rentToBank += amt;
            } else {
                if (isSajida) sajidaUnassignedBank += amt;
                else jeelaniUnassignedBank += amt;
            }
        });

        // Distribute unassigned Rent-to-Bank outflows proportionally
        allocateUnassigned(sajidaUnassignedBank, [1, 2], 'rentToBank');
        allocateUnassigned(jeelaniUnassignedBank, [3, 4, 5], 'rentToBank');

        // Process Wallet Transfers (rent to advance replenishment reserve)
        let sajidaUnassignedAdv = 0;
        let jeelaniUnassignedAdv = 0;

        (this.data.walletTransfers || []).forEach(tr => {
            const trMonth = tr.date ? tr.date.slice(0, 7) : '';
            if (this.floorMonthFilter !== 'all' && trMonth && trMonth !== this.floorMonthFilter) return;
            const amt = parseFloat(tr.amount) || 0;
            if (amt <= 0) return;

            const isSajida = (tr.fromWallet === 'sajida_rent');
            const isJeelani = (tr.fromWallet === 'jeelani_rent');
            if (!isSajida && !isJeelani) return;

            const ownerFloors = isSajida ? [1, 2] : [3, 4, 5];
            const detectedFl = detectSingleFloor(tr);

            if (detectedFl && ownerFloors.includes(detectedFl)) {
                floorData[detectedFl].rentToAdvance += amt;
            } else {
                if (isSajida) sajidaUnassignedAdv += amt;
                else jeelaniUnassignedAdv += amt;
            }
        });

        // Distribute unassigned Rent-to-Advance outflows proportionally
        allocateUnassigned(sajidaUnassignedAdv, [1, 2], 'rentToAdvance');
        allocateUnassigned(jeelaniUnassignedAdv, [3, 4, 5], 'rentToAdvance');

        // Rent Outflow per floor = Rent to Bank + Rent to Advance
        [1, 2, 3, 4, 5].forEach(fl => {
            floorData[fl].rentOutflow = floorData[fl].rentToBank + floorData[fl].rentToAdvance;
        });

        // 6. Allocate Expenses across floors
        (this.data.expenses || []).forEach(exp => {
            const expMonth = exp.date ? exp.date.slice(0, 7) : (exp.monthKey || '');
            if (this.floorMonthFilter !== 'all' && expMonth !== this.floorMonthFilter) return;

            const totalAmt = parseFloat(exp.amount) || 0;
            const target = exp.targetFloor || 'all';
            const catId = exp.categoryId || 'other';

            const addCatSpend = (fl, amt) => {
                if (!floorData[fl].categories[catId]) floorData[fl].categories[catId] = 0;
                floorData[fl].categories[catId] += amt;
            };

            if (target === '1' || target === '2' || target === '3' || target === '4' || target === '5') {
                const fl = parseInt(target);
                if (floorData[fl]) {
                    floorData[fl].expenses += totalAmt;
                    floorData[fl].directExp += totalAmt;
                    addCatSpend(fl, totalAmt);
                    floorData[fl].items.push({ ...exp, floorShare: totalAmt, scope: 'Direct Floor Expense' });
                }
            } else if (target === 'sajida_floors' || (!exp.targetFloor && exp.splitType === 'sajida_only')) {
                const share = Math.round(totalAmt / 2);
                [1, 2].forEach((fl, idx) => {
                    const cur = (idx === 1) ? (totalAmt - share) : share;
                    floorData[fl].expenses += cur;
                    floorData[fl].sharedExp += cur;
                    addCatSpend(fl, cur);
                    floorData[fl].items.push({ ...exp, floorShare: cur, scope: 'Sajida Floors Share (50%)' });
                });
            } else if (target === 'jeelani_floors' || (!exp.targetFloor && exp.splitType === 'jeelani_only')) {
                const share = Math.round(totalAmt / 3);
                let rem = totalAmt;
                [3, 4, 5].forEach((fl, idx) => {
                    const cur = (idx === 2) ? rem : share;
                    rem -= cur;
                    floorData[fl].expenses += cur;
                    floorData[fl].sharedExp += cur;
                    addCatSpend(fl, cur);
                    floorData[fl].items.push({ ...exp, floorShare: cur, scope: 'Jeelani Floors Share (33.3%)' });
                });
            } else {
                // Common Building Maintenance: 20% per floor across all 5 floors (60:40)
                const share = Math.round(totalAmt * 0.20);
                let rem = totalAmt;
                [1, 2, 3, 4, 5].forEach((fl, idx) => {
                    const cur = (idx === 4) ? rem : share;
                    rem -= cur;
                    floorData[fl].expenses += cur;
                    floorData[fl].sharedExp += cur;
                    addCatSpend(fl, cur);
                    floorData[fl].items.push({ ...exp, floorShare: cur, scope: 'Building Shared (20% Share)' });
                });
            }
        });

        // 7. Update Filter Pill active classes
        document.querySelectorAll('.floor-pill-btn').forEach(btn => {
            const f = btn.getAttribute('data-floor');
            const isActive = (f === this.activeFloorFilter);
            btn.className = `floor-pill-btn px-3 py-1.5 rounded-xl transition font-bold text-xs ${
                isActive ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`;
        });

        // 8. Render 5 KPI Cards (Displaying Advance Payment, Refund Advance, Rent Inflow, Rent Outflow, Rent to Bank, and Expenses)
        let kpiHtml = '';
        [1, 2, 3, 4, 5].forEach(fl => {
            const data = floorData[fl];
            const margin = data.rent - data.expenses;
            const isSelected = (this.activeFloorFilter === String(fl));
            const ownerBadge = data.owner === 'Sajida' 
                ? 'bg-emerald-100 text-emerald-800' 
                : 'bg-sky-100 text-sky-800';

            kpiHtml += `
                <div onclick="App.setFloorFilter('${fl}')" class="cursor-pointer transition-all duration-200 bg-white rounded-2xl p-3.5 border ${
                    isSelected ? 'border-emerald-600 ring-2 ring-emerald-500/30 shadow-md scale-[1.01]' : 'border-slate-200 hover:border-slate-300 shadow-sm'
                } flex flex-col justify-between space-y-2.5">
                    <div>
                        <div class="flex items-center justify-between gap-1 mb-1.5">
                            <span class="font-black text-sm text-slate-900">${data.name}</span>
                            <span class="px-2 py-0.5 rounded text-[10px] font-extrabold ${ownerBadge}">
                                ${data.owner}
                            </span>
                        </div>
                        <div class="text-[10px] text-slate-400 flex items-center justify-between mb-2">
                            <span>20% Building Share</span>
                            <span class="font-bold text-slate-600">${data.activeTenants} Active Lease${data.activeTenants === 1 ? '' : 's'}</span>
                        </div>

                        <!-- 1. Advance Deposits Movement -->
                        <div class="bg-amber-50/70 border border-amber-200/70 rounded-xl p-2 space-y-1 mb-2 text-[11px]">
                            <div class="flex items-center justify-between">
                                <span class="text-amber-800 font-bold">Advance Payment:</span>
                                <strong class="text-amber-950 font-black">+₹${data.advancePayment.toLocaleString('en-IN')}</strong>
                            </div>
                            <div class="flex items-center justify-between text-[10px]">
                                <span class="text-slate-500">Refund Advance:</span>
                                <span class="font-bold ${data.refundAdvance > 0 ? 'text-rose-600' : 'text-slate-400'}">${data.refundAdvance > 0 ? `-₹${data.refundAdvance.toLocaleString('en-IN')}` : '₹0'}</span>
                            </div>
                            <div class="flex items-center justify-between text-[10px] pt-1 border-t border-amber-200/50">
                                <span class="text-slate-500 font-medium">Active Held Deposit:</span>
                                <strong class="text-slate-800 font-bold">₹${data.advanceHeld.toLocaleString('en-IN')}</strong>
                            </div>
                        </div>

                        <!-- 2. Rent & Banking Flow -->
                        <div class="bg-emerald-50/70 border border-emerald-200/70 rounded-xl p-2 space-y-1 mb-2 text-[11px]">
                            <div class="flex items-center justify-between">
                                <span class="text-emerald-800 font-bold">Rent Inflow:</span>
                                <strong class="text-emerald-900 font-black">+₹${data.rent.toLocaleString('en-IN')}</strong>
                            </div>
                            <div class="flex items-center justify-between text-[10px]">
                                <span class="text-slate-500">Rent Outflow:</span>
                                <span class="font-bold ${data.rentOutflow > 0 ? 'text-amber-700' : 'text-slate-400'}">${data.rentOutflow > 0 ? `-₹${data.rentOutflow.toLocaleString('en-IN')}` : '₹0'}</span>
                            </div>
                            <div class="flex items-center justify-between text-[10px] pt-1 border-t border-emerald-200/50">
                                <span class="text-blue-700 font-bold flex items-center gap-1">
                                    <i class="fa-solid fa-building-columns text-[9px]"></i> Rent ➔ Bank Inflow:
                                </span>
                                <strong class="text-blue-900 font-black">₹${data.rentToBank.toLocaleString('en-IN')}</strong>
                            </div>
                        </div>

                        <!-- 3. Expenses Debited -->
                        <div class="bg-slate-50 border border-slate-200 rounded-xl p-2 space-y-1 text-[11px]">
                            <div class="flex items-center justify-between">
                                <span class="text-slate-600 font-bold">Expenses Debited:</span>
                                <strong class="text-slate-900 font-black">₹${data.expenses.toLocaleString('en-IN')}</strong>
                            </div>
                            <div class="flex items-center justify-between text-[10px] text-slate-400">
                                <span>Direct: ₹${data.directExp.toLocaleString('en-IN')}</span>
                                <span>Shared: ₹${data.sharedExp.toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Net Operating Yield -->
                    <div class="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                        <span class="text-slate-500 font-medium">Net Operating Yield:</span>
                        <strong class="font-extrabold text-sm ${margin >= 0 ? 'text-emerald-700' : 'text-rose-600'}">
                            ${margin >= 0 ? '+' : ''}₹${margin.toLocaleString('en-IN')}
                        </strong>
                    </div>
                </div>
            `;
        });
        kpiContainer.innerHTML = kpiHtml;

        // 9. Aggregate for Selected Scope (All or specific floor)
        const activeFloors = (this.activeFloorFilter === 'all') 
            ? [1, 2, 3, 4, 5] 
            : [parseInt(this.activeFloorFilter)];

        let totalSelectedCost = 0;
        let totalSelectedShared = 0;
        let totalSelectedDirect = 0;
        let totalSelectedRent = 0;
        let totalSelectedTenants = 0;
        let totalSelectedAdvPayment = 0;
        let totalSelectedAdvRefund = 0;
        let totalSelectedAdvDeductions = 0;
        let totalSelectedAdvHeld = 0;
        let totalSelectedRentOutflow = 0;
        let totalSelectedRentToBank = 0;
        let totalSelectedRentToAdv = 0;
        const aggregateCategories = {};
        const allItemizedExpenses = [];

        activeFloors.forEach(fl => {
            const fd = floorData[fl];
            totalSelectedCost += fd.expenses;
            totalSelectedShared += fd.sharedExp;
            totalSelectedDirect += fd.directExp;
            totalSelectedRent += fd.rent;
            totalSelectedTenants += fd.activeTenants;
            totalSelectedAdvPayment += fd.advancePayment;
            totalSelectedAdvRefund += fd.refundAdvance;
            totalSelectedAdvDeductions += fd.settleDeductions;
            totalSelectedAdvHeld += fd.advanceHeld;
            totalSelectedRentOutflow += fd.rentOutflow;
            totalSelectedRentToBank += fd.rentToBank;
            totalSelectedRentToAdv += fd.rentToAdvance;

            Object.entries(fd.categories).forEach(([cid, amt]) => {
                aggregateCategories[cid] = (aggregateCategories[cid] || 0) + amt;
            });

            fd.items.forEach(it => {
                allItemizedExpenses.push({ ...it, floorNum: fl, floorName: fd.name, floorOwner: fd.owner });
            });
        });

        const selectedMargin = totalSelectedRent - totalSelectedCost;
        const scopeTitle = (this.activeFloorFilter === 'all') 
            ? 'Entire Building (All 5 Floors Combined)' 
            : `${floorData[parseInt(this.activeFloorFilter)].name} (${floorData[parseInt(this.activeFloorFilter)].owner})`;

        // 10. Render Cost Structure Container (3 Expanded Cards)
        const sharedPct = totalSelectedCost > 0 ? Math.round((totalSelectedShared / totalSelectedCost) * 100) : 0;
        const directPct = totalSelectedCost > 0 ? (100 - sharedPct) : 0;

        let categoryBarsHtml = '';
        const sortedCats = Object.entries(aggregateCategories).sort((a, b) => b[1] - a[1]);
        if (sortedCats.length === 0) {
            categoryBarsHtml = `<p class="text-xs text-slate-400 py-4 text-center">No categorized expenses recorded for this floor in the selected timeframe.</p>`;
        } else {
            sortedCats.slice(0, 5).forEach(([cid, amt]) => {
                const catObj = this.data.categories.find(c => c.id === cid) || { name: cid, icon: 'fa-tag', color: '#64748b' };
                const pct = totalSelectedCost > 0 ? Math.round((amt / totalSelectedCost) * 100) : 0;
                categoryBarsHtml += `
                    <div class="space-y-1">
                        <div class="flex items-center justify-between text-xs">
                            <span class="font-semibold text-slate-700 flex items-center gap-1.5">
                                <i class="fa-solid ${catObj.icon}" style="color: ${catObj.color}"></i>
                                ${catObj.name}
                            </span>
                            <span class="font-bold text-slate-900">₹${amt.toLocaleString('en-IN')} <span class="text-slate-400 text-[10px]">(${pct}%)</span></span>
                        </div>
                        <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div class="h-1.5 rounded-full" style="width: ${pct}%; background-color: ${catObj.color || '#10B981'};"></div>
                        </div>
                    </div>
                `;
            });
        }

        costStructureContainer.innerHTML = `
            <!-- Card 1: Tenant Security Deposits & Advance Capital -->
            <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                    <div class="flex items-center justify-between mb-3">
                        <h4 class="font-extrabold text-sm text-slate-900">Tenant Advance Capital</h4>
                        <span class="text-[11px] font-bold text-slate-500">${scopeTitle}</span>
                    </div>
                    <div class="text-2xl font-black text-amber-900 mb-1">₹${totalSelectedAdvHeld.toLocaleString('en-IN')}</div>
                    <p class="text-xs text-slate-500 mb-3">Net active security deposits held in advance wallets</p>

                    <div class="grid grid-cols-2 gap-2 text-xs mb-3">
                        <div class="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl">
                            <span class="text-[10px] font-bold text-amber-800 uppercase block">Advance Payment</span>
                            <strong class="text-sm font-black text-amber-950">+₹${totalSelectedAdvPayment.toLocaleString('en-IN')}</strong>
                            <span class="text-[10px] text-slate-500 block">Collected from tenants</span>
                        </div>
                        <div class="p-2.5 bg-rose-50/80 border border-rose-200 rounded-xl">
                            <span class="text-[10px] font-bold text-rose-800 uppercase block">Refund Advance</span>
                            <strong class="text-sm font-black text-rose-950">${totalSelectedAdvRefund > 0 ? `-₹${totalSelectedAdvRefund.toLocaleString('en-IN')}` : '₹0'}</strong>
                            <span class="text-[10px] text-slate-500 block">Paid out on vacate</span>
                        </div>
                    </div>

                    <div class="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                        <span class="font-medium text-emerald-800">Settlement Deductions Retained:</span>
                        <strong class="font-extrabold text-emerald-900">+₹${totalSelectedAdvDeductions.toLocaleString('en-IN')}</strong>
                    </div>
                </div>
                <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Advance Security Reserves</span>
                    <span>Held in Advance Wallet</span>
                </div>
            </div>

            <!-- Card 2: Operating Cashflow & Owner Bank Inflow -->
            <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <h4 class="font-extrabold text-sm text-slate-900">Operating Cashflow & Bank Flow</h4>
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">${totalSelectedTenants} Active Lease${totalSelectedTenants === 1 ? '' : 's'}</span>
                    </div>

                    <div class="grid grid-cols-2 gap-2 mb-2">
                        <div class="p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                            <span class="text-[10px] font-bold text-emerald-800 uppercase block">Rent Inflow</span>
                            <strong class="text-base font-black text-emerald-900">+₹${totalSelectedRent.toLocaleString('en-IN')}</strong>
                        </div>
                        <div class="p-2.5 bg-rose-50 border border-rose-100 rounded-xl">
                            <span class="text-[10px] font-bold text-rose-800 uppercase block">Total Debited</span>
                            <strong class="text-base font-black text-rose-900">₹${totalSelectedCost.toLocaleString('en-IN')}</strong>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-2 mb-2">
                        <div class="p-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                            <span class="text-[10px] font-bold text-amber-800 uppercase block">Rent Outflow</span>
                            <strong class="text-sm font-black text-amber-900">${totalSelectedRentOutflow > 0 ? `-₹${totalSelectedRentOutflow.toLocaleString('en-IN')}` : '₹0'}</strong>
                        </div>
                        <div class="p-2.5 bg-blue-50 border border-blue-100 rounded-xl">
                            <span class="text-[10px] font-bold text-blue-800 uppercase block flex items-center gap-1">
                                <i class="fa-solid fa-building-columns text-[9px]"></i> Rent ➔ Bank
                            </span>
                            <strong class="text-sm font-black text-blue-900">₹${totalSelectedRentToBank.toLocaleString('en-IN')}</strong>
                        </div>
                    </div>

                    <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <div class="text-[10px] font-bold text-slate-500 uppercase">Net Operating Surplus</div>
                        <div class="text-lg font-black ${selectedMargin >= 0 ? 'text-emerald-700' : 'text-rose-600'}">
                            ${selectedMargin >= 0 ? '+' : ''}₹${selectedMargin.toLocaleString('en-IN')}
                        </div>
                        <span class="text-[10px] text-slate-500">${selectedMargin >= 0 ? 'Surplus retained after maintenance costs' : 'Operating deficit on this floor scope'}</span>
                    </div>
                </div>
                <div class="mt-3 pt-2.5 border-t border-slate-100 text-right">
                    <button onclick="ExcelExporter.exportFloorExpensesToExcel(App.activeFloorFilter)" class="text-xs font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1">
                        <i class="fa-solid fa-file-excel"></i> Export Detailed Report
                    </button>
                </div>
            </div>

            <!-- Card 3: Cost Structure & Maintenance Categories -->
            <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                    <h4 class="font-extrabold text-sm text-slate-900 mb-1">Expense Structure & Categories</h4>
                    <p class="text-xs text-slate-500 mb-2">Direct floor vs 20% shared maintenance breakdown</p>

                    <div class="space-y-2 mb-3 bg-slate-50 p-2.5 rounded-xl text-xs">
                        <div>
                            <div class="flex items-center justify-between mb-0.5">
                                <span class="font-medium text-slate-600">Common Building (20% share):</span>
                                <strong class="text-slate-900">₹${totalSelectedShared.toLocaleString('en-IN')} (${sharedPct}%)</strong>
                            </div>
                            <div class="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                <div class="bg-blue-600 h-1.5 rounded-full" style="width: ${sharedPct}%"></div>
                            </div>
                        </div>
                        <div>
                            <div class="flex items-center justify-between mb-0.5">
                                <span class="font-medium text-slate-600">Direct Floor Specific:</span>
                                <strong class="text-slate-900">₹${totalSelectedDirect.toLocaleString('en-IN')} (${directPct}%)</strong>
                            </div>
                            <div class="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                <div class="bg-emerald-600 h-1.5 rounded-full" style="width: ${directPct}%"></div>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-2">
                        ${categoryBarsHtml}
                    </div>
                </div>
                <div class="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span>${sortedCats.length} Categories active</span>
                    <span>100% Granular</span>
                </div>
            </div>
        `;

        // 10. Filter Itemized Table by Search Query
        let tableList = [...allItemizedExpenses];
        if (this.floorSearchQuery) {
            const q = this.floorSearchQuery;
            tableList = tableList.filter(item => 
                (item.title && item.title.toLowerCase().includes(q)) ||
                (item.notes && item.notes.toLowerCase().includes(q)) ||
                (item.scope && item.scope.toLowerCase().includes(q)) ||
                (item.floorName && item.floorName.toLowerCase().includes(q))
            );
        }

        tableList = this.sortRecords(tableList, this.sortState.floor, 'title');
        const floorSort = document.getElementById('floor-sort');
        if (floorSort) floorSort.value = this.sortState.floor;

        // 11. Render Granular Table
        let ledgerHtml = `
            <div class="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                    <h4 class="font-extrabold text-sm text-slate-900">Itemized Floor Expenses (${tableList.length} records)</h4>
                    <p class="text-xs text-slate-500">Every individual building maintenance expense and this floor's mathematically calculated share</p>
                </div>
                <div class="flex items-center gap-2">
                    <span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">Scope: ${scopeTitle}</span>
                </div>
            </div>

            <!-- 1. Desktop Table View (visible on md and above) -->
            <div class="hidden md:block overflow-x-auto">
                <table class="w-full text-left text-xs text-slate-600">
                    <thead class="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200">
                        <tr>
                            <th class="px-4 py-3">Date</th>
                            <th class="px-4 py-3">Floor</th>
                            <th class="px-4 py-3">Expense Details</th>
                            <th class="px-4 py-3">Category</th>
                            <th class="px-4 py-3">Building Total</th>
                            <th class="px-4 py-3">Floor Allocation Scope</th>
                            <th class="px-4 py-3 text-emerald-800">This Floor's Share</th>
                            <th class="px-4 py-3">Debited Wallet</th>
                            <th class="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 font-medium">
        `;

        let mobileHtml = `<div class="md:hidden p-3 space-y-3">`;

        if (tableList.length === 0) {
            ledgerHtml += `
                <tr>
                    <td colspan="9" class="text-center py-12 text-slate-400">
                        <i class="fa-solid fa-layer-group text-3xl mb-2 text-slate-300 block"></i>
                        No expense records found for this floor filter.
                    </td>
                </tr>
            `;
            mobileHtml += `
                <div class="text-center py-8 text-slate-400 text-xs">
                    <i class="fa-solid fa-layer-group text-2xl mb-2 text-slate-300 block"></i>
                    No expense records found for this floor filter.
                </div>
            `;
        } else {
            tableList.forEach(item => {
                const cat = this.data.categories.find(c => c.id === item.categoryId) || { name: 'Expense', icon: 'fa-tag', color: '#64748b' };
                const ownerBadge = item.floorOwner === 'Sajida' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800';
                
                let walletBadge = 'Split 60:40';
                if (item.debitedWallet === 'sajida') walletBadge = 'Sajida (100%)';
                else if (item.debitedWallet === 'jeelani') walletBadge = 'Jeelani (100%)';
                else if (item.paidBy) walletBadge = item.paidBy;

                // Desktop Row
                ledgerHtml += `
                    <tr class="hover:bg-slate-50/80 transition">
                        <td class="px-4 py-3 whitespace-nowrap font-semibold text-slate-800">${item.date || 'N/A'}</td>
                        <td class="px-4 py-3 whitespace-nowrap">
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${ownerBadge}">
                                ${item.floorName} (${item.floorOwner})
                            </span>
                        </td>
                        <td class="px-4 py-3">
                            <strong class="text-slate-900 block font-bold">${item.title}</strong>
                            ${item.notes ? `<span class="text-[11px] text-slate-400 truncate max-w-xs block">${item.notes}</span>` : ''}
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap">
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                <i class="fa-solid ${cat.icon}" style="color: ${cat.color}"></i>
                                ${cat.name}
                            </span>
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap font-extrabold text-slate-700">
                            ₹${parseFloat(item.amount).toLocaleString('en-IN')}
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap">
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                ${item.scope || '20% Share'}
                            </span>
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap font-black text-emerald-700 text-sm">
                            ₹${parseFloat(item.floorShare || 0).toLocaleString('en-IN')}
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap text-[11px] text-slate-500">
                            ${walletBadge}
                        </td>
                        <td class="px-4 py-3 text-right whitespace-nowrap">
                            <button onclick="App.openExpenseModal('${item.id}')" class="p-1.5 text-slate-400 hover:text-emerald-600 transition" title="Edit Expense">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                        </td>
                    </tr>
                `;

                // Mobile Card
                mobileHtml += `
                    <div class="bg-slate-50/70 rounded-2xl p-3.5 border border-slate-200 space-y-2.5">
                        <div class="flex items-center justify-between gap-2">
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${ownerBadge}">
                                    ${item.floorName}
                                </span>
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-white text-slate-700 border border-slate-200">
                                    <i class="fa-solid ${cat.icon}" style="color: ${cat.color}"></i>
                                    ${cat.name}
                                </span>
                            </div>
                            <div class="text-right">
                                <span class="text-xs font-black text-emerald-700">Share: ₹${parseFloat(item.floorShare || 0).toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                        <div>
                            <h5 class="text-xs font-bold text-slate-900">${item.title}</h5>
                            ${item.notes ? `<p class="text-[11px] text-slate-500 mt-0.5">${item.notes}</p>` : ''}
                        </div>
                        <div class="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                            <div>
                                <span>Total: <strong>₹${parseFloat(item.amount).toLocaleString('en-IN')}</strong></span>
                                <span class="text-slate-400 ml-1">(${item.scope || '20% Share'})</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="text-[10px] font-semibold text-slate-600">${walletBadge}</span>
                                <button onclick="App.openExpenseModal('${item.id}')" class="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-emerald-600 flex items-center justify-center text-xs transition" title="Edit Expense">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        ledgerHtml += `
                    </tbody>
                </table>
            </div>
        `;
        mobileHtml += `</div>`;

        ledgerContainer.innerHTML = ledgerHtml + mobileHtml;
    },

    // -------------------------------------------------------------
    // TENANTS DIRECTORY WITH FLOOR & OWNER BADGES
    // -------------------------------------------------------------
    renderTenants() {
        const container = document.getElementById('tenants-grid-container');
        if (!container) return;

        let list = [...this.data.tenants];
        if (this.tenantSearchQuery.trim()) {
            const q = this.tenantSearchQuery.toLowerCase();
            list = list.filter(t => 
                (t.name && t.name.toLowerCase().includes(q)) ||
                (t.flat && t.flat.toLowerCase().includes(q)) ||
                (t.phone && t.phone.includes(q)) ||
                (t.occupation && t.occupation.toLowerCase().includes(q))
            );
        }

        const currentMonth = this.getCurrentMonthKey();

        if (list.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8">
                    <i class="fa-solid fa-users text-4xl text-slate-400 mb-3"></i>
                    <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200">No Tenants Found</h3>
                    <p class="text-sm text-slate-500 mt-1">Add your tenants to track floor ownership, advance deposits, rent dues, and contact info.</p>
                    <button onclick="App.openTenantModal()" class="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition">
                        <i class="fa-solid fa-user-plus mr-1"></i> Add Tenant
                    </button>
                </div>
            `;
            return;
        }

        let html = '';
        list.forEach(tenant => {
            const floor = parseInt(tenant.floor) || this.detectFloorFromFlat(tenant.flat);
            const ownerInfo = this.getFloorOwner(floor);

            const isVacated = tenant.status === 'vacated';
            const depositPaid = parseFloat(tenant.advanceDeposit) || 0;
            const depositRefunded = parseFloat(tenant.advanceRefunded) || 0;
            const depositDeductions = parseFloat(tenant.advanceDeductions) || 0;
            const activeHeld = Math.max(0, depositPaid - depositRefunded - depositDeductions);

            const billingMonths = this.getTenantBillingMonths(tenant);
            const unpaidMonths = billingMonths.filter(b => !b.isPaid);
            const paidThisMonth = this.data.rentCollections.some(r => r.tenantId === tenant.id && r.month === currentMonth);
            const isPaidUp = !isVacated && unpaidMonths.length === 0;
            const isOnlyCurrentDue = !isVacated && unpaidMonths.length === 1 && unpaidMonths[0].month === currentMonth;

            let dueStatusBadge = '';
            if (isVacated) {
                dueStatusBadge = `<span class="text-xs text-slate-400 font-semibold">Settled</span>`;
            } else if (isPaidUp) {
                dueStatusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    <i class="fa-solid fa-check-circle"></i> Paid Up
                </span>`;
            } else if (isOnlyCurrentDue) {
                dueStatusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                    <i class="fa-regular fa-clock"></i> Current Due
                </span>`;
            } else {
                dueStatusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                    <i class="fa-solid fa-circle-exclamation"></i> ${unpaidMonths.length} Mos Due
                </span>`;
            }

            const duesListText = unpaidMonths.map(u => u.label).join(', ') || 'this month';
            const waReceiptMsg = encodeURIComponent(
                `Hello ${tenant.name},\nThank you for paying the rent of ₹${tenant.monthlyRent} for ${tenant.flat} (${floor} Floor, Meera Heights).\nAdvance Deposit on record: ₹${activeHeld}.\nWarm regards,\nManagement, Meera Heights.`
            );
            const waReminderMsg = encodeURIComponent(
                `Hello ${tenant.name},\nThis is a gentle reminder that your rent of ₹${tenant.monthlyRent} for ${tenant.flat} (${floor} Floor, Meera Heights) is due for: ${duesListText}.\nPlease transfer to ${ownerInfo.name}'s account.\nThank you,\nManagement, Meera Heights.`
            );

            html += `
                <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition relative flex flex-col justify-between ${isVacated ? 'opacity-75 bg-slate-50/60' : ''}">
                    <div>
                        <!-- Header & Floor Owner Badge -->
                        <div class="flex items-start justify-between gap-2">
                            <div>
                                <div class="flex items-center gap-1.5 flex-wrap mb-1">
                                    <span class="inline-block px-2 py-0.5 bg-slate-900 text-white rounded text-[11px] font-bold uppercase tracking-wider">
                                        ${tenant.flat}
                                    </span>
                                    <span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold ${floor <= 2 ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}">
                                        Floor ${floor} • ${ownerInfo.name}
                                    </span>
                                    ${isVacated ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Vacated</span>` : ''}
                                </div>
                                <h4 class="text-base font-bold text-slate-900 dark:text-white">${tenant.name}</h4>
                                <div class="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                    <i class="fa-solid fa-briefcase text-slate-400"></i>
                                    <span>${tenant.occupation || 'Resident'}</span>
                                </div>
                            </div>
                            <div>
                                ${dueStatusBadge}
                            </div>
                        </div>

                        <!-- Financial Figures -->
                        <div class="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 text-xs">
                            <div class="bg-slate-50 dark:bg-slate-700/40 p-2 rounded-xl">
                                <span class="text-slate-400 block text-[10px] uppercase font-semibold">Monthly Rent</span>
                                <span class="font-bold text-slate-900 dark:text-white text-sm">₹${parseFloat(tenant.monthlyRent).toLocaleString('en-IN')}</span>
                            </div>
                            <div class="bg-slate-50 dark:bg-slate-700/40 p-2 rounded-xl">
                                <span class="text-slate-400 block text-[10px] uppercase font-semibold">Security Advance</span>
                                <span class="font-bold text-emerald-600 text-sm">₹${activeHeld.toLocaleString('en-IN')}</span>
                                ${depositRefunded > 0 || depositDeductions > 0 ? `
                                    <div class="text-[9px] text-slate-400 mt-0.5">Orig: ₹${depositPaid} (Ref: ₹${depositRefunded})</div>
                                ` : ''}
                            </div>
                        </div>

                        <div class="mt-3 flex items-center justify-between text-xs text-slate-500">
                            <div class="flex items-center gap-1.5">
                                <i class="fa-solid fa-phone text-slate-400"></i>
                                <a href="tel:${tenant.phone}" class="hover:underline text-slate-700 dark:text-slate-300 font-medium">${tenant.phone}</a>
                            </div>
                        </div>
                        <div class="mt-1 text-[10px] text-slate-400">
                            Move-in: ${tenant.moveInDate || 'N/A'}
                        </div>
                        ${unpaidMonths.length > 1 ? `
                            <div class="mt-2 text-[10px] font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100">
                                Dues: ${unpaidMonths.map(u => u.label).join(', ')}
                            </div>
                        ` : ''}
                    </div>

                    <!-- Action Buttons -->
                    <div class="mt-5 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-1.5 flex-wrap">
                        ${!isVacated ? `
                            <button onclick="App.openRentCollectionForTenant('${tenant.id}')" class="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-sm">
                                <i class="fa-solid fa-hand-holding-dollar"></i> Collect Rent
                            </button>
                        ` : ''}

                        <!-- Refund / Settle Advance Button -->
                        <button onclick="App.openSettleAdvanceModal('${tenant.id}')" class="px-2.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition flex items-center gap-1" title="Refund or Settle Advance">
                            <i class="fa-solid fa-handshake"></i>
                            <span>${isVacated ? 'Advance View' : 'Refund Advance'}</span>
                        </button>
                        
                        <a href="https://wa.me/91${tenant.phone}?text=${paidThisMonth ? waReceiptMsg : waReminderMsg}" target="_blank" 
                           class="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl text-xs font-semibold transition flex items-center justify-center" 
                           title="${paidThisMonth ? 'Send WhatsApp Receipt' : 'Send WhatsApp Reminder'}">
                            <i class="fa-brands fa-whatsapp text-base"></i>
                        </a>

                        <button onclick="App.editTenant('${tenant.id}')" class="p-2 text-slate-400 hover:text-slate-600 transition" title="Edit Tenant">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button onclick="App.deleteTenant('${tenant.id}')" class="p-2 text-slate-400 hover:text-red-500 transition" title="Delete Tenant">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    // -------------------------------------------------------------
    // RENT COLLECTION LEDGER
    // -------------------------------------------------------------
    renderRentLedger() {
        const container = document.getElementById('rent-ledger-container');
        if (!container) return;

        let list = [...this.data.rentCollections];
        if (this.selectedMonthFilter !== 'all') {
            list = list.filter(r => r.month === this.selectedMonthFilter);
        }

        list = this.sortRecords(list, this.sortState.rent, 'tenantName');

        if (list.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-slate-400 text-sm">
                    No rent collection entries recorded yet.
                </div>
            `;
            return;
        }

        // 1. Desktop Table View (visible on md and above)
        let desktopHtml = `
            <div class="hidden md:block overflow-x-auto rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
                <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                    <thead class="bg-slate-50 dark:bg-slate-700/60 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            <th class="px-4 py-3">Date</th>
                            <th class="px-4 py-3">Tenant & Flat</th>
                            <th class="px-4 py-3">Floor</th>
                            <th class="px-4 py-3">Month</th>
                            <th class="px-4 py-3">Amount Paid</th>
                            <th class="px-4 py-3">Owner Credited</th>
                            <th class="px-4 py-3">Mode</th>
                            <th class="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
        `;

        // 2. Mobile Cards View (visible on screens < md)
        let mobileHtml = `<div class="md:hidden space-y-3">`;

        list.forEach(rent => {
            const floor = rent.floor || this.detectFloorFromFlat(rent.flat);
            const ownerInfo = this.getFloorOwner(floor);

            let ownerBadge = '';
            if (rent.ownerCredited === 'sajida') {
                ownerBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Sajida (Fl 1-2)</span>`;
            } else if (rent.ownerCredited === 'jeelani') {
                ownerBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Jeelani (Fl 3-5)</span>`;
            } else {
                ownerBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">50:50 Shared</span>`;
            }

            let destBadge = '';
            if (rent.creditDestination === 'bank') {
                destBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200 mt-1 block w-max"><i class="fa-solid fa-building-columns"></i> ${rent.bankName || 'Bank'}</span>`;
            } else {
                destBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-1 block w-max"><i class="fa-solid fa-wallet"></i> Cash Wallet</span>`;
            }

            // Desktop Row
            desktopHtml += `
                <tr class="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition">
                    <td class="px-4 py-3 text-xs text-slate-500 font-medium">${rent.paymentDate}</td>
                    <td class="px-4 py-3">
                        <div class="font-semibold text-slate-900 dark:text-white">${rent.tenantName}</div>
                        <div class="text-xs text-slate-400 font-mono">${rent.flat}</div>
                    </td>
                    <td class="px-4 py-3 text-xs font-semibold text-slate-600">${floor} Floor</td>
                    <td class="px-4 py-3 text-xs font-semibold text-slate-700 dark:text-slate-300">${rent.month}</td>
                    <td class="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">₹${parseFloat(rent.amount).toLocaleString('en-IN')}</td>
                    <td class="px-4 py-3">${ownerBadge}${destBadge}</td>
                    <td class="px-4 py-3 text-xs text-slate-500">${rent.paymentMode || 'Cash'}</td>
                    <td class="px-4 py-3 text-right whitespace-nowrap">
                        <button onclick="App.showRentReceipt('${rent.id}')" class="p-1.5 text-slate-500 hover:text-emerald-600 transition" title="View / Print Receipt">
                            <i class="fa-solid fa-receipt"></i>
                        </button>
                        <button onclick="App.openEditRentModal('${rent.id}')" class="p-1.5 text-slate-500 hover:text-blue-600 transition ml-1" title="Edit Rent Entry">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button onclick="App.deleteRentCollection('${rent.id}')" class="p-1.5 text-slate-500 hover:text-red-500 transition ml-1" title="Delete Entry">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;

            // Mobile Card
            mobileHtml += `
                <div class="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <div class="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs shrink-0">
                                ${rent.flat}
                            </div>
                            <div class="min-w-0">
                                <h4 class="text-sm font-extrabold text-slate-900 truncate">${rent.tenantName}</h4>
                                <span class="text-[10px] text-slate-400 font-medium">${floor} Floor • ${rent.month}</span>
                            </div>
                        </div>
                        <div class="text-right shrink-0">
                            <div class="text-base font-black text-emerald-600">₹${parseFloat(rent.amount).toLocaleString('en-IN')}</div>
                            <span class="text-[10px] text-slate-400">${rent.paymentDate}</span>
                        </div>
                    </div>
                    <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            ${ownerBadge}
                            ${destBadge}
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                            <button onclick="App.showRentReceipt('${rent.id}')" class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center justify-center text-xs transition" title="Receipt">
                                <i class="fa-solid fa-receipt"></i>
                            </button>
                            <button onclick="App.openEditRentModal('${rent.id}')" class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs transition" title="Edit">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button onclick="App.deleteRentCollection('${rent.id}')" class="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center text-xs transition" title="Delete">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        desktopHtml += `
                    </tbody>
                </table>
            </div>
        `;
        mobileHtml += `</div>`;

        container.innerHTML = desktopHtml + mobileHtml;
    },

    // -------------------------------------------------------------
    // WALLET & CAPITAL BALANCE BREAKDOWN WITH HISTORY & DETAILS
    // -------------------------------------------------------------
    renderWalletPage(stats) {
        // Sajida (Floors 1 & 2)
        this.setElementText('wallet-sajida-balance', `₹${stats.sajidaBalance.toLocaleString('en-IN')}`);
        this.setElementText('wallet-sajida-free-cap', `₹${stats.sajidaFreeCapital.toLocaleString('en-IN')}`);
        this.setElementText('wallet-sajida-cap', `₹${stats.sajidaCapital.toLocaleString('en-IN')}`);
        this.setElementText('wallet-sajida-adv-collected', `+₹${stats.sajidaAdvancesCollected.toLocaleString('en-IN')}`);
        this.setElementText('wallet-sajida-rent', `+₹${stats.sajidaRentTotal.toLocaleString('en-IN')}`);
        this.setElementText('wallet-sajida-exp', `-₹${stats.sajidaExpTotal.toLocaleString('en-IN')}`);
        this.setElementText('wallet-sajida-refund', `-₹${stats.sajidaRefunds.toLocaleString('en-IN')}`);
        this.setElementText('wallet-sajida-bank-outflow', `-₹${stats.sajidaBankOutflow.toLocaleString('en-IN')}`);
        this.setElementText('wallet-sajida-bank-inflow', `+₹${stats.sajidaBankInflow.toLocaleString('en-IN')}`);
        this.setElementText('wallet-sajida-adv', `₹${stats.sajidaAdvancesHeld.toLocaleString('en-IN')}`);
        this.setElementText('wallet-sajida-deductions', `₹${stats.sajidaDeductions.toLocaleString('en-IN')}`);

        // Jeelani (Floors 3, 4 & 5)
        this.setElementText('wallet-jeelani-balance', `₹${stats.jeelaniBalance.toLocaleString('en-IN')}`);
        this.setElementText('wallet-jeelani-free-cap', `₹${stats.jeelaniFreeCapital.toLocaleString('en-IN')}`);
        this.setElementText('wallet-jeelani-cap', `₹${stats.jeelaniCapital.toLocaleString('en-IN')}`);
        this.setElementText('wallet-jeelani-adv-collected', `+₹${stats.jeelaniAdvancesCollected.toLocaleString('en-IN')}`);
        this.setElementText('wallet-jeelani-rent', `+₹${stats.jeelaniRentTotal.toLocaleString('en-IN')}`);
        this.setElementText('wallet-jeelani-exp', `-₹${stats.jeelaniExpTotal.toLocaleString('en-IN')}`);
        this.setElementText('wallet-jeelani-refund', `-₹${stats.jeelaniRefunds.toLocaleString('en-IN')}`);
        this.setElementText('wallet-jeelani-bank-outflow', `-₹${stats.jeelaniBankOutflow.toLocaleString('en-IN')}`);
        this.setElementText('wallet-jeelani-bank-inflow', `+₹${stats.jeelaniBankInflow.toLocaleString('en-IN')}`);
        this.setElementText('wallet-jeelani-adv', `₹${stats.jeelaniAdvancesHeld.toLocaleString('en-IN')}`);
        this.setElementText('wallet-jeelani-deductions', `₹${stats.jeelaniDeductions.toLocaleString('en-IN')}`);

        // 4 Wallets Breakdown in Wallets page
        this.setElementText('wallet-page-sajida-adv', `₹${stats.sajidaAdvanceBalance.toLocaleString('en-IN')}`);
        this.setElementText('wallet-page-sajida-adv-sub', `Held: ₹${stats.sajidaAdvancesHeld.toLocaleString('en-IN')} • Retained: ₹${stats.sajidaDeductions.toLocaleString('en-IN')}`);
        this.setElementText('wallet-page-sajida-rent', `₹${stats.sajidaRentBalance.toLocaleString('en-IN')}`);
        this.setElementText('wallet-page-jeelani-adv', `₹${stats.jeelaniAdvanceBalance.toLocaleString('en-IN')}`);
        this.setElementText('wallet-page-jeelani-adv-sub', `Held: ₹${stats.jeelaniAdvancesHeld.toLocaleString('en-IN')} • Retained: ₹${stats.jeelaniDeductions.toLocaleString('en-IN')}`);
        this.setElementText('wallet-page-jeelani-rent', `₹${stats.jeelaniRentBalance.toLocaleString('en-IN')}`);

        // Settlement box
        this.setElementText('wallet-settlement-title', stats.settlementText);
        this.setElementText('wallet-settlement-desc', stats.settlementNote);

        // Render the active sub-tab inside Wallets
        this.renderWalletSubTabContent();
    },

    setWalletSubTab(tab) {
        this.walletSubTab = tab;
        document.querySelectorAll('.wallet-tab-btn').forEach(btn => {
            const isTarget = btn.getAttribute('data-wtab') === tab;
            btn.classList.toggle('bg-slate-900', isTarget);
            btn.classList.toggle('text-white', isTarget);
            btn.classList.toggle('bg-slate-100', !isTarget);
            btn.classList.toggle('text-slate-700', !isTarget);
        });
        this.renderWalletSubTabContent();
    },

    setWalletOwnerFilter(ownerId) {
        this.walletOwnerFilter = ownerId;
        document.querySelectorAll('.wallet-owner-filter-btn').forEach(btn => {
            const isTarget = btn.getAttribute('data-owner') === ownerId;
            btn.classList.toggle('bg-emerald-600', isTarget);
            btn.classList.toggle('text-white', isTarget);
            btn.classList.toggle('bg-white', !isTarget);
            btn.classList.toggle('text-slate-600', !isTarget);
        });
        this.renderWalletSubTabContent();
    },

    renderWalletSubTabContent() {
        const container = document.getElementById('wallet-subtab-container');
        if (!container) return;

        if (this.walletSubTab === 'bank') {
            this.renderWalletBankBreakup(container);
        } else if (this.walletSubTab === 'transfers') {
            this.renderWalletTransferBreakup(container);
        } else if (this.walletSubTab === 'advances') {
            this.renderTenantAdvancesBreakup(container);
        } else if (this.walletSubTab === 'rents') {
            this.renderWalletRentBreakup(container);
        } else if (this.walletSubTab === 'expenses') {
            this.renderWalletExpenseBreakup(container);
        } else if (this.walletSubTab === 'capital') {
            this.renderWalletCapitalBreakup(container);
        } else {
            // 'all' comprehensive timeline with Edit/Delete
            this.renderWalletUnifiedTimeline(container);
        }
    },

    // --- Unified Wallet Transactions Stream Generator ---
    getWalletTransactionsStream(options = {}) {
        const stream = [];

        // 1. Rents
        (this.data.rentCollections || []).forEach(r => {
            const floor = r.floor || this.detectFloorFromFlat(r.flat);
            const targetWallet = r.ownerCredited === 'sajida' ? 'sajida_rent' : 'jeelani_rent';
            stream.push({
                id: r.id,
                type: 'rent',
                walletId: targetWallet,
                title: `Rent: ${r.tenantName} (${r.flat} - ${floor} Floor)`,
                amount: parseFloat(r.amount) || 0,
                date: r.paymentDate,
                category: 'Rent Collection',
                ownerCredited: r.ownerCredited,
                ownerDisplay: r.ownerCredited === 'sajida' ? 'Sajida Rent' : (r.ownerCredited === 'jeelani' ? 'Jeelani Rent' : '50:50 Split')
            });
        });

        // 2. Expenses
        (this.data.expenses || []).forEach(e => {
            const cat = this.data.categories.find(c => c.id === e.categoryId);
            const targetWallet = e.debitedWallet === 'sajida' ? 'sajida_advance' : (e.debitedWallet === 'jeelani' ? 'jeelani_advance' : 'both');
            stream.push({
                id: e.id,
                type: 'expense',
                walletId: targetWallet,
                title: `Expense: ${e.title}`,
                amount: parseFloat(e.amount) || 0,
                date: e.date,
                category: cat ? cat.name : 'Maintenance',
                debitedWallet: e.debitedWallet,
                sajidaShare: e.sajidaAmount,
                jeelaniShare: e.jeelaniAmount,
                ownerDisplay: e.debitedWallet === 'sajida' ? 'Sajida Advance' : (e.debitedWallet === 'jeelani' ? 'Jeelani Advance' : `Shared (S: ₹${e.sajidaAmount} | J: ₹${e.jeelaniAmount})`)
            });
        });

        // 3. Capital Adjustments
        (this.data.walletAdjustments || []).forEach(adj => {
            const isDeposit = adj.type === 'deposit';
            const targetWallet = adj.walletId || (adj.ownerId === 'sajida' ? 'sajida_advance' : 'jeelani_advance');
            const wInfo = this.getWalletInfo(targetWallet);
            stream.push({
                id: adj.id,
                type: 'capital',
                walletId: targetWallet,
                title: `Capital ${isDeposit ? 'Deposit' : 'Withdrawal'}: ${adj.notes || 'Owner corpus'}`,
                amount: parseFloat(adj.amount) || 0,
                date: adj.date,
                category: isDeposit ? 'Capital Inflow' : 'Capital Payout',
                isDeposit,
                ownerCredited: adj.ownerId,
                ownerDisplay: wInfo ? wInfo.shortName : (adj.ownerId === 'sajida' ? 'Sajida' : 'Jeelani')
            });
        });

        // 4. Advance Deposits Received
        (this.data.tenants || []).forEach(t => {
            const deposit = parseFloat(t.advanceDeposit) || 0;
            if (deposit > 0) {
                const floor = parseInt(t.floor) || this.detectFloorFromFlat(t.flat);
                const ownerInfo = this.getFloorOwner(floor);
                const targetWallet = (ownerInfo.id === 'sajida' ? 'sajida_advance' : 'jeelani_advance');
                stream.push({
                    id: 'adv_' + t.id,
                    type: 'advance_received',
                    tenantId: t.id,
                    walletId: targetWallet,
                    title: `Advance Deposit: ${t.name} (${t.flat} - ${floor} Floor)`,
                    amount: deposit,
                    date: t.advancePaidDate || t.moveInDate || '2026-09-01',
                    category: 'Advance Deposit Received',
                    ownerCredited: ownerInfo.id,
                    ownerDisplay: `${ownerInfo.name} Advance (${ownerInfo.floors})`,
                    isInflow: true
                });
            }
        });

        // 5. Advance Settlements (Refunds Paid & Deductions Retained)
        (this.data.advanceSettlements || []).forEach(settle => {
            const targetWallet = settle.walletId || (settle.refundOwner === 'sajida' ? 'sajida_advance' : 'jeelani_advance');
            const ownerName = (settle.refundOwner === 'sajida' || targetWallet === 'sajida_advance') ? 'Sajida' : 'Jeelani';
            const ownerFloors = (settle.refundOwner === 'sajida' || targetWallet === 'sajida_advance') ? 'Fl 1-2' : 'Fl 3-5';
            const deductions = parseFloat(settle.totalDeductions) || 0;
            const refund = parseFloat(settle.refundAmount) || 0;

            const isDeductOnly = (refund === 0);
            const title = isDeductOnly 
                ? `Advance Settlement (Deduct Only): ${settle.tenantName} (${settle.flat})`
                : `Advance Settlement & Refund: ${settle.tenantName} (${settle.flat})`;

            stream.push({
                id: settle.id,
                type: 'advance_settlement',
                tenantId: settle.tenantId,
                walletId: targetWallet,
                title,
                amount: refund,
                date: settle.settlementDate,
                category: isDeductOnly ? 'Advance Settlement (Deductions)' : 'Advance Refund Paid',
                ownerCredited: settle.refundOwner,
                ownerDisplay: `${ownerName} Advance (${ownerFloors})`,
                deductions,
                isDeductOnly,
                paintingDeduction: settle.paintingDeduction,
                cleaningDeduction: settle.cleaningDeduction,
                utilityDeduction: settle.utilityDeduction,
                damageDeduction: settle.damageDeduction,
                otherDeduction: settle.otherDeduction,
                transferMode: settle.refundPaymentMode,
                notes: settle.notes,
                isVacated: settle.isVacated
            });
        });

        // 6. Wallet ⇄ Bank Transactions
        (this.data.bankTransactions || []).forEach(tx => {
            const isWalletToBank = (tx.type === 'wallet_to_bank');
            const targetWallet = tx.walletId || (tx.ownerId === 'sajida' ? 'sajida_rent' : 'jeelani_rent');
            const wInfo = this.getWalletInfo(targetWallet);

            stream.push({
                id: tx.id,
                type: 'bank_transfer',
                bankTxType: tx.type,
                walletId: targetWallet,
                title: isWalletToBank 
                    ? `Wallet ➔ Bank: ${tx.bankName || 'Bank Account'}${tx.notes ? ` (${tx.notes})` : ''}`
                    : `Bank ➔ Wallet: Deposit from ${tx.bankName || 'Bank Account'}${tx.notes ? ` (${tx.notes})` : ''}`,
                amount: parseFloat(tx.amount) || 0,
                date: tx.date,
                category: isWalletToBank ? 'Wallet ➔ Bank' : 'Bank ➔ Wallet',
                isCredit: !isWalletToBank,
                ownerCredited: tx.ownerId,
                ownerDisplay: wInfo ? wInfo.shortName : (tx.ownerId === 'sajida' ? 'Sajida' : 'Jeelani'),
                reference: tx.reference,
                transferMode: tx.transferMode
            });
        });

        // 7. Advance ⇄ Rent Internal Wallet Transfers
        (this.data.walletTransfers || []).forEach(wt => {
            const fromInfo = this.getWalletInfo(wt.fromWallet);
            const toInfo = this.getWalletInfo(wt.toWallet);
            stream.push({
                id: wt.id,
                type: 'wallet_transfer',
                title: `Wallet Transfer: ${fromInfo ? fromInfo.shortName : wt.fromWallet} ➔ ${toInfo ? toInfo.shortName : wt.toWallet}`,
                amount: parseFloat(wt.amount) || 0,
                date: wt.date,
                category: 'Advance ⇄ Rent Transfer',
                ownerCredited: fromInfo ? fromInfo.ownerId : null,
                fromWallet: wt.fromWallet,
                toWallet: wt.toWallet,
                ownerDisplay: `${fromInfo ? fromInfo.shortName : wt.fromWallet} ➔ ${toInfo ? toInfo.shortName : wt.toWallet}`,
                notes: wt.reason ? `${wt.reason}${wt.notes ? ` • ${wt.notes}` : ''}` : wt.notes
            });
        });

        // Filter by Transaction Type (subTab or options.type)
        let filtered = stream;
        const txType = options.type || options.subTab;
        if (txType && txType !== 'all') {
            if (txType === 'bank') {
                filtered = filtered.filter(item => item.type === 'bank_transfer');
            } else if (txType === 'transfers') {
                filtered = filtered.filter(item => item.type === 'wallet_transfer');
            } else if (txType === 'advances') {
                filtered = filtered.filter(item => item.type === 'advance_received' || item.type === 'advance_settlement');
            } else if (txType === 'rents') {
                filtered = filtered.filter(item => item.type === 'rent');
            } else if (txType === 'expenses') {
                filtered = filtered.filter(item => item.type === 'expense');
            } else if (txType === 'capital') {
                filtered = filtered.filter(item => item.type === 'capital');
            }
        }

        // Filter by Scope / Owner
        const scope = options.walletScope || options.ownerFilter;
        if (scope === 'sajida' || scope === 'owner_sajida') {
            filtered = filtered.filter(item => 
                item.ownerCredited === 'sajida' || 
                item.debitedWallet === 'sajida' || 
                item.debitedWallet === 'both' ||
                (item.walletId && item.walletId.startsWith('sajida')) ||
                (item.fromWallet && item.fromWallet.startsWith('sajida')) ||
                (item.toWallet && item.toWallet.startsWith('sajida'))
            );
        } else if (scope === 'jeelani' || scope === 'owner_jeelani') {
            filtered = filtered.filter(item => 
                item.ownerCredited === 'jeelani' || 
                item.debitedWallet === 'jeelani' || 
                item.debitedWallet === 'both' ||
                (item.walletId && item.walletId.startsWith('jeelani')) ||
                (item.fromWallet && item.fromWallet.startsWith('jeelani')) ||
                (item.toWallet && item.toWallet.startsWith('jeelani'))
            );
        } else if (scope && scope !== 'all') {
            filtered = filtered.filter(item => 
                item.fromWallet === scope ||
                item.toWallet === scope ||
                item.walletId === scope ||
                (item.walletId === 'both' && (scope === 'sajida_advance' || scope === 'jeelani_advance'))
            );
        }

        // Filter by Dynamic Period
        const period = options.period || 'all';
        if (period === 'weekly') {
            const now = new Date();
            const past7 = new Date();
            past7.setDate(now.getDate() - 7);
            const past7Str = past7.toISOString().slice(0, 10);
            filtered = filtered.filter(t => (t.date || '') >= past7Str);
        } else if (period === 'monthly') {
            const m = options.month || (this.selectedMonthFilter && this.selectedMonthFilter !== 'all' ? this.selectedMonthFilter : this.getCurrentMonthKey());
            if (m && m !== 'all') {
                filtered = filtered.filter(t => (t.date || '').startsWith(m));
            }
        } else if (period === 'yearly') {
            const yr = options.year || new Date().getFullYear().toString();
            filtered = filtered.filter(t => (t.date || '').startsWith(yr));
        } else if (period === 'custom') {
            if (options.startDate) {
                filtered = filtered.filter(t => (t.date || '') >= options.startDate);
            }
            if (options.endDate) {
                filtered = filtered.filter(t => (t.date || '') <= options.endDate);
            }
        }

        const sortKey = options.sortKey || (this.sortState ? this.sortState.wallet : 'date-desc');
        return this.sortRecords(filtered, sortKey, 'title');
    },

    // --- Sub-Tab 1: Unified Wallet History with EDIT & DELETE on EVERY transaction ---
    renderWalletUnifiedTimeline(container) {
        const filtered = this.getWalletTransactionsStream({
            ownerFilter: this.walletOwnerFilter,
            sortKey: this.sortState.wallet
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="text-center py-10 text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
                    <i class="fa-solid fa-receipt text-3xl mb-2 text-slate-300"></i>
                    <p>No wallet transactions found for this filter.</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="space-y-3">
                <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Transaction History (${filtered.length} entries)</span>
                    <span class="text-[11px] text-emerald-600 font-semibold"><i class="fa-solid fa-pen-to-square"></i> Tap Edit or Delete on any entry below</span>
                </div>
        `;

        filtered.forEach(item => {
            const isTransfer = (item.type === 'wallet_transfer');
            const isSettlement = (item.type === 'advance_settlement' || item.type === 'advance_refund');
            const isCredit = !isTransfer && !isSettlement && (item.type === 'rent' || (item.type === 'capital' && item.isDeposit) || item.type === 'advance_received' || (item.type === 'bank_transfer' && item.isCredit));
            
            let icon = isCredit ? 'fa-arrow-down' : 'fa-arrow-up';
            let colorClass = isCredit ? 'text-emerald-600 bg-emerald-100' : 'text-rose-600 bg-rose-100';
            let amtClass = isCredit ? 'text-emerald-600' : 'text-rose-600';
            let amtPrefix = isCredit ? '+' : '-';
            let catBadge = 'bg-slate-100 text-slate-700';

            if (isTransfer) {
                icon = 'fa-arrow-right-arrow-left';
                colorClass = 'text-purple-600 bg-purple-100';
                amtClass = 'text-purple-700';
                amtPrefix = '⇄';
                catBadge = 'bg-purple-100 text-purple-800';
            } else if (item.type === 'bank_transfer') {
                icon = 'fa-building-columns';
                catBadge = item.isCredit ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800';
            } else if (isSettlement) {
                icon = 'fa-handshake';
                if (item.isDeductOnly || item.amount === 0) {
                    colorClass = 'text-amber-700 bg-amber-100';
                    amtClass = 'text-amber-800';
                    amtPrefix = '';
                    catBadge = 'bg-amber-100 text-amber-800';
                } else {
                    colorClass = 'text-rose-600 bg-rose-100';
                    amtClass = 'text-rose-600';
                    amtPrefix = '-';
                    catBadge = 'bg-amber-100 text-amber-800';
                }
            }

            html += `
                <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm gap-2 hover:border-emerald-200 transition">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colorClass}">
                            <i class="fa-solid ${icon}"></i>
                        </div>
                        <div>
                            <h5 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                                <span>${item.title}</span>
                                ${isSettlement && item.isVacated ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Vacated</span>' : ''}
                            </h5>
                            <div class="text-xs text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                                <span><i class="fa-regular fa-calendar"></i> ${item.date}</span>
                                <span>•</span>
                                <span class="px-2 py-0.5 rounded ${catBadge} text-[10px] font-bold">${item.category}</span>
                                <span>•</span>
                                <span class="font-medium text-slate-600 dark:text-slate-300">${item.ownerDisplay}</span>
                                ${isSettlement && item.deductions > 0 ? `<span>•</span><span class="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">Retained Deductions: +₹${item.deductions.toLocaleString('en-IN')}</span>` : ''}
                                ${item.transferMode ? `<span>•</span><span class="text-[10px] text-slate-500 font-medium">${item.transferMode}</span>` : ''}
                                ${item.notes ? `<span>•</span><span class="text-[10px] text-slate-500 italic">"${item.notes}"</span>` : ''}
                                ${item.reference ? `<span>•</span><span class="text-[10px] font-mono text-slate-500">Ref: ${item.reference}</span>` : ''}
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
                        <div class="text-right">
                            ${isSettlement && (item.isDeductOnly || item.amount === 0) ? `
                                <div class="text-sm font-black text-amber-800">₹0 Refund</div>
                                <div class="text-[11px] font-bold text-emerald-700">+₹${(item.deductions || 0).toLocaleString('en-IN')} Deducted</div>
                            ` : isSettlement ? `
                                <div class="text-base font-black text-rose-600">
                                    -₹${parseFloat(item.amount).toLocaleString('en-IN')}
                                </div>
                                <div class="text-[10px] text-slate-400 font-semibold">Refund Paid Out</div>
                                ${item.deductions > 0 ? `<div class="text-[10px] font-bold text-emerald-700">+₹${item.deductions.toLocaleString('en-IN')} Retained</div>` : ''}
                            ` : `
                                <div class="text-base font-black ${amtClass}">
                                    ${amtPrefix}₹${parseFloat(item.amount).toLocaleString('en-IN')}
                                </div>
                            `}
                        </div>

                        <!-- EDIT & DELETE BUTTONS FOR EVERY TRANSACTION -->
                        <div class="flex items-center gap-1">
                            <button onclick="App.editWalletTransaction('${item.type}', '${item.id}')" class="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition text-xs font-bold flex items-center gap-1" title="Edit this transaction">
                                <i class="fa-solid fa-pen"></i>
                                <span class="hidden sm:inline">Edit</span>
                            </button>
                            <button onclick="App.deleteWalletTransaction('${item.type}', '${item.id}')" class="p-2 text-slate-400 hover:text-red-600 hover:bg-rose-50 rounded-xl transition text-xs" title="Delete this transaction">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    // --- Sub-Tab: Advance ⇄ Rent Transfers Breakup ---
    renderWalletTransferBreakup(container) {
        let html = '<div class="space-y-4">';

        let list = this.sortRecords([...(this.data.walletTransfers || [])], this.sortState.wallet, 'reason');

        if (this.walletOwnerFilter === 'sajida') {
            list = list.filter(t => t.fromWallet.startsWith('sajida') || t.toWallet.startsWith('sajida'));
        } else if (this.walletOwnerFilter === 'jeelani') {
            list = list.filter(t => t.fromWallet.startsWith('jeelani') || t.toWallet.startsWith('jeelani'));
        } else if (this.walletOwnerFilter !== 'all') {
            list = list.filter(t => t.fromWallet === this.walletOwnerFilter || t.toWallet === this.walletOwnerFilter);
        }

        const sajidaAdvToRent = (this.data.walletTransfers || [])
            .filter(t => t.fromWallet === 'sajida_advance' && t.toWallet === 'sajida_rent')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        const sajidaRentToAdv = (this.data.walletTransfers || [])
            .filter(t => t.fromWallet === 'sajida_rent' && t.toWallet === 'sajida_advance')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        const jeelaniAdvToRent = (this.data.walletTransfers || [])
            .filter(t => t.fromWallet === 'jeelani_advance' && t.toWallet === 'jeelani_rent')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        const jeelaniRentToAdv = (this.data.walletTransfers || [])
            .filter(t => t.fromWallet === 'jeelani_rent' && t.toWallet === 'jeelani_advance')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        html += `
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="bg-emerald-50/70 border border-emerald-200 p-3 rounded-2xl">
                    <span class="block text-[10px] uppercase font-bold text-emerald-800">Sajida: Adv ➔ Rent</span>
                    <strong class="text-sm sm:text-base font-extrabold text-emerald-900">₹${sajidaAdvToRent.toLocaleString('en-IN')}</strong>
                </div>
                <div class="bg-teal-50/70 border border-teal-200 p-3 rounded-2xl">
                    <span class="block text-[10px] uppercase font-bold text-teal-800">Sajida: Rent ➔ Adv</span>
                    <strong class="text-sm sm:text-base font-extrabold text-teal-900">₹${sajidaRentToAdv.toLocaleString('en-IN')}</strong>
                </div>
                <div class="bg-blue-50/70 border border-blue-200 p-3 rounded-2xl">
                    <span class="block text-[10px] uppercase font-bold text-blue-800">Jeelani: Adv ➔ Rent</span>
                    <strong class="text-sm sm:text-base font-extrabold text-blue-900">₹${jeelaniAdvToRent.toLocaleString('en-IN')}</strong>
                </div>
                <div class="bg-indigo-50/70 border border-indigo-200 p-3 rounded-2xl">
                    <span class="block text-[10px] uppercase font-bold text-indigo-800">Jeelani: Rent ➔ Adv</span>
                    <strong class="text-sm sm:text-base font-extrabold text-indigo-900">₹${jeelaniRentToAdv.toLocaleString('en-IN')}</strong>
                </div>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div>
                    <h4 class="font-bold text-slate-900 text-sm">Advance ⇄ Rent Transfer Ledger</h4>
                    <p class="text-xs text-slate-500">History of transfers between tenant advance deposits and rent collections</p>
                </div>
                <button onclick="App.openWalletTransferModal()" class="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-purple-600/20 self-start sm:self-auto">
                    <i class="fa-solid fa-arrow-right-arrow-left"></i>
                    <span>+ New Wallet Transfer</span>
                </button>
            </div>
        `;

        if (list.length === 0) {
            html += `
                <div class="text-center py-10 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <div class="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mx-auto mb-2 text-lg">
                        <i class="fa-solid fa-arrow-right-arrow-left"></i>
                    </div>
                    <h5 class="font-bold text-slate-700 text-sm">No Internal Wallet Transfers Yet</h5>
                    <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Transfer surplus advances to rental income or replenish advance wallets for maintenance with 1-click presets.</p>
                    <button onclick="App.openWalletTransferModal()" class="mt-3 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition">
                        Create First Transfer
                    </button>
                </div>
            `;
        } else {
            html += `
                <div class="overflow-x-auto border border-slate-200 rounded-2xl bg-white">
                    <table class="w-full text-left text-xs">
                        <thead class="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                            <tr>
                                <th class="px-4 py-3">Date</th>
                                <th class="px-4 py-3">Source (Debit -)</th>
                                <th class="px-4 py-3 text-center"></th>
                                <th class="px-4 py-3">Destination (Credit +)</th>
                                <th class="px-4 py-3">Purpose / Notes</th>
                                <th class="px-4 py-3 text-right">Amount</th>
                                <th class="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
            `;

            list.forEach(tx => {
                const fromInfo = this.getWalletInfo(tx.fromWallet);
                const toInfo = this.getWalletInfo(tx.toWallet);

                html += `
                    <tr class="hover:bg-slate-50/80 transition">
                        <td class="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">${tx.date}</td>
                        <td class="px-4 py-3">
                            <span class="px-2 py-0.5 rounded text-[11px] font-bold ${fromInfo.badgeBg || 'bg-slate-100 text-slate-800'}">
                                ${fromInfo.name}
                            </span>
                        </td>
                        <td class="px-2 py-3 text-center text-purple-500">
                            <i class="fa-solid fa-arrow-right text-xs"></i>
                        </td>
                        <td class="px-4 py-3">
                            <span class="px-2 py-0.5 rounded text-[11px] font-bold ${toInfo.badgeBg || 'bg-slate-100 text-slate-800'}">
                                ${toInfo.name}
                            </span>
                        </td>
                        <td class="px-4 py-3 text-slate-600">
                            <strong class="block text-slate-800 text-xs">${tx.reason || 'Internal Transfer'}</strong>
                            ${tx.notes ? `<span class="text-[11px] text-slate-400">${tx.notes}</span>` : ''}
                        </td>
                        <td class="px-4 py-3 text-right font-extrabold text-purple-700 text-sm whitespace-nowrap">
                            ₹${parseFloat(tx.amount).toLocaleString('en-IN')}
                        </td>
                        <td class="px-4 py-3 text-right whitespace-nowrap">
                            <div class="flex items-center justify-end gap-1">
                                <button onclick="App.editWalletTransfer('${tx.id}')" class="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition text-xs font-bold" title="Edit Transfer">
                                    <i class="fa-solid fa-pen"></i>
                                </button>
                                <button onclick="App.deleteWalletTransfer('${tx.id}')" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-rose-50 rounded-lg transition text-xs" title="Delete Transfer">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;
        }

        html += '</div>';
        container.innerHTML = html;
    },

    // --- Sub-Tab 2: Tenant Advances / Security Deposits Breakup ---
    renderTenantAdvancesBreakup(container) {
        const stats = this.getStats();

        let html = `
            <div class="space-y-4">
                <!-- Advance Summary Cards -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div class="bg-white p-4 rounded-2xl border border-slate-200">
                        <span class="block text-[10px] uppercase font-bold text-slate-400">Total Active Advances Held</span>
                        <div class="text-2xl font-black text-slate-900 mt-1">₹${stats.totalDeposits.toLocaleString('en-IN')}</div>
                        <span class="text-xs text-slate-500">Security deposits across all active residents</span>
                    </div>
                    <div class="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200">
                        <span class="block text-[10px] uppercase font-bold text-emerald-800">Sajida's Held Advances (Floors 1-2)</span>
                        <div class="text-2xl font-black text-emerald-900 mt-1">₹${stats.sajidaAdvancesHeld.toLocaleString('en-IN')}</div>
                        <span class="text-xs text-emerald-700">Held in trust for 1st & 2nd floors</span>
                    </div>
                    <div class="bg-blue-50/70 p-4 rounded-2xl border border-blue-200">
                        <span class="block text-[10px] uppercase font-bold text-blue-800">Jeelani's Held Advances (Floors 3-5)</span>
                        <div class="text-2xl font-black text-blue-900 mt-1">₹${stats.jeelaniAdvancesHeld.toLocaleString('en-IN')}</div>
                        <span class="text-xs text-blue-700">Held in trust for 3rd, 4th & 5th floors</span>
                    </div>
                </div>

                <!-- Advances Table -->
                <div class="overflow-x-auto rounded-2xl bg-white shadow-sm border border-slate-200">
                    <table class="w-full text-left text-sm text-slate-600">
                        <thead class="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                            <tr>
                                <th class="px-4 py-3">Tenant & Unit</th>
                                <th class="px-4 py-3">Floor</th>
                                <th class="px-4 py-3">Floor Owner</th>
                                <th class="px-4 py-3">Advance Paid</th>
                                <th class="px-4 py-3">Active Held</th>
                                <th class="px-4 py-3">Deductions</th>
                                <th class="px-4 py-3">Refunded</th>
                                <th class="px-4 py-3">Status</th>
                                <th class="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
        `;

        let list = [...this.data.tenants];
        if (this.walletOwnerFilter === 'sajida' || this.walletOwnerFilter === 'sajida_advance') {
            list = list.filter(t => {
                const fl = parseInt(t.floor) || this.detectFloorFromFlat(t.flat);
                return fl === 1 || fl === 2;
            });
        } else if (this.walletOwnerFilter === 'jeelani' || this.walletOwnerFilter === 'jeelani_advance') {
            list = list.filter(t => {
                const fl = parseInt(t.floor) || this.detectFloorFromFlat(t.flat);
                return fl >= 3;
            });
        }

        if (list.length === 0) {
            html += `<tr><td colspan="9" class="text-center py-8 text-slate-400">No tenant advance deposits recorded for this filter. Add tenants to start tracking deposits.</td></tr>`;
        } else {
            list.forEach(t => {
                const floor = parseInt(t.floor) || this.detectFloorFromFlat(t.flat);
                const ownerInfo = this.getFloorOwner(floor);

                const deposit = parseFloat(t.advanceDeposit) || 0;
                const refunded = parseFloat(t.advanceRefunded) || 0;
                const deductions = parseFloat(t.advanceDeductions) || 0;
                const activeHeld = Math.max(0, deposit - refunded - deductions);

                const isVacated = t.status === 'vacated';

                html += `
                    <tr class="hover:bg-slate-50/80 transition">
                        <td class="px-4 py-3">
                            <strong class="text-slate-900 block">${t.name}</strong>
                            <span class="text-xs text-slate-400 font-mono">${t.flat}</span>
                        </td>
                        <td class="px-4 py-3 text-xs font-semibold">${floor} Floor</td>
                        <td class="px-4 py-3">
                            <span class="px-2 py-0.5 rounded text-xs font-bold ${floor <= 2 ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}">
                                ${ownerInfo.name}
                            </span>
                        </td>
                        <td class="px-4 py-3 font-semibold text-slate-800">₹${deposit.toLocaleString('en-IN')}</td>
                        <td class="px-4 py-3 font-bold text-emerald-600">₹${activeHeld.toLocaleString('en-IN')}</td>
                        <td class="px-4 py-3 text-rose-600 font-semibold">₹${deductions.toLocaleString('en-IN')}</td>
                        <td class="px-4 py-3 text-blue-600 font-semibold">₹${refunded.toLocaleString('en-IN')}</td>
                        <td class="px-4 py-3">
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${isVacated ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-800'}">
                                ${isVacated ? 'Vacated' : 'Active Resident'}
                            </span>
                        </td>
                        <td class="px-4 py-3 text-right whitespace-nowrap">
                            <div class="flex items-center justify-end gap-1.5">
                                <button onclick="App.openSettleAdvanceModal('${t.id}')" class="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition flex items-center gap-1" title="${isVacated ? 'View settlement terms' : 'Refund advance or apply deductions'}">
                                    <i class="fa-solid fa-handshake"></i>
                                    <span class="hidden sm:inline">${isVacated ? 'Details' : 'Refund'}</span>
                                </button>
                                <button onclick="App.openEditAdvanceModal('${t.id}')" class="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition text-xs font-bold flex items-center gap-1" title="Edit advance breakup amounts and status">
                                    <i class="fa-solid fa-pen"></i>
                                    <span class="hidden sm:inline">Edit</span>
                                </button>
                                <button onclick="App.deleteAdvanceBreakup('${t.id}')" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-rose-50 rounded-lg transition text-xs" title="Delete advance record">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }

        html += `
                        </tbody>
                    </table>
                </div>

                <!-- Advance Settlements & Deductions History Section -->
                <div class="mt-6 space-y-3">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <h4 class="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                                <i class="fa-solid fa-handshake text-amber-600"></i>
                                <span>Advance Settlements & Deductions Log</span>
                            </h4>
                            <p class="text-xs text-slate-500">Security deposits settled, deductions retained by owner, and refunds paid</p>
                        </div>
                    </div>
        `;

        let settlements = [...(this.data.advanceSettlements || [])];
        if (this.walletOwnerFilter === 'sajida' || this.walletOwnerFilter === 'sajida_advance') {
            settlements = settlements.filter(s => s.refundOwner === 'sajida' || (s.walletId && s.walletId.startsWith('sajida')) || s.floor <= 2);
        } else if (this.walletOwnerFilter === 'jeelani' || this.walletOwnerFilter === 'jeelani_advance') {
            settlements = settlements.filter(s => s.refundOwner === 'jeelani' || (s.walletId && s.walletId.startsWith('jeelani')) || s.floor >= 3);
        }
        settlements.sort((a, b) => new Date(b.settlementDate) - new Date(a.settlementDate));

        if (settlements.length === 0) {
            html += `
                <div class="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-slate-200">
                    <i class="fa-solid fa-handshake text-2xl mb-1 text-slate-300"></i>
                    <p>No advance settlements recorded yet for this filter. Use the "Refund / Settle Advance" button above to record deductions or refunds.</p>
                </div>
            `;
        } else {
            html += `
                <div class="overflow-x-auto rounded-2xl bg-white shadow-sm border border-slate-200">
                    <table class="w-full text-left text-sm text-slate-600">
                        <thead class="bg-amber-50/70 text-xs uppercase font-semibold text-amber-900 border-b border-amber-200/80">
                            <tr>
                                <th class="px-4 py-3">Date</th>
                                <th class="px-4 py-3">Tenant & Unit</th>
                                <th class="px-4 py-3">Advance Wallet</th>
                                <th class="px-4 py-3">Deductions Breakdown</th>
                                <th class="px-4 py-3">Retained Deductions</th>
                                <th class="px-4 py-3">Refund Paid Out</th>
                                <th class="px-4 py-3">Mode</th>
                                <th class="px-4 py-3">Status</th>
                                <th class="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
            `;

            settlements.forEach(s => {
                const isSajida = (s.refundOwner === 'sajida' || (s.walletId && s.walletId.startsWith('sajida')) || s.floor <= 2);
                const walletBadge = isSajida
                    ? '<span class="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">Sajida Advance (Fl 1-2)</span>'
                    : '<span class="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800">Jeelani Advance (Fl 3-5)</span>';

                const deductParts = [];
                if (s.paintingDeduction > 0) deductParts.push(`Painting: ₹${s.paintingDeduction.toLocaleString('en-IN')}`);
                if (s.cleaningDeduction > 0) deductParts.push(`Cleaning: ₹${s.cleaningDeduction.toLocaleString('en-IN')}`);
                if (s.utilityDeduction > 0) deductParts.push(`Utility: ₹${s.utilityDeduction.toLocaleString('en-IN')}`);
                if (s.damageDeduction > 0) deductParts.push(`Repairs: ₹${s.damageDeduction.toLocaleString('en-IN')}`);
                if (s.otherDeduction > 0) deductParts.push(`Other: ₹${s.otherDeduction.toLocaleString('en-IN')}`);
                const deductText = deductParts.length > 0 ? deductParts.join(', ') : 'None';

                html += `
                    <tr class="hover:bg-slate-50/80 transition text-xs">
                        <td class="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">${s.settlementDate || '-'}</td>
                        <td class="px-4 py-3">
                            <strong class="text-slate-900 block">${s.tenantName}</strong>
                            <span class="text-[11px] text-slate-400 font-mono">${s.flat} (${s.floor} Fl)</span>
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap">${walletBadge}</td>
                        <td class="px-4 py-3 text-slate-600 max-w-xs">
                            <span class="text-[11px]">${deductText}</span>
                            ${s.notes ? `<span class="block text-[10px] text-slate-400 italic mt-0.5">"${s.notes}"</span>` : ''}
                        </td>
                        <td class="px-4 py-3 font-bold text-emerald-700 whitespace-nowrap">+₹${(s.totalDeductions || 0).toLocaleString('en-IN')}</td>
                        <td class="px-4 py-3 font-extrabold ${s.refundAmount > 0 ? 'text-rose-600' : 'text-slate-500'} whitespace-nowrap">
                            ${s.refundAmount > 0 ? `-₹${s.refundAmount.toLocaleString('en-IN')}` : '₹0 (Deduct only)'}
                        </td>
                        <td class="px-4 py-3 text-slate-500 whitespace-nowrap">${s.refundPaymentMode || 'N/A'}</td>
                        <td class="px-4 py-3 whitespace-nowrap">
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${s.isVacated ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-800'}">
                                ${s.isVacated ? 'Vacated' : 'Continuing'}
                            </span>
                        </td>
                        <td class="px-4 py-3 text-right whitespace-nowrap">
                            <div class="flex items-center justify-end gap-1">
                                <button onclick="App.openSettleAdvanceModal('${s.tenantId}', '${s.id}')" class="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition text-xs font-bold flex items-center gap-1" title="Edit this advance settlement">
                                    <i class="fa-solid fa-pen"></i>
                                    <span class="hidden sm:inline">Edit</span>
                                </button>
                                <button onclick="App.deleteWalletTransaction('advance_settlement', '${s.id}')" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-rose-50 rounded-lg transition text-xs" title="Delete this settlement record">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;
        }

        html += `
                </div>
            </div>
        `;

        container.innerHTML = html;
    },

    openEditAdvanceModal(tenantId) {
        this.editingAdvanceTenantId = tenantId;
        const tenant = (this.data.tenants || []).find(t => t.id === tenantId);
        if (!tenant) return;

        const floor = parseInt(tenant.floor) || this.detectFloorFromFlat(tenant.flat);
        const ownerInfo = this.getFloorOwner(floor);

        this.setElementText('edit-adv-tenant-name', tenant.name || 'Tenant');
        this.setElementText('edit-adv-tenant-flat', `(${tenant.flat || 'Unit'})`);
        this.onEditAdvFloorChanged(floor);

        const nameInput = document.getElementById('edit-adv-name');
        if (nameInput) nameInput.value = tenant.name || '';

        const flatInput = document.getElementById('edit-adv-flat');
        if (flatInput) flatInput.value = tenant.flat || '';

        const floorSelect = document.getElementById('edit-adv-floor');
        if (floorSelect) floorSelect.value = String(floor);

        const depositInput = document.getElementById('edit-adv-deposit');
        if (depositInput) depositInput.value = tenant.advanceDeposit || 0;

        const deductionsInput = document.getElementById('edit-adv-deductions');
        if (deductionsInput) deductionsInput.value = tenant.advanceDeductions || 0;

        const refundedInput = document.getElementById('edit-adv-refunded');
        if (refundedInput) refundedInput.value = tenant.advanceRefunded || 0;

        const statusSelect = document.getElementById('edit-adv-status');
        if (statusSelect) statusSelect.value = tenant.status || 'active';

        const notesInput = document.getElementById('edit-adv-notes');
        if (notesInput) notesInput.value = tenant.notes || '';

        this.updateEditAdvanceHeldPreview();
        this.showModal('modal-edit-advance');
    },

    onEditAdvFloorChanged(floorVal) {
        const floor = parseInt(floorVal) || 1;
        const ownerInfo = this.getFloorOwner(floor);
        const badge = document.getElementById('edit-adv-owner-badge');
        if (badge) {
            badge.textContent = `${ownerInfo.name} (${ownerInfo.floors})`;
            badge.className = `px-2 py-0.5 rounded text-xs font-bold ${floor <= 2 ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`;
        }
    },

    updateEditAdvanceHeldPreview() {
        const deposit = parseFloat(document.getElementById('edit-adv-deposit')?.value) || 0;
        const deductions = parseFloat(document.getElementById('edit-adv-deductions')?.value) || 0;
        const refunded = parseFloat(document.getElementById('edit-adv-refunded')?.value) || 0;
        const held = Math.max(0, deposit - deductions - refunded);

        const previewEl = document.getElementById('edit-adv-held-preview');
        if (previewEl) {
            previewEl.textContent = `₹${held.toLocaleString('en-IN')}`;
        }

        const bannerEl = document.getElementById('edit-adv-held-status-banner');
        if (bannerEl) {
            if (held === 0) {
                bannerEl.className = 'p-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs flex items-center gap-2';
                bannerEl.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-600"></i><span>All advance fully settled (₹0 held in liabilities).</span>';
            } else {
                bannerEl.className = 'p-2.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs flex items-center gap-2';
                bannerEl.innerHTML = `<i class="fa-solid fa-shield-halved text-amber-600"></i><span>Active Liability: <strong>₹${held.toLocaleString('en-IN')}</strong> will remain held in owner\'s wallet.</span>`;
            }
        }
    },

    saveEditAdvance(e) {
        if (e && e.preventDefault) e.preventDefault();

        const tenant = (this.data.tenants || []).find(t => t.id === this.editingAdvanceTenantId);
        if (!tenant) return;

        const name = document.getElementById('edit-adv-name')?.value.trim();
        const flat = document.getElementById('edit-adv-flat')?.value.trim();
        const floor = parseInt(document.getElementById('edit-adv-floor')?.value) || 1;
        const deposit = parseFloat(document.getElementById('edit-adv-deposit')?.value) || 0;
        const deductions = parseFloat(document.getElementById('edit-adv-deductions')?.value) || 0;
        const refunded = parseFloat(document.getElementById('edit-adv-refunded')?.value) || 0;
        const status = document.getElementById('edit-adv-status')?.value || 'active';
        const notes = document.getElementById('edit-adv-notes')?.value.trim() || '';

        if (!name || !flat) {
            alert('Please enter tenant name and flat number.');
            return;
        }

        tenant.name = name;
        tenant.flat = flat;
        tenant.floor = floor;
        const ownerInfo = this.getFloorOwner(floor);
        tenant.ownerId = ownerInfo.id;
        tenant.advanceDeposit = deposit;
        tenant.advanceDeductions = deductions;
        tenant.advanceRefunded = refunded;
        tenant.status = status;
        tenant.notes = notes;

        const activeHeld = Math.max(0, deposit - deductions - refunded);

        StorageManager.saveData(this.data);
        ActivityLogger.log('tenant', `Advance Breakup Updated: ${tenant.name}`, `Deposit: ₹${deposit.toLocaleString('en-IN')}, Held: ₹${activeHeld.toLocaleString('en-IN')} (Flat ${tenant.flat})`);
        this.hideModal('modal-edit-advance');
        this.renderAll();
        this.showToast(`Advance breakup for "${tenant.name}" updated! Active held: ₹${activeHeld.toLocaleString('en-IN')}`);
    },

    deleteAdvanceBreakup(tenantId) {
        const tenant = (this.data.tenants || []).find(t => t.id === tenantId);
        if (!tenant) return;

        const deposit = parseFloat(tenant.advanceDeposit) || 0;
        const refunded = parseFloat(tenant.advanceRefunded) || 0;
        const deductions = parseFloat(tenant.advanceDeductions) || 0;
        const activeHeld = Math.max(0, deposit - refunded - deductions);

        const msg = `Are you sure you want to delete the advance record for "${tenant.name}" (${tenant.flat})?\n\n` +
            `• Advance Deposit: ₹${deposit.toLocaleString('en-IN')}\n` +
            `• Deductions: ₹${deductions.toLocaleString('en-IN')}\n` +
            `• Refunded: ₹${refunded.toLocaleString('en-IN')}\n` +
            `• Active Held Liability: ₹${activeHeld.toLocaleString('en-IN')}\n\n` +
            `Press OK to confirm deletion.`;

        if (!confirm(msg)) return;

        const hasRentHistory = (this.data.rentCollections || []).some(r => r.tenantId === tenantId);

        if (tenant.status === 'vacated' && !hasRentHistory) {
            this.data.tenants = this.data.tenants.filter(t => t.id !== tenantId);
        } else {
            const deleteProfileToo = confirm(
                `Do you also want to remove "${tenant.name}" completely from the tenant list?\n\n` +
                `• Press OK to completely remove the tenant record.\n` +
                `• Press Cancel to keep the tenant profile, but reset advance deposit & held liabilities to ₹0.`
            );
            if (deleteProfileToo) {
                this.data.tenants = this.data.tenants.filter(t => t.id !== tenantId);
            } else {
                tenant.advanceDeposit = 0;
                tenant.advanceRefunded = 0;
                tenant.advanceDeductions = 0;
            }
        }

        // Clean up related settlements
        this.data.advanceSettlements = (this.data.advanceSettlements || []).filter(s => s.tenantId !== tenantId);

        StorageManager.saveData(this.data);
        ActivityLogger.log('tenant', `Advance Record Deleted: ${tenant.name}`, `Flat ${tenant.flat} • Deposit: ₹${deposit.toLocaleString('en-IN')}`);
        this.hideModal('modal-edit-advance');
        this.renderAll();
        this.showToast(`Advance record for "${tenant.name}" deleted.`);
    },

    // --- Sub-Tab 3: Rent Collections Breakup ---
    renderWalletRentBreakup(container) {
        let html = '<div class="space-y-3">';
        const list = [...this.data.rentCollections].sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

        if (list.length === 0) {
            container.innerHTML = `<p class="text-sm text-slate-400 text-center py-6">No rent collections recorded yet.</p>`;
            return;
        }

        list.forEach(r => {
            const floor = r.floor || this.detectFloorFromFlat(r.flat);
            const ownerInfo = this.getFloorOwner(floor);

            html += `
                <div class="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-200">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                            <i class="fa-solid fa-hand-holding-dollar"></i>
                        </div>
                        <div>
                            <div class="font-bold text-sm text-slate-900">${r.tenantName} (${r.flat} - ${floor} Floor)</div>
                            <div class="text-xs text-slate-400">${r.paymentDate} • For ${r.month} • Credited: ${r.ownerCredited}</div>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="font-bold text-emerald-600 text-base">+₹${parseFloat(r.amount).toLocaleString('en-IN')}</span>
                        <button onclick="App.openEditRentModal('${r.id}')" class="p-1.5 text-slate-400 hover:text-blue-600" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="App.deleteRentCollection('${r.id}')" class="p-1.5 text-slate-400 hover:text-red-600" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    // --- Sub-Tab 4: Expenses Debited Breakup ---
    renderWalletExpenseBreakup(container) {
        let html = '<div class="space-y-3">';
        const list = [...this.data.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

        if (list.length === 0) {
            container.innerHTML = `<p class="text-sm text-slate-400 text-center py-6">No expenses debited yet.</p>`;
            return;
        }

        list.forEach(e => {
            html += `
                <div class="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-200">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                            <i class="fa-solid fa-receipt"></i>
                        </div>
                        <div>
                            <div class="font-bold text-sm text-slate-900">${e.title}</div>
                            <div class="text-xs text-slate-400">${e.date} • Sajida: ₹${e.sajidaAmount} | Jeelani: ₹${e.jeelaniAmount}</div>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="font-bold text-rose-600 text-base">-₹${parseFloat(e.amount).toLocaleString('en-IN')}</span>
                        <button onclick="App.editExpense('${e.id}')" class="p-1.5 text-slate-400 hover:text-blue-600" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="App.deleteExpense('${e.id}')" class="p-1.5 text-slate-400 hover:text-red-600" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    // --- Sub-Tab: Wallet ⇄ Bank Transfers Breakup ---
    renderWalletBankBreakup(container) {
        let list = [...(this.data.bankTransactions || [])];

        if (this.walletOwnerFilter === 'sajida') {
            list = list.filter(t => t.ownerId === 'sajida');
        } else if (this.walletOwnerFilter === 'jeelani') {
            list = list.filter(t => t.ownerId === 'jeelani');
        }

        list.sort((a, b) => new Date(b.date) - new Date(a.date));

        const filteredOutflow = list.filter(t => t.type === 'wallet_to_bank').reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
        const filteredInflow = list.filter(t => t.type === 'bank_to_wallet').reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
        const netFlow = filteredInflow - filteredOutflow;

        let html = `
            <div class="space-y-4">
                <!-- Bank Flow Metrics Cards -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div class="bg-rose-50/70 p-4 rounded-2xl border border-rose-200">
                        <div class="flex items-center justify-between">
                            <span class="block text-[10px] uppercase font-bold text-rose-800">Total Transferred to Bank</span>
                            <i class="fa-solid fa-arrow-up-right-from-square text-rose-500"></i>
                        </div>
                        <div class="text-2xl font-black text-rose-900 mt-1">-₹${filteredOutflow.toLocaleString('en-IN')}</div>
                        <span class="text-xs text-rose-700">Withdrawals from liquid wallet to bank</span>
                    </div>
                    <div class="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200">
                        <div class="flex items-center justify-between">
                            <span class="block text-[10px] uppercase font-bold text-emerald-800">Total Deposited from Bank</span>
                            <i class="fa-solid fa-arrow-down-left-and-up-right-to-center text-emerald-500"></i>
                        </div>
                        <div class="text-2xl font-black text-emerald-900 mt-1">+₹${filteredInflow.toLocaleString('en-IN')}</div>
                        <span class="text-xs text-emerald-700">Funds injected into liquid wallet</span>
                    </div>
                    <div class="bg-white p-4 rounded-2xl border border-slate-200">
                        <div class="flex items-center justify-between">
                            <span class="block text-[10px] uppercase font-bold text-slate-500">Net Bank Movement</span>
                            <i class="fa-solid fa-building-columns text-sky-500"></i>
                        </div>
                        <div class="text-2xl font-black ${netFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'} mt-1">
                            ${netFlow >= 0 ? '+' : ''}₹${netFlow.toLocaleString('en-IN')}
                        </div>
                        <span class="text-xs text-slate-500">${netFlow >= 0 ? 'Net addition to property wallet' : 'Net withdrawal into bank accounts'}</span>
                    </div>
                </div>

                <!-- Action Header -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                    <div>
                        <h4 class="font-extrabold text-sm text-slate-900">Wallet ⇄ Bank Transactions (${list.length})</h4>
                        <p class="text-xs text-slate-500">Track and edit bank transfers and wallet deposits</p>
                    </div>
                    <button onclick="App.openBankTransferModal()" class="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-sky-600/20 self-start sm:self-auto">
                        <i class="fa-solid fa-plus"></i>
                        <span>+ New Bank Transfer</span>
                    </button>
                </div>

                <!-- Transactions Table -->
                <div class="overflow-x-auto rounded-2xl bg-white shadow-sm border border-slate-200">
                    <table class="w-full text-left text-sm text-slate-600">
                        <thead class="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                            <tr>
                                <th class="px-4 py-3">Date</th>
                                <th class="px-4 py-3">Owner & Floors</th>
                                <th class="px-4 py-3">Direction</th>
                                <th class="px-4 py-3">Amount</th>
                                <th class="px-4 py-3">Bank & Mode</th>
                                <th class="px-4 py-3">Reference / UTR</th>
                                <th class="px-4 py-3">Purpose</th>
                                <th class="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
        `;

        if (list.length === 0) {
            html += `
                <tr>
                    <td colspan="8" class="text-center py-10 text-slate-400">
                        <i class="fa-solid fa-building-columns text-3xl mb-2 text-slate-300 block"></i>
                        No bank transactions recorded yet. Click <strong>"+ New Bank Transfer"</strong> to record one.
                    </td>
                </tr>
            `;
        } else {
            list.forEach(tx => {
                const isWalletToBank = (tx.type === 'wallet_to_bank');
                const ownerName = tx.ownerId === 'sajida' ? 'Sajida' : 'Jeelani';
                const ownerFloors = tx.ownerId === 'sajida' ? 'Floors 1-2' : 'Floors 3-5';
                const ownerBadgeClass = tx.ownerId === 'sajida' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800';
                const dirBadgeClass = isWalletToBank ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200';
                const dirIcon = isWalletToBank ? 'fa-arrow-up-right-from-square' : 'fa-arrow-down-left-and-up-right-to-center';
                const dirLabel = isWalletToBank ? 'Wallet ➔ Bank' : 'Bank ➔ Wallet';

                html += `
                    <tr class="hover:bg-slate-50/80 transition">
                        <td class="px-4 py-3 text-xs font-semibold whitespace-nowrap">${tx.date}</td>
                        <td class="px-4 py-3">
                            <span class="px-2 py-0.5 rounded text-xs font-bold ${ownerBadgeClass}">
                                ${ownerName} (${ownerFloors})
                            </span>
                            ${tx.floor ? `<span class="block text-[10px] font-semibold text-slate-500 mt-0.5"><i class="fa-solid fa-layer-group text-[9px] text-sky-600"></i> ${tx.floor}</span>` : ''}
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap">
                            <span class="px-2.5 py-1 rounded-full text-xs font-extrabold border ${dirBadgeClass} inline-flex items-center gap-1.5">
                                <i class="fa-solid ${dirIcon}"></i>
                                ${dirLabel}
                            </span>
                        </td>
                        <td class="px-4 py-3 font-extrabold whitespace-nowrap ${isWalletToBank ? 'text-rose-600' : 'text-emerald-600'}">
                            ${isWalletToBank ? '-' : '+'}₹${parseFloat(tx.amount).toLocaleString('en-IN')}
                        </td>
                        <td class="px-4 py-3 text-xs">
                            <strong class="text-slate-900 block">${tx.bankName || 'Bank Account'}</strong>
                            <span class="text-[11px] text-slate-400">${tx.transferMode || 'Transfer'}</span>
                        </td>
                        <td class="px-4 py-3 text-xs font-mono text-slate-600">
                            ${tx.reference || '-'}
                        </td>
                        <td class="px-4 py-3 text-xs text-slate-500 max-w-xs truncate" title="${tx.notes || ''}">
                            ${tx.notes || '-'}
                        </td>
                        <td class="px-4 py-3 text-right whitespace-nowrap">
                            <div class="flex items-center justify-end gap-1">
                                <button onclick="App.openBankTransferModal('${tx.id}')" class="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition text-xs font-bold flex items-center gap-1" title="Edit this transaction">
                                    <i class="fa-solid fa-pen"></i>
                                    <span class="hidden sm:inline">Edit</span>
                                </button>
                                <button onclick="App.deleteBankTransfer('${tx.id}')" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-rose-50 rounded-lg transition text-xs" title="Delete this transaction">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;
    },

    // --- Sub-Tab 5: Capital Adjustments ---
    renderWalletCapitalBreakup(container) {
        let html = '<div class="space-y-3">';
        const list = (this.data.walletAdjustments || []).sort((a, b) => new Date(b.date) - new Date(a.date));

        if (list.length === 0) {
            container.innerHTML = `<p class="text-sm text-slate-400 text-center py-6">No owner capital adjustments recorded yet.</p>`;
            return;
        }

        list.forEach(adj => {
            const isDeposit = adj.type === 'deposit';
            html += `
                <div class="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-200">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-xl ${isDeposit ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'} flex items-center justify-center font-bold">
                            <i class="fa-solid ${isDeposit ? 'fa-plus' : 'fa-minus'}"></i>
                        </div>
                        <div>
                            <div class="font-bold text-sm text-slate-900">${adj.ownerId === 'sajida' ? 'Sajida' : 'Jeelani'}: Capital ${isDeposit ? 'Deposit' : 'Withdrawal'}</div>
                            <div class="text-xs text-slate-400">${adj.date} • ${adj.notes || 'No notes'}</div>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="font-bold ${isDeposit ? 'text-emerald-600' : 'text-rose-600'} text-base">${isDeposit ? '+' : '-'}₹${parseFloat(adj.amount).toLocaleString('en-IN')}</span>
                        <button onclick="App.editCapitalAdjustment('${adj.id}')" class="p-1.5 text-slate-400 hover:text-blue-600" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="App.deleteCapitalAdjustment('${adj.id}')" class="p-1.5 text-slate-400 hover:text-red-600" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    // -------------------------------------------------------------
    // TRANSACTION EDIT & DELETE ROUTER FOR SHAREHOLDER WALLETS
    // -------------------------------------------------------------
    editWalletTransaction(type, id) {
        if (type === 'rent') {
            this.openEditRentModal(id);
        } else if (type === 'expense') {
            this.openExpenseModal(id);
        } else if (type === 'capital') {
            this.openCapitalModal(id);
        } else if (type === 'bank_transfer') {
            this.openBankTransferModal(id);
        } else if (type === 'wallet_transfer') {
            this.editWalletTransfer(id);
        } else if (type === 'advance_received') {
            const tenantId = id.replace('adv_', '');
            this.openEditAdvanceModal(tenantId);
        } else if (type === 'advance_refund' || type === 'advance_settlement') {
            const settle = (this.data.advanceSettlements || []).find(s => s.id === id);
            if (settle) this.openSettleAdvanceModal(settle.tenantId, id);
        }
    },

    deleteWalletTransaction(type, id) {
        if (type === 'rent') {
            this.deleteRentCollection(id);
        } else if (type === 'expense') {
            this.deleteExpense(id);
        } else if (type === 'capital') {
            this.deleteCapitalAdjustment(id);
        } else if (type === 'bank_transfer') {
            this.deleteBankTransfer(id);
        } else if (type === 'wallet_transfer') {
            this.deleteWalletTransfer(id);
        } else if (type === 'advance_received') {
            const tenantId = id.replace('adv_', '');
            const tenant = (this.data.tenants || []).find(t => t.id === tenantId);
            if (!tenant) return;
            if (!confirm(`Are you sure you want to remove the advance deposit record for ${tenant.name}?`)) return;
            tenant.advanceDeposit = 0;
            StorageManager.saveData(this.data);
            this.renderAll();
            this.showToast(`Advance deposit removed for ${tenant.name}.`);
        } else if (type === 'advance_refund' || type === 'advance_settlement') {
            const settle = (this.data.advanceSettlements || []).find(s => s.id === id);
            if (!settle) return;
            if (!confirm('Are you sure you want to delete this advance settlement record? Tenant held liability and advance wallet will be restored.')) return;
            
            // Restore tenant state
            const tenant = (this.data.tenants || []).find(t => t.id === settle.tenantId);
            if (tenant) {
                tenant.advanceRefunded = Math.max(0, (tenant.advanceRefunded || 0) - (settle.refundAmount || 0));
                tenant.advanceDeductions = Math.max(0, (tenant.advanceDeductions || 0) - (settle.totalDeductions || 0));
                if (settle.isVacated && tenant.status === 'vacated') {
                    tenant.status = 'active';
                }
            }

            this.data.advanceSettlements = (this.data.advanceSettlements || []).filter(s => s.id !== id);
            StorageManager.saveData(this.data);
            this.renderAll();
            this.showToast('Advance settlement record removed and tenant balance restored.');
        }
    },

    // -------------------------------------------------------------
    // ADVANCE SETTLEMENT & REFUND / VACATE FLOW
    // -------------------------------------------------------------
    openSettleAdvanceModal(tenantId = null, settlementId = null) {
        this.editingSettlementId = settlementId;
        const tenantSelect = document.getElementById('settle-tenant-select');
        if (!tenantSelect) return;

        let selectedTenantId = tenantId;
        if (settlementId) {
            const settle = (this.data.advanceSettlements || []).find(s => s.id === settlementId);
            if (settle) selectedTenantId = settle.tenantId;
        }

        let html = '';
        this.data.tenants.forEach(t => {
            const floor = parseInt(t.floor) || this.detectFloorFromFlat(t.flat);
            const ownerInfo = this.getFloorOwner(floor);
            html += `<option value="${t.id}" ${t.id === selectedTenantId ? 'selected' : ''}>${t.name} (${t.flat} - ${floor} Fl, ${ownerInfo.name})</option>`;
        });
        tenantSelect.innerHTML = html;

        const targetId = selectedTenantId || (this.data.tenants[0] ? this.data.tenants[0].id : null);
        if (targetId) {
            tenantSelect.value = targetId;
            this.onSettleTenantChanged(targetId, settlementId);
        }

        const dateInput = document.getElementById('settle-date');
        if (dateInput && !settlementId) dateInput.value = new Date().toISOString().slice(0, 10);

        this.showModal('modal-settle-advance');
    },

    onSettleTenantChanged(tenantId, settlementId = null) {
        const tenant = this.data.tenants.find(t => t.id === tenantId);
        if (!tenant) return;

        const floor = parseInt(tenant.floor) || this.detectFloorFromFlat(tenant.flat);
        const ownerInfo = this.getFloorOwner(floor);

        const origAdvance = parseFloat(tenant.advanceDeposit) || 0;
        let alreadyRefunded = parseFloat(tenant.advanceRefunded) || 0;
        let alreadyDeducted = parseFloat(tenant.advanceDeductions) || 0;

        const effectiveSettlementId = settlementId || this.editingSettlementId;
        const existingSettle = effectiveSettlementId
            ? (this.data.advanceSettlements || []).find(s => s.id === effectiveSettlementId)
            : null;

        if (existingSettle) {
            // Subtract the settlement's own previous impact so it doesn't double-deduct during editing
            alreadyRefunded = Math.max(0, alreadyRefunded - (existingSettle.refundAmount || 0));
            alreadyDeducted = Math.max(0, alreadyDeducted - (existingSettle.totalDeductions || 0));
        }

        const currentHeld = Math.max(0, origAdvance - alreadyRefunded - alreadyDeducted);

        this.setElementText('settle-tenant-name-preview', tenant.name);
        this.setElementText('settle-tenant-flat-preview', `${tenant.flat} (${floor} Floor)`);
        this.setElementText('settle-tenant-owner-preview', `${ownerInfo.name} Advance Wallet (${ownerInfo.floors})`);
        this.setElementText('settle-orig-advance', `₹${origAdvance.toLocaleString('en-IN')}`);
        this.setElementText('settle-prior-deductions', `₹${alreadyDeducted.toLocaleString('en-IN')}`);
        this.setElementText('settle-prior-refunds', `₹${alreadyRefunded.toLocaleString('en-IN')}`);
        this.setElementText('settle-current-held', `₹${currentHeld.toLocaleString('en-IN')}`);

        document.getElementById('settle-advance-total').value = currentHeld;
        document.getElementById('settle-owner-refund').value = ownerInfo.id;

        if (existingSettle) {
            document.getElementById('settle-deduct-painting').value = existingSettle.paintingDeduction || '';
            document.getElementById('settle-deduct-cleaning').value = existingSettle.cleaningDeduction || '';
            document.getElementById('settle-deduct-utility').value = existingSettle.utilityDeduction || '';
            document.getElementById('settle-deduct-damage').value = existingSettle.damageDeduction || '';
            if (document.getElementById('settle-deduct-other')) {
                document.getElementById('settle-deduct-other').value = existingSettle.otherDeduction || '';
            }
            document.getElementById('settle-notes').value = existingSettle.notes || '';

            const refundInput = document.getElementById('settle-refund-amount-input');
            if (refundInput) refundInput.value = existingSettle.refundAmount || 0;

            const dateInput = document.getElementById('settle-date');
            if (dateInput) dateInput.value = existingSettle.settlementDate || new Date().toISOString().slice(0, 10);

            const modeSelect = document.getElementById('settle-mode');
            if (modeSelect) modeSelect.value = existingSettle.refundPaymentMode || 'Bank Transfer';

            const vacateCheck = document.getElementById('settle-mark-vacated');
            if (vacateCheck) vacateCheck.checked = !!existingSettle.isVacated;

            this.setElementText('settle-modal-title', 'Edit Advance Settlement');
            this.setElementText('settle-submit-btn-text', 'Update Settlement & Advance Wallet');
        } else {
            // Reset deduction inputs
            document.getElementById('settle-deduct-painting').value = '';
            document.getElementById('settle-deduct-cleaning').value = '';
            document.getElementById('settle-deduct-utility').value = '';
            document.getElementById('settle-deduct-damage').value = '';
            if (document.getElementById('settle-deduct-other')) {
                document.getElementById('settle-deduct-other').value = '';
            }
            document.getElementById('settle-notes').value = '';

            // Default refund amount input to 0 (deduct only by default, tenant stays)
            const refundInput = document.getElementById('settle-refund-amount-input');
            if (refundInput) refundInput.value = 0;
            const vacateCheck = document.getElementById('settle-mark-vacated');
            if (vacateCheck) vacateCheck.checked = false;

            this.setElementText('settle-modal-title', 'Tenant Advance Settlement & Refund');
            this.setElementText('settle-submit-btn-text', 'Process Settlement & Update Wallet');
        }

        this.updateNetRefundPreview();
    },

    setSettleMode(mode) {
        const totalHeld = parseFloat(document.getElementById('settle-advance-total').value) || 0;
        const painting = parseFloat(document.getElementById('settle-deduct-painting').value) || 0;
        const cleaning = parseFloat(document.getElementById('settle-deduct-cleaning').value) || 0;
        const utility = parseFloat(document.getElementById('settle-deduct-utility').value) || 0;
        const damage = parseFloat(document.getElementById('settle-deduct-damage').value) || 0;
        const other = parseFloat(document.getElementById('settle-deduct-other')?.value) || 0;
        const totalDeductions = painting + cleaning + utility + damage + other;
        const remainingAfterDeductions = Math.max(0, totalHeld - totalDeductions);

        const refundInput = document.getElementById('settle-refund-amount-input');
        const vacateCheck = document.getElementById('settle-mark-vacated');

        if (mode === 'deduct_only') {
            if (refundInput) refundInput.value = 0;
            if (vacateCheck) vacateCheck.checked = false;
        } else if (mode === 'full_vacate') {
            if (refundInput) refundInput.value = remainingAfterDeductions;
            if (vacateCheck) vacateCheck.checked = true;
        }

        this.updateNetRefundPreview();
    },

    updateNetRefundPreview() {
        const totalHeld = parseFloat(document.getElementById('settle-advance-total').value) || 0;
        const painting = parseFloat(document.getElementById('settle-deduct-painting').value) || 0;
        const cleaning = parseFloat(document.getElementById('settle-deduct-cleaning').value) || 0;
        const utility = parseFloat(document.getElementById('settle-deduct-utility').value) || 0;
        const damage = parseFloat(document.getElementById('settle-deduct-damage').value) || 0;
        const other = parseFloat(document.getElementById('settle-deduct-other')?.value) || 0;

        const totalDeductions = painting + cleaning + utility + damage + other;
        const remainingAfterDeductions = Math.max(0, totalHeld - totalDeductions);

        this.setElementText('settle-total-deductions-preview', `₹${totalDeductions.toLocaleString('en-IN')}`);
        this.setElementText('settle-remaining-after-deductions', `₹${remainingAfterDeductions.toLocaleString('en-IN')}`);

        const refundInput = document.getElementById('settle-refund-amount-input');
        let refundAmount = 0;
        if (refundInput) {
            refundAmount = parseFloat(refundInput.value);
            if (isNaN(refundAmount) || refundAmount < 0) refundAmount = 0;
            if (refundAmount > remainingAfterDeductions) {
                refundAmount = remainingAfterDeductions;
                refundInput.value = refundAmount;
            }
        }

        const advanceLeftHeld = Math.max(0, remainingAfterDeductions - refundAmount);
        this.setElementText('settle-advance-left-preview', `₹${advanceLeftHeld.toLocaleString('en-IN')}`);
    },

    saveAdvanceSettlement(e) {
        e.preventDefault();

        const tenantId = document.getElementById('settle-tenant-select').value;
        const tenant = this.data.tenants.find(t => t.id === tenantId);
        if (!tenant) return;

        const floor = parseInt(tenant.floor) || this.detectFloorFromFlat(tenant.flat);
        const ownerInfo = this.getFloorOwner(floor);
        const targetWallet = ownerInfo.id === 'sajida' ? 'sajida_advance' : 'jeelani_advance';

        const totalHeld = parseFloat(document.getElementById('settle-advance-total').value) || 0;
        const painting = parseFloat(document.getElementById('settle-deduct-painting').value) || 0;
        const cleaning = parseFloat(document.getElementById('settle-deduct-cleaning').value) || 0;
        const utility = parseFloat(document.getElementById('settle-deduct-utility').value) || 0;
        const damage = parseFloat(document.getElementById('settle-deduct-damage').value) || 0;
        const other = parseFloat(document.getElementById('settle-deduct-other')?.value) || 0;

        const totalDeductions = painting + cleaning + utility + damage + other;
        const remainingAfterDeductions = Math.max(0, totalHeld - totalDeductions);

        let refundAmount = parseFloat(document.getElementById('settle-refund-amount-input').value);
        if (isNaN(refundAmount) || refundAmount < 0) refundAmount = 0;
        if (refundAmount > remainingAfterDeductions) refundAmount = remainingAfterDeductions;

        const settlementDate = document.getElementById('settle-date').value || new Date().toISOString().slice(0, 10);
        const refundPaymentMode = document.getElementById('settle-mode').value;
        const isVacated = document.getElementById('settle-mark-vacated').checked;
        const notes = document.getElementById('settle-notes').value.trim();

        const advanceLeftHeld = Math.max(0, remainingAfterDeductions - refundAmount);

        if (!this.data.advanceSettlements) this.data.advanceSettlements = [];

        if (this.editingSettlementId) {
            const idx = this.data.advanceSettlements.findIndex(s => s.id === this.editingSettlementId);
            if (idx >= 0) {
                const oldSettle = this.data.advanceSettlements[idx];
                const refundDelta = refundAmount - (oldSettle.refundAmount || 0);
                const deductionDelta = totalDeductions - (oldSettle.totalDeductions || 0);

                tenant.advanceRefunded = Math.max(0, (tenant.advanceRefunded || 0) + refundDelta);
                tenant.advanceDeductions = Math.max(0, (tenant.advanceDeductions || 0) + deductionDelta);
                if (isVacated) {
                    tenant.status = 'vacated';
                } else if (tenant.status === 'vacated' && !isVacated) {
                    tenant.status = 'active';
                }

                this.data.advanceSettlements[idx] = {
                    ...oldSettle,
                    tenantId,
                    tenantName: tenant.name,
                    flat: tenant.flat,
                    floor,
                    walletId: targetWallet,
                    refundOwner: ownerInfo.id,
                    totalHeld,
                    totalDeductions,
                    paintingDeduction: painting,
                    cleaningDeduction: cleaning,
                    utilityDeduction: utility,
                    damageDeduction: damage,
                    otherDeduction: other,
                    refundAmount,
                    advanceLeftHeld,
                    settlementDate,
                    refundPaymentMode,
                    isVacated,
                    notes
                };
            }
            this.editingSettlementId = null;
            this.showToast(`Settlement updated for ${tenant.name} in ${ownerInfo.name} Advance Wallet.`);
        } else {
            const settlementRecord = {
                id: 'settle_' + Date.now(),
                tenantId,
                tenantName: tenant.name,
                flat: tenant.flat,
                floor,
                walletId: targetWallet,
                refundOwner: ownerInfo.id,
                totalHeld,
                totalDeductions,
                paintingDeduction: painting,
                cleaningDeduction: cleaning,
                utilityDeduction: utility,
                damageDeduction: damage,
                otherDeduction: other,
                refundAmount,
                advanceLeftHeld,
                settlementDate,
                refundPaymentMode,
                isVacated,
                notes
            };

            this.data.advanceSettlements.push(settlementRecord);

            // Update tenant state
            tenant.advanceRefunded = (tenant.advanceRefunded || 0) + refundAmount;
            tenant.advanceDeductions = (tenant.advanceDeductions || 0) + totalDeductions;
            if (isVacated) {
                tenant.status = 'vacated';
            }

            this.showToast(`Advance settlement processed for ${tenant.name} in ${ownerInfo.name} Advance Wallet. Retained: ₹${totalDeductions.toLocaleString('en-IN')}, Refunded: ₹${refundAmount.toLocaleString('en-IN')}`);
        }

        ActivityLogger.log('tenant', `Advance Settled: ${tenant ? tenant.name : 'Tenant'}`, `Retained: ₹${totalDeductions.toLocaleString('en-IN')}, Refunded: ₹${refundAmount.toLocaleString('en-IN')}`);
        StorageManager.saveData(this.data);
        this.hideModal('modal-settle-advance');
        this.renderAll();
    },

    // -------------------------------------------------------------
    // EDIT RENT MODAL WITH DUPLICATE CHECK & DIRECT BANK CREDIT
    // -------------------------------------------------------------
    checkEditRentDuplicate() {
        const rent = this.data.rentCollections.find(r => r.id === this.editingRentId);
        if (!rent) return false;

        const monthInput = document.getElementById('edit-rent-month');
        const warningBox = document.getElementById('edit-rent-duplicate-warning');
        const warningText = document.getElementById('edit-rent-duplicate-warning-text');
        const newMonth = monthInput ? monthInput.value : '';

        if (!newMonth) {
            if (warningBox) warningBox.classList.add('hidden');
            return false;
        }

        const isDuplicate = this.data.rentCollections.some(r => 
            r.id !== this.editingRentId && 
            r.tenantId === rent.tenantId &&
            r.month === newMonth
        );

        if (isDuplicate) {
            if (warningBox) {
                warningBox.classList.remove('hidden');
                if (warningText) {
                    warningText.textContent = `Rent for "${newMonth}" already exists for ${rent.tenantName}! Duplicate entries are blocked.`;
                }
            }
            return true;
        } else {
            if (warningBox) warningBox.classList.add('hidden');
            return false;
        }
    },

    onEditRentDestinationChanged(val) {
        const wrapper = document.getElementById('edit-rent-bank-details-wrapper');
        if (wrapper) wrapper.classList.toggle('hidden', val !== 'bank');
        if (val === 'bank') {
            const bankSelect = document.getElementById('edit-rent-bank-name');
            this.onEditRentBankNameChanged(bankSelect ? bankSelect.value : '');
        }
    },

    onEditRentBankNameChanged(val) {
        const customInput = document.getElementById('edit-rent-custom-bank');
        if (customInput) customInput.classList.toggle('hidden', val !== 'Other');
    },

    openEditRentModal(rentId) {
        this.editingRentId = rentId;
        const rent = this.data.rentCollections.find(r => r.id === rentId);
        if (!rent) return;

        this.setElementText('edit-rent-tenant-display', `${rent.tenantName} (${rent.flat})`);
        document.getElementById('edit-rent-amount').value = rent.amount;
        document.getElementById('edit-rent-month').value = rent.month;
        document.getElementById('edit-rent-date').value = rent.paymentDate;
        document.getElementById('edit-rent-mode').value = rent.paymentMode || 'Cash';
        document.getElementById('edit-rent-notes').value = rent.notes || '';

        const radio = document.querySelector(`input[name="edit-rent-owner"][value="${rent.ownerCredited}"]`);
        if (radio) radio.checked = true;

        const isBank = (rent.creditDestination === 'bank');
        const destWallet = document.getElementById('edit-rent-dest-wallet');
        const destBank = document.getElementById('edit-rent-dest-bank');
        if (isBank) {
            if (destBank) destBank.checked = true;
        } else {
            if (destWallet) destWallet.checked = true;
        }
        this.onEditRentDestinationChanged(isBank ? 'bank' : 'wallet');

        const bankSelect = document.getElementById('edit-rent-bank-name');
        const customBank = document.getElementById('edit-rent-custom-bank');
        if (bankSelect) {
            let found = false;
            for (let i = 0; i < bankSelect.options.length; i++) {
                if (bankSelect.options[i].value === rent.bankName) {
                    found = true;
                    break;
                }
            }
            if (found) {
                bankSelect.value = rent.bankName;
                if (customBank) { customBank.value = ''; customBank.classList.add('hidden'); }
            } else if (rent.bankName) {
                bankSelect.value = 'Other';
                if (customBank) { customBank.value = rent.bankName; customBank.classList.remove('hidden'); }
            }
        }
        const bankRefInput = document.getElementById('edit-rent-bank-ref');
        if (bankRefInput) bankRefInput.value = rent.bankReference || '';

        const warningBox = document.getElementById('edit-rent-duplicate-warning');
        if (warningBox) warningBox.classList.add('hidden');

        this.showModal('modal-edit-rent');
    },

    saveEditRent(e) {
        e.preventDefault();
        const rent = this.data.rentCollections.find(r => r.id === this.editingRentId);
        if (!rent) return;

        if (this.checkEditRentDuplicate()) {
            alert('⚠️ Duplicate Rent Warning!\n\nA rent record already exists for this tenant in the selected month. Please choose a different month or cancel.');
            return;
        }

        const amount = parseFloat(document.getElementById('edit-rent-amount').value) || 0;
        const month = document.getElementById('edit-rent-month').value;
        const paymentDate = document.getElementById('edit-rent-date').value;
        const ownerCredited = document.querySelector('input[name="edit-rent-owner"]:checked').value;
        const paymentMode = document.getElementById('edit-rent-mode').value;
        const notes = document.getElementById('edit-rent-notes').value.trim();

        const creditDestination = document.querySelector('input[name="edit-rent-destination"]:checked')?.value || 'wallet';
        let bankName = '';
        let bankReference = '';

        if (creditDestination === 'bank') {
            bankName = document.getElementById('edit-rent-bank-name')?.value || 'Bank Account';
            if (bankName === 'Other') {
                bankName = document.getElementById('edit-rent-custom-bank')?.value.trim() || 'Bank Account';
            }
            bankReference = document.getElementById('edit-rent-bank-ref')?.value.trim() || '';
        }

        rent.amount = amount;
        rent.month = month;
        rent.paymentDate = paymentDate;
        rent.ownerCredited = ownerCredited;
        rent.paymentMode = paymentMode;
        rent.notes = notes;
        rent.creditDestination = creditDestination;
        rent.bankName = bankName;
        rent.bankReference = bankReference;

        StorageManager.saveData(this.data);
        this.hideModal('modal-edit-rent');
        this.renderAll();
        this.showToast('Rent entry updated successfully.');
    },

    // -------------------------------------------------------------
    // TENANT CREATION / EDITING WITH FLOOR & OWNER AUTO-BINDING
    // -------------------------------------------------------------
    openTenantModal(editId = null) {
        this.editingTenantId = editId;
        const adjustSection = document.getElementById('tenant-advance-adjust-section');
        if (editId) {
            const t = this.data.tenants.find(x => x.id === editId);
            if (t) {
                document.getElementById('tenant-modal-title').textContent = 'Edit Tenant Details';
                document.getElementById('t-name').value = t.name || '';
                document.getElementById('t-floor').value = t.floor || this.detectFloorFromFlat(t.flat);
                document.getElementById('t-flat').value = t.flat || '';
                document.getElementById('t-phone').value = t.phone || '';
                document.getElementById('t-occupation').value = t.occupation || '';
                document.getElementById('t-advance').value = t.advanceDeposit || '';
                document.getElementById('t-rent').value = t.monthlyRent || '';
                document.getElementById('t-date').value = t.moveInDate || '';
                document.getElementById('t-notes').value = t.notes || '';
                
                if (adjustSection) {
                    adjustSection.classList.remove('hidden');
                    const dedInput = document.getElementById('t-advance-deductions');
                    const refInput = document.getElementById('t-advance-refunded');
                    if (dedInput) dedInput.value = t.advanceDeductions || 0;
                    if (refInput) refInput.value = t.advanceRefunded || 0;
                    this.updateTenantAdvancePreview();
                }

                this.onTenantFloorChanged(t.floor || this.detectFloorFromFlat(t.flat));
            }
        } else {
            document.getElementById('tenant-modal-title').textContent = 'Add Resident Tenant';
            document.getElementById('t-name').value = '';
            document.getElementById('t-floor').value = '1';
            document.getElementById('t-flat').value = '';
            document.getElementById('t-phone').value = '';
            document.getElementById('t-occupation').value = '';
            document.getElementById('t-advance').value = '';
            document.getElementById('t-rent').value = '';
            document.getElementById('t-date').value = new Date().toISOString().slice(0, 10);
            document.getElementById('t-notes').value = '';

            if (adjustSection) {
                adjustSection.classList.add('hidden');
                const dedInput = document.getElementById('t-advance-deductions');
                const refInput = document.getElementById('t-advance-refunded');
                if (dedInput) dedInput.value = '0';
                if (refInput) refInput.value = '0';
            }

            this.onTenantFloorChanged(1);
        }
        this.showModal('modal-add-tenant');
    },

    updateTenantAdvancePreview() {
        const adv = parseFloat(document.getElementById('t-advance')?.value) || 0;
        const ded = parseFloat(document.getElementById('t-advance-deductions')?.value) || 0;
        const ref = parseFloat(document.getElementById('t-advance-refunded')?.value) || 0;
        const held = Math.max(0, adv - ded - ref);
        const previewEl = document.getElementById('t-advance-held-preview');
        if (previewEl) {
            previewEl.textContent = `₹${held.toLocaleString('en-IN')}`;
        }
    },

    onTenantFloorChanged(floorVal) {
        const floor = parseInt(floorVal) || 1;
        const owner = this.getFloorOwner(floor);
        const badge = document.getElementById('tenant-floor-owner-badge');
        if (badge) {
            badge.textContent = `Assigned Owner: ${owner.name} (${owner.floors})`;
            badge.className = `text-[11px] font-bold px-2 py-0.5 rounded ${floor <= 2 ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`;
        }
    },

    saveTenant(e) {
        e.preventDefault();
        const name = document.getElementById('t-name').value.trim();
        const floor = parseInt(document.getElementById('t-floor').value) || 1;
        const flat = document.getElementById('t-flat').value.trim();
        const phone = document.getElementById('t-phone').value.trim();
        const occupation = document.getElementById('t-occupation').value.trim();
        const advanceDeposit = parseFloat(document.getElementById('t-advance').value) || 0;
        const monthlyRent = parseFloat(document.getElementById('t-rent').value) || 0;
        const moveInDate = document.getElementById('t-date').value;
        const notes = document.getElementById('t-notes').value.trim();

        if (!name || !flat) {
            alert('Please enter tenant name and flat number.');
            return;
        }

        const ownerInfo = this.getFloorOwner(floor);

        if (this.editingTenantId) {
            const idx = this.data.tenants.findIndex(t => t.id === this.editingTenantId);
            if (idx >= 0) {
                const advanceDeductions = parseFloat(document.getElementById('t-advance-deductions')?.value) || 0;
                const advanceRefunded = parseFloat(document.getElementById('t-advance-refunded')?.value) || 0;
                this.data.tenants[idx] = {
                    ...this.data.tenants[idx],
                    name,
                    floor,
                    flat,
                    ownerId: ownerInfo.id,
                    phone,
                    occupation,
                    advanceDeposit,
                    advanceDeductions,
                    advanceRefunded,
                    monthlyRent,
                    moveInDate,
                    notes
                };
            }
        } else {
            const newT = {
                id: 't_' + Date.now(),
                name,
                floor,
                flat,
                ownerId: ownerInfo.id,
                phone,
                occupation,
                advanceDeposit,
                advancePaidDate: moveInDate,
                advanceRefunded: 0,
                advanceDeductions: 0,
                status: 'active',
                monthlyRent,
                moveInDate,
                notes
            };
            this.data.tenants.push(newT);
        }

        StorageManager.saveData(this.data);
        if (typeof CloudSyncManager !== 'undefined' && CloudSyncManager.isEnabled()) {
            CloudSyncManager.pushLocalDataToCloud(this.data);
        }
        ActivityLogger.log('tenant', `Tenant Saved: ${name}`, `Flat ${flat} (Floor ${floor}, ${ownerInfo.name})`);
        this.hideModal('modal-add-tenant');
        this.renderAll();
        this.showToast(`Tenant "${name}" (${floor} Floor, ${ownerInfo.name}) saved.`);
    },

    editTenant(id) {
        this.openTenantModal(id);
    },

    deleteTenant(id) {
        if (!confirm('Are you sure you want to delete this tenant record? All history will remain.')) return;
        const tenantToDelete = this.data.tenants.find(t => t.id === id);
        this.data.tenants = this.data.tenants.filter(t => t.id !== id);
        StorageManager.saveData(this.data);
        if (typeof CloudSyncManager !== 'undefined' && CloudSyncManager.isEnabled()) {
            CloudSyncManager.pushLocalDataToCloud(this.data);
        }
        ActivityLogger.log('tenant', 'Tenant Deleted', `Deleted tenant: ${tenantToDelete ? tenantToDelete.name : id}`);
        this.renderAll();
        this.showToast('Tenant removed.');
    },

    // -------------------------------------------------------------
    // RENT COLLECTION WITH FLOOR AUTO-SELECTION & DUPLICATE PREVENTION
    // -------------------------------------------------------------
    checkRentDuplicate() {
        const selectVal = document.getElementById('rent-tenant-select')?.value;
        const month = document.getElementById('rent-month')?.value;
        const warningBox = document.getElementById('rent-duplicate-warning');
        const warningText = document.getElementById('rent-duplicate-warning-text');

        if (!selectVal || !month) {
            if (warningBox) warningBox.classList.add('hidden');
            return false;
        }

        let tenantName = '';
        let tenantFlat = '';

        if (selectVal === 'NEW_TENANT') {
            tenantName = document.getElementById('new-t-name')?.value.trim() || 'New Tenant';
            tenantFlat = document.getElementById('new-t-flat')?.value.trim() || '';
        } else {
            const tenant = this.data.tenants.find(t => t.id === selectVal);
            if (tenant) {
                tenantName = tenant.name;
                tenantFlat = tenant.flat;
            }
        }

        // Show warning ONLY when trying to enter two records for the same month for this tenant
        const isDuplicate = this.data.rentCollections.some(r => {
            if (selectVal !== 'NEW_TENANT') {
                return r.tenantId === selectVal && r.month === month;
            } else {
                return tenantFlat && r.flat && r.flat.trim().toLowerCase() === tenantFlat.trim().toLowerCase() && r.month === month;
            }
        });

        if (isDuplicate) {
            if (warningBox) {
                warningBox.classList.remove('hidden');
                if (warningText) {
                    warningText.textContent = `⚠️ Rent for "${month}" has already been collected for ${tenantName}${tenantFlat ? ` (${tenantFlat})` : ''}! Duplicate entries for the same month are blocked.`;
                }
            }
            return true;
        } else {
            if (warningBox) warningBox.classList.add('hidden');
            return false;
        }
    },

    getTenantBillingMonths(tenant) {
        if (!tenant || !tenant.id) return [];
        const moveInStr = tenant.moveInDate || tenant.advancePaidDate || this.getCurrentMonthKey() + '-01';
        let startYear = parseInt(moveInStr.slice(0, 4)) || new Date().getFullYear();
        let startMonth = parseInt(moveInStr.slice(5, 7)) || (new Date().getMonth() + 1);

        const now = new Date();
        const endYear = now.getFullYear();
        const endMonth = now.getMonth() + 1;

        // Safety bound: up to 5 years past
        if (startYear < endYear - 5) startYear = endYear - 5;

        const months = [];
        let y = startYear;
        let m = startMonth;

        while (y < endYear || (y === endYear && m <= endMonth)) {
            const mKey = `${y}-${String(m).padStart(2, '0')}`;
            const dateObj = new Date(y, m - 1, 1);
            const label = dateObj.toLocaleString('en-IN', { month: 'short', year: 'numeric' });

            const record = (this.data.rentCollections || []).find(r => r.tenantId === tenant.id && r.month === mKey);
            months.push({
                month: mKey,
                label,
                isPaid: !!record,
                amount: record ? (parseFloat(record.amount) || 0) : (parseFloat(tenant.monthlyRent) || 0),
                record
            });

            m++;
            if (m > 12) {
                m = 1;
                y++;
            }
        }

        return months;
    },

    renderRentModalMonthPills(tenant) {
        const container = document.getElementById('rent-tenant-months-container');
        const pillsWrapper = document.getElementById('rent-month-pills');
        const moveInLabel = document.getElementById('rent-tenant-movein-label');
        const summaryLabel = document.getElementById('rent-tenant-months-summary');
        const monthInput = document.getElementById('rent-month');

        if (!container || !pillsWrapper) return;

        if (!tenant || !tenant.id) {
            container.classList.add('hidden');
            return;
        }

        const billingMonths = this.getTenantBillingMonths(tenant);
        if (billingMonths.length === 0) {
            container.classList.add('hidden');
            return;
        }

        container.classList.remove('hidden');
        if (moveInLabel) moveInLabel.textContent = tenant.moveInDate || 'Start';

        const unpaid = billingMonths.filter(bm => !bm.isPaid);
        if (summaryLabel) {
            if (unpaid.length === 0) {
                summaryLabel.textContent = 'All Paid ✓';
                summaryLabel.className = 'text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full';
            } else {
                summaryLabel.textContent = `${unpaid.length} Due`;
                summaryLabel.className = 'text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full';
            }
        }

        // Auto-select earliest unpaid month from move-in
        if (unpaid.length > 0) {
            if (monthInput) monthInput.value = unpaid[0].month;
        } else {
            if (monthInput) monthInput.value = this.getCurrentMonthKey();
        }

        const selectedVal = monthInput ? monthInput.value : '';

        let pillsHtml = '';
        billingMonths.forEach(bm => {
            const isSelected = (bm.month === selectedVal);
            if (bm.isPaid) {
                pillsHtml += `
                    <button type="button" onclick="App.selectRentMonthFromPill('${bm.month}')"
                        class="px-2 py-1 text-[11px] rounded-lg font-semibold transition border flex items-center gap-1 ${
                            isSelected 
                                ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-400' 
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                        }" title="Already Paid: ₹${bm.amount.toLocaleString('en-IN')}">
                        <i class="fa-solid fa-check text-[10px]"></i>
                        <span>${bm.label} (Paid)</span>
                    </button>
                `;
            } else {
                pillsHtml += `
                    <button type="button" onclick="App.selectRentMonthFromPill('${bm.month}')"
                        class="px-2 py-1 text-[11px] rounded-lg font-bold transition border flex items-center gap-1 ${
                            isSelected 
                                ? 'bg-amber-500 text-white border-amber-600 shadow-sm ring-2 ring-amber-400' 
                                : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                        }" title="Pending Due: ₹${bm.amount.toLocaleString('en-IN')}">
                        <i class="fa-regular fa-clock text-[10px] text-amber-600"></i>
                        <span>${bm.label} (Due)</span>
                    </button>
                `;
            }
        });

        pillsWrapper.innerHTML = pillsHtml;
    },

    selectRentMonthFromPill(monthKey) {
        const monthInput = document.getElementById('rent-month');
        if (monthInput) {
            monthInput.value = monthKey;
        }
        const selectVal = document.getElementById('rent-tenant-select')?.value;
        const tenant = this.data.tenants.find(t => t.id === selectVal);
        if (tenant) {
            this.renderRentModalMonthPills(tenant);
        }
        this.checkRentDuplicate();
    },

    onRentDestinationChanged(val) {
        const wrapper = document.getElementById('rent-bank-details-wrapper');
        if (wrapper) wrapper.classList.toggle('hidden', val !== 'bank');
        if (val === 'bank') {
            const bankSelect = document.getElementById('rent-bank-name');
            this.onRentBankNameChanged(bankSelect ? bankSelect.value : '');
        }
    },

    onRentBankNameChanged(val) {
        const customInput = document.getElementById('rent-custom-bank');
        if (customInput) customInput.classList.toggle('hidden', val !== 'Other');
    },

    openRentCollectionModal(tenantId = null) {
        this.populateTenantDropdown(tenantId);
        
        const dateInput = document.getElementById('rent-payment-date');
        const monthInput = document.getElementById('rent-month');
        if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
        if (monthInput) monthInput.value = this.getCurrentMonthKey();

        const destWallet = document.getElementById('rent-dest-wallet');
        if (destWallet) destWallet.checked = true;
        this.onRentDestinationChanged('wallet');
        const customBank = document.getElementById('rent-custom-bank');
        if (customBank) { customBank.value = ''; customBank.classList.add('hidden'); }
        const refInput = document.getElementById('rent-bank-ref');
        if (refInput) refInput.value = '';

        if (tenantId) {
            const select = document.getElementById('rent-tenant-select');
            if (select) {
                select.value = tenantId;
                this.onTenantSelectChanged(tenantId);
            }
        } else {
            const select = document.getElementById('rent-tenant-select');
            if (select && select.options.length > 1) {
                select.selectedIndex = 1;
                this.onTenantSelectChanged(select.value);
            } else {
                this.onTenantSelectChanged('NEW_TENANT');
            }
        }

        this.checkRentDuplicate();
        this.showModal('modal-collect-rent');
    },

    openRentCollectionForTenant(tenantId) {
        this.openRentCollectionModal(tenantId);
    },

    onTenantSelectChanged(val) {
        const isNew = (val === 'NEW_TENANT');
        const newFields = document.getElementById('new-tenant-extra-fields');
        if (newFields) {
            newFields.classList.toggle('hidden', !isNew);
        }

        if (!isNew) {
            const tenant = this.data.tenants.find(t => t.id === val);
            if (tenant) {
                const floor = parseInt(tenant.floor) || this.detectFloorFromFlat(tenant.flat);
                const ownerInfo = this.getFloorOwner(floor);

                document.getElementById('rent-amount').value = tenant.monthlyRent || '';
                document.getElementById('rent-tenant-phone-preview').textContent = tenant.phone || '';
                document.getElementById('rent-tenant-flat-preview').textContent = `${tenant.flat} (${floor} Fl)`;
                const advDeposit = parseFloat(tenant.advanceDeposit) || 0;
                const advRefunded = parseFloat(tenant.advanceRefunded) || 0;
                const advDeducted = parseFloat(tenant.advanceDeductions) || 0;
                const advHeld = Math.max(0, advDeposit - advRefunded - advDeducted);
                document.getElementById('rent-tenant-advance-preview').textContent = `₹${advHeld.toLocaleString('en-IN')}`;

                // AUTO-SELECT FLOOR OWNER FOR RENT PAYMENT!
                const ownerRadio = document.querySelector(`input[name="rent-owner-credited"][value="${ownerInfo.id}"]`);
                if (ownerRadio) {
                    ownerRadio.checked = true;
                }

                // Show floor owner badge
                const floorBadge = document.getElementById('rent-floor-owner-badge');
                if (floorBadge) {
                    floorBadge.textContent = `Auto-selected: ${ownerInfo.name} (${ownerInfo.floors})`;
                }

                // Render billing timeline from move-in and auto-select earliest unpaid month
                this.renderRentModalMonthPills(tenant);
            }
        } else {
            document.getElementById('rent-amount').value = '';
            document.getElementById('rent-tenant-phone-preview').textContent = 'New';
            document.getElementById('rent-tenant-flat-preview').textContent = 'New';
            document.getElementById('rent-tenant-advance-preview').textContent = 'New';
            const container = document.getElementById('rent-tenant-months-container');
            if (container) container.classList.add('hidden');
        }

        this.checkRentDuplicate();
    },

    populateTenantDropdown(selectedId = null) {
        const select = document.getElementById('rent-tenant-select');
        if (!select) return;

        let html = `<option value="" disabled>-- Select Tenant --</option>`;
        this.data.tenants.filter(t => t.status !== 'vacated').forEach(t => {
            const floor = parseInt(t.floor) || this.detectFloorFromFlat(t.flat);
            const ownerInfo = this.getFloorOwner(floor);
            html += `<option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>${t.name} (${t.flat} - Floor ${floor}, ${ownerInfo.name})</option>`;
        });
        html += `<option value="NEW_TENANT" class="font-bold text-emerald-600">+ Add New Tenant On-the-fly...</option>`;
        select.innerHTML = html;
    },

    saveRentCollection(e) {
        e.preventDefault();

        if (this.checkRentDuplicate()) {
            alert('⚠️ Duplicate Rent Warning!\n\nA rent collection record for this tenant and month already exists in the system. To prevent duplicate accounting, this payment cannot be saved again. Please edit the existing record if changes are needed.');
            return;
        }

        const selectVal = document.getElementById('rent-tenant-select').value;
        const amount = parseFloat(document.getElementById('rent-amount').value);
        const month = document.getElementById('rent-month').value;
        const paymentDate = document.getElementById('rent-payment-date').value;
        const ownerCredited = document.querySelector('input[name="rent-owner-credited"]:checked').value;
        const paymentMode = document.getElementById('rent-payment-mode').value;
        const notes = document.getElementById('rent-notes').value;

        if (!amount || isNaN(amount) || amount <= 0) {
            alert('Please enter a valid rent amount.');
            return;
        }

        const creditDestination = document.querySelector('input[name="rent-credit-destination"]:checked')?.value || 'wallet';
        let bankName = '';
        let bankReference = '';

        if (creditDestination === 'bank') {
            bankName = document.getElementById('rent-bank-name')?.value || 'Bank Account';
            if (bankName === 'Other') {
                bankName = document.getElementById('rent-custom-bank')?.value.trim() || 'Bank Account';
            }
            bankReference = document.getElementById('rent-bank-ref')?.value.trim() || '';
        }

        let tenantId = selectVal;
        let tenantName = '';
        let tenantFlat = '';
        let tenantPhone = '';
        let tenantFloor = 1;

        if (selectVal === 'NEW_TENANT') {
            const newName = document.getElementById('new-t-name').value.trim();
            const newFloor = parseInt(document.getElementById('new-t-floor').value) || 1;
            const newFlat = document.getElementById('new-t-flat').value.trim();
            const newPhone = document.getElementById('new-t-phone').value.trim();
            const newOcc = document.getElementById('new-t-occupation').value.trim();
            const newAdvance = parseFloat(document.getElementById('new-t-advance').value) || 0;

            if (!newName || !newFlat) {
                alert('Please enter tenant name and flat number.');
                return;
            }

            tenantId = 't_' + Date.now();
            const ownerInfo = this.getFloorOwner(newFloor);

            const newTenantObj = {
                id: tenantId,
                name: newName,
                floor: newFloor,
                flat: newFlat,
                ownerId: ownerInfo.id,
                phone: newPhone,
                occupation: newOcc,
                advanceDeposit: newAdvance,
                advancePaidDate: paymentDate,
                advanceRefunded: 0,
                advanceDeductions: 0,
                status: 'active',
                monthlyRent: amount,
                moveInDate: paymentDate,
                notes: 'Created via Rent Collection'
            };

            this.data.tenants.push(newTenantObj);
            tenantName = newName;
            tenantFlat = newFlat;
            tenantPhone = newPhone;
            tenantFloor = newFloor;
        } else {
            const existing = this.data.tenants.find(t => t.id === tenantId);
            if (existing) {
                tenantName = existing.name;
                tenantFlat = existing.flat;
                tenantPhone = existing.phone;
                tenantFloor = parseInt(existing.floor) || this.detectFloorFromFlat(existing.flat);
            }
        }

        const newRentRecord = {
            id: 'rent_' + Date.now(),
            tenantId,
            tenantName,
            flat: tenantFlat,
            floor: tenantFloor,
            phone: tenantPhone,
            amount,
            month,
            paymentDate,
            ownerCredited,
            paymentMode,
            creditDestination,
            bankName,
            bankReference,
            notes
        };

        this.data.rentCollections.push(newRentRecord);
        StorageManager.saveData(this.data);
        if (typeof CloudSyncManager !== 'undefined' && CloudSyncManager.isEnabled()) {
            CloudSyncManager.pushLocalDataToCloud(this.data);
        }
        ActivityLogger.log('rent', `Rent Collected: ₹${amount.toLocaleString('en-IN')}`, `${tenantName || 'Tenant'} (${tenantFlat}) • Month: ${month}`);
        this.hideModal('modal-collect-rent');

        // Make sure newly recorded past month is not hidden by active filter
        if (this.selectedMonthFilter !== 'all' && this.selectedMonthFilter !== month) {
            this.selectedMonthFilter = 'all';
            const filterEl = document.getElementById('global-month-filter');
            if (filterEl) filterEl.value = 'all';
        }
        this.populateMonthFilter();
        this.renderAll();

        if (typeof confetti === 'function') {
            confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
        }

        this.showRentReceipt(newRentRecord.id);
        const destDesc = (creditDestination === 'bank') ? `Owner Bank Account (${bankName})` : `${ownerCredited === 'sajida' ? 'Sajida' : 'Jeelani'}'s Liquid Wallet`;
        this.showToast(`Rent of ₹${amount.toLocaleString('en-IN')} for month "${month}" credited to ${destDesc}!`);
    },

    deleteRentCollection(id) {
        if (!confirm('Are you sure you want to delete this rent collection record?')) return;
        this.data.rentCollections = this.data.rentCollections.filter(r => r.id !== id);
        StorageManager.saveData(this.data);
        if (typeof CloudSyncManager !== 'undefined' && CloudSyncManager.isEnabled()) {
            CloudSyncManager.pushLocalDataToCloud(this.data);
        }
        ActivityLogger.log('rent', 'Rent Record Deleted', `Deleted rent collection entry ID: ${id}`);
        this.renderAll();
        this.showToast('Rent record removed.');
    },

    // --- Rent Receipt Viewer ---
    showRentReceipt(rentId) {
        const rent = this.data.rentCollections.find(r => r.id === rentId);
        if (!rent) return;

        const tenant = this.data.tenants.find(t => t.id === rent.tenantId) || {};
        const floor = rent.floor || (tenant ? tenant.floor : 1);

        this.setElementText('receipt-building-name', this.data.buildingName);
        this.setElementText('receipt-no', `MHR-${rent.id.slice(-6).toUpperCase()}`);
        this.setElementText('receipt-date', rent.paymentDate);
        this.setElementText('receipt-month', rent.month);
        this.setElementText('receipt-tenant-name', rent.tenantName);
        this.setElementText('receipt-tenant-flat', `${rent.flat} (${floor} Floor)`);
        this.setElementText('receipt-tenant-phone', rent.phone || tenant.phone || 'N/A');
        this.setElementText('receipt-amount', `₹${parseFloat(rent.amount).toLocaleString('en-IN')}`);
        this.setElementText('receipt-mode', rent.paymentMode || 'Cash');
        
        let creditedDesc = "Split 60:40 between Jeelani (60%) & Sajida (40%)";
        if (rent.ownerCredited === 'sajida') creditedDesc = "Sajida's Account (Floors 1 & 2)";
        else if (rent.ownerCredited === 'jeelani') creditedDesc = "Jeelani's Account (Floors 3, 4 & 5)";

        if (rent.creditDestination === 'bank') {
            creditedDesc += ` • Credited directly to Bank Account (${rent.bankName || 'Bank'}${rent.bankReference ? ' - Ref: ' + rent.bankReference : ''})`;
        } else {
            creditedDesc += ` • Credited to Owner Liquid Wallet`;
        }

        this.setElementText('receipt-owner-credited', creditedDesc);

        const advDep = parseFloat(tenant.advanceDeposit) || 0;
        const advRef = parseFloat(tenant.advanceRefunded) || 0;
        const advDed = parseFloat(tenant.advanceDeductions) || 0;
        const advHeld = Math.max(0, advDep - advRef - advDed);
        this.setElementText('receipt-advance-held', `₹${advHeld.toLocaleString('en-IN')}`);

        const waMsg = encodeURIComponent(
            `*RENT RECEIPT - MEERA HEIGHTS*\n` +
            `Receipt No: MHR-${rent.id.slice(-6).toUpperCase()}\n` +
            `Date: ${rent.paymentDate}\n` +
            `Tenant: ${rent.tenantName} (${rent.flat} - ${floor} Floor)\n` +
            `Month: ${rent.month}\n` +
            `Amount Paid: ₹${rent.amount}\n` +
            `Payment Mode: ${rent.paymentMode}\n` +
            `Credited To: ${creditedDesc}\n` +
            `Security Advance on Record: ₹${advHeld.toLocaleString('en-IN')}\n\n` +
            `Thank you for the prompt payment!`
        );
        const waBtn = document.getElementById('receipt-whatsapp-share');
        if (waBtn) {
            waBtn.href = `https://wa.me/91${rent.phone || tenant.phone}?text=${waMsg}`;
        }

        this.showModal('modal-rent-receipt');
    },

    // --- Add/Edit Expense Modal ---
    // --- Add/Edit Expense Modal ---
    openExpenseModal(editId = null) {
        this.populateExpenseCategoriesDropdown();
        this.editingExpenseId = editId;

        const dateInput = document.getElementById('exp-date');
        if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
        const floorSelect = document.getElementById('exp-target-floor');

        if (editId) {
            const exp = this.data.expenses.find(e => e.id === editId);
            if (exp) {
                document.getElementById('exp-modal-title').textContent = 'Edit Building Expense';
                document.getElementById('exp-title').value = exp.title;
                document.getElementById('exp-amount').value = exp.amount;
                document.getElementById('exp-category').value = exp.categoryId;
                this.onExpenseCategoryChanged(exp.categoryId, exp.subCategory);
                document.getElementById('exp-date').value = exp.date;
                document.getElementById('exp-notes').value = exp.notes || '';
                if (floorSelect) floorSelect.value = exp.targetFloor || 'all';
                
                const radio = document.querySelector(`input[name="exp-split-type"][value="${exp.splitType}"]`);
                if (radio) radio.checked = true;
                this.onExpenseSplitTypeChanged(exp.splitType);

                if (exp.splitType === 'custom') {
                    document.getElementById('exp-sajida-pct').value = exp.sajidaRatio;
                    document.getElementById('exp-jeelani-pct').value = exp.jeelaniRatio;
                }
            }
        } else {
            document.getElementById('exp-modal-title').textContent = 'Add Building Expense';
            document.getElementById('exp-title').value = '';
            document.getElementById('exp-amount').value = '';
            document.getElementById('exp-notes').value = '';
            const defCat = this.data.categories[0]?.id || 'cat_maintenance';
            const catSelect = document.getElementById('exp-category');
            if (catSelect) catSelect.value = defCat;
            this.onExpenseCategoryChanged(defCat);
            document.getElementById('exp-sajida-pct').value = 40;
            document.getElementById('exp-jeelani-pct').value = 60;
            if (floorSelect) floorSelect.value = 'all';
            const sajidaLabel = document.getElementById('sajida-pct-label');
            if (sajidaLabel) sajidaLabel.textContent = '40';
            const defRadio = document.querySelector('input[name="exp-split-type"][value="ratio"]');
            if (defRadio) defRadio.checked = true;
            this.onExpenseSplitTypeChanged('ratio');
        }

        this.updateExpenseSplitPreview();
        this.showModal('modal-add-expense');
    },

    populateExpenseCategoriesDropdown() {
        const select = document.getElementById('exp-category');
        if (!select) return;

        let html = '';
        this.data.categories.forEach(cat => {
            html += `<option value="${cat.id}">${this.escapeHtml(cat.name)}</option>`;
        });
        select.innerHTML = html;
    },

    onExpenseCategoryChanged(categoryId, preselectedSub = null) {
        const subSelect = document.getElementById('exp-subcategory');
        if (!subSelect) return;

        const cat = this.data.categories.find(c => c.id === categoryId);
        let subcategories = [];
        if (cat && Array.isArray(cat.subcategories) && cat.subcategories.length > 0) {
            subcategories = [...cat.subcategories];
        } else if (typeof DEFAULT_CATEGORY_SUBCATEGORIES !== 'undefined' && DEFAULT_CATEGORY_SUBCATEGORIES[categoryId]) {
            subcategories = [...DEFAULT_CATEGORY_SUBCATEGORIES[categoryId]];
        } else {
            subcategories = ['General Maintenance', 'Service Repairs', 'Consumables & Parts', 'Emergency Fixes'];
        }

        let html = '';
        subcategories.forEach(sub => {
            html += `<option value="${this.escapeHtml(sub)}">${this.escapeHtml(sub)}</option>`;
        });
        html += `<option value="__custom__">+ Add Custom Subcategory...</option>`;
        subSelect.innerHTML = html;

        const customBox = document.getElementById('exp-custom-subcategory-box');
        const customInput = document.getElementById('exp-custom-subcategory');

        if (preselectedSub) {
            const exists = subcategories.includes(preselectedSub);
            if (exists) {
                subSelect.value = preselectedSub;
                if (customBox) customBox.classList.add('hidden');
                if (customInput) customInput.value = '';
            } else {
                subSelect.value = '__custom__';
                if (customBox) customBox.classList.remove('hidden');
                if (customInput) customInput.value = preselectedSub;
            }
        } else {
            if (subcategories.length > 0) {
                subSelect.value = subcategories[0];
            }
            if (customBox) customBox.classList.add('hidden');
            if (customInput) customInput.value = '';
        }
    },

    onExpenseSubcategoryChanged(val) {
        const customBox = document.getElementById('exp-custom-subcategory-box');
        const customInput = document.getElementById('exp-custom-subcategory');
        if (val === '__custom__') {
            if (customBox) customBox.classList.remove('hidden');
            if (customInput) {
                customInput.focus();
                customInput.required = true;
            }
        } else {
            if (customBox) customBox.classList.add('hidden');
            if (customInput) {
                customInput.required = false;
                customInput.value = '';
            }
        }
    },

    onExpenseTargetFloorChanged(val) {
        if (val === '1' || val === '2' || val === 'sajida_floors') {
            const rad = document.querySelector('input[name="exp-split-type"][value="sajida_only"]');
            if (rad) { rad.checked = true; this.onExpenseSplitTypeChanged('sajida_only'); }
        } else if (val === '3' || val === '4' || val === '5' || val === 'jeelani_floors') {
            const rad = document.querySelector('input[name="exp-split-type"][value="jeelani_only"]');
            if (rad) { rad.checked = true; this.onExpenseSplitTypeChanged('jeelani_only'); }
        } else if (val === 'all') {
            const rad = document.querySelector('input[name="exp-split-type"][value="ratio"]');
            if (rad) { rad.checked = true; this.onExpenseSplitTypeChanged('ratio'); }
        }
    },

    onExpenseSplitTypeChanged(val) {
        const customBox = document.getElementById('custom-ratio-controls');
        if (customBox) {
            customBox.classList.toggle('hidden', val !== 'custom');
        }
        this.updateExpenseSplitPreview();
    },

    updateExpenseSplitPreview() {
        const amt = parseFloat(document.getElementById('exp-amount').value) || 0;
        const splitType = (document.querySelector('input[name="exp-split-type"]:checked') || {}).value || 'ratio';

        let sajidaAmt = 0;
        let jeelaniAmt = 0;

        if (splitType === 'sajida_only') {
            sajidaAmt = amt;
            jeelaniAmt = 0;
        } else if (splitType === 'jeelani_only') {
            sajidaAmt = 0;
            jeelaniAmt = amt;
        } else if (splitType === 'custom') {
            const sajidaPct = parseFloat(document.getElementById('exp-sajida-pct').value) || 40;
            const jeelaniPct = 100 - sajidaPct;
            document.getElementById('exp-jeelani-pct').value = jeelaniPct;
            sajidaAmt = Math.round((amt * sajidaPct) / 100);
            jeelaniAmt = amt - sajidaAmt;
        } else {
            // Default 60:40 Floor Ratio: Sajida 40% (Floors 1-2), Jeelani 60% (Floors 3-5)
            sajidaAmt = Math.round((amt * 40) / 100);
            jeelaniAmt = amt - sajidaAmt;
        }

        this.setElementText('preview-sajida-share', `₹${sajidaAmt.toLocaleString('en-IN')}`);
        this.setElementText('preview-jeelani-share', `₹${jeelaniAmt.toLocaleString('en-IN')}`);
    },

    saveExpense(e) {
        e.preventDefault();

        const title = document.getElementById('exp-title').value.trim();
        const amount = parseFloat(document.getElementById('exp-amount').value);
        const categoryId = document.getElementById('exp-category').value;
        const date = document.getElementById('exp-date').value;
        const notes = document.getElementById('exp-notes').value;
        const splitType = document.querySelector('input[name="exp-split-type"]:checked').value;
        const targetFloor = document.getElementById('exp-target-floor')?.value || 'all';

        const subCategoryVal = document.getElementById('exp-subcategory')?.value || '';
        let finalSubCategory = subCategoryVal;
        if (subCategoryVal === '__custom__') {
            const customInputVal = document.getElementById('exp-custom-subcategory')?.value.trim();
            if (!customInputVal) {
                alert('Please enter a name for the custom subcategory.');
                return;
            }
            finalSubCategory = customInputVal;

            // Dynamically register custom subcategory into category object
            const catObj = this.data.categories.find(c => c.id === categoryId);
            if (catObj) {
                if (!Array.isArray(catObj.subcategories)) {
                    catObj.subcategories = (typeof DEFAULT_CATEGORY_SUBCATEGORIES !== 'undefined' && DEFAULT_CATEGORY_SUBCATEGORIES[categoryId])
                        ? [...DEFAULT_CATEGORY_SUBCATEGORIES[categoryId]]
                        : [];
                }
                if (!catObj.subcategories.includes(finalSubCategory)) {
                    catObj.subcategories.push(finalSubCategory);
                }
            }
        }
        if (!finalSubCategory) finalSubCategory = 'General';

        if (!title || isNaN(amount) || amount <= 0) {
            alert('Please enter a valid expense title and amount.');
            return;
        }

        let sajidaRatio = 40;
        let jeelaniRatio = 60;
        let sajidaAmount = Math.round((amount * 40) / 100);
        let jeelaniAmount = amount - sajidaAmount;
        let debitedWallet = 'both';
        let paidBy = 'Wallet Split (60:40 Floor Ratio)';

        if (splitType === 'sajida_only') {
            sajidaRatio = 100;
            jeelaniRatio = 0;
            sajidaAmount = amount;
            jeelaniAmount = 0;
            debitedWallet = 'sajida';
            paidBy = '100% Sajida (Floors 1-2)';
        } else if (splitType === 'jeelani_only') {
            sajidaRatio = 0;
            jeelaniRatio = 100;
            sajidaAmount = 0;
            jeelaniAmount = amount;
            debitedWallet = 'jeelani';
            paidBy = '100% Jeelani (Floors 3-5)';
        } else if (splitType === 'custom') {
            sajidaRatio = parseFloat(document.getElementById('exp-sajida-pct').value) || 40;
            jeelaniRatio = 100 - sajidaRatio;
            sajidaAmount = Math.round((amount * sajidaRatio) / 100);
            jeelaniAmount = amount - sajidaAmount;
            debitedWallet = 'both';
            paidBy = `Custom Split (${sajidaRatio}% : ${jeelaniRatio}%)`;
        }

        const mKey = date ? date.slice(0, 7) : this.getCurrentMonthKey();

        if (this.editingExpenseId) {
            const idx = this.data.expenses.findIndex(e => e.id === this.editingExpenseId);
            if (idx >= 0) {
                this.data.expenses[idx] = {
                    ...this.data.expenses[idx],
                    title,
                    categoryId,
                    subCategory: finalSubCategory,
                    amount,
                    date,
                    monthKey: mKey,
                    targetFloor,
                    splitType,
                    sajidaRatio,
                    jeelaniRatio,
                    sajidaAmount,
                    jeelaniAmount,
                    debitedWallet,
                    debitedSource: 'advance',
                    paidBy,
                    notes
                };
            }
        } else {
            const newExp = {
                id: 'exp_' + Date.now(),
                title,
                categoryId,
                subCategory: finalSubCategory,
                amount,
                date,
                monthKey: mKey,
                targetFloor,
                splitType,
                sajidaRatio,
                jeelaniRatio,
                sajidaAmount,
                jeelaniAmount,
                debitedWallet,
                debitedSource: 'advance',
                paidBy,
                notes
            };
            this.data.expenses.push(newExp);
        }

        StorageManager.saveData(this.data);
        if (typeof CloudSyncManager !== 'undefined' && CloudSyncManager.isEnabled()) {
            CloudSyncManager.pushLocalDataToCloud(this.data);
        }
        ActivityLogger.log('expense', `Expense: ₹${amount.toLocaleString('en-IN')}`, `${title} (${paidBy}) • ${date}`);
        this.hideModal('modal-add-expense');
        this.renderAll();
        this.showToast(`Expense of ₹${amount.toLocaleString('en-IN')} debited successfully!`);
    },

    editExpense(id) {
        this.openExpenseModal(id);
    },

    deleteExpense(id) {
        if (!confirm('Are you sure you want to delete this expense record?')) return;
        const expToDelete = this.data.expenses.find(e => e.id === id);
        this.data.expenses = this.data.expenses.filter(e => e.id !== id);
        StorageManager.saveData(this.data);
        if (typeof CloudSyncManager !== 'undefined' && CloudSyncManager.isEnabled()) {
            CloudSyncManager.pushLocalDataToCloud(this.data);
        }
        ActivityLogger.log('expense', 'Expense Deleted', `Removed expense: ${expToDelete ? expToDelete.title : id}`);
        this.renderAll();
        this.showToast('Expense entry removed.');
    },

    // --- Dynamic Category Modal ---
    openAddCategoryModal() {
        document.getElementById('new-cat-name').value = '';
        document.getElementById('new-cat-desc').value = '';
        this.showModal('modal-add-category');
    },

    saveCategory(e) {
        e.preventDefault();
        const name = document.getElementById('new-cat-name').value.trim();
        const icon = document.getElementById('new-cat-icon').value || 'fa-tag';
        const color = document.getElementById('new-cat-color').value || '#10B981';
        const desc = document.getElementById('new-cat-desc').value.trim();

        if (!name) {
            alert('Please enter a category name.');
            return;
        }

        const newCat = {
            id: 'cat_' + Date.now(),
            name,
            icon,
            color,
            desc,
            isDefault: false
        };

        this.data.categories.push(newCat);
        StorageManager.saveData(this.data);
        ActivityLogger.log('expense', `Category Created: ${name}`, `New expense category added.`);
        this.hideModal('modal-add-category');
        this.renderAll();
        this.showToast(`New sheet/category "${name}" created!`);
    },

    deleteCategory(id) {
        const cat = this.data.categories.find(c => c.id === id);
        if (!cat) return;

        const count = this.data.expenses.filter(e => e.categoryId === id).length;
        if (count > 0) {
            if (!confirm(`This category has ${count} expenses linked to it. Deleting will reassign them to General Expenditure. Continue?`)) {
                return;
            }
            this.data.expenses.forEach(e => {
                if (e.categoryId === id) e.categoryId = 'cat_expenditure';
            });
        } else {
            if (!confirm(`Are you sure you want to delete the "${cat.name}" category?`)) return;
        }

        this.data.categories = this.data.categories.filter(c => c.id !== id);
        StorageManager.saveData(this.data);
        ActivityLogger.log('expense', `Category Deleted: ${cat.name}`, `Expense category removed.`);
        if (this.expenseCategoryFilter === id) {
            this.expenseCategoryFilter = 'all';
            this.expenseFilters.categoryId = 'all';
            this.expenseFilters.subCategory = 'all';
        }
        this.renderAll();
        this.showToast(`Category "${cat.name}" deleted.`);
    },

    // --- Capital Adjustment Modal ---
    openCapitalModal(editId = null) {
        this.editingCapitalId = editId;
        if (editId) {
            const adj = (this.data.walletAdjustments || []).find(a => a.id === editId);
            if (adj) {
                document.getElementById('cap-owner').value = adj.ownerId;
                document.getElementById('cap-type').value = adj.type;
                document.getElementById('cap-amount').value = adj.amount;
                document.getElementById('cap-date').value = adj.date;
                document.getElementById('cap-notes').value = adj.notes || '';
            }
        } else {
            document.getElementById('cap-amount').value = '';
            document.getElementById('cap-date').value = new Date().toISOString().slice(0, 10);
            document.getElementById('cap-notes').value = '';
        }
        this.showModal('modal-add-capital');
    },

    editCapitalAdjustment(id) {
        this.openCapitalModal(id);
    },

    deleteCapitalAdjustment(id) {
        if (!confirm('Delete this capital transaction?')) return;
        const targetAdj = (this.data.walletAdjustments || []).find(a => a.id === id);
        this.data.walletAdjustments = (this.data.walletAdjustments || []).filter(a => a.id !== id);
        StorageManager.saveData(this.data);
        const ownerName = targetAdj?.ownerId === 'sajida' ? 'Sajida' : (targetAdj?.ownerId === 'jeelani' ? 'Jeelani' : 'Building');
        const adjAmt = targetAdj ? parseFloat(targetAdj.amount) || 0 : 0;
        ActivityLogger.log('rent', `Capital Adjustment Deleted: ₹${adjAmt.toLocaleString('en-IN')}`, `${ownerName} • ${targetAdj?.type || 'Adjustment'}`);
        this.renderAll();
        this.showToast('Capital transaction removed.');
    },

    saveCapitalAdjustment(e) {
        e.preventDefault();
        const ownerId = document.getElementById('cap-owner').value;
        const type = document.getElementById('cap-type').value;
        const amount = parseFloat(document.getElementById('cap-amount').value);
        const date = document.getElementById('cap-date').value;
        const notes = document.getElementById('cap-notes').value.trim();

        if (isNaN(amount) || amount <= 0) {
            alert('Please enter a valid amount.');
            return;
        }

        if (!this.data.walletAdjustments) this.data.walletAdjustments = [];

        if (this.editingCapitalId) {
            const idx = this.data.walletAdjustments.findIndex(a => a.id === this.editingCapitalId);
            if (idx >= 0) {
                this.data.walletAdjustments[idx] = {
                    ...this.data.walletAdjustments[idx],
                    ownerId,
                    type,
                    amount,
                    date,
                    notes
                };
            }
        } else {
            this.data.walletAdjustments.push({
                id: 'adj_' + Date.now(),
                ownerId,
                amount,
                type,
                date,
                notes
            });
        }

        StorageManager.saveData(this.data);
        const ownerName = ownerId === 'sajida' ? 'Sajida' : (ownerId === 'jeelani' ? 'Jeelani' : 'Building');
        ActivityLogger.log('rent', `Capital ${type === 'injection' ? 'Infusion' : 'Draw'}: ₹${amount.toLocaleString('en-IN')}`, `${ownerName} • ${date}${notes ? ' • ' + notes : ''}`);
        this.hideModal('modal-add-capital');
        this.renderAll();
        this.showToast(`Capital ${type} of ₹${amount.toLocaleString('en-IN')} saved.`);
    },

    // -------------------------------------------------------------
    // WALLET ⇄ BANK TRANSACTION METHODS (DEPOSITS & WITHDRAWALS)
    // -------------------------------------------------------------
    updateBankFloorOptions(ownerId, selectedFloor = null) {
        const floorSelect = document.getElementById('bank-tx-floor');
        if (!floorSelect) return;

        const currentVal = selectedFloor !== null ? selectedFloor : (floorSelect.value || 'all');

        let html = '';
        if (ownerId === 'sajida') {
            html += `<option value="all">Proportional to Rent Collected (or Split 50:50 if ₹0 rent)</option>`;
            html += `<option value="1">1st Floor only (Sajida)</option>`;
            html += `<option value="2">2nd Floor only (Sajida)</option>`;
            html += `<option value="split_all">Split across each floor (½ for Floor 1 + ½ for Floor 2)</option>`;
        } else {
            html += `<option value="all">Proportional to Rent Collected (or Split 1/3 each if ₹0 rent)</option>`;
            html += `<option value="3">3rd Floor only (Jeelani)</option>`;
            html += `<option value="4">4th Floor only (Jeelani)</option>`;
            html += `<option value="5">5th Floor only (Jeelani)</option>`;
            html += `<option value="split_all">Split across each floor (1/3 each into separate entries)</option>`;
        }
        floorSelect.innerHTML = html;

        let hasOption = false;
        for (let i = 0; i < floorSelect.options.length; i++) {
            if (floorSelect.options[i].value === String(currentVal)) {
                hasOption = true;
                break;
            }
        }

        if (hasOption) {
            floorSelect.value = String(currentVal);
        } else {
            floorSelect.value = 'all';
        }
        this.onBankFloorChanged();
    },

    onBankWalletChanged() {
        const walletId = document.getElementById('bank-tx-wallet')?.value || 'sajida_advance';
        const wInfo = this.getWalletInfo(walletId);
        const balEl = document.getElementById('bank-tx-wallet-balance');
        const bal = this.getWalletBalance(walletId);
        if (balEl) balEl.textContent = `₹${bal.toLocaleString('en-IN')}`;

        const ownerSelect = document.getElementById('bank-tx-owner');
        if (ownerSelect) ownerSelect.value = wInfo.ownerId;

        const currentFloor = document.getElementById('bank-tx-floor')?.value || 'all';
        this.updateBankFloorOptions(wInfo.ownerId, currentFloor);
        this.updateBankTransferPreview();
    },

    onBankOwnerChanged() {
        const ownerId = document.getElementById('bank-tx-owner')?.value || 'sajida';
        const currentFloor = document.getElementById('bank-tx-floor')?.value || 'all';
        this.updateBankFloorOptions(ownerId, currentFloor);
        this.updateBankTransferPreview();
    },

    onBankFloorChanged() {
        const floorVal = document.getElementById('bank-tx-floor')?.value || 'all';
        const badge = document.getElementById('bank-tx-floor-badge');
        const hint = document.getElementById('bank-tx-floor-hint');

        if (floorVal === 'split_all') {
            if (badge) {
                badge.className = 'text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded';
                badge.textContent = 'Split entries';
            }
            if (hint) hint.textContent = 'Will create separate entries for each owned floor with equal split amounts.';
        } else if (floorVal === 'all') {
            if (badge) {
                badge.className = 'text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded';
                badge.textContent = 'Proportional Allocation';
            }
            if (hint) hint.textContent = 'Allocates to floors in proportion to their rent collected (or equal split if ₹0 rent).';
        } else {
            if (badge) {
                badge.className = 'text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded';
                badge.textContent = `Floor ${floorVal} only`;
            }
            if (hint) hint.textContent = `100% of this bank transfer will be attributed directly to Floor ${floorVal}.`;
        }
        this.updateBankTransferPreview();
    },

    openBankTransferModal(editId = null, defaultWallet = null, defaultType = 'wallet_to_bank') {
        // Handle when called with a walletId as first argument (e.g. from index.html: openBankTransferModal('jeelani_rent'))
        if (typeof editId === 'string' && (editId.includes('_rent') || editId.includes('_advance') || (typeof WALLET_DEFINITIONS !== 'undefined' && editId in WALLET_DEFINITIONS))) {
            defaultWallet = editId;
            editId = null;
        }

        this.editingBankTransferId = editId;

        const dirW2b = document.getElementById('bank-dir-w2b');
        const dirB2w = document.getElementById('bank-dir-b2w');
        const walletSelect = document.getElementById('bank-tx-wallet');
        const ownerSelect = document.getElementById('bank-tx-owner');
        const dateInput = document.getElementById('bank-tx-date');
        const amountInput = document.getElementById('bank-tx-amount');
        const bankNameSelect = document.getElementById('bank-tx-bank-name');
        const customBankInput = document.getElementById('bank-tx-custom-bank');
        const modeSelect = document.getElementById('bank-tx-mode');
        const refInput = document.getElementById('bank-tx-reference');
        const notesInput = document.getElementById('bank-tx-notes');
        const titleEl = document.getElementById('bank-modal-title');

        if (editId) {
            const tx = (this.data.bankTransactions || []).find(t => t.id === editId);
            if (tx) {
                if (titleEl) titleEl.textContent = 'Edit Wallet ⇄ Bank Transaction';
                if (tx.type === 'bank_to_wallet') {
                    if (dirB2w) dirB2w.checked = true;
                } else {
                    if (dirW2b) dirW2b.checked = true;
                }

                let targetWallet = tx.walletId;
                if (!targetWallet) {
                    targetWallet = (tx.ownerId === 'sajida') ? 'sajida_rent' : 'jeelani_rent';
                }
                if (walletSelect) walletSelect.value = targetWallet;
                if (ownerSelect) ownerSelect.value = tx.ownerId || 'sajida';

                if (dateInput) dateInput.value = tx.date || new Date().toISOString().slice(0, 10);
                if (amountInput) amountInput.value = tx.amount || '';

                this.updateBankFloorOptions(tx.ownerId || 'sajida', tx.floorCode || 'all');

                let hasOpt = false;
                if (bankNameSelect) {
                    for (let i = 0; i < bankNameSelect.options.length; i++) {
                        if (bankNameSelect.options[i].value === tx.bankName) {
                            hasOpt = true;
                            break;
                        }
                    }
                    if (hasOpt) {
                        bankNameSelect.value = tx.bankName;
                        if (customBankInput) {
                            customBankInput.classList.add('hidden');
                            customBankInput.value = '';
                        }
                    } else {
                        bankNameSelect.value = 'Other';
                        if (customBankInput) {
                            customBankInput.classList.remove('hidden');
                            customBankInput.value = tx.bankName || '';
                        }
                    }
                }

                if (modeSelect) modeSelect.value = tx.transferMode || 'UPI / GPay / PhonePe';
                if (refInput) refInput.value = tx.reference || '';
                if (notesInput) notesInput.value = tx.notes || '';
            }
        } else {
            if (titleEl) titleEl.textContent = 'Wallet ⇄ Bank Transaction';
            if (defaultType === 'bank_to_wallet') {
                if (dirB2w) dirB2w.checked = true;
            } else {
                if (dirW2b) dirW2b.checked = true;
            }

            let chosenWallet = defaultWallet;
            if (!chosenWallet) {
                if (this.walletOwnerFilter === 'sajida') chosenWallet = 'sajida_rent';
                else if (this.walletOwnerFilter === 'jeelani') chosenWallet = 'jeelani_rent';
                else if (typeof WALLET_DEFINITIONS !== 'undefined' && this.walletOwnerFilter in WALLET_DEFINITIONS) chosenWallet = this.walletOwnerFilter;
                else chosenWallet = 'sajida_advance';
            }

            if (walletSelect) walletSelect.value = chosenWallet;
            const wInfo = this.getWalletInfo(chosenWallet);
            if (ownerSelect) ownerSelect.value = wInfo.ownerId;

            if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
            if (amountInput) amountInput.value = '';

            let defaultFloor = 'all';
            if (this.currentPage === 'floor-breakup' && this.activeFloorFilter && this.activeFloorFilter !== 'all') {
                const flNum = parseInt(this.activeFloorFilter);
                const ownerFloors = (wInfo.ownerId === 'sajida') ? [1, 2] : [3, 4, 5];
                if (ownerFloors.includes(flNum)) {
                    defaultFloor = String(flNum);
                }
            }

            this.updateBankFloorOptions(wInfo.ownerId, defaultFloor);

            if (bankNameSelect) bankNameSelect.selectedIndex = 0;
            if (customBankInput) {
                customBankInput.classList.add('hidden');
                customBankInput.value = '';
            }
            if (modeSelect) modeSelect.selectedIndex = 0;
            if (refInput) refInput.value = '';
            if (notesInput) notesInput.value = '';
        }

        const currentDir = document.querySelector('input[name="bank-tx-direction"]:checked')?.value || 'wallet_to_bank';
        this.onBankTransferTypeChanged(currentDir);

        const chosenWId = walletSelect ? walletSelect.value : 'sajida_advance';
        const balEl = document.getElementById('bank-tx-wallet-balance');
        if (balEl) balEl.textContent = `₹${this.getWalletBalance(chosenWId).toLocaleString('en-IN')}`;
        this.updateBankTransferPreview();
        this.showModal('modal-bank-transfer');
    },

    onBankNameSelectChanged(val) {
        const customInput = document.getElementById('bank-tx-custom-bank');
        if (customInput) {
            customInput.classList.toggle('hidden', val !== 'Other');
            if (val === 'Other') customInput.focus();
        }
        this.updateBankTransferPreview();
    },

    onBankTransferTypeChanged(type) {
        this.updateBankTransferPreview();
    },

    updateBankTransferPreview() {
        const type = document.querySelector('input[name="bank-tx-direction"]:checked')?.value || 'wallet_to_bank';
        const walletId = document.getElementById('bank-tx-wallet')?.value || 'sajida_advance';
        const wInfo = this.getWalletInfo(walletId);
        const amount = parseFloat(document.getElementById('bank-tx-amount')?.value) || 0;
        const currentBal = this.getWalletBalance(walletId);

        const balEl = document.getElementById('bank-tx-wallet-balance');
        if (balEl) balEl.textContent = `₹${currentBal.toLocaleString('en-IN')}`;

        let bankName = document.getElementById('bank-tx-bank-name')?.value || 'Bank Account';
        if (bankName === 'Other') {
            bankName = document.getElementById('bank-tx-custom-bank')?.value.trim() || 'Custom Bank Account';
        }

        const previewBox = document.getElementById('bank-impact-preview');
        const titleEl = document.getElementById('bank-impact-action-title');
        const descEl = document.getElementById('bank-impact-desc');

        if (!previewBox || !titleEl || !descEl) return;

        if (type === 'wallet_to_bank') {
            const isOverdraw = amount > currentBal;
            const newBal = currentBal - amount;
            if (isOverdraw && amount > 0) {
                previewBox.className = 'p-3 bg-rose-50 border border-rose-300 rounded-2xl text-xs space-y-1.5';
                titleEl.className = 'text-rose-900 font-bold flex items-center gap-1.5';
                titleEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-rose-600"></i> Wallet Debit: -₹${amount.toLocaleString('en-IN')} (Exceeds Available Balance!)`;
                descEl.className = 'text-rose-700 leading-relaxed';
                descEl.innerHTML = `Will withdraw ₹${amount.toLocaleString('en-IN')} from <strong>${wInfo.name}</strong> to ${bankName}. Current balance is ₹${currentBal.toLocaleString('en-IN')} (will become <span class="font-bold text-rose-800">₹${newBal.toLocaleString('en-IN')}</span>).`;
            } else {
                previewBox.className = 'p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs space-y-1';
                titleEl.className = 'text-rose-900 font-bold';
                titleEl.textContent = `Wallet Debit: -₹${amount.toLocaleString('en-IN')}`;
                descEl.className = 'text-rose-700';
                descEl.textContent = `Will withdraw ₹${amount.toLocaleString('en-IN')} from ${wInfo.name} and transfer to ${bankName}. Remaining balance: ₹${newBal.toLocaleString('en-IN')}.`;
            }
        } else {
            const newBal = currentBal + amount;
            previewBox.className = 'p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs space-y-1';
            titleEl.className = 'text-emerald-900 font-bold';
            titleEl.textContent = `Wallet Credit: +₹${amount.toLocaleString('en-IN')}`;
            descEl.className = 'text-emerald-700';
            descEl.textContent = `Will deposit ₹${amount.toLocaleString('en-IN')} into ${wInfo.name} from ${bankName}. New balance: ₹${newBal.toLocaleString('en-IN')}.`;
        }
    },

    saveBankTransfer(e) {
        if (e && e.preventDefault) e.preventDefault();

        // Mutex guard against double submission
        if (this._isSavingBankTransfer) return;
        this._isSavingBankTransfer = true;

        try {
            const type = document.querySelector('input[name="bank-tx-direction"]:checked')?.value || 'wallet_to_bank';
            const walletId = document.getElementById('bank-tx-wallet')?.value || 'sajida_advance';
            const wInfo = this.getWalletInfo(walletId);
            const ownerId = wInfo.ownerId;
            const date = document.getElementById('bank-tx-date').value;
            const amount = parseFloat(document.getElementById('bank-tx-amount').value);
            let bankName = document.getElementById('bank-tx-bank-name').value;
            if (bankName === 'Other') {
                bankName = document.getElementById('bank-tx-custom-bank').value.trim() || 'Bank Account';
            }
            const transferMode = document.getElementById('bank-tx-mode').value;
            const reference = document.getElementById('bank-tx-reference').value.trim();
            const notes = document.getElementById('bank-tx-notes').value.trim();
            const floorChoice = document.getElementById('bank-tx-floor')?.value || 'all';

            if (isNaN(amount) || amount <= 0) {
                alert('Please enter a valid transfer amount.');
                return;
            }

            // Balance warning on withdrawal
            const currentBal = this.getWalletBalance(walletId);
            if (type === 'wallet_to_bank' && amount > currentBal) {
                const proceed = confirm(`Warning: The withdrawal amount of ₹${amount.toLocaleString('en-IN')} exceeds the available balance in ${wInfo.name} (₹${currentBal.toLocaleString('en-IN')}). Do you want to proceed?`);
                if (!proceed) return;
            }

            if (!this.data.bankTransactions) this.data.bankTransactions = [];

            if (this.editingBankTransferId) {
                let floorLabel = (ownerId === 'sajida') ? 'Floors 1 & 2' : 'Floors 3, 4 & 5';
                if (floorChoice !== 'all' && floorChoice !== 'split_all') {
                    floorLabel = `Floor ${floorChoice}`;
                }

                const idx = this.data.bankTransactions.findIndex(t => t.id === this.editingBankTransferId);
                if (idx >= 0) {
                    this.data.bankTransactions[idx] = {
                        ...this.data.bankTransactions[idx],
                        type,
                        walletId,
                        walletName: wInfo.name,
                        ownerId,
                        date,
                        amount,
                        floor: floorLabel,
                        floorCode: floorChoice,
                        bankName,
                        transferMode,
                        reference,
                        notes
                    };
                }
            } else {
                if (floorChoice === 'split_all') {
                    if (ownerId === 'sajida') {
                        const splitAmt = Math.round(amount / 2);
                        const amt1 = splitAmt;
                        const amt2 = amount - splitAmt;
                        this.data.bankTransactions.push({
                            id: 'btx_' + Date.now() + '_fl1',
                            type,
                            walletId,
                            walletName: wInfo.name,
                            ownerId,
                            date,
                            amount: amt1,
                            floor: 'Floor 1',
                            floorCode: '1',
                            bankName,
                            transferMode,
                            reference,
                            notes: notes ? `${notes} (Floor 1 Share)` : 'Floor 1 Share'
                        });
                        this.data.bankTransactions.push({
                            id: 'btx_' + (Date.now() + 1) + '_fl2',
                            type,
                            walletId,
                            walletName: wInfo.name,
                            ownerId,
                            date,
                            amount: amt2,
                            floor: 'Floor 2',
                            floorCode: '2',
                            bankName,
                            transferMode,
                            reference,
                            notes: notes ? `${notes} (Floor 2 Share)` : 'Floor 2 Share'
                        });
                    } else {
                        const splitAmt = Math.round(amount / 3);
                        let rem = amount;
                        [3, 4, 5].forEach((fl, idx) => {
                            const cur = (idx === 2) ? rem : splitAmt;
                            rem -= cur;
                            this.data.bankTransactions.push({
                                id: 'btx_' + (Date.now() + idx) + `_fl${fl}`,
                                type,
                                walletId,
                                walletName: wInfo.name,
                                ownerId,
                                date,
                                amount: cur,
                                floor: `Floor ${fl}`,
                                floorCode: String(fl),
                                bankName,
                                transferMode,
                                reference,
                                notes: notes ? `${notes} (Floor ${fl} Share)` : `Floor ${fl} Share`
                            });
                        });
                    }
                } else {
                    let floorLabel = (ownerId === 'sajida') ? 'Floors 1 & 2' : 'Floors 3, 4 & 5';
                    if (floorChoice !== 'all') {
                        floorLabel = `Floor ${floorChoice}`;
                    }
                    this.data.bankTransactions.push({
                        id: 'btx_' + Date.now(),
                        type,
                        walletId,
                        walletName: wInfo.name,
                        ownerId,
                        date,
                        amount,
                        floor: floorLabel,
                        floorCode: floorChoice,
                        bankName,
                        transferMode,
                        reference,
                        notes
                    });
                }
            }

            StorageManager.saveData(this.data);
            this.hideModal('modal-bank-transfer');
            this.renderAll();

            const actionText = (type === 'wallet_to_bank') ? 'transferred to bank' : 'deposited into wallet';
            ActivityLogger.log('rent', `Bank Transfer: ₹${amount.toLocaleString('en-IN')}`, `${wInfo.name} (${actionText} - ${bankName})`);
            this.showToast(`₹${amount.toLocaleString('en-IN')} successfully ${actionText} for ${wInfo.shortName}!`, 'success');
        } finally {
            this._isSavingBankTransfer = false;
        }
    },

    deleteBankTransfer(id) {
        const tx = (this.data.bankTransactions || []).find(t => t.id === id);
        if (!tx) return;

        const isWalletToBank = (tx.type === 'wallet_to_bank');
        const targetWallet = tx.walletId || (tx.ownerId === 'sajida' ? 'sajida_rent' : 'jeelani_rent');
        const wInfo = this.getWalletInfo(targetWallet);

        const msg = isWalletToBank 
            ? `Delete this transfer of ₹${tx.amount.toLocaleString('en-IN')} to ${tx.bankName}?\n\n₹${tx.amount.toLocaleString('en-IN')} will be refunded back to ${wInfo.name}.`
            : `Delete this deposit of ₹${tx.amount.toLocaleString('en-IN')} from ${tx.bankName}?\n\n₹${tx.amount.toLocaleString('en-IN')} will be deducted from ${wInfo.name}.`;

        if (!confirm(msg)) return;

        this.data.bankTransactions = (this.data.bankTransactions || []).filter(t => t.id !== id);
        ActivityLogger.log('rent', `Bank Transfer Deleted: ₹${tx.amount.toLocaleString('en-IN')}`, `${tx.bankName} (${wInfo.name})`);
        StorageManager.saveData(this.data);
        this.renderAll();
        this.showToast(`Bank transaction removed. ${wInfo.shortName} updated.`);
    },

    // -------------------------------------------------------------
    // ADVANCE ⇄ RENT INTERNAL WALLET TRANSFERS
    // -------------------------------------------------------------
    openWalletTransferModal(fromWallet = null, toWallet = null, editId = null) {
        this.editingWalletTransferId = editId;

        const fromSelect = document.getElementById('wtransfer-from');
        const toSelect = document.getElementById('wtransfer-to');
        const amountInput = document.getElementById('wtransfer-amount');
        const dateInput = document.getElementById('wtransfer-date');
        const reasonSelect = document.getElementById('wtransfer-reason-select');
        const customReasonInput = document.getElementById('wtransfer-custom-reason');
        const notesInput = document.getElementById('wtransfer-notes');
        const titleEl = document.getElementById('wtransfer-modal-title');

        if (editId) {
            const tx = (this.data.walletTransfers || []).find(t => t.id === editId);
            if (tx) {
                if (titleEl) titleEl.textContent = 'Edit Advance ⇄ Rent Transfer';
                if (fromSelect) fromSelect.value = tx.fromWallet || 'sajida_advance';
                if (toSelect) toSelect.value = tx.toWallet || 'sajida_rent';
                if (amountInput) amountInput.value = tx.amount || '';
                if (dateInput) dateInput.value = tx.date || new Date().toISOString().slice(0, 10);

                let hasReason = false;
                if (reasonSelect) {
                    for (let i = 0; i < reasonSelect.options.length; i++) {
                        if (reasonSelect.options[i].value === tx.reason) {
                            hasReason = true;
                            break;
                        }
                    }
                    if (hasReason) {
                        reasonSelect.value = tx.reason;
                        if (customReasonInput) customReasonInput.classList.add('hidden');
                    } else {
                        reasonSelect.value = 'Other';
                        if (customReasonInput) {
                            customReasonInput.classList.remove('hidden');
                            customReasonInput.value = tx.reason || '';
                        }
                    }
                }
                if (notesInput) notesInput.value = tx.notes || '';
            }
        } else {
            if (titleEl) titleEl.textContent = 'Advance ⇄ Rent Wallet Transfer';
            const f = fromWallet || 'sajida_advance';
            let t = toWallet;
            if (!t) {
                if (f === 'sajida_advance') t = 'sajida_rent';
                else if (f === 'sajida_rent') t = 'sajida_advance';
                else if (f === 'jeelani_advance') t = 'jeelani_rent';
                else if (f === 'jeelani_rent') t = 'jeelani_advance';
                else t = 'sajida_rent';
            }
            if (fromSelect) fromSelect.value = f;
            if (toSelect) toSelect.value = t;
            if (amountInput) amountInput.value = '';
            if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
            if (reasonSelect) reasonSelect.selectedIndex = 0;
            if (customReasonInput) {
                customReasonInput.classList.add('hidden');
                customReasonInput.value = '';
            }
            if (notesInput) notesInput.value = '';
        }

        this.onWalletTransferFromChanged();
        this.updateWalletTransferPreview();
        this.showModal('modal-wallet-transfer');
    },

    applyWalletTransferPreset(preset) {
        const fromSelect = document.getElementById('wtransfer-from');
        const toSelect = document.getElementById('wtransfer-to');
        const reasonSelect = document.getElementById('wtransfer-reason-select');

        if (preset === 'sajida_adv_to_rent') {
            if (fromSelect) fromSelect.value = 'sajida_advance';
            if (toSelect) toSelect.value = 'sajida_rent';
            if (reasonSelect) reasonSelect.value = 'Move advance surplus to rent earnings';
        } else if (preset === 'sajida_rent_to_adv') {
            if (fromSelect) fromSelect.value = 'sajida_rent';
            if (toSelect) toSelect.value = 'sajida_advance';
            if (reasonSelect) reasonSelect.value = 'Refill advance wallet for building maintenance & expenses';
        } else if (preset === 'jeelani_adv_to_rent') {
            if (fromSelect) fromSelect.value = 'jeelani_advance';
            if (toSelect) toSelect.value = 'jeelani_rent';
            if (reasonSelect) reasonSelect.value = 'Move advance surplus to rent earnings';
        } else if (preset === 'jeelani_rent_to_adv') {
            if (fromSelect) fromSelect.value = 'jeelani_rent';
            if (toSelect) toSelect.value = 'jeelani_advance';
            if (reasonSelect) reasonSelect.value = 'Refill advance wallet for building maintenance & expenses';
        }

        this.onWalletTransferFromChanged();
        this.updateWalletTransferPreview();
    },

    onWalletTransferFromChanged() {
        const fromWallet = document.getElementById('wtransfer-from')?.value || 'sajida_advance';
        const toSelect = document.getElementById('wtransfer-to');
        const fromBalEl = document.getElementById('wtransfer-from-balance');
        const toBalEl = document.getElementById('wtransfer-to-balance');

        const stats = this.getStats();
        const fromBal = this.getWalletBalance(fromWallet, stats);
        if (fromBalEl) fromBalEl.textContent = `₹${fromBal.toLocaleString('en-IN')}`;

        if (toSelect && toSelect.value === fromWallet) {
            if (fromWallet === 'sajida_advance') toSelect.value = 'sajida_rent';
            else if (fromWallet === 'sajida_rent') toSelect.value = 'sajida_advance';
            else if (fromWallet === 'jeelani_advance') toSelect.value = 'jeelani_rent';
            else if (fromWallet === 'jeelani_rent') toSelect.value = 'jeelani_advance';
        }

        const toWallet = toSelect ? toSelect.value : '';
        const toBal = this.getWalletBalance(toWallet, stats);
        if (toBalEl) toBalEl.textContent = `₹${toBal.toLocaleString('en-IN')}`;

        this.updateWalletTransferPreview();
    },

    onWalletTransferReasonSelectChanged(val) {
        const customInput = document.getElementById('wtransfer-custom-reason');
        if (customInput) {
            customInput.classList.toggle('hidden', val !== 'Other');
            if (val === 'Other') customInput.focus();
        }
    },

    updateWalletTransferPreview() {
        const fromWallet = document.getElementById('wtransfer-from')?.value || 'sajida_advance';
        const toWallet = document.getElementById('wtransfer-to')?.value || 'sajida_rent';
        const amount = parseFloat(document.getElementById('wtransfer-amount')?.value) || 0;

        const fromInfo = this.getWalletInfo(fromWallet);
        const toInfo = this.getWalletInfo(toWallet);

        const stats = this.getStats();
        const fromBal = this.getWalletBalance(fromWallet, stats);
        const toBal = this.getWalletBalance(toWallet, stats);

        const fromBalEl = document.getElementById('wtransfer-from-balance');
        const toBalEl = document.getElementById('wtransfer-to-balance');
        if (fromBalEl) fromBalEl.textContent = `₹${fromBal.toLocaleString('en-IN')}`;
        if (toBalEl) toBalEl.textContent = `₹${toBal.toLocaleString('en-IN')}`;

        const previewBox = document.getElementById('wtransfer-impact-preview');
        const titleEl = document.getElementById('wtransfer-impact-title');
        const descEl = document.getElementById('wtransfer-impact-desc');
        if (!previewBox || !titleEl || !descEl) return;

        if (fromWallet === toWallet) {
            previewBox.className = 'p-3 bg-amber-50 border border-amber-300 rounded-2xl text-xs space-y-1';
            titleEl.className = 'text-amber-900 font-bold';
            titleEl.textContent = 'Invalid Selection';
            descEl.className = 'text-amber-700';
            descEl.textContent = 'Source and Destination wallets must be different.';
            return;
        }

        const isOverdraw = amount > fromBal;
        const newFrom = fromBal - amount;
        const newTo = toBal + amount;

        if (isOverdraw && amount > 0) {
            previewBox.className = 'p-3 bg-rose-50 border border-rose-300 rounded-2xl text-xs space-y-1.5';
            titleEl.className = 'text-rose-900 font-bold flex items-center gap-1.5';
            titleEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-rose-600"></i> Warning: Transfer amount exceeds available balance`;
            descEl.className = 'text-rose-700 leading-relaxed';
            descEl.innerHTML = `<strong>${fromInfo.name}</strong> currently holds ₹${fromBal.toLocaleString('en-IN')}. Transferring ₹${amount.toLocaleString('en-IN')} will cause a negative balance (₹${newFrom.toLocaleString('en-IN')}).`;
        } else {
            previewBox.className = 'p-3 bg-purple-50 border border-purple-200 rounded-2xl text-xs space-y-1.5';
            titleEl.className = 'text-purple-950 font-bold';
            titleEl.textContent = `Transfer: ₹${amount.toLocaleString('en-IN')}`;
            descEl.className = 'text-purple-900 leading-relaxed';
            descEl.innerHTML = `
                <div>• <strong>${fromInfo.name}</strong>: ₹${fromBal.toLocaleString('en-IN')} ➔ <strong class="text-rose-700">₹${newFrom.toLocaleString('en-IN')}</strong> (-₹${amount.toLocaleString('en-IN')})</div>
                <div>• <strong>${toInfo.name}</strong>: ₹${toBal.toLocaleString('en-IN')} ➔ <strong class="text-emerald-700">₹${newTo.toLocaleString('en-IN')}</strong> (+₹${amount.toLocaleString('en-IN')})</div>
            `;
        }
    },

    saveWalletTransfer(e) {
        if (e && e.preventDefault) e.preventDefault();

        if (this._isSavingWalletTransfer) return;
        this._isSavingWalletTransfer = true;

        try {
            const fromWallet = document.getElementById('wtransfer-from').value;
            const toWallet = document.getElementById('wtransfer-to').value;
            const amount = parseFloat(document.getElementById('wtransfer-amount').value);
            const date = document.getElementById('wtransfer-date').value;
            let reason = document.getElementById('wtransfer-reason-select').value;
            if (reason === 'Other') {
                reason = document.getElementById('wtransfer-custom-reason').value.trim() || 'Internal Wallet Transfer';
            }
            const notes = document.getElementById('wtransfer-notes').value.trim();

            if (fromWallet === toWallet) {
                alert('Source wallet and destination wallet cannot be the same.');
                return;
            }

            if (isNaN(amount) || amount <= 0) {
                alert('Please enter a valid transfer amount.');
                return;
            }

            if (!this.data.walletTransfers) this.data.walletTransfers = [];

            const fromInfo = this.getWalletInfo(fromWallet);
            const toInfo = this.getWalletInfo(toWallet);

            const currentBal = this.getWalletBalance(fromWallet);
            if (amount > currentBal) {
                const proceed = confirm(`Notice: The transfer amount of ₹${amount.toLocaleString('en-IN')} exceeds the current available balance in ${fromInfo.name} (₹${currentBal.toLocaleString('en-IN')}). Do you still want to proceed?`);
                if (!proceed) return;
            }

            if (this.editingWalletTransferId) {
                const idx = this.data.walletTransfers.findIndex(t => t.id === this.editingWalletTransferId);
                if (idx >= 0) {
                    this.data.walletTransfers[idx] = {
                        ...this.data.walletTransfers[idx],
                        fromWallet,
                        toWallet,
                        amount,
                        date,
                        reason,
                        notes
                    };
                }
            } else {
                this.data.walletTransfers.push({
                    id: 'wtx_' + Date.now(),
                    fromWallet,
                    toWallet,
                    amount,
                    date,
                    reason,
                    notes
                });
            }

            StorageManager.saveData(this.data);
            this.hideModal('modal-wallet-transfer');
            this.renderAll();

            ActivityLogger.log('rent', `Wallet Transfer: ₹${amount.toLocaleString('en-IN')}`, `${fromInfo.shortName} → ${toInfo.shortName} (${reason || 'Transfer'})`);
            this.showToast(`Transferred ₹${amount.toLocaleString('en-IN')} from ${fromInfo.shortName} to ${toInfo.shortName}!`, 'success');
        } finally {
            this._isSavingWalletTransfer = false;
        }
    },

    editWalletTransfer(id) {
        this.openWalletTransferModal(null, null, id);
    },

    deleteWalletTransfer(id) {
        const tx = (this.data.walletTransfers || []).find(t => t.id === id);
        if (!tx) return;

        const fromInfo = this.getWalletInfo(tx.fromWallet);
        const toInfo = this.getWalletInfo(tx.toWallet);

        const msg = `Delete this transfer of ₹${parseFloat(tx.amount).toLocaleString('en-IN')} from ${fromInfo.name} to ${toInfo.name}?\n\n` +
            `• ₹${parseFloat(tx.amount).toLocaleString('en-IN')} will be returned to ${fromInfo.shortName}.\n` +
            `• ₹${parseFloat(tx.amount).toLocaleString('en-IN')} will be deducted from ${toInfo.shortName}.`;

        if (!confirm(msg)) return;

        this.data.walletTransfers = (this.data.walletTransfers || []).filter(t => t.id !== id);
        ActivityLogger.log('rent', `Wallet Transfer Deleted: ₹${parseFloat(tx.amount).toLocaleString('en-IN')}`, `${fromInfo.shortName} → ${toInfo.shortName}`);
        StorageManager.saveData(this.data);
        this.renderAll();
        this.showToast(`Transfer reverted. Wallet balances restored.`);
    },

    // -------------------------------------------------------------
    // NAVIGATION & TAB SWITCHING
    // -------------------------------------------------------------
    switchTab(tabId) {
        this.activeTab = tabId;

        document.querySelectorAll('.app-view').forEach(view => {
            view.classList.add('hidden');
        });

        const target = document.getElementById(`view-${tabId}`);
        if (target) {
            target.classList.remove('hidden');
        }

        document.querySelectorAll('.nav-btn').forEach(btn => {
            const isTarget = btn.getAttribute('data-tab') === tabId;
            btn.classList.toggle('text-emerald-600', isTarget);
            btn.classList.toggle('dark:text-emerald-400', isTarget);
            btn.classList.toggle('active-tab', isTarget);
            btn.classList.toggle('font-extrabold', isTarget);
            btn.classList.toggle('text-slate-400', !isTarget);
            // Desktop active background badge
            if (btn.classList.contains('px-4')) {
                btn.classList.toggle('bg-emerald-50', isTarget);
                btn.classList.toggle('text-slate-500', !isTarget);
            }
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (tabId === 'dashboard') {
            this.updateDashboard();
        } else if (tabId === 'floors') {
            this.renderFloorBreakupPage();
        } else if (tabId === 'expenses') {
            this.renderExpenses();
            this.renderCategoryExportActions();
            this.renderExpenseCalendar();
        } else if (tabId === 'tenants') {
            this.renderTenants();
            this.renderRentLedger();
        } else if (tabId === 'wallets') {
            this.renderWalletPage(this.getStats());
        } else if (tabId === 'settings') {
            this.renderSettingsPage();
        }
    },

    // -------------------------------------------------------------
    // HELPERS & SETUP
    // -------------------------------------------------------------
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
        }
    },

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
    },

    setElementText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    },

    populateMonthFilter() {
        const selectMobile = document.getElementById('global-month-filter');
        const selectDesktop = document.getElementById('global-month-filter-desktop');
        if (!selectMobile && !selectDesktop) return;

        const monthsMap = {};
        monthsMap[this.getCurrentMonthKey()] = true;

        [...this.data.rentCollections, ...this.data.expenses].forEach(item => {
            const m = item.month || (item.date ? item.date.slice(0, 7) : '');
            if (m) monthsMap[m] = true;
        });

        const sorted = Object.keys(monthsMap).sort().reverse();
        let html = `<option value="all">All Months</option>`;
        sorted.forEach(m => {
            const isSel = (m === this.selectedMonthFilter) ? 'selected' : '';
            html += `<option value="${m}" ${isSel}>${m}</option>`;
        });

        if (selectMobile) {
            selectMobile.innerHTML = html;
            selectMobile.value = this.selectedMonthFilter || 'all';
        }
        if (selectDesktop) {
            selectDesktop.innerHTML = html;
            selectDesktop.value = this.selectedMonthFilter || 'all';
        }
    },

    onMonthFilterChange(val) {
        this.selectedMonthFilter = val;
        const selectMobile = document.getElementById('global-month-filter');
        const selectDesktop = document.getElementById('global-month-filter-desktop');
        if (selectMobile) selectMobile.value = val;
        if (selectDesktop) selectDesktop.value = val;
        this.renderExpenses();
        this.renderRentLedger();
        this.updateDashboard();
        if (this.activeTab === 'floors') this.renderFloorBreakupPage();
    },

    updateDashboard() {
        const stats = this.getStats();
        this.renderStatsCards(stats);
        this.renderRecurringBanner();
        setTimeout(() => this.renderCharts(), 50);
    },

    renderSettingsPage() {
        const backupSettings = StorageManager.getBackupSettings();
        this.updateBackupSettingsUI(backupSettings);
        this.applyTheme(StorageManager.getTheme(), false);

        const container = document.getElementById('settings-categories-list');
        if (!container) return;

        let html = '';
        this.data.categories.forEach(cat => {
            const count = this.data.expenses.filter(e => e.categoryId === cat.id).length;
            html += `
                <div class="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-lg flex items-center justify-center text-white" style="background-color: ${cat.color || '#10B981'}">
                            <i class="fa-solid ${cat.icon || 'fa-tag'}"></i>
                        </div>
                        <div>
                            <div class="font-semibold text-sm text-slate-900 dark:text-white">${cat.name}</div>
                            <div class="text-xs text-slate-400">${cat.desc || 'Building expenditure category'} • ${count} entries</div>
                        </div>
                    </div>
                    <div>
                        ${!cat.isDefault ? `
                            <button onclick="App.deleteCategory('${cat.id}')" class="p-1.5 text-slate-400 hover:text-red-500 transition" title="Delete Category">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        ` : `
                            <span class="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">Default</span>
                        `}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        const chkAuto = document.getElementById('chk-auto-post-recurring');
        if (chkAuto) {
            chkAuto.checked = this.data.autoPostRecurring !== false;
        }
    },

    renderCharts() {
        if (typeof Chart === 'undefined') return;

        const catCanvas = document.getElementById('chart-expense-categories');
        if (catCanvas) {
            const labels = [];
            const dataVals = [];
            const colors = [];

            this.data.categories.forEach(cat => {
                const total = this.data.expenses
                    .filter(e => e.categoryId === cat.id)
                    .reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
                if (total > 0) {
                    labels.push(cat.name);
                    dataVals.push(total);
                    colors.push(cat.color || '#10B981');
                }
            });

            if (labels.length === 0) {
                labels.push('No Expenses Yet');
                dataVals.push(1);
                colors.push('#cbd5e1');
            }

            if (this.charts.expenseCategory) {
                this.charts.expenseCategory.destroy();
            }

            this.charts.expenseCategory = new Chart(catCanvas, {
                type: 'doughnut',
                data: {
                    labels,
                    datasets: [{
                        data: dataVals,
                        backgroundColor: colors,
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                boxWidth: 12,
                                font: { size: 11 }
                            }
                        }
                    }
                }
            });
        }

        const barCanvas = document.getElementById('chart-cashflow-trends');
        if (barCanvas) {
            const monthsMap = {};
            [...this.data.rentCollections, ...this.data.expenses].forEach(item => {
                const m = item.month || (item.date ? item.date.slice(0, 7) : '');
                if (m) monthsMap[m] = true;
            });

            let sortedMonths = Object.keys(monthsMap).sort().slice(-6);
            const rentSeries = [];
            const expSeries = [];

            if (sortedMonths.length === 0) {
                sortedMonths = [this.getCurrentMonthKey()];
                rentSeries.push(0);
                expSeries.push(0);
            } else {
                sortedMonths.forEach(m => {
                    const rentSum = this.data.rentCollections
                        .filter(r => (r.month === m || (r.paymentDate && r.paymentDate.startsWith(m))))
                        .reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0);
                    const expSum = this.data.expenses
                        .filter(e => e.date && e.date.startsWith(m))
                        .reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
                    
                    rentSeries.push(rentSum);
                    expSeries.push(expSum);
                });
            }

            if (this.charts.monthlyCashflow) {
                this.charts.monthlyCashflow.destroy();
            }

            this.charts.monthlyCashflow = new Chart(barCanvas, {
                type: 'bar',
                data: {
                    labels: sortedMonths,
                    datasets: [
                        {
                            label: 'Rent Collections (₹)',
                            data: rentSeries,
                            backgroundColor: '#10B981',
                            borderRadius: 6
                        },
                        {
                            label: 'Expenditures (₹)',
                            data: expSeries,
                            backgroundColor: '#EF4444',
                            borderRadius: 6
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: val => '₹' + (val / 1000) + 'k'
                            }
                        }
                    },
                    plugins: {
                        legend: { position: 'top' }
                    }
                }
            });
        }
    },

    setupEventListeners() {
        const rentForm = document.getElementById('form-collect-rent');
        if (rentForm) rentForm.addEventListener('submit', e => this.saveRentCollection(e));

        const editRentForm = document.getElementById('form-edit-rent');
        if (editRentForm) editRentForm.addEventListener('submit', e => this.saveEditRent(e));

        const expForm = document.getElementById('form-add-expense');
        if (expForm) expForm.addEventListener('submit', e => this.saveExpense(e));

        const catForm = document.getElementById('form-add-category');
        if (catForm) catForm.addEventListener('submit', e => this.saveCategory(e));

        const tenantForm = document.getElementById('form-add-tenant');
        if (tenantForm) tenantForm.addEventListener('submit', e => this.saveTenant(e));

        const capForm = document.getElementById('form-add-capital');
        if (capForm) capForm.addEventListener('submit', e => this.saveCapitalAdjustment(e));

        const bankForm = document.getElementById('form-bank-transfer');
        if (bankForm) bankForm.addEventListener('submit', e => this.saveBankTransfer(e));

        const wTransferForm = document.getElementById('form-wallet-transfer');
        if (wTransferForm) wTransferForm.addEventListener('submit', e => this.saveWalletTransfer(e));

        // Wallet transfer live calculation listeners
        const wTransAmt = document.getElementById('wtransfer-amount');
        if (wTransAmt) wTransAmt.addEventListener('input', () => this.updateWalletTransferPreview());
        const wTransFrom = document.getElementById('wtransfer-from');
        if (wTransFrom) wTransFrom.addEventListener('change', () => this.onWalletTransferFromChanged());
        const wTransTo = document.getElementById('wtransfer-to');
        if (wTransTo) wTransTo.addEventListener('change', () => this.updateWalletTransferPreview());
        const wTransReason = document.getElementById('wtransfer-reason-select');
        if (wTransReason) wTransReason.addEventListener('change', e => this.onWalletTransferReasonSelectChanged(e.target.value));

        // Bank transfer live calculation listeners
        const bankAmt = document.getElementById('bank-tx-amount');
        if (bankAmt) bankAmt.addEventListener('input', () => this.updateBankTransferPreview());
        const bankWallet = document.getElementById('bank-tx-wallet');
        if (bankWallet) bankWallet.addEventListener('change', () => this.onBankWalletChanged());
        const bankName = document.getElementById('bank-tx-bank-name');
        if (bankName) bankName.addEventListener('change', e => this.onBankNameSelectChanged(e.target.value));
        const bankFloor = document.getElementById('bank-tx-floor');
        if (bankFloor) bankFloor.addEventListener('change', () => this.onBankFloorChanged());
        document.querySelectorAll('input[name="bank-tx-direction"]').forEach(r => {
            r.addEventListener('change', e => this.onBankTransferTypeChanged(e.target.value));
        });

        const recForm = document.getElementById('form-add-recurring');
        if (recForm) recForm.addEventListener('submit', e => this.saveRecurringRule(e));

        const settleForm = document.getElementById('form-settle-advance');
        if (settleForm) settleForm.addEventListener('submit', e => this.saveAdvanceSettlement(e));

        const editAdvForm = document.getElementById('form-edit-advance');
        if (editAdvForm) editAdvForm.addEventListener('submit', e => this.saveEditAdvance(e));

        // Deductions & settlement refund live calculation listeners
        ['settle-deduct-painting', 'settle-deduct-cleaning', 'settle-deduct-utility', 'settle-deduct-damage', 'settle-deduct-other', 'settle-refund-amount-input'].forEach(id => {
            const input = document.getElementById(id);
            if (input) input.addEventListener('input', () => this.updateNetRefundPreview());
        });

        // Advance breakup live calculation listeners
        ['edit-adv-deposit', 'edit-adv-deductions', 'edit-adv-refunded'].forEach(id => {
            const input = document.getElementById(id);
            if (input) input.addEventListener('input', () => this.updateEditAdvanceHeldPreview());
        });

        // Tenant modal advance preview listeners
        ['t-advance', 't-advance-deductions', 't-advance-refunded'].forEach(id => {
            const input = document.getElementById(id);
            if (input) input.addEventListener('input', () => this.updateTenantAdvancePreview());
        });

        // Live split sliders
        const sajidaPctInput = document.getElementById('exp-sajida-pct');
        if (sajidaPctInput) {
            sajidaPctInput.addEventListener('input', () => {
                const val = parseFloat(sajidaPctInput.value) || 0;
                document.getElementById('exp-jeelani-pct').value = Math.max(0, 100 - val);
                this.updateExpenseSplitPreview();
            });
        }

        const recSajidaPctInput = document.getElementById('rec-sajida-pct');
        if (recSajidaPctInput) {
            recSajidaPctInput.addEventListener('input', () => {
                const val = parseFloat(recSajidaPctInput.value) || 0;
                document.getElementById('rec-jeelani-pct').value = Math.max(0, 100 - val);
            });
        }

        const expAmountInput = document.getElementById('exp-amount');
        if (expAmountInput) {
            expAmountInput.addEventListener('input', () => this.updateExpenseSplitPreview());
        }

        // Search inputs
        const tenantSearch = document.getElementById('tenant-search-input');
        if (tenantSearch) {
            tenantSearch.addEventListener('input', e => {
                this.tenantSearchQuery = e.target.value;
                this.renderTenants();
            });
        }

        const expenseSearch = document.getElementById('expense-search-input');
        if (expenseSearch) {
            expenseSearch.addEventListener('input', e => {
                this.onExpenseSearchInput(e.target.value);
            });
        }

        const expenseSort = document.getElementById('expense-sort');
        if (expenseSort) {
            expenseSort.addEventListener('change', e => this.setSort('expenses', e.target.value));
        }

        const rentSort = document.getElementById('rent-sort');
        if (rentSort) {
            rentSort.addEventListener('change', e => this.setSort('rent', e.target.value));
        }

        // Global month filter (Mobile & Desktop)
        const monthFilter = document.getElementById('global-month-filter');
        if (monthFilter) {
            monthFilter.addEventListener('change', e => this.onMonthFilterChange(e.target.value));
        }
        const monthFilterDesktop = document.getElementById('global-month-filter-desktop');
        if (monthFilterDesktop) {
            monthFilterDesktop.addEventListener('change', e => this.onMonthFilterChange(e.target.value));
        }

        // URL Hash routing listener
        window.addEventListener('hashchange', () => this.checkHashRoute());

        // Backup & Restore
        const btnBackup = document.getElementById('btn-export-backup');
        if (btnBackup) {
            btnBackup.addEventListener('click', () => this.exportStandardBackup());
        }

        const fileRestore = document.getElementById('file-import-backup');
        if (fileRestore) {
            fileRestore.addEventListener('change', e => this.handleBackupFileRestore(e.target));
        }

        // Reset clean slate button
        const btnReset = document.getElementById('btn-reset-data');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                if (confirm('Clear all entries and start fresh with a clean slate? This will remove all tenants, rents, and expenses.')) {
                    this.data = StorageManager.resetToDefault();
                    this.renderAll();
                    this.showToast('All entries cleared. Ready for fresh data entry!', 'success');
                }
            });
        }

        // -------------------------------------------------------------
        // TOP HEADER ACTION BAR BUTTONS (7 UNIVERSAL PLATFORM BUTTONS)
        // -------------------------------------------------------------
        // 1. Cloud Sync Buttons (Desktop & Mobile)
        ['nav-cloud-sync-btn-desktop', 'nav-cloud-sync-btn', 'btn-cloud-configure'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.openCloudSyncModal();
                });
            }
        });

        // 2. Month Filter Dropdowns (Desktop & Mobile change handlers already registered above)

        // 3. Treasury Balance Badges (Desktop & Mobile -> Switch to Wallets Page)
        ['header-treasury-btn-desktop', 'header-treasury-badge-desktop', 'header-treasury-btn-mobile', 'header-treasury-badge'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.switchTab('wallets');
                });
            }
        });

        // 4. Excel Download Buttons (Desktop opens Modal, Mobile triggers direct 1-tap Master Excel download)
        const desktopExcel = document.getElementById('btn-download-excel');
        if (desktopExcel) {
            desktopExcel.addEventListener('click', (e) => {
                e.preventDefault();
                this.openExportModal();
            });
        }
        const mobileExcel = document.getElementById('btn-download-excel-mobile');
        if (mobileExcel) {
            mobileExcel.addEventListener('click', (e) => {
                e.preventDefault();
                this.downloadExcel();
            });
        }

        // 5. PDF Download Buttons (Desktop & Mobile)
        ['btn-download-pdf-header', 'btn-download-pdf-mobile'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.openPDFExportModal();
                });
            }
        });

        // 6. CSV Download Buttons (Desktop & Mobile)
        ['btn-download-csv-header', 'btn-download-csv-mobile'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.downloadCSV();
                });
            }
        });

        // 7. Light / Dark Theme Toggle Buttons (Desktop & Mobile)
        ['btn-theme-toggle-desktop', 'btn-theme-toggle-mobile'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.toggleTheme();
                });
            }
        });

        // Mobile QR Pairing direct button
        const btnCloudPair = document.getElementById('btn-cloud-pair-mobile');
        if (btnCloudPair) {
            btnCloudPair.addEventListener('click', (e) => {
                e.preventDefault();
                this.openCloudPairQrModal();
            });
        }

        // 8. Activity History & Audit Log Buttons (Desktop & Mobile)
        ['btn-activity-history-desktop', 'btn-activity-history-mobile'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.openActivityHistoryModal();
                });
            }
        });
    },

    // =============================================================
    // THEME MANAGEMENT (Universal Light / Dark Mode)
    // =============================================================
    initTheme() {
        const theme = StorageManager.getTheme(); // 'light', 'dark', or 'system'
        this.applyTheme(theme, false);

        // Listen to system preference changes if system mode is selected
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
                if (StorageManager.getTheme() === 'system') {
                    this.applyTheme('system', false);
                }
            });
        }

        // Global keyboard shortcut: Ctrl + Shift + D to toggle theme
        window.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
                e.preventDefault();
                this.toggleTheme();
            }
        });
    },

    setTheme(mode) {
        StorageManager.saveTheme(mode);
        this.applyTheme(mode, true);
    },

    _lastThemeToggle: 0,
    toggleTheme() {
        const now = Date.now();
        if (now - this._lastThemeToggle < 350) return;
        this._lastThemeToggle = now;

        const isCurrentlyDark = document.documentElement.classList.contains('dark');
        if (isCurrentlyDark) {
            this.setTheme('light');
        } else {
            let preferredDark = 'oled';
            try {
                preferredDark = localStorage.getItem('mh_preferred_dark_mode') || 'oled';
            } catch (e) {}
            this.setTheme(preferredDark === 'dark' ? 'dark' : 'oled');
        }
    },

    applyTheme(mode, showNotification = false) {
        let isDark = false;
        let isOled = false;

        if (mode === 'oled') {
            isDark = true;
            isOled = true;
            try { localStorage.setItem('mh_preferred_dark_mode', 'oled'); } catch (e) {}
        } else if (mode === 'dark') {
            isDark = true;
            isOled = false;
            try { localStorage.setItem('mh_preferred_dark_mode', 'dark'); } catch (e) {}
        } else if (mode === 'light') {
            isDark = false;
            isOled = false;
        } else {
            // 'system'
            isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            let pref = 'oled';
            try { pref = localStorage.getItem('mh_preferred_dark_mode') || 'oled'; } catch (e) {}
            isOled = isDark && (pref === 'oled');
        }

        if (isDark) {
            document.documentElement.classList.add('dark');
            document.documentElement.classList.remove('light');
            if (isOled) {
                document.documentElement.classList.add('oled');
            } else {
                document.documentElement.classList.remove('oled');
            }

            if (document.body) {
                document.body.classList.add('dark');
                document.body.classList.remove('light');
                if (isOled) {
                    document.body.classList.add('oled');
                } else {
                    document.body.classList.remove('oled');
                }
            }
        } else {
            document.documentElement.classList.remove('dark', 'oled');
            document.documentElement.classList.add('light');
            if (document.body) {
                document.body.classList.remove('dark', 'oled');
                document.body.classList.add('light');
            }
        }

        // Update meta theme-color for native mobile status bar tinting
        // Pure #000000 for OLED, #0b1329 for Dark Slate, #ffffff for Light
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', isOled ? '#000000' : (isDark ? '#0b1329' : '#ffffff'));
        }

        // Update desktop and mobile toggle icons
        const iconDesktop = document.getElementById('theme-toggle-icon-desktop');
        const iconMobile = document.getElementById('theme-toggle-icon-mobile');
        if (iconDesktop) {
            iconDesktop.className = isDark ? (isOled ? 'fa-solid fa-bolt text-emerald-400 text-sm' : 'fa-solid fa-sun text-amber-400 text-sm') : 'fa-solid fa-moon text-slate-700 text-sm';
        }
        if (iconMobile) {
            iconMobile.className = isDark ? (isOled ? 'fa-solid fa-bolt text-emerald-400' : 'fa-solid fa-sun text-amber-400') : 'fa-solid fa-moon text-slate-700';
        }

        // Update settings appearance buttons
        const currentSetting = StorageManager.getTheme();
        ['light', 'dark', 'oled', 'system'].forEach(m => {
            const btn = document.getElementById(`theme-btn-${m}`);
            if (btn) {
                if (m === currentSetting) {
                    btn.className = 'px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-600';
                } else {
                    btn.className = 'px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200';
                }
            }
        });

        if (showNotification) {
            let label = 'Theme updated';
            if (mode === 'system') label = 'System theme applied';
            else if (mode === 'oled') label = 'OLED True Black enabled (0% Pixel Power Draw)';
            else if (mode === 'dark') label = 'Dark Slate mode enabled';
            else label = 'Light mode enabled';
            this.showToast(label, 'info');
        }
    },

    // =============================================================
    // SECURE AUTHENTICATION GATE ENGINE
    // Username & Password Gateway with Masked Credentials & Recovery
    // =============================================================
    async initAuthGate() {
        const overlay = document.getElementById('auth-gate-overlay');
        if (!overlay) return;

        if (AuthManager.isAuthenticated()) {
            document.body.classList.remove('portal-locked');
            overlay.classList.add('hidden');
            overlay.style.display = 'none';
            return;
        }

        // Conceal all underlying app data immediately while locked
        document.body.classList.add('portal-locked');
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';

        if (AuthManager.isPasswordConfigured()) {
            this.showAuthLoginView();
            // Self-healing sync: asynchronously ensure Firestore cloud has credentials
            if (navigator.onLine && typeof CloudSyncManager !== 'undefined') {
                const creds = StorageManager.getAuthCredentials();
                if (creds && creds.hash && creds.salt) {
                    CloudSyncManager.pushAuthSecurity(creds).catch(() => {});
                }
            }
            return;
        }

        // Password not in local localStorage: check cloud database (if configured on Windows / other device)
        if (navigator.onLine && typeof CloudSyncManager !== 'undefined') {
            this.showAuthCheckingView();
            try {
                const remoteCreds = await CloudSyncManager.fetchRemoteAuthSecurity();
                if (remoteCreds && remoteCreds.hash) {
                    this.showAuthLoginView();
                    return;
                }
            } catch (e) {
                console.warn('Cloud auth check error:', e);
            }
        }

        // If not found in cloud, present first-time setup
        this.showAuthSetupView();
    },

    onAuthCredentialsSynced() {
        if (!AuthManager.isAuthenticated()) {
            const setupView = document.getElementById('auth-view-setup');
            const checkingView = document.getElementById('auth-view-checking');
            if ((setupView && !setupView.classList.contains('hidden')) || (checkingView && !checkingView.classList.contains('hidden'))) {
                this.showAuthLoginView();
                this.showToast('Master password synchronized from cloud. Please sign in.', 'info');
            }
        }
    },

    showAuthCheckingView() {
        const setup = document.getElementById('auth-view-setup');
        const login = document.getElementById('auth-view-login');
        const recovery = document.getElementById('auth-view-recovery');
        const checking = document.getElementById('auth-view-checking');
        if (setup) setup.classList.add('hidden');
        if (login) login.classList.add('hidden');
        if (recovery) recovery.classList.add('hidden');
        if (checking) checking.classList.remove('hidden');
    },

    showAuthSetupView() {
        const setup = document.getElementById('auth-view-setup');
        const login = document.getElementById('auth-view-login');
        const recovery = document.getElementById('auth-view-recovery');
        const checking = document.getElementById('auth-view-checking');
        if (setup) setup.classList.remove('hidden');
        if (login) login.classList.add('hidden');
        if (recovery) recovery.classList.add('hidden');
        if (checking) checking.classList.add('hidden');
        const err = document.getElementById('auth-setup-error');
        if (err) err.classList.add('hidden');
    },

    showAuthLoginView() {
        const setup = document.getElementById('auth-view-setup');
        const login = document.getElementById('auth-view-login');
        const recovery = document.getElementById('auth-view-recovery');
        const checking = document.getElementById('auth-view-checking');
        if (setup) setup.classList.add('hidden');
        if (login) login.classList.remove('hidden');
        if (recovery) recovery.classList.add('hidden');
        if (checking) checking.classList.add('hidden');
        const err = document.getElementById('auth-login-error');
        if (err) err.classList.add('hidden');
    },

    showAuthRecoveryView() {
        const setup = document.getElementById('auth-view-setup');
        const login = document.getElementById('auth-view-login');
        const recovery = document.getElementById('auth-view-recovery');
        const checking = document.getElementById('auth-view-checking');
        if (setup) setup.classList.add('hidden');
        if (login) login.classList.add('hidden');
        if (recovery) recovery.classList.remove('hidden');
        if (checking) checking.classList.add('hidden');
        const err = document.getElementById('auth-recovery-error');
        if (err) err.classList.add('hidden');
    },

    togglePasswordVisibility(inputId, iconId) {
        const input = document.getElementById(inputId);
        const icon = document.getElementById(iconId);
        if (!input) return;
        if (input.type === 'password') {
            input.type = 'text';
            if (icon) {
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            }
        } else {
            input.type = 'password';
            if (icon) {
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        }
    },

    async handleAuthSetupSubmit(e) {
        if (e) e.preventDefault();
        const usernameInput = document.getElementById('auth-setup-username');
        const passwordInput = document.getElementById('auth-setup-password');
        const confirmInput = document.getElementById('auth-setup-confirm');
        const errorBox = document.getElementById('auth-setup-error');
        const errorText = document.getElementById('auth-setup-error-text');

        const username = (usernameInput?.value || '').trim();
        const password = (passwordInput?.value || '').trim();
        const confirm = (confirmInput?.value || '').trim();

        if (errorBox) errorBox.classList.add('hidden');

        const isUserValid = await AuthManager.verifyUsername(username);
        if (!isUserValid) {
            if (errorBox && errorText) {
                errorText.textContent = 'Invalid administrator username. Access denied.';
                errorBox.classList.remove('hidden');
            }
            return;
        }

        if (!password || password.length < 4) {
            if (errorBox && errorText) {
                errorText.textContent = 'Password must be at least 4 characters long.';
                errorBox.classList.remove('hidden');
            }
            return;
        }

        if (password !== confirm) {
            if (errorBox && errorText) {
                errorText.textContent = 'Passwords do not match. Please re-enter.';
                errorBox.classList.remove('hidden');
            }
            return;
        }

        try {
            await AuthManager.setPassword(password);
            ActivityLogger.log('security', 'Master Password Configured', 'Initial master password setup completed successfully.');
            document.body.classList.remove('portal-locked');
            const overlay = document.getElementById('auth-gate-overlay');
            if (overlay) {
                overlay.classList.add('hidden');
                overlay.style.display = 'none';
            }
            if (typeof CloudSyncManager !== 'undefined' && CloudSyncManager.isEnabled()) {
                CloudSyncManager.pushToCloud(this.data, true);
            }
            this.showToast('Master password configured successfully! Welcome to Meera Heights.', 'success');
        } catch (err) {
            if (errorBox && errorText) {
                errorText.textContent = err.message || 'Setup failed.';
                errorBox.classList.remove('hidden');
            }
        }
    },

    async handleAuthLoginSubmit(e) {
        if (e) e.preventDefault();
        const usernameInput = document.getElementById('auth-login-username');
        const passwordInput = document.getElementById('auth-login-password');
        const errorBox = document.getElementById('auth-login-error');
        const errorText = document.getElementById('auth-login-error-text');

        const username = (usernameInput?.value || '').trim();
        const password = (passwordInput?.value || '').trim();

        if (errorBox) errorBox.classList.add('hidden');

        const isUserValid = await AuthManager.verifyUsername(username);
        if (!isUserValid) {
            if (errorBox && errorText) {
                errorText.textContent = 'Invalid username or password.';
                errorBox.classList.remove('hidden');
            }
            ActivityLogger.log('security', 'Failed Sign-In Attempt', 'Invalid username provided.');
            return;
        }

        const isPassValid = await AuthManager.verifyPassword(password);
        if (!isPassValid) {
            if (errorBox && errorText) {
                errorText.textContent = 'Invalid username or password.';
                errorBox.classList.remove('hidden');
            }
            ActivityLogger.log('security', 'Failed Sign-In Attempt', 'Incorrect password entered.');
            return;
        }

        AuthManager.setAuthenticated(true);
        ActivityLogger.log('security', 'Administrator Signed In', 'Successful authentication into management portal.');
        document.body.classList.remove('portal-locked');
        const overlay = document.getElementById('auth-gate-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.style.display = 'none';
        }
        this.showToast('Signed in successfully!', 'success');
    },

    async handleAuthRecoverySubmit(e) {
        if (e) e.preventDefault();
        const keyInput = document.getElementById('auth-recovery-key');
        const passwordInput = document.getElementById('auth-recovery-password');
        const confirmInput = document.getElementById('auth-recovery-confirm');
        const errorBox = document.getElementById('auth-recovery-error');
        const errorText = document.getElementById('auth-recovery-error-text');

        const key = (keyInput?.value || '').trim();
        const password = (passwordInput?.value || '').trim();
        const confirm = (confirmInput?.value || '').trim();

        if (errorBox) errorBox.classList.add('hidden');

        const isKeyValid = await AuthManager.verifyRecoveryKey(key);
        if (!isKeyValid) {
            if (errorBox && errorText) {
                errorText.textContent = 'Invalid Master Recovery Key. Verification failed.';
                errorBox.classList.remove('hidden');
            }
            ActivityLogger.log('security', 'Failed Recovery Attempt', 'Invalid recovery key entered.');
            return;
        }

        if (!password || password.length < 4) {
            if (errorBox && errorText) {
                errorText.textContent = 'New password must be at least 4 characters long.';
                errorBox.classList.remove('hidden');
            }
            return;
        }

        if (password !== confirm) {
            if (errorBox && errorText) {
                errorText.textContent = 'New passwords do not match.';
                errorBox.classList.remove('hidden');
            }
            return;
        }

        try {
            await AuthManager.setPassword(password);
            ActivityLogger.log('security', 'Password Reset via Recovery Key', 'Master password successfully reset.');
            document.body.classList.remove('portal-locked');
            const overlay = document.getElementById('auth-gate-overlay');
            if (overlay) {
                overlay.classList.add('hidden');
                overlay.style.display = 'none';
            }
            if (typeof CloudSyncManager !== 'undefined' && CloudSyncManager.isEnabled()) {
                CloudSyncManager.pushToCloud(this.data, true);
            }
            this.showToast('Master password successfully reset! Welcome back.', 'success');
        } catch (err) {
            if (errorBox && errorText) {
                errorText.textContent = err.message || 'Recovery failed.';
                errorBox.classList.remove('hidden');
            }
        }
    },

    lockApp() {
        AuthManager.logout();
        ActivityLogger.log('security', 'Portal Locked', 'User locked portal session.');
        document.body.classList.add('portal-locked');

        // Close all open modals to ensure complete privacy
        document.querySelectorAll('[id^="modal-"]').forEach(m => {
            if (m.id !== 'auth-gate-overlay') {
                m.classList.add('hidden');
                m.style.display = 'none';
            }
        });

        // Wipe sensitive password inputs
        const loginPass = document.getElementById('auth-login-password');
        if (loginPass) loginPass.value = '';
        const recPass = document.getElementById('auth-recovery-password');
        if (recPass) recPass.value = '';

        const overlay = document.getElementById('auth-gate-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            overlay.style.display = 'flex';
            this.showAuthLoginView();
        }
        this.showToast('Portal signed out & locked.', 'info');
        setTimeout(() => {
            if (loginPass) loginPass.focus();
        }, 150);
    },

    // =============================================================
    // AUTOMATED GOOGLE DRIVE & EMAIL BACKUP ENGINE
    // =============================================================
    initBackupScheduler() {
        const settings = StorageManager.getBackupSettings();
        this.updateBackupSettingsUI(settings);
        this.checkScheduledBackupDue(settings);
    },

    updateBackupSettingsUI(settings) {
        const badge = document.getElementById('backup-schedule-badge');
        if (badge) {
            if (settings.frequency === 'weekly') badge.textContent = 'Weekly (Mon)';
            else if (settings.frequency === 'monthly') badge.textContent = 'Monthly (1st)';
            else badge.textContent = 'Manual Only';
        }

        const lastDispatchedText = document.getElementById('backup-last-dispatched-text');
        if (lastDispatchedText) {
            lastDispatchedText.textContent = settings.lastRunTimestamp ? new Date(settings.lastRunTimestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never';
        }

        const nextDueText = document.getElementById('backup-next-due-text');
        if (nextDueText) {
            if (settings.frequency === 'manual') {
                nextDueText.textContent = 'Disabled';
            } else {
                nextDueText.textContent = this.isBackupDue(settings) ? 'Due Today!' : 'Scheduled';
            }
        }
    },

    isBackupDue(settings) {
        if (!settings || settings.frequency === 'manual') return false;
        const now = new Date();
        const lastRun = settings.lastRunTimestamp ? new Date(settings.lastRunTimestamp) : null;

        if (settings.frequency === 'weekly') {
            const isMonday = now.getDay() === 1;
            const daysSinceLast = lastRun ? (now - lastRun) / (1000 * 60 * 60 * 24) : 999;
            return (isMonday && daysSinceLast >= 1) || daysSinceLast >= 7;
        }

        if (settings.frequency === 'monthly') {
            const isFirst = now.getDate() === 1;
            const daysSinceLast = lastRun ? (now - lastRun) / (1000 * 60 * 60 * 24) : 999;
            return (isFirst && daysSinceLast >= 1) || daysSinceLast >= 30;
        }

        return false;
    },

    checkScheduledBackupDue(settings = null) {
        const s = settings || StorageManager.getBackupSettings();
        if (!this.isBackupDue(s)) return;

        const dismissed = sessionStorage.getItem('meera_backup_banner_dismissed');
        if (dismissed) return;

        const banner = document.getElementById('scheduled-backup-banner');
        if (banner) {
            banner.classList.remove('hidden');
        }
    },

    dismissScheduledBackupBanner() {
        sessionStorage.setItem('meera_backup_banner_dismissed', 'true');
        const banner = document.getElementById('scheduled-backup-banner');
        if (banner) banner.classList.add('hidden');
    },

    triggerScheduledBackupNow() {
        this.dismissScheduledBackupBanner();
        this.backupToGoogleDrive();
    },

    openBackupSettingsModal() {
        const settings = StorageManager.getBackupSettings();
        const freqSelect = document.getElementById('backup-frequency-select');
        if (freqSelect) freqSelect.value = settings.frequency || 'weekly';

        const recipInput = document.getElementById('backup-recipients-input');
        if (recipInput) recipInput.value = (settings.recipients || []).join(', ');

        const encryptToggle = document.getElementById('backup-encrypt-toggle');
        if (encryptToggle) encryptToggle.checked = !!settings.encryptWithPassphrase;

        const passContainer = document.getElementById('backup-passphrase-container');
        if (passContainer) passContainer.classList.toggle('hidden', !settings.encryptWithPassphrase);

        const passInput = document.getElementById('backup-passphrase-input');
        if (passInput) passInput.value = settings.passphrase || '';

        const webhookInput = document.getElementById('backup-webhook-url-input');
        if (webhookInput) webhookInput.value = settings.webhookUrl || '';

        this.showModal('modal-backup-settings');
    },

    onBackupEncryptionToggled(checked) {
        const passContainer = document.getElementById('backup-passphrase-container');
        if (passContainer) passContainer.classList.toggle('hidden', !checked);
    },

    saveBackupSettingsForm(e) {
        e.preventDefault();
        const frequency = document.getElementById('backup-frequency-select')?.value || 'weekly';
        const rawRecipients = document.getElementById('backup-recipients-input')?.value || '';
        const recipients = rawRecipients.split(',').map(s => s.trim()).filter(Boolean);
        const encryptWithPassphrase = !!document.getElementById('backup-encrypt-toggle')?.checked;
        const passphrase = (document.getElementById('backup-passphrase-input')?.value || '').trim();
        const webhookUrl = (document.getElementById('backup-webhook-url-input')?.value || '').trim();

        if (encryptWithPassphrase && !passphrase) {
            alert('Please enter an encryption passphrase or turn off passphrase protection.');
            return;
        }

        const currentSettings = StorageManager.getBackupSettings();
        const newSettings = {
            ...currentSettings,
            frequency,
            recipients,
            encryptWithPassphrase,
            passphrase: encryptWithPassphrase ? passphrase : '',
            webhookUrl
        };

        StorageManager.saveBackupSettings(newSettings);
        this.updateBackupSettingsUI(newSettings);
        this.hideModal('modal-backup-settings');
        this.showToast('Automated backup settings saved successfully!', 'success');
    },

    async generateBackupPayload() {
        const rawPayload = JSON.stringify({
            app: 'Meera Heights Building Management',
            exportDate: new Date().toISOString(),
            version: '4.7.0',
            data: this.data
        }, null, 2);

        const settings = StorageManager.getBackupSettings();
        const dateStr = new Date().toISOString().slice(0, 10);

        if (settings.encryptWithPassphrase && settings.passphrase) {
            const encryptedBytes = await this.encryptWithPassphrase(rawPayload, settings.passphrase);
            const blob = new Blob([encryptedBytes], { type: 'application/octet-stream' });
            return {
                blob,
                filename: `meera_heights_encrypted_backup_${dateStr}.mhbackup`,
                isEncrypted: true
            };
        } else {
            const blob = new Blob([rawPayload], { type: 'application/json' });
            return {
                blob,
                filename: `meera_heights_backup_${dateStr}.json`,
                isEncrypted: false
            };
        }
    },

    // Web Crypto AES-GCM (PBKDF2 100,000 rounds)
    async encryptWithPassphrase(plaintext, password) {
        const enc = new TextEncoder();
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            enc.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        const key = await window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt']
        );

        const ciphertext = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            enc.encode(plaintext)
        );

        // Header format: [4 bytes magic 'MH01'] + [16 bytes salt] + [12 bytes iv] + [ciphertext]
        const magic = new Uint8Array([0x4D, 0x48, 0x30, 0x31]); // 'MH01'
        const totalLen = magic.length + salt.length + iv.length + ciphertext.byteLength;
        const result = new Uint8Array(totalLen);

        let offset = 0;
        result.set(magic, offset); offset += magic.length;
        result.set(salt, offset); offset += salt.length;
        result.set(iv, offset); offset += iv.length;
        result.set(new Uint8Array(ciphertext), offset);

        return result;
    },

    async decryptWithPassphrase(encryptedArrayBuffer, password) {
        const bytes = new Uint8Array(encryptedArrayBuffer);
        // Verify magic 'MH01'
        if (bytes[0] !== 0x4D || bytes[1] !== 0x48 || bytes[2] !== 0x30 || bytes[3] !== 0x31) {
            throw new Error('Invalid backup file format.');
        }

        const salt = bytes.slice(4, 20);
        const iv = bytes.slice(20, 32);
        const ciphertext = bytes.slice(32);

        const enc = new TextEncoder();
        const dec = new TextDecoder();

        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            enc.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        const key = await window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
        );

        const decrypted = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            ciphertext
        );

        return dec.decode(decrypted);
    },

    async backupToGoogleDrive() {
        try {
            const { blob, filename, isEncrypted } = await this.generateBackupPayload();

            // Record last run
            const settings = StorageManager.getBackupSettings();
            settings.lastRunTimestamp = new Date().toISOString();
            StorageManager.saveBackupSettings(settings);
            this.updateBackupSettingsUI(settings);
            ActivityLogger.log('backup', 'Google Drive Backup Dispatched', `File: ${filename} (${isEncrypted ? 'Encrypted' : 'JSON'})`);

            // 1. If user configured an automated Google Apps Script Webhook, upload directly to Drive!
            if (settings.webhookUrl) {
                this.showToast('Uploading backup directly to your Google Drive...', 'info');
                try {
                    const rawText = await blob.text();
                    await fetch(settings.webhookUrl, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'drive',
                            filename,
                            content: rawText,
                            isEncrypted
                        })
                    });
                    this.showToast(`Backup successfully uploaded to Google Drive folder 'Meera Heights App Backups'!`, 'success');
                    return;
                } catch (webErr) {
                    console.warn('Webhook upload error, falling back to download:', webErr);
                }
            }

            // 2. Attempt Native Web Share API if supported (works on Android & iOS to save directly to Drive)
            if (navigator.canShare && navigator.share) {
                try {
                    const file = new File([blob], filename, { type: blob.type });
                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            files: [file],
                            title: 'Meera Heights Database Backup',
                            text: `Meera Heights automated backup (${isEncrypted ? 'AES Encrypted' : 'JSON'}). Save directly to Google Drive or files.`
                        });
                        this.showToast('Backup shared successfully! Choose Google Drive from the menu.', 'success');
                        return;
                    }
                } catch (shareErr) {
                    console.warn('Share sheet dismissed or unsupported file share:', shareErr);
                }
            }

            // 3. Standard browser download for desktop / unsupported share
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.position = 'fixed';
            a.style.left = '-9999px';
            a.style.opacity = '0';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            try {
                a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            } catch (e) {
                a.click();
            }
            setTimeout(() => {
                try {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                } catch (e) {}
            }, 10000);

            this.showToast(`Backup downloaded: ${filename}. Opening Google Drive to upload...`, 'success');

            // Open Google Drive upload page in new tab
            try {
                window.open('https://drive.google.com/drive/u/0/my-drive', '_blank');
            } catch (e) {}
        } catch (err) {
            console.error('Drive backup failed:', err);
            this.showToast('Backup failed: ' + err.message, 'error');
        }
    },

    async backupToEmail() {
        try {
            const { blob, filename, isEncrypted } = await this.generateBackupPayload();

            // Record last run
            const settings = StorageManager.getBackupSettings();
            settings.lastRunTimestamp = new Date().toISOString();
            StorageManager.saveBackupSettings(settings);
            this.updateBackupSettingsUI(settings);

            const recipients = (settings.recipients && settings.recipients.length > 0)
                ? settings.recipients
                : ['mahaboob.1411ali@gmail.com'];

            ActivityLogger.log('backup', 'Email Backup Dispatched', `File: ${filename} to ${recipients.join(', ')}`);

            // 1. If user configured an automated Google Apps Script Webhook, send email with attachment directly!
            if (settings.webhookUrl) {
                this.showToast('Sending automated email with backup attachment...', 'info');
                try {
                    const rawText = await blob.text();
                    await fetch(settings.webhookUrl, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'email',
                            recipients,
                            filename,
                            content: rawText,
                            isEncrypted
                        })
                    });
                    this.showToast(`Backup email with attachment sent successfully to ${recipients.join(', ')}!`, 'success');
                    return;
                } catch (webErr) {
                    console.warn('Webhook email error, falling back to mailto:', webErr);
                }
            }

            // 2. Trigger file download so user has the file
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.position = 'fixed';
            a.style.left = '-9999px';
            a.style.opacity = '0';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            try {
                a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            } catch (e) {
                a.click();
            }
            setTimeout(() => {
                try {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                } catch (e) {}
            }, 10000);

            // Compose email after small delay so download is not aborted
            setTimeout(() => {
                const recipStr = recipients.join(',');
                const stats = this.getStats();
                const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                const subject = encodeURIComponent(`[Meera Heights] Database Backup & Financial Summary - ${dateStr}`);
                const body = encodeURIComponent(
                    `Hello Sajida & Jeelani,\n\nPlease find the latest automated database backup for Meera Heights Residential Apartments attached.\n\n` +
                    `📊 Executive Financial Summary:\n` +
                    `• Treasury Balance: ₹${stats.treasuryBalance.toLocaleString('en-IN')}\n` +
                    `• Sajida Advance Wallet: ₹${stats.sajidaAdvanceBalance.toLocaleString('en-IN')}\n` +
                    `• Sajida Rent Wallet: ₹${stats.sajidaRentBalance.toLocaleString('en-IN')}\n` +
                    `• Jeelani Advance Wallet: ₹${stats.jeelaniAdvanceBalance.toLocaleString('en-IN')}\n` +
                    `• Jeelani Rent Wallet: ₹${stats.jeelaniRentBalance.toLocaleString('en-IN')}\n` +
                    `• Active Tenants: ${this.data.tenants.filter(t => t.status !== 'vacated').length}\n` +
                    `• Total Expenses Recorded: ${this.data.expenses.length}\n\n` +
                    `📁 Backup File: ${filename} (${isEncrypted ? 'AES Password-Protected' : 'Standard JSON'})\n\n` +
                    `Please attach the downloaded file "${filename}" from your Downloads folder to this email for your records.\n\n` +
                    `Best regards,\nMeera Heights Building Management App`
                );

                window.location.href = `mailto:${recipStr}?subject=${subject}&body=${body}`;
            }, 350);

            this.showToast(`Backup downloaded: ${filename}. Please attach it to your email composer.`, 'info');
        } catch (err) {
            console.error('Email backup failed:', err);
            this.showToast('Email backup failed: ' + err.message, 'error');
        }
    },

    exportStandardBackup() {
        StorageManager.exportJsonBackup();
        ActivityLogger.log('backup', 'Database Backup Exported', 'Standard JSON backup downloaded.');
    },

    openRestoreModal() {
        this.showModal('modal-restore-options');
    },

    triggerOfflineFileRestore() {
        this.hideModal('modal-restore-options');
        this._restoreSource = 'offline';
        const input = document.getElementById('file-import-backup');
        if (input) {
            input.value = '';
            input.click();
        }
    },

    triggerEmailFileRestore() {
        this.hideModal('modal-restore-options');
        this._restoreSource = 'email';
        const input = document.getElementById('file-import-backup');
        if (input) {
            input.value = '';
            input.click();
        }
    },

    triggerLocalRestorePicker() {
        this.triggerOfflineFileRestore();
    },

    async browseGoogleDriveBackups() {
        this.hideModal('modal-restore-options');
        const settings = StorageManager.getBackupSettings();
        const container = document.getElementById('drive-backups-container');

        if (!settings.webhookUrl) {
            // Webhook is not configured yet -> guide user with clear steps & open Drive
            if (container) {
                container.innerHTML = `
                    <div class="text-center py-6 px-4 space-y-3">
                        <div class="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center mx-auto text-2xl">
                            <i class="fa-brands fa-google-drive"></i>
                        </div>
                        <h4 class="font-bold text-sm text-slate-900 dark:text-white">Google Drive Backup Storage</h4>
                        <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                            Backups uploaded to your Google Drive are stored in your <strong class="text-slate-700 dark:text-slate-300">'Meera Heights App Backups'</strong> folder.
                        </p>
                        <div class="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                            <a href="https://drive.google.com/drive/u/0/my-drive" target="_blank" class="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm">
                                <i class="fa-solid fa-arrow-up-right-from-square text-[11px]"></i>
                                <span>Open Google Drive</span>
                            </a>
                            <button onclick="App.hideModal('modal-drive-backups-list'); App.triggerLocalRestorePicker();" class="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer">
                                <i class="fa-solid fa-file-arrow-up text-[11px]"></i>
                                <span>Select Downloaded File</span>
                            </button>
                        </div>
                    </div>
                `;
            }
            this.showModal('modal-drive-backups-list');
            return;
        }

        // Webhook URL is configured -> fetch list of backups directly from Google Drive!
        if (container) {
            container.innerHTML = `
                <div class="text-center py-8 text-slate-400">
                    <i class="fa-solid fa-circle-notch fa-spin text-2xl mb-2 text-blue-500"></i>
                    <p class="text-xs font-medium">Fetching backups from Google Drive...</p>
                </div>
            `;
        }
        this.showModal('modal-drive-backups-list');

        try {
            const resp = await fetch(settings.webhookUrl + '?action=list', {
                method: 'GET'
            });
            const data = await resp.json();
            if (data && Array.isArray(data.files) && data.files.length > 0) {
                container.innerHTML = data.files.map(f => `
                    <div class="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                        <div class="flex items-center gap-3 min-w-0">
                            <div class="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
                                <i class="fa-solid fa-file-code"></i>
                            </div>
                            <div class="min-w-0">
                                <p class="text-xs font-bold text-slate-900 dark:text-white truncate">${App.escapeHtml(f.name)}</p>
                                <p class="text-[11px] text-slate-400">${new Date(f.createdTime || f.date).toLocaleString('en-IN')}</p>
                            </div>
                        </div>
                        <button onclick="App.restoreDriveFileById('${f.id}', '${App.escapeHtml(f.name)}')" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shrink-0 cursor-pointer shadow-sm">
                            Restore This
                        </button>
                    </div>
                `).join('');
            } else {
                container.innerHTML = `
                    <div class="text-center py-6 text-slate-400 text-xs">
                        <p>No backup files found yet in Google Drive folder.</p>
                    </div>
                `;
            }
        } catch (e) {
            console.warn('Could not query Drive webhook list:', e);
            container.innerHTML = `
                <div class="text-center py-6 px-4 space-y-2">
                    <p class="text-xs text-slate-500 dark:text-slate-400">Direct cloud browser accessed. Click below to select a downloaded Drive backup file:</p>
                    <button onclick="App.hideModal('modal-drive-backups-list'); App.triggerLocalRestorePicker();" class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer mx-auto">
                        <i class="fa-solid fa-folder-open"></i>
                        <span>Select File</span>
                    </button>
                </div>
            `;
        }
    },

    async initiateRevertToLatestDriveBackup() {
        this.hideModal('modal-restore-options');
        const settings = StorageManager.getBackupSettings();
        const filenameEl = document.getElementById('revert-confirm-filename');
        const dateEl = document.getElementById('revert-confirm-date');

        if (filenameEl) filenameEl.textContent = 'Meera_Heights_Latest_Backup.json';
        if (dateEl) dateEl.textContent = settings.lastRunTimestamp ? new Date(settings.lastRunTimestamp).toLocaleString('en-IN') : 'Latest Cloud Backup';

        // Query webhook if available to display actual latest file metadata
        this._pendingRevertFileId = null;
        if (settings.webhookUrl) {
            try {
                const resp = await fetch(settings.webhookUrl + '?action=latest', { method: 'GET' });
                const json = await resp.json();
                if (json && json.latest) {
                    if (filenameEl) filenameEl.textContent = json.latest.name || 'Meera_Heights_Latest_Backup.json';
                    if (dateEl) dateEl.textContent = new Date(json.latest.createdTime || json.latest.date).toLocaleString('en-IN');
                    this._pendingRevertFileId = json.latest.id;
                }
            } catch (e) {
                console.warn('Unable to query latest backup metadata from webhook:', e);
            }
        }

        this.showModal('modal-revert-confirm');
    },

    async executeRevertBackup() {
        const settings = StorageManager.getBackupSettings();
        this.hideModal('modal-revert-confirm');

        if (settings.webhookUrl && this._pendingRevertFileId) {
            this.showToast('Fetching latest cloud backup from Google Drive...', 'info');
            try {
                const resp = await fetch(`${settings.webhookUrl}?action=download&id=${this._pendingRevertFileId}`);
                const payload = await resp.json();
                const content = payload.content;
                const parsed = (typeof content === 'string') ? JSON.parse(content) : content;
                const dataToRestore = parsed.data || parsed;
                if (!dataToRestore.expenses || !dataToRestore.tenants) {
                    throw new Error('Invalid backup structure returned from Drive.');
                }
                StorageManager.saveData(dataToRestore);
                this.data = StorageManager.getData();
                if (typeof CloudSyncManager !== 'undefined' && CloudSyncManager.isEnabled()) {
                    CloudSyncManager.pushLocalDataToCloud(this.data, true);
                }
                ActivityLogger.log('restore', 'Reverted to Latest Cloud Backup', `Reverted database to backup: ${payload.filename || 'latest'}`);
                this.renderAll();
                this.showToast('Database successfully reverted to latest Google Drive backup!', 'success');
                return;
            } catch (err) {
                console.warn('Direct cloud revert download failed, falling back to local selector:', err);
            }
        }

        // Fallback: prompt user to pick the downloaded backup file
        this.showToast('Please select your latest downloaded backup file to complete revert:', 'info');
        this.triggerLocalRestorePicker();
    },

    async restoreDriveFileById(fileId, fileName) {
        this.hideModal('modal-drive-backups-list');
        const settings = StorageManager.getBackupSettings();
        if (!settings.webhookUrl) return;

        this.showToast(`Fetching ${fileName} from Google Drive...`, 'info');
        try {
            const resp = await fetch(`${settings.webhookUrl}?action=download&id=${fileId}`);
            const payload = await resp.json();
            const content = payload.content;
            const parsed = (typeof content === 'string') ? JSON.parse(content) : content;
            const dataToRestore = parsed.data || parsed;
            if (!dataToRestore.expenses || !dataToRestore.tenants) {
                throw new Error('Invalid backup structure.');
            }
            if (confirm(`Restore ${fileName} and replace current local entries?`)) {
                StorageManager.saveData(dataToRestore);
                this.data = StorageManager.getData();
                if (typeof CloudSyncManager !== 'undefined' && CloudSyncManager.isEnabled()) {
                    CloudSyncManager.pushLocalDataToCloud(this.data, true);
                }
                ActivityLogger.log('restore', 'Restored from Google Drive', `Restored ${fileName}`);
                this.renderAll();
                this.showToast(`${fileName} restored successfully!`, 'success');
            }
        } catch (e) {
            alert('Failed to download file from Google Drive: ' + e.message);
        }
    },

    handleBackupFileRestore(input) {
        if (!input.files || !input.files[0]) return;
        const file = input.files[0];
        const source = this._restoreSource || 'offline';

        if (file.name.endsWith('.mhbackup')) {
            // Encrypted backup file
            const reader = new FileReader();
            reader.onload = (e) => {
                this.pendingEncryptedBackupBuffer = e.target.result;
                this.pendingBackupFileName = file.name;
                this.pendingBackupFileSize = file.size;
                const modal = document.getElementById('modal-restore-passphrase');
                const passInput = document.getElementById('restore-passphrase-input');
                if (passInput) passInput.value = '';
                this.showModal('modal-restore-passphrase');
            };
            reader.readAsArrayBuffer(file);
        } else {
            // Standard JSON backup
            const reader = new FileReader();
            reader.onload = (e) => {
                const inspection = StorageManager.parseBackupSummary(e.target.result);
                if (!inspection.valid) {
                    alert(inspection.error || 'Invalid backup file.');
                    input.value = '';
                    return;
                }
                this.inspectAndConfirmRestore({
                    data: inspection.data,
                    summary: inspection.summary,
                    fileName: file.name,
                    fileSize: file.size,
                    source: source
                });
            };
            reader.readAsText(file);
        }
        input.value = '';
    },

    cancelRestorePassphrase() {
        this.pendingEncryptedBackupBuffer = null;
        this.pendingBackupFileName = null;
        this.pendingBackupFileSize = null;
        this.hideModal('modal-restore-passphrase');
    },

    async confirmRestorePassphrase() {
        const passInput = document.getElementById('restore-passphrase-input');
        const password = (passInput?.value || '').trim();
        if (!password) {
            alert('Please enter the encryption passphrase.');
            return;
        }

        if (!this.pendingEncryptedBackupBuffer) {
            this.hideModal('modal-restore-passphrase');
            return;
        }

        try {
            const jsonText = await this.decryptWithPassphrase(this.pendingEncryptedBackupBuffer, password);
            const inspection = StorageManager.parseBackupSummary(jsonText);
            if (!inspection.valid) {
                throw new Error(inspection.error || 'Decrypted data has invalid backup format.');
            }

            const fileName = this.pendingBackupFileName || 'backup.mhbackup';
            const fileSize = this.pendingBackupFileSize || 0;
            const source = this._restoreSource || 'offline';

            this.hideModal('modal-restore-passphrase');
            this.pendingEncryptedBackupBuffer = null;
            this.pendingBackupFileName = null;
            this.pendingBackupFileSize = null;

            this.inspectAndConfirmRestore({
                data: inspection.data,
                summary: inspection.summary,
                fileName: fileName,
                fileSize: fileSize,
                source: source
            });
        } catch (err) {
            console.error('Decryption failed:', err);
            alert('Decryption failed: Incorrect passphrase or damaged backup file.');
        }
    },

    inspectAndConfirmRestore({ data, summary, fileName, fileSize, source }) {
        this._pendingRestoreData = data;
        this._pendingRestoreMeta = { fileName, fileSize, source };

        const sourceEl = document.getElementById('restore-confirm-source');
        const filenameEl = document.getElementById('restore-confirm-filename');
        const filesizeEl = document.getElementById('restore-confirm-filesize');
        const dateEl = document.getElementById('restore-confirm-date');
        const countTenants = document.getElementById('restore-count-tenants');
        const countRents = document.getElementById('restore-count-rents');
        const countExpenses = document.getElementById('restore-count-expenses');
        const countTransfers = document.getElementById('restore-count-transfers');

        if (sourceEl) {
            if (source === 'email') {
                sourceEl.innerHTML = '<i class="fa-solid fa-envelope-open-text text-blue-500"></i><span>Email Backup (Rollback)</span>';
            } else {
                sourceEl.innerHTML = '<i class="fa-solid fa-hard-drive text-emerald-500"></i><span>Offline File</span>';
            }
        }
        if (filenameEl) filenameEl.textContent = fileName || 'Meera_Heights_Backup.json';
        if (filesizeEl) {
            const kb = ((fileSize || 0) / 1024).toFixed(1);
            filesizeEl.textContent = `${kb} KB`;
        }
        if (dateEl) {
            if (summary.timestamp) {
                dateEl.textContent = new Date(summary.timestamp).toLocaleString('en-IN');
            } else {
                dateEl.textContent = 'Included in backup';
            }
        }
        if (countTenants) countTenants.textContent = summary.tenantsCount;
        if (countRents) countRents.textContent = summary.rentCollectionsCount;
        if (countExpenses) countExpenses.textContent = summary.expensesCount;
        if (countTransfers) countTransfers.textContent = summary.transfersCount;

        this.showModal('modal-restore-confirm-json');
    },

    cancelConfirmedRestore() {
        this._pendingRestoreData = null;
        this._pendingRestoreMeta = null;
        this.hideModal('modal-restore-confirm-json');
    },

    executeConfirmedRestore() {
        if (!this._pendingRestoreData) {
            this.hideModal('modal-restore-confirm-json');
            return;
        }

        const dataToRestore = this._pendingRestoreData;
        const meta = this._pendingRestoreMeta || {};

        StorageManager.saveData(dataToRestore);
        this.data = StorageManager.getData();

        if (typeof CloudSyncManager !== 'undefined' && CloudSyncManager.isEnabled()) {
            CloudSyncManager.pushLocalDataToCloud(this.data, true);
        }

        const sourceLabel = (meta.source === 'email') ? 'Email Backup Rollback' : 'Offline Backup File';
        ActivityLogger.log('restore', `Database Restored (${meta.source === 'email' ? 'Email' : 'Offline'})`,
            `Restored from ${meta.fileName || 'backup.json'} via ${sourceLabel}. Database updated successfully.`);

        this.activeTab = 'dashboard';
        this.selectedMonthFilter = 'all';
        this.renderAll();
        this.hideModal('modal-restore-confirm-json');

        this._pendingRestoreData = null;
        this._pendingRestoreMeta = null;

        this.showToast(`Database restored successfully from ${meta.fileName || 'backup file'}!`, 'success');
    },

    // =============================================================
    // ACTIVITY HISTORY & AUDIT LOG UI ENGINE
    // =============================================================
    activityCategoryFilter: 'all',

    openActivityHistoryModal() {
        try {
            this.showModal('modal-activity-history');
            this.renderActivityHistory();
        } catch (e) {
            console.error('Error opening activity history modal:', e);
            this.showModal('modal-activity-history');
        }
    },

    setActivityCategoryFilter(cat) {
        this.activityCategoryFilter = cat;
        document.querySelectorAll('.activity-cat-pill').forEach(btn => {
            if (btn.dataset.cat === cat) {
                btn.className = 'activity-cat-pill px-3 py-1 rounded-lg text-xs font-bold bg-indigo-600 text-white transition cursor-pointer';
            } else {
                btn.className = 'activity-cat-pill px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer';
            }
        });
        this.renderActivityHistory();
    },

    renderActivityHistory() {
        const container = document.getElementById('activity-timeline-container');
        const badge = document.getElementById('activity-count-badge');
        const search = (document.getElementById('activity-search-input')?.value || '').trim();

        const logs = ActivityLogger.getLogs(this.activityCategoryFilter, search);
        if (badge) badge.textContent = `${logs.length} log${logs.length !== 1 ? 's' : ''}`;

        if (!container) return;

        if (logs.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12 text-slate-400">
                    <i class="fa-solid fa-clock-rotate-left text-3xl mb-2 opacity-50"></i>
                    <p class="text-xs font-semibold">No activity logs found</p>
                    <p class="text-[11px] text-slate-500 mt-0.5">Activities will appear automatically as you record rents, expenses, and backups.</p>
                </div>
            `;
            return;
        }

        const categoryMeta = {
            rent: { icon: 'fa-hand-holding-dollar', bg: 'bg-emerald-100 dark:bg-emerald-950/70', text: 'text-emerald-600 dark:text-emerald-400', label: 'Rent' },
            expense: { icon: 'fa-file-invoice-dollar', bg: 'bg-rose-100 dark:bg-rose-950/70', text: 'text-rose-600 dark:text-rose-400', label: 'Expense' },
            tenant: { icon: 'fa-user-group', bg: 'bg-purple-100 dark:bg-purple-950/70', text: 'text-purple-600 dark:text-purple-400', label: 'Tenant' },
            transfer: { icon: 'fa-building-columns', bg: 'bg-sky-100 dark:bg-sky-950/70', text: 'text-sky-600 dark:text-sky-400', label: 'Transfer' },
            backup: { icon: 'fa-cloud-arrow-up', bg: 'bg-blue-100 dark:bg-blue-950/70', text: 'text-blue-600 dark:text-blue-400', label: 'Backup' },
            restore: { icon: 'fa-rotate-left', bg: 'bg-amber-100 dark:bg-amber-950/70', text: 'text-amber-600 dark:text-amber-400', label: 'Restore' },
            security: { icon: 'fa-shield-halved', bg: 'bg-indigo-100 dark:bg-indigo-950/70', text: 'text-indigo-600 dark:text-indigo-400', label: 'Security' },
            sync: { icon: 'fa-cloud', bg: 'bg-cyan-100 dark:bg-cyan-950/70', text: 'text-cyan-600 dark:text-cyan-400', label: 'Sync' }
        };

        container.innerHTML = logs.map(l => {
            try {
                const meta = categoryMeta[l.category] || { icon: 'fa-circle-check', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300', label: l.category || 'General' };
                const timeAgo = ActivityLogger.formatRelativeTime(l.timestamp);
                let fullDate = '';
                let timeStr = '';
                try {
                    const d = new Date(l.timestamp);
                    fullDate = d.toLocaleString('en-IN');
                    timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                } catch(e) {
                    fullDate = l.timestamp || '';
                    timeStr = '';
                }

                return `
                    <div class="p-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100/70 dark:hover:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 transition flex items-start gap-3">
                        <div class="w-9 h-9 rounded-xl ${meta.bg} ${meta.text} flex items-center justify-center text-sm shrink-0 mt-0.5">
                            <i class="fa-solid ${meta.icon}"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between gap-2">
                                <h4 class="font-extrabold text-xs text-slate-900 dark:text-white truncate">${App.escapeHtml(l.title)}</h4>
                                <span class="text-[10px] text-slate-400 font-medium shrink-0" title="${fullDate}">${timeAgo}</span>
                            </div>
                            <p class="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">${App.escapeHtml(l.description)}</p>
                            <div class="flex items-center gap-2 mt-1.5">
                                <span class="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${meta.bg} ${meta.text}">${meta.label}</span>
                                ${timeStr ? `
                                <span class="text-[9px] text-slate-400 font-mono flex items-center gap-1">
                                    <i class="fa-regular fa-clock text-[8px]"></i>
                                    <span>${timeStr}</span>
                                </span>` : ''}
                                <span class="text-[9px] text-slate-400 font-mono flex items-center gap-1">
                                    <i class="fa-solid fa-display text-[8px]"></i>
                                    <span>${App.escapeHtml(l.device || 'Web')}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                `;
            } catch (itemErr) {
                console.warn('Error rendering activity item:', itemErr);
                return '';
            }
        }).join('');
    },

    exportActivityHistoryCSV() {
        const csv = ActivityLogger.exportCSV();
        if (!csv) {
            this.showToast('No activity logs available to export.', 'info');
            return;
        }
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const dateStr = new Date().toISOString().slice(0, 10);
        const filename = `Meera_Heights_Activity_History_${dateStr}.csv`;
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 1000);
        this.showToast('Activity history exported to CSV!', 'success');
    },

    clearActivityHistory() {
        if (confirm('Are you sure you want to clear all activity logs? This cannot be undone.')) {
            ActivityLogger.clear();
            this.renderActivityHistory();
            this.showToast('Activity logs cleared.', 'info');
        }
    }
};

// Global helper access
window.App = App;
window.openCloudSyncModal = () => App.openCloudSyncModal();
window.openCloudPairQrModal = () => App.openCloudPairQrModal();

// Bootstrap app safely on DOM ready or immediately if already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        App.init();
    });
} else {
    App.init();
}
