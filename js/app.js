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
    activeFloorFilter: 'all',     // 'all', '1', '2', '3', '4', '5'
    floorMonthFilter: 'all',
    floorSearchQuery: '',
    sortState: {
        expenses: 'date-desc',
        floor: 'date-desc',
        rent: 'date-desc',
        wallet: 'date-desc'
    },
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
        this.data = StorageManager.getData();
        this.setupEventListeners();
        this.populateMonthFilter();
        
        // Auto-post recurring expenses if enabled
        this.checkAndAutoPostRecurring();

        // Initialize Real-Time Cloud Sync Engine (Firebase)
        this.initCloudSync();

        this.renderAll();
        console.log('Meera Heights App Initialized with Floor Ownership & Advance Management.');
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
        // Top Navbar Pill Indicators
        const dot = document.getElementById('nav-cloud-sync-dot');
        const text = document.getElementById('nav-cloud-sync-text');
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

        if (status === 'connected') {
            if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50';
            if (text) text.textContent = 'Sync Live';
            if (badge) {
                badge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
                badge.textContent = 'Connected (Live)';
            }
            if (statusText) statusText.textContent = 'Connected & Listening';
            if (modalDot) modalDot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0';
            if (modalLabel) modalLabel.textContent = 'Connected & Syncing';
            if (modalDetails) modalDetails.textContent = detail || 'Firestore real-time listener active';
        } else if (status === 'syncing') {
            if (dot) dot.className = 'w-2 h-2 rounded-full bg-blue-500 animate-pulse';
            if (text) text.textContent = 'Syncing...';
            if (badge) {
                badge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-blue-500/20 text-blue-300 border border-blue-500/30';
                badge.textContent = 'Syncing...';
            }
            if (statusText) statusText.textContent = detail || 'Synchronizing with cloud...';
            if (modalDot) modalDot.className = 'w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shrink-0';
            if (modalLabel) modalLabel.textContent = 'Syncing...';
            if (modalDetails) modalDetails.textContent = detail;
        } else if (status === 'offline') {
            if (dot) dot.className = 'w-2 h-2 rounded-full bg-amber-500';
            if (text) text.textContent = 'Offline';
            if (badge) {
                badge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-amber-500/20 text-amber-300 border border-amber-500/30';
                badge.textContent = 'Offline';
            }
            if (statusText) statusText.textContent = 'Offline (Local persistence active)';
            if (modalDot) modalDot.className = 'w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0';
            if (modalLabel) modalLabel.textContent = 'Device Offline';
            if (modalDetails) modalDetails.textContent = detail || 'Changes queued locally';
        } else if (status === 'error') {
            if (dot) dot.className = 'w-2 h-2 rounded-full bg-rose-500';
            if (text) text.textContent = 'Sync Error';
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
            if (dot) dot.className = 'w-2 h-2 rounded-full bg-slate-400';
            if (text) text.textContent = 'Sync Off';
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
        this.data = newData;
        this.renderAll();

        const platform = meta && meta.clientPlatform ? meta.clientPlatform : 'paired device';
        this.showToast(`Cloud data updated from ${platform}! Synchronized successfully.`, 'info');
    },

    openCloudSyncModal() {
        const textarea = document.getElementById('cloud-sync-config-input');
        if (textarea && typeof CloudSyncManager !== 'undefined') {
            const currentCfg = CloudSyncManager.getConfig();
            if (currentCfg) {
                textarea.value = JSON.stringify(currentCfg, null, 2);
            } else {
                textarea.value = '';
            }
        }
        if (typeof CloudSyncManager !== 'undefined') {
            this.updateCloudSyncUI(CloudSyncManager.syncStatus, CloudSyncManager.lastStatusDetail);
        }
        this.showModal('modal-cloud-sync-setup');
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
        if (typeof CloudSyncManager === 'undefined' || !CloudSyncManager.getConfig() || !CloudSyncManager.isEnabled()) {
            alert('Please configure and connect Cloud Sync on this computer first before pairing a mobile device.');
            this.openCloudSyncModal();
            return;
        }

        const pairingUrl = CloudSyncManager.generatePairingUrl();
        if (!pairingUrl) {
            alert('Could not generate pairing URL. Please re-check your Cloud Sync configuration.');
            return;
        }

        const urlInput = document.getElementById('cloud-pair-url-input');
        if (urlInput) urlInput.value = pairingUrl;

        const qrContainer = document.getElementById('cloud-sync-qrcode');
        if (qrContainer) {
            qrContainer.innerHTML = '';
            if (typeof QRCode !== 'undefined') {
                try {
                    new QRCode(qrContainer, {
                        text: pairingUrl,
                        width: 220,
                        height: 220,
                        colorDark: "#0f172a",
                        colorLight: "#ffffff",
                        correctLevel: QRCode.CorrectLevel.M
                    });
                } catch (err) {
                    console.error('QRCode generation error:', err);
                    qrContainer.innerHTML = '<p class="text-xs text-rose-500">QR code failed to render. Use the copy link below.</p>';
                }
            } else {
                qrContainer.innerHTML = '<p class="text-xs text-slate-500">QRCode library loading... Use the copy link below.</p>';
            }
        }

        this.showModal('modal-cloud-sync-qr');
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

    forceSyncNow() {
        if (typeof CloudSyncManager === 'undefined' || !CloudSyncManager.getConfig() || !CloudSyncManager.isEnabled()) {
            this.showToast('Cloud Sync is not configured yet. Click Configure to set it up.', 'warning');
            this.openCloudSyncModal();
            return;
        }
        this.showToast('Uploading latest data to cloud...', 'info');
        CloudSyncManager.pushToCloud(this.data, true);
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
    },

    downloadSingleSheet(sheetKey) {
        const cfg = ExcelExporter.getSheetConfig(sheetKey, { data: this.data, stats: this.getStats() });
        const title = cfg ? cfg.name : sheetKey;
        this.showToast(`Generating ${title} (.xlsx)...`, 'info');
        setTimeout(() => {
            const success = ExcelExporter.exportSheet(sheetKey, {
                data: this.data,
                stats: this.getStats()
            });
            if (success) {
                this.showToast(`${title} exported successfully!`, 'success');
            }
        }, 100);
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
        setTimeout(() => {
            const success = ExcelExporter.exportWorkbook({
                data: this.data,
                stats: this.getStats()
            });
            if (success) {
                this.showToast('Meera_Heights_Building_Accounts.xlsx downloaded successfully!', 'success');
            }
        }, 100);
    },

    downloadCSV() {
        this.showToast('Generating CSV ledger...', 'info');
        setTimeout(() => {
            const success = ExcelExporter.exportCSV({
                data: this.data,
                stats: this.getStats()
            });
            if (success) {
                this.showToast('CSV Ledger downloaded successfully!', 'success');
            }
        }, 100);
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

    downloadMonthlyPDF(type = 'expense') {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            this.showToast('PDF library is unavailable. Check your internet connection and try again.', 'error');
            return;
        }
        const month = this.selectedMonthFilter || 'all';
        const rents = (this.data.rentCollections || []).filter(r => month === 'all' || r.month === month || (r.paymentDate || '').startsWith(month));
        const expenses = (this.data.expenses || []).filter(e => month === 'all' || (e.date || '').startsWith(month) || e.monthKey === month);
        const rows = type === 'rent' ? rents : expenses;
        const title = type === 'rent' ? 'Monthly Rent Collections Report' : 'Monthly Expenses Report';
        const monthLabel = month === 'all' ? 'All Months' : month;
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        let y = 18;
        const pageWidth = doc.internal.pageSize.getWidth();
        const total = rows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('Meera Heights', 14, y); y += 7;
        doc.setFontSize(13); doc.text(title, 14, y); y += 6;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(`Period: ${monthLabel} | Generated: ${new Date().toLocaleString('en-IN')}`, 14, y); y += 8;
        doc.setFont('helvetica', 'bold'); doc.text(`Records: ${rows.length}    Total: Rs. ${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 14, y); y += 8;
        doc.setDrawColor(190); doc.line(14, y, pageWidth - 14, y); y += 6;
        rows.forEach((row, index) => {
            const tenant = this.data.tenants.find(t => t.id === row.tenantId);
            const category = this.data.categories.find(c => c.id === row.categoryId);
            const heading = type === 'rent'
                ? `${index + 1}. ${row.paymentDate || ''} | ${tenant?.name || row.tenantName || 'Tenant'} | Rs. ${Number(row.amount || 0).toLocaleString('en-IN')}`
                : `${index + 1}. ${row.date || ''} | ${row.title || 'Expense'} | Rs. ${Number(row.amount || 0).toLocaleString('en-IN')}`;
            const details = type === 'rent'
                ? `Month: ${row.month || '-'} | Flat: ${tenant?.flat || row.flat || '-'} | Owner: ${row.ownerCredited || '-'} | Mode: ${row.paymentMode || row.mode || '-'}`
                : `Category: ${category?.name || row.categoryName || '-'} | Sajida: Rs. ${Number(row.sajidaAmount || 0).toLocaleString('en-IN')} | Jeelani: Rs. ${Number(row.jeelaniAmount || 0).toLocaleString('en-IN')} | Wallet: ${row.debitedWallet || row.debitedSource || '-'}`;
            doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(heading, 14, y); y += 5;
            doc.setFont('helvetica', 'normal'); const wrapped = doc.splitTextToSize(details, pageWidth - 28); doc.text(wrapped, 14, y); y += wrapped.length * 4.5 + 4;
            if (y > 275) { doc.addPage(); y = 18; }
        });
        doc.save(`Meera_Heights_${type}_${month}.pdf`);
        this.showToast('Monthly PDF report downloaded.', 'success');
    },

    // -------------------------------------------------------------
    // RENDER DISPATCHER
    // -------------------------------------------------------------
    renderAll() {
        const stats = this.getStats();
        this.renderStatsCards(stats);
        this.renderRecurringBanner();
        this.renderCategoryPills();
        this.renderExpenses();
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

        // Header mini balance badge
        this.setElementText('header-treasury-badge', `₹${stats.netBuildingBalance.toLocaleString('en-IN')}`);
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
    },

    setExpenseCategory(catId) {
        this.expenseCategoryFilter = catId;
        this.renderCategoryPills();
        this.renderExpenses();
    },

    // -------------------------------------------------------------
    // EXPENSES LISTING
    // -------------------------------------------------------------
    renderExpenses() {
        const container = document.getElementById('expenses-list-container');
        if (!container) return;

        let filtered = [...this.data.expenses];

        if (this.expenseCategoryFilter !== 'all') {
            filtered = filtered.filter(e => e.categoryId === this.expenseCategoryFilter);
        }

        if (this.expenseSearchQuery.trim()) {
            const q = this.expenseSearchQuery.toLowerCase();
            filtered = filtered.filter(e => 
                (e.title && e.title.toLowerCase().includes(q)) ||
                (e.notes && e.notes.toLowerCase().includes(q))
            );
        }

        if (this.selectedMonthFilter !== 'all') {
            filtered = filtered.filter(e => e.date && e.date.startsWith(this.selectedMonthFilter));
        }

        filtered = this.sortRecords(filtered, this.sortState.expenses, 'title');
        const expenseSort = document.getElementById('expense-sort');
        if (expenseSort) expenseSort.value = this.sortState.expenses;

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8">
                    <div class="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                        <i class="fa-solid fa-receipt text-2xl"></i>
                    </div>
                    <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200">No Expenses Recorded</h3>
                    <p class="text-sm text-slate-500 mt-1 max-w-sm mx-auto">No expenses match your active filter. Tap the button below to add building maintenance or bill payment.</p>
                    <button onclick="App.openExpenseModal()" class="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition">
                        <i class="fa-solid fa-plus mr-1.5"></i> Add New Expense
                    </button>
                </div>
            `;
            return;
        }

        let html = `
            <div class="overflow-x-auto rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
                <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                    <thead class="bg-slate-50 dark:bg-slate-700/60 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            <th class="px-4 py-3.5">Date & Item</th>
                            <th class="px-4 py-3.5">Category Sheet</th>
                            <th class="px-4 py-3.5">Amount</th>
                            <th class="px-4 py-3.5">Split Allocation</th>
                            <th class="px-4 py-3.5">Debited Wallet</th>
                            <th class="px-4 py-3.5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
        `;

        filtered.forEach(exp => {
            const cat = this.data.categories.find(c => c.id === exp.categoryId) || { name: 'General', icon: 'fa-tag', color: '#10B981' };
            
            let splitBadge = '';
            if (exp.splitType === 'sajida_only') {
                splitBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">100% Sajida (Fl 1-2)</span>`;
            } else if (exp.splitType === 'jeelani_only') {
                splitBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">100% Jeelani (Fl 3-5)</span>`;
            } else if (exp.splitType === 'custom') {
                splitBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">Custom (${exp.sajidaRatio}% : ${exp.jeelaniRatio}%)</span>
                              <div class="text-[11px] text-slate-500 mt-0.5">S: ₹${exp.sajidaAmount} | J: ₹${exp.jeelaniAmount}</div>`;
            } else {
                splitBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">60:40 Floor Ratio</span>
                              <div class="text-[11px] text-slate-500 mt-0.5">S(40%): ₹${exp.sajidaAmount} | J(60%): ₹${exp.jeelaniAmount}</div>`;
            }

            let walletText = `<span class="font-medium text-slate-700 dark:text-slate-300">Both Wallets</span>`;
            if (exp.debitedWallet === 'sajida') walletText = `<span class="font-medium text-emerald-600">Sajida's Wallet</span>`;
            if (exp.debitedWallet === 'jeelani') walletText = `<span class="font-medium text-blue-600">Jeelani's Wallet</span>`;

            html += `
                <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition">
                    <td class="px-4 py-3.5">
                        <div class="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>${exp.title}</span>
                            ${exp.isRecurring ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200"><i class="fa-solid fa-arrows-rotate text-[8px]"></i> Auto-Recurring</span>` : ''}
                        </div>
                        <div class="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <i class="fa-regular fa-calendar"></i> ${exp.date || 'N/A'}
                            ${exp.notes ? `<span class="text-slate-300 dark:text-slate-600">•</span> <span class="truncate max-w-xs">${exp.notes}</span>` : ''}
                        </div>
                    </td>
                    <td class="px-4 py-3.5">
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                            <i class="fa-solid ${cat.icon}" style="color: ${cat.color}"></i>
                            ${cat.name}
                        </span>
                    </td>
                    <td class="px-4 py-3.5">
                        <div class="font-bold text-slate-900 dark:text-white text-base">₹${parseFloat(exp.amount).toLocaleString('en-IN')}</div>
                    </td>
                    <td class="px-4 py-3.5">${splitBadge}</td>
                    <td class="px-4 py-3.5 text-xs">${walletText}</td>
                    <td class="px-4 py-3.5 text-right whitespace-nowrap">
                        <button onclick="App.editExpense('${exp.id}')" class="p-1.5 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition" title="Edit">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button onclick="App.deleteExpense('${exp.id}')" class="p-1.5 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition ml-1" title="Delete">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
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

            <div class="overflow-x-auto">
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

        if (tableList.length === 0) {
            ledgerHtml += `
                <tr>
                    <td colspan="9" class="text-center py-12 text-slate-400">
                        <i class="fa-solid fa-layer-group text-3xl mb-2 text-slate-300 block"></i>
                        No expense records found for this floor filter.
                    </td>
                </tr>
            `;
        } else {
            tableList.forEach(item => {
                const cat = this.data.categories.find(c => c.id === item.categoryId) || { name: 'Expense', icon: 'fa-tag', color: '#64748b' };
                const ownerBadge = item.floorOwner === 'Sajida' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800';
                
                let walletBadge = 'Split 60:40';
                if (item.debitedWallet === 'sajida') walletBadge = 'Sajida (100%)';
                else if (item.debitedWallet === 'jeelani') walletBadge = 'Jeelani (100%)';
                else if (item.paidBy) walletBadge = item.paidBy;

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
            });
        }

        ledgerHtml += `
                    </tbody>
                </table>
            </div>
        `;

        ledgerContainer.innerHTML = ledgerHtml;
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
                            <div class="text-[10px] text-slate-400">
                                Move-in: ${tenant.moveInDate || 'N/A'}
                            </div>
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

        let html = `
            <div class="overflow-x-auto rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
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

        list.forEach(rent => {
            const floor = rent.floor || this.detectFloorFromFlat(rent.flat);
            const ownerInfo = this.getFloorOwner(floor);

            let ownerBadge = '';
            if (rent.ownerCredited === 'sajida') {
                ownerBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Sajida (Floors 1-2)</span>`;
            } else if (rent.ownerCredited === 'jeelani') {
                ownerBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Jeelani (Floors 3-5)</span>`;
            } else {
                ownerBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">50:50 Shared</span>`;
            }

            let destBadge = '';
            if (rent.creditDestination === 'bank') {
                destBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200 mt-1 block w-max"><i class="fa-solid fa-building-columns"></i> ${rent.bankName || 'Bank'}</span>`;
            } else {
                destBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-1 block w-max"><i class="fa-solid fa-wallet"></i> Cash Wallet</span>`;
            }

            html += `
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
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
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

    // --- Sub-Tab 1: Unified Wallet History with EDIT & DELETE on EVERY transaction ---
    renderWalletUnifiedTimeline(container) {
        const stream = [];

        // Rents
        (this.data.rentCollections || []).forEach(r => {
            const floor = r.floor || this.detectFloorFromFlat(r.flat);
            const targetWallet = r.ownerCredited === 'sajida' ? 'sajida_rent' : 'jeelani_rent';
            stream.push({
                id: r.id,
                type: 'rent',
                walletId: targetWallet,
                title: `Rent: ${r.tenantName} (${r.flat} - ${floor} Floor)`,
                amount: r.amount,
                date: r.paymentDate,
                category: 'Rent Collection',
                ownerCredited: r.ownerCredited,
                ownerDisplay: r.ownerCredited === 'sajida' ? 'Sajida Rent' : (r.ownerCredited === 'jeelani' ? 'Jeelani Rent' : '50:50 Split')
            });
        });

        // Expenses
        (this.data.expenses || []).forEach(e => {
            const cat = this.data.categories.find(c => c.id === e.categoryId);
            const targetWallet = e.debitedWallet === 'sajida' ? 'sajida_advance' : (e.debitedWallet === 'jeelani' ? 'jeelani_advance' : 'both');
            stream.push({
                id: e.id,
                type: 'expense',
                walletId: targetWallet,
                title: `Expense: ${e.title}`,
                amount: e.amount,
                date: e.date,
                category: cat ? cat.name : 'Maintenance',
                debitedWallet: e.debitedWallet,
                sajidaShare: e.sajidaAmount,
                jeelaniShare: e.jeelaniAmount,
                ownerDisplay: e.debitedWallet === 'sajida' ? 'Sajida Advance' : (e.debitedWallet === 'jeelani' ? 'Jeelani Advance' : `Shared (S: ₹${e.sajidaAmount} | J: ₹${e.jeelaniAmount})`)
            });
        });

        // Capital Adjustments
        (this.data.walletAdjustments || []).forEach(adj => {
            const isDeposit = adj.type === 'deposit';
            const targetWallet = adj.walletId || (adj.ownerId === 'sajida' ? 'sajida_advance' : 'jeelani_advance');
            const wInfo = this.getWalletInfo(targetWallet);
            stream.push({
                id: adj.id,
                type: 'capital',
                walletId: targetWallet,
                title: `Capital ${isDeposit ? 'Deposit' : 'Withdrawal'}: ${adj.notes || 'Owner corpus'}`,
                amount: adj.amount,
                date: adj.date,
                category: isDeposit ? 'Capital Inflow' : 'Capital Payout',
                isDeposit,
                ownerCredited: adj.ownerId,
                ownerDisplay: wInfo ? wInfo.shortName : (adj.ownerId === 'sajida' ? 'Sajida' : 'Jeelani')
            });
        });

        // Advance Deposits Received
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

        // Advance Settlements (Refunds Paid & Deductions Retained)
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

        // Wallet ⇄ Bank Transactions
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
                amount: tx.amount,
                date: tx.date,
                category: isWalletToBank ? 'Wallet ➔ Bank' : 'Bank ➔ Wallet',
                isCredit: !isWalletToBank,
                ownerCredited: tx.ownerId,
                ownerDisplay: wInfo.shortName,
                reference: tx.reference,
                transferMode: tx.transferMode
            });
        });

        // Advance ⇄ Rent Internal Wallet Transfers
        (this.data.walletTransfers || []).forEach(wt => {
            const fromInfo = this.getWalletInfo(wt.fromWallet);
            const toInfo = this.getWalletInfo(wt.toWallet);
            stream.push({
                id: wt.id,
                type: 'wallet_transfer',
                title: `Wallet Transfer: ${fromInfo.shortName} ➔ ${toInfo.shortName}`,
                amount: wt.amount,
                date: wt.date,
                category: 'Advance ⇄ Rent Transfer',
                ownerCredited: fromInfo.ownerId,
                fromWallet: wt.fromWallet,
                toWallet: wt.toWallet,
                ownerDisplay: `${fromInfo.shortName} ➔ ${toInfo.shortName}`,
                notes: wt.reason ? `${wt.reason}${wt.notes ? ` • ${wt.notes}` : ''}` : wt.notes
            });
        });

        // Filter by Owner or Specific Wallet
        let filtered = stream;
        if (this.walletOwnerFilter === 'sajida') {
            filtered = filtered.filter(item => 
                item.ownerCredited === 'sajida' || 
                item.debitedWallet === 'sajida' || 
                item.debitedWallet === 'both' ||
                (item.walletId && item.walletId.startsWith('sajida')) ||
                (item.fromWallet && item.fromWallet.startsWith('sajida')) ||
                (item.toWallet && item.toWallet.startsWith('sajida'))
            );
        } else if (this.walletOwnerFilter === 'jeelani') {
            filtered = filtered.filter(item => 
                item.ownerCredited === 'jeelani' || 
                item.debitedWallet === 'jeelani' || 
                item.debitedWallet === 'both' ||
                (item.walletId && item.walletId.startsWith('jeelani')) ||
                (item.fromWallet && item.fromWallet.startsWith('jeelani')) ||
                (item.toWallet && item.toWallet.startsWith('jeelani'))
            );
        } else if (this.walletOwnerFilter !== 'all') {
            filtered = filtered.filter(item => 
                item.fromWallet === this.walletOwnerFilter ||
                item.toWallet === this.walletOwnerFilter ||
                item.walletId === this.walletOwnerFilter ||
                (item.walletId === 'both' && (this.walletOwnerFilter === 'sajida_advance' || this.walletOwnerFilter === 'jeelani_advance'))
            );
        }

        filtered = this.sortRecords(filtered, this.sortState.wallet, 'title');

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
        this.hideModal('modal-add-tenant');
        this.renderAll();
        this.showToast(`Tenant "${name}" (${floor} Floor, ${ownerInfo.name}) saved.`);
    },

    editTenant(id) {
        this.openTenantModal(id);
    },

    deleteTenant(id) {
        if (!confirm('Are you sure you want to delete this tenant record? All history will remain.')) return;
        this.data.tenants = this.data.tenants.filter(t => t.id !== id);
        StorageManager.saveData(this.data);
        this.renderAll();
        this.showToast('Tenant record removed.');
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
            html += `<option value="${cat.id}">${cat.name}</option>`;
        });
        select.innerHTML = html;
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
        this.hideModal('modal-add-expense');
        this.renderAll();
        this.showToast(`Expense of ₹${amount.toLocaleString('en-IN')} debited successfully!`);
    },

    editExpense(id) {
        this.openExpenseModal(id);
    },

    deleteExpense(id) {
        if (!confirm('Are you sure you want to delete this expense record?')) return;
        this.data.expenses = this.data.expenses.filter(e => e.id !== id);
        StorageManager.saveData(this.data);
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
        if (this.expenseCategoryFilter === id) {
            this.expenseCategoryFilter = 'all';
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
        this.data.walletAdjustments = (this.data.walletAdjustments || []).filter(a => a.id !== id);
        StorageManager.saveData(this.data);
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
            btn.classList.toggle('text-slate-400', !isTarget);
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (tabId === 'dashboard') {
            setTimeout(() => this.renderCharts(), 50);
        } else if (tabId === 'floors') {
            this.renderFloorBreakupPage();
        }
    },

    // -------------------------------------------------------------
    // HELPERS & SETUP
    // -------------------------------------------------------------
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    },

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    },

    setElementText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    },

    populateMonthFilter() {
        const select = document.getElementById('global-month-filter');
        if (!select) return;

        const monthsMap = {};
        monthsMap[this.getCurrentMonthKey()] = true;

        [...this.data.rentCollections, ...this.data.expenses].forEach(item => {
            const m = item.month || (item.date ? item.date.slice(0, 7) : '');
            if (m) monthsMap[m] = true;
        });

        const sorted = Object.keys(monthsMap).sort().reverse();
        let html = `<option value="all">All Months</option>`;
        sorted.forEach(m => {
            html += `<option value="${m}">${m}</option>`;
        });
        select.innerHTML = html;
    },

    renderSettingsPage() {
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
                this.expenseSearchQuery = e.target.value;
                this.renderExpenses();
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

        // Global month filter
        const monthFilter = document.getElementById('global-month-filter');
        if (monthFilter) {
            monthFilter.addEventListener('change', e => {
                this.selectedMonthFilter = e.target.value;
                this.renderExpenses();
                this.renderRentLedger();
            });
        }

        // Backup & Restore
        const btnBackup = document.getElementById('btn-export-backup');
        if (btnBackup) {
            btnBackup.addEventListener('click', () => StorageManager.exportJsonBackup());
        }

        const fileRestore = document.getElementById('file-import-backup');
        if (fileRestore) {
            fileRestore.addEventListener('change', e => {
                if (e.target.files && e.target.files[0]) {
                    if (!confirm('Restore this backup and replace the current browser data? Export a backup first if you need the current data.')) {
                        e.target.value = '';
                        return;
                    }
                    StorageManager.importJsonBackup(e.target.files[0], (success, msg) => {
                        this.showToast(msg, success ? 'success' : 'error');
                        if (success) {
                            this.data = StorageManager.getData();
                            this.activeTab = 'dashboard';
                            this.selectedMonthFilter = 'all';
                            this.renderAll();
                        }
                    });
                }
            });
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
    }
};

// Bootstrap app on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
