/**
 * storage.js - Data Layer for Meera Heights Building Management
 * Co-owned by Sajida (1st & 2nd Floors) and Jeelani (3rd, 4th & 5th Floors)
 * Handles LocalStorage persistence, floor ownership mapping, advance settlements, and JSON backup/restore.
 */

const STORAGE_KEYS = {
    APP_DATA: 'meera_heights_data_v4', // v4: Floor ownership & Advance settlement architecture
    SETTINGS: 'meera_heights_settings_v4'
};

// Floor ownership definition requested by user
const FLOOR_OWNERSHIP = {
    1: { floorName: '1st Floor', ownerId: 'sajida', ownerName: 'Sajida' },
    2: { floorName: '2nd Floor', ownerId: 'sajida', ownerName: 'Sajida' },
    3: { floorName: '3rd Floor', ownerId: 'jeelani', ownerName: 'Jeelani' },
    4: { floorName: '4th Floor', ownerId: 'jeelani', ownerName: 'Jeelani' },
    5: { floorName: '5th Floor', ownerId: 'jeelani', ownerName: 'Jeelani' }
};

// Default dynamic categories
const DEFAULT_CATEGORIES = [
    { id: 'cat_maintenance', name: 'Maintenance', icon: 'fa-wrench', color: '#3B82F6', desc: 'General building repairs & civil maintenance', isDefault: true },
    { id: 'cat_expenditure', name: 'General Expenditure', icon: 'fa-receipt', color: '#6B7280', desc: 'Day-to-day general building expenses', isDefault: true },
    { id: 'cat_watchman', name: 'Watchman Salary', icon: 'fa-user-shield', color: '#10B981', desc: 'Monthly security guard / watchman compensation', isDefault: true },
    { id: 'cat_caretaker', name: 'Property Caretaker Salary', icon: 'fa-user-tie', color: '#8B5CF6', desc: 'Building manager & property caretaker wages', isDefault: true },
    { id: 'cat_current_bills', name: 'Current Bills (Electricity)', icon: 'fa-bolt', color: '#F59E0B', desc: 'Common area electricity, motor, lighting & meter charges', isDefault: true },
    { id: 'cat_water_tax', name: 'Water Tax / Water Charges', icon: 'fa-faucet-drip', color: '#06B6D4', desc: 'Municipal water supply tax, borewell & tanker charges', isDefault: true },
    { id: 'cat_property_tax', name: 'Property Tax', icon: 'fa-landmark', color: '#EF4444', desc: 'Municipal municipal council / corporation property taxes', isDefault: true },
    { id: 'cat_solar_maint', name: 'Solar Maintenance', icon: 'fa-solar-panel', color: '#EC4899', desc: 'Rooftop solar panel cleaning, inverter AMC & servicing', isDefault: true },
    { id: 'cat_internet_bills', name: 'Internet Bills', icon: 'fa-wifi', color: '#6366F1', desc: 'CCTV broadband, security Wi-Fi and smart meter connections', isDefault: true },
    { id: 'cat_miscellaneous', name: 'Miscellaneous', icon: 'fa-boxes-packing', color: '#64748B', desc: 'Unforeseen expenses, festival tips, cleaning supplies', isDefault: true }
];

// Pre-configured recurring expenses templates
const DEFAULT_RECURRING_EXPENSES = [
    {
        id: 'rec_watchman',
        title: 'Watchman Monthly Salary - Ramu K',
        categoryId: 'cat_watchman',
        amount: 12000,
        dayOfMonth: 1,
        frequency: 'monthly',
        splitType: 'ratio',
        sajidaRatio: 40,
        jeelaniRatio: 60,
        debitedWallet: 'both',
        paidBy: 'Wallet Split (60:40)',
        active: true,
        notes: 'Monthly security guard salary due on 1st'
    },
    {
        id: 'rec_caretaker',
        title: 'Caretaker Monthly Wages - Altaf',
        categoryId: 'cat_caretaker',
        amount: 8000,
        dayOfMonth: 2,
        frequency: 'monthly',
        splitType: 'ratio',
        sajidaRatio: 40,
        jeelaniRatio: 60,
        debitedWallet: 'both',
        paidBy: 'Wallet Split (60:40)',
        active: true,
        notes: 'Building maintenance supervisor salary due on 2nd'
    },
    {
        id: 'rec_internet',
        title: 'CCTV Wi-Fi & Internet Bill',
        categoryId: 'cat_internet_bills',
        amount: 799,
        dayOfMonth: 5,
        frequency: 'monthly',
        splitType: 'ratio',
        sajidaRatio: 40,
        jeelaniRatio: 60,
        debitedWallet: 'both',
        paidBy: 'Wallet Split (60:40)',
        active: true,
        notes: 'Airtel Fiber CCTV broadband plan recharge'
    },
    {
        id: 'rec_current_bills',
        title: 'Common Electricity / Motor Bill',
        categoryId: 'cat_current_bills',
        amount: 4500,
        dayOfMonth: 10,
        frequency: 'monthly',
        splitType: 'ratio',
        sajidaRatio: 40,
        jeelaniRatio: 60,
        debitedWallet: 'both',
        paidBy: 'Wallet Split (60:40)',
        active: true,
        notes: 'Estimated monthly common meter BESCOM electricity'
    },
    {
        id: 'rec_solar',
        title: 'Solar Water Heater & Panel Servicing',
        categoryId: 'cat_solar_maint',
        amount: 1500,
        dayOfMonth: 15,
        frequency: 'monthly',
        splitType: 'ratio',
        sajidaRatio: 40,
        jeelaniRatio: 60,
        debitedWallet: 'both',
        paidBy: 'Wallet Split (60:40)',
        active: true,
        notes: 'Monthly rooftop solar panel AMC and descaling'
    }
];

// 4 Distinct Wallets Architecture
const WALLET_DEFINITIONS = {
    sajida_advance: {
        id: 'sajida_advance',
        name: 'Sajida Advance Wallet',
        shortName: 'Sajida Advance',
        ownerId: 'sajida',
        ownerName: 'Sajida',
        type: 'advance',
        floors: '1st & 2nd Floors',
        color: 'emerald',
        icon: 'fa-shield-halved',
        badgeBg: 'bg-emerald-100 text-emerald-800',
        description: 'Advance deposits from tenants & expense deductions'
    },
    sajida_rent: {
        id: 'sajida_rent',
        name: 'Sajida Rent Wallet',
        shortName: 'Sajida Rent',
        ownerId: 'sajida',
        ownerName: 'Sajida',
        type: 'rent',
        floors: '1st & 2nd Floors',
        color: 'teal',
        icon: 'fa-hand-holding-dollar',
        badgeBg: 'bg-teal-100 text-teal-800',
        description: 'Monthly rent collections from Floors 1 & 2'
    },
    jeelani_advance: {
        id: 'jeelani_advance',
        name: 'Jeelani Advance Wallet',
        shortName: 'Jeelani Advance',
        ownerId: 'jeelani',
        ownerName: 'Jeelani',
        type: 'advance',
        floors: '3rd, 4th & 5th Floors',
        color: 'blue',
        icon: 'fa-shield-halved',
        badgeBg: 'bg-blue-100 text-blue-800',
        description: 'Advance deposits from tenants & expense deductions'
    },
    jeelani_rent: {
        id: 'jeelani_rent',
        name: 'Jeelani Rent Wallet',
        shortName: 'Jeelani Rent',
        ownerId: 'jeelani',
        ownerName: 'Jeelani',
        type: 'rent',
        floors: '3rd, 4th & 5th Floors',
        color: 'indigo',
        icon: 'fa-hand-holding-dollar',
        badgeBg: 'bg-indigo-100 text-indigo-800',
        description: 'Monthly rent collections from Floors 3, 4 & 5'
    }
};

// Clean initial data for Meera Heights
const INITIAL_DATA = {
    buildingName: 'Meera Heights',
    autoPostRecurring: false,
    owners: [
        { 
            id: 'sajida', 
            name: 'Sajida', 
            role: 'Building Co-Owner', 
            floorsOwned: '1st & 2nd Floors',
            floorNumbers: [1, 2],
            defaultSplit: 40, 
            sharePct: 40,
            color: 'emerald' 
        },
        { 
            id: 'jeelani', 
            name: 'Jeelani', 
            role: 'Building Co-Owner', 
            floorsOwned: '3rd, 4th & 5th Floors',
            floorNumbers: [3, 4, 5],
            defaultSplit: 60, 
            sharePct: 60,
            color: 'blue' 
        }
    ],
    categories: DEFAULT_CATEGORIES,
    recurringExpenses: DEFAULT_RECURRING_EXPENSES,
    tenants: [],            // Clean slate: ready for real tenants
    rentCollections: [],    // Clean slate: ready for real rent payments
    expenses: [],           // Clean slate: ready for real expenses
    walletAdjustments: [],  // Clean slate: ready for owner capital
    advanceSettlements: [], // Clean slate: tracks security deposits, deductions, and refunds
    bankTransactions: [],   // Tracks Wallet ⇄ Bank interactions (deposits & withdrawals)
    walletTransfers: []     // Tracks Advance Wallet ⇄ Rent Wallet interactions
};

class StorageManager {
    static getData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.APP_DATA);
            if (!raw) {
                this.saveData(INITIAL_DATA);
                return JSON.parse(JSON.stringify(INITIAL_DATA));
            }
            const parsed = JSON.parse(raw);
            
            // Ensure default categories exist
            if (!parsed.categories || parsed.categories.length === 0) {
                parsed.categories = DEFAULT_CATEGORIES;
            }
            
            // Ensure recurring templates exist
            if (!parsed.recurringExpenses || parsed.recurringExpenses.length === 0) {
                parsed.recurringExpenses = DEFAULT_RECURRING_EXPENSES;
            }

            if (typeof parsed.autoPostRecurring === 'undefined') {
                parsed.autoPostRecurring = false;
            }

            if (!parsed.tenants) parsed.tenants = [];
            if (!parsed.rentCollections) parsed.rentCollections = [];
            if (!parsed.expenses) parsed.expenses = [];
            if (!parsed.walletAdjustments) parsed.walletAdjustments = [];
            if (!parsed.advanceSettlements) parsed.advanceSettlements = [];
            if (!parsed.bankTransactions) parsed.bankTransactions = [];
            if (!parsed.walletTransfers) parsed.walletTransfers = [];

            // Backward compatibility: ensure existing bank transactions have walletId
            (parsed.bankTransactions || []).forEach(tx => {
                if (!tx.walletId) {
                    if (tx.notes && tx.notes.toLowerCase().includes('advance')) {
                        tx.walletId = (tx.ownerId === 'sajida') ? 'sajida_advance' : 'jeelani_advance';
                    } else {
                        tx.walletId = (tx.ownerId === 'sajida') ? 'sajida_rent' : 'jeelani_rent';
                    }
                }
            });

            // Ensure owners have floor descriptions & 60:40 default split
            if (!parsed.owners || parsed.owners.length === 0) {
                parsed.owners = INITIAL_DATA.owners;
            } else {
                const sOwner = parsed.owners.find(o => o.id === 'sajida');
                if (sOwner) { sOwner.defaultSplit = 40; sOwner.sharePct = 40; }
                const jOwner = parsed.owners.find(o => o.id === 'jeelani');
                if (jOwner) { jOwner.defaultSplit = 60; jOwner.sharePct = 60; }
            }

            // Update default ratio recurring rules to 60:40 if they were 50:50
            (parsed.recurringExpenses || []).forEach(r => {
                if (r.splitType === 'ratio' && (r.sajidaRatio === 50 && r.jeelaniRatio === 50)) {
                    r.sajidaRatio = 40;
                    r.jeelaniRatio = 60;
                    r.paidBy = 'Wallet Split (60:40)';
                }
            });

            return parsed;
        } catch (e) {
            console.error('Error reading localStorage:', e);
            return JSON.parse(JSON.stringify(INITIAL_DATA));
        }
    }

    static saveDataLocallyOnly(data) {
        try {
            localStorage.setItem(STORAGE_KEYS.APP_DATA, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Error saving to localStorage:', e);
            return false;
        }
    }

    static saveData(data) {
        const saved = this.saveDataLocallyOnly(data);
        if (saved && typeof CloudSyncManager !== 'undefined' && CloudSyncManager.isEnabled() && !CloudSyncManager.isSyncingFromCloud) {
            CloudSyncManager.pushToCloud(data);
        }
        return saved;
    }

    static exportJsonBackup() {
        const data = this.getData();
        const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const downloadAnchor = document.createElement('a');
        const filename = `Meera_Heights_Backup_${new Date().toISOString().slice(0,10)}.json`;
        downloadAnchor.setAttribute("href", jsonStr);
        downloadAnchor.setAttribute("download", filename);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    }

    static importJsonBackup(file, callback) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                const valid = parsed && (parsed.buildingName === 'Meera Heights' || parsed.buildingName) &&
                    Array.isArray(parsed.owners) && Array.isArray(parsed.categories) &&
                    Array.isArray(parsed.tenants) && Array.isArray(parsed.rentCollections) &&
                    Array.isArray(parsed.expenses);
                if (!valid) {
                    if (callback) callback(false, 'Invalid backup file. Required Meera Heights data collections are missing.');
                    return;
                }
                const normalized = {
                    ...JSON.parse(JSON.stringify(INITIAL_DATA)),
                    ...parsed,
                    buildingName: parsed.buildingName || 'Meera Heights',
                    owners: parsed.owners || INITIAL_DATA.owners,
                    categories: parsed.categories || INITIAL_DATA.categories,
                    recurringExpenses: parsed.recurringExpenses || [],
                    tenants: parsed.tenants || [],
                    rentCollections: parsed.rentCollections || [],
                    expenses: parsed.expenses || [],
                    walletAdjustments: parsed.walletAdjustments || [],
                    advanceSettlements: parsed.advanceSettlements || [],
                    bankTransactions: parsed.bankTransactions || [],
                    walletTransfers: parsed.walletTransfers || []
                };
                this.saveData(normalized);
                if (callback) callback(true, 'Data imported successfully. Reloading the app...');
            } catch (err) {
                if (callback) callback(false, 'Error parsing JSON file: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    static resetToDefault() {
        this.saveData(INITIAL_DATA);
        return JSON.parse(JSON.stringify(INITIAL_DATA));
    }
}

// -------------------------------------------------------------
// REAL-TIME CLOUD SYNC MANAGER (FIREBASE FIRESTORE)
// Seamless Sub-Second Sync Across iOS, Android, macOS & Windows
// -------------------------------------------------------------
const CLOUD_SYNC_KEYS = {
    FIREBASE_CONFIG: 'meera_firebase_config_v1',
    SYNC_ENABLED: 'meera_cloud_sync_enabled_v1',
    LAST_SYNCED: 'meera_cloud_last_synced_v1',
    DEVICE_ID: 'meera_device_id_v1'
};

// Default pre-configured cloud database for Meera Heights (Firebase Firestore)
const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyAT3MBVdwg-D2q5bGt-LX7thbm2fyz5RgA",
    authDomain: "meera-heights.firebaseapp.com",
    projectId: "meera-heights",
    storageBucket: "meera-heights.firebasestorage.app",
    messagingSenderId: "75973275632",
    appId: "1:75973275632:web:7d23c4a6c351c6dce1f735",
    measurementId: "G-JSMZB43NTZ"
};

class CloudSyncManager {
    static isInitialized = false;
    static db = null;
    static unsubscribeListener = null;
    static isSyncingFromCloud = false;
    static syncStatus = 'disconnected'; // 'connected' | 'syncing' | 'offline' | 'disconnected' | 'error'
    static lastStatusDetail = '';
    static lastSyncedTimestamp = null;
    static _pendingPushTimeout = null;
    static _lastPushedHash = null;
    static statusCallbacks = [];
    static updateCallbacks = [];

    static getDeviceId() {
        let devId = localStorage.getItem(CLOUD_SYNC_KEYS.DEVICE_ID);
        if (!devId) {
            devId = 'dev_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
            localStorage.setItem(CLOUD_SYNC_KEYS.DEVICE_ID, devId);
        }
        return devId;
    }

    static isEnabled() {
        const val = localStorage.getItem(CLOUD_SYNC_KEYS.SYNC_ENABLED);
        if (val === 'false') return false;
        // Enabled by default so cross-device sync operates seamlessly
        return true;
    }

    static setEnabled(val) {
        localStorage.setItem(CLOUD_SYNC_KEYS.SYNC_ENABLED, val ? 'true' : 'false');
    }

    static getConfig() {
        try {
            const raw = localStorage.getItem(CLOUD_SYNC_KEYS.FIREBASE_CONFIG);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.apiKey && parsed.projectId) return parsed;
            }
        } catch (e) {}
        return DEFAULT_FIREBASE_CONFIG;
    }

    static setConfig(config) {
        if (!config) {
            localStorage.removeItem(CLOUD_SYNC_KEYS.FIREBASE_CONFIG);
        } else {
            localStorage.setItem(CLOUD_SYNC_KEYS.FIREBASE_CONFIG, JSON.stringify(config));
        }
    }

    static getLastSynced() {
        return localStorage.getItem(CLOUD_SYNC_KEYS.LAST_SYNCED) || null;
    }

    static setLastSynced(date = new Date()) {
        const str = date.toISOString();
        this.lastSyncedTimestamp = str;
        localStorage.setItem(CLOUD_SYNC_KEYS.LAST_SYNCED, str);
    }

    static parseFirebaseSnippet(input) {
        if (!input || typeof input !== 'string') return null;
        const trimmed = input.trim();

        // 1. Direct JSON parse
        try {
            const obj = JSON.parse(trimmed);
            if (obj && obj.apiKey && obj.projectId) return obj;
        } catch (e) {}

        // 2. JavaScript config snippet (e.g. const firebaseConfig = { apiKey: "...", projectId: "..." })
        try {
            const apiKeyMatch = trimmed.match(/apiKey\s*:\s*["']([^"']+)["']/);
            const projectIdMatch = trimmed.match(/projectId\s*:\s*["']([^"']+)["']/);
            const authDomainMatch = trimmed.match(/authDomain\s*:\s*["']([^"']+)["']/);
            const appIdMatch = trimmed.match(/appId\s*:\s*["']([^"']+)["']/);
            const storageBucketMatch = trimmed.match(/storageBucket\s*:\s*["']([^"']+)["']/);
            const messagingSenderIdMatch = trimmed.match(/messagingSenderId\s*:\s*["']([^"']+)["']/);

            if (apiKeyMatch && projectIdMatch) {
                return {
                    apiKey: apiKeyMatch[1],
                    projectId: projectIdMatch[1],
                    authDomain: authDomainMatch ? authDomainMatch[1] : `${projectIdMatch[1]}.firebaseapp.com`,
                    appId: appIdMatch ? appIdMatch[1] : undefined,
                    storageBucket: storageBucketMatch ? storageBucketMatch[1] : `${projectIdMatch[1]}.appspot.com`,
                    messagingSenderId: messagingSenderIdMatch ? messagingSenderIdMatch[1] : undefined
                };
            }
        } catch (e) {}

        return null;
    }

    static checkUrlForSyncConfig() {
        try {
            // Check for #cloud-sync=active (default pre-configured pairing)
            if (window.location.hash && window.location.hash.includes('cloud-sync=active')) {
                this.setConfig(DEFAULT_FIREBASE_CONFIG);
                this.setEnabled(true);
                const cleanUrl = window.location.origin + window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
                return { autoConfigured: true, config: DEFAULT_FIREBASE_CONFIG };
            }

            // Check hash for #sync=<base64>
            let encodedConfig = null;
            if (window.location.hash && window.location.hash.startsWith('#sync=')) {
                encodedConfig = window.location.hash.slice(6);
            } else {
                const params = new URLSearchParams(window.location.search);
                if (params.has('sync')) {
                    encodedConfig = params.get('sync');
                }
            }

            if (encodedConfig) {
                const decodedJson = decodeURIComponent(escape(atob(encodedConfig)));
                const parsed = JSON.parse(decodedJson);
                if (parsed && parsed.apiKey && parsed.projectId) {
                    this.setConfig(parsed);
                    this.setEnabled(true);

                    // Clean URL without reloading
                    const cleanUrl = window.location.origin + window.location.pathname;
                    window.history.replaceState({}, document.title, cleanUrl);

                    return { autoConfigured: true, config: parsed };
                }
            }
        } catch (e) {
            console.warn('Could not parse sync credentials from URL:', e);
        }
        return { autoConfigured: false };
    }

    static init() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        // Auto-configure if URL contains mobile pairing QR payload
        const urlCheck = this.checkUrlForSyncConfig();

        window.addEventListener('online', () => {
            if (this.isEnabled() && this.getConfig()) {
                this.updateStatus('syncing', 'Reconnected, synchronizing...');
                this.connect(this.getConfig());
            }
        });

        window.addEventListener('offline', () => {
            this.updateStatus('offline', 'Device is currently offline');
        });

        const config = this.getConfig();
        if (config && this.isEnabled()) {
            this.connect(config, urlCheck.autoConfigured);
        } else {
            this.updateStatus('disconnected', 'Cloud sync not configured');
        }
    }

    static connect(config, notifyUserOnPair = false) {
        if (!config || !config.apiKey || !config.projectId) {
            this.updateStatus('error', 'Invalid Firebase credentials');
            return false;
        }

        if (typeof firebase === 'undefined' || !firebase.initializeApp) {
            this.updateStatus('error', 'Firebase SDK library not loaded');
            console.warn('Firebase SDK script tags missing or failed to load.');
            return false;
        }

        this.updateStatus('syncing', 'Connecting to cloud database...');

        try {
            // Initialize Firebase App
            let app;
            if (firebase.apps && firebase.apps.length > 0) {
                app = firebase.apps[0];
            } else {
                app = firebase.initializeApp(config);
            }

            this.db = firebase.firestore(app);

            // Enable offline persistence if possible
            if (!this._persistenceAttempted) {
                this._persistenceAttempted = true;
                this.db.enablePersistence({ synchronizeTabs: true }).catch(err => {
                    if (err.code === 'failed-precondition') {
                        console.log('Multiple tabs open, offline persistence enabled in primary tab only.');
                    } else if (err.code === 'unimplemented') {
                        console.log('Browser does not support offline firestore persistence.');
                    }
                });
            }

            this.setConfig(config);
            this.setEnabled(true);

            // Setup Real-time Listener on Firestore Document
            this.listenToCloudDocument();

            if (notifyUserOnPair && typeof App !== 'undefined' && App.showToast) {
                App.showToast('Paired with Cloud Database! Real-time sync is active.', 'success');
            }

            return true;
        } catch (e) {
            console.error('Error connecting to Firebase:', e);
            this.updateStatus('error', 'Connection failed: ' + (e.message || e));
            return false;
        }
    }

    static listenToCloudDocument() {
        if (!this.db) return;

        if (this.unsubscribeListener) {
            this.unsubscribeListener();
            this.unsubscribeListener = null;
        }

        const docRef = this.db.collection('buildings').doc('meera_heights');

        this.unsubscribeListener = docRef.onSnapshot({ includeMetadataChanges: false }, (docSnapshot) => {
            if (!navigator.onLine) {
                this.updateStatus('offline', 'Offline');
                return;
            }

            this.updateStatus('connected', 'Live Cloud Sync Connected');

            if (!docSnapshot.exists) {
                // Cloud document does not exist yet. Seed cloud with current local dataset!
                console.log('Cloud database document does not exist yet. Initializing with local data...');
                const localData = StorageManager.getData();
                this.pushToCloud(localData, true);
                return;
            }

            const cloudPayload = docSnapshot.data();
            if (!cloudPayload) return;

            // Avoid echo loops: ignore update if it originated from our own immediate push
            const myDevId = this.getDeviceId();
            if (cloudPayload._cloudMeta && cloudPayload._cloudMeta.senderDeviceId === myDevId) {
                this.setLastSynced(new Date());
                return;
            }

            // Ingest cloud update into local storage and notify UI
            this.isSyncingFromCloud = true;
            try {
                const cleaned = { ...cloudPayload };
                delete cleaned._cloudMeta;

                // Validate and save locally without re-triggering cloud upload
                StorageManager.saveDataLocallyOnly(cleaned);
                this.setLastSynced(new Date());

                // Notify App UI to re-render with fresh cloud data
                this.notifyUpdate(cleaned, cloudPayload._cloudMeta);
            } catch (err) {
                console.error('Error ingesting cloud update:', err);
            } finally {
                this.isSyncingFromCloud = false;
            }
        }, (error) => {
            console.error('Firestore snapshot listener error:', error);
            if (error.code === 'permission-denied') {
                this.updateStatus('error', 'Firestore permission denied. Ensure database rules allow read/write.');
            } else {
                this.updateStatus('error', 'Sync error: ' + error.message);
            }
        });
    }

    static pushToCloud(data, immediate = false) {
        if (!this.db || !this.isEnabled() || this.isSyncingFromCloud) return;

        if (this._pendingPushTimeout) {
            clearTimeout(this._pendingPushTimeout);
            this._pendingPushTimeout = null;
        }

        const doPush = async () => {
            try {
                this.updateStatus('syncing', 'Uploading changes to cloud...');

                const docRef = this.db.collection('buildings').doc('meera_heights');
                const myDevId = this.getDeviceId();
                const now = Date.now();

                const payload = {
                    ...data,
                    _cloudMeta: {
                        senderDeviceId: myDevId,
                        lastUpdated: now,
                        updatedAt: new Date().toISOString(),
                        clientPlatform: navigator.platform || 'web'
                    }
                };

                await docRef.set(payload);
                this.setLastSynced(new Date());
                this.updateStatus('connected', 'Live Cloud Sync Connected');
            } catch (e) {
                console.error('Failed to upload data to cloud:', e);
                if (e.code === 'permission-denied') {
                    this.updateStatus('error', 'Write permission denied in Firestore rules.');
                } else {
                    this.updateStatus('error', 'Failed to upload: ' + (e.message || e));
                }
            }
        };

        if (immediate) {
            doPush();
        } else {
            // Debounce writes by 400ms to batch rapid sequential edits
            this._pendingPushTimeout = setTimeout(doPush, 400);
        }
    }

    static disconnect() {
        if (this.unsubscribeListener) {
            this.unsubscribeListener();
            this.unsubscribeListener = null;
        }
        this.setEnabled(false);
        this.setConfig(null);
        this.db = null;
        this.updateStatus('disconnected', 'Cloud sync disconnected');
    }

    static updateStatus(status, detail = '') {
        this.syncStatus = status;
        this.lastStatusDetail = detail;
        this.statusCallbacks.forEach(cb => {
            try { cb(status, detail); } catch (e) {}
        });
    }

    static onStatusChange(callback) {
        if (typeof callback === 'function') {
            this.statusCallbacks.push(callback);
            callback(this.syncStatus, this.lastStatusDetail);
        }
    }

    static onDataUpdated(callback) {
        if (typeof callback === 'function') {
            this.updateCallbacks.push(callback);
        }
    }

    static notifyUpdate(data, meta) {
        this.updateCallbacks.forEach(cb => {
            try { cb(data, meta); } catch (e) {}
        });
    }

    static generatePairingUrl() {
        const config = this.getConfig();
        if (!config) return null;

        let baseUrl;
        const host = (typeof window !== 'undefined' && window.location) ? window.location.hostname : '';
        const proto = (typeof window !== 'undefined' && window.location) ? window.location.protocol : '';
        if (!host || host === 'localhost' || host === '127.0.0.1' || proto === 'file:') {
            // Mobile devices cannot resolve localhost or local file paths.
            // Direct them to the live hosted web application on GitHub Pages!
            baseUrl = 'https://sameerprince152-ship-it.github.io/meera-height-app/';
        } else {
            baseUrl = window.location.origin + window.location.pathname;
        }

        const isDefault = config.apiKey === DEFAULT_FIREBASE_CONFIG.apiKey && config.projectId === DEFAULT_FIREBASE_CONFIG.projectId;
        if (isDefault) {
            return `${baseUrl.replace(/\/+$/, '')}/#cloud-sync=active`;
        }

        try {
            const json = JSON.stringify(config);
            const encoded = btoa(unescape(encodeURIComponent(json)));
            return `${baseUrl.replace(/\/+$/, '')}/#sync=${encoded}`;
        } catch (e) {
            return `${baseUrl.replace(/\/+$/, '')}/#cloud-sync=active`;
        }
    }
}
