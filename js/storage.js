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

    static saveData(data) {
        try {
            localStorage.setItem(STORAGE_KEYS.APP_DATA, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Error saving to localStorage:', e);
            return false;
        }
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
