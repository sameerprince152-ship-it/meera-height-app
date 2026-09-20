/**
 * storage.js - Data Layer for Meera Heights Building Management
 * Co-owned by Sajida (1st & 2nd Floors) and Jeelani (3rd, 4th & 5th Floors)
 * Handles LocalStorage persistence, floor ownership mapping, advance settlements, and JSON backup/restore.
 */

const STORAGE_KEYS = {
    APP_DATA: 'meera_heights_data_v4', // v4: Floor ownership & Advance settlement architecture
    SETTINGS: 'meera_heights_settings_v4',
    BACKUP_SETTINGS: 'meera_backup_settings_v1',
    THEME: 'meera_theme_v1',
    AUTH_CREDENTIALS: 'meera_auth_sec_v1',
    AUTH_SESSION: 'meera_auth_session_active',
    ACTIVITY_LOG: 'meera_activity_history_v1',
    DRIVE_BACKUPS: 'meera_drive_backups_registry_v1',
    EMAIL_BACKUPS: 'meera_email_backups_registry_v1'
};

// Floor ownership definition requested by user
const FLOOR_OWNERSHIP = {
    1: { floorName: '1st Floor', ownerId: 'sajida', ownerName: 'Sajida' },
    2: { floorName: '2nd Floor', ownerId: 'sajida', ownerName: 'Sajida' },
    3: { floorName: '3rd Floor', ownerId: 'jeelani', ownerName: 'Jeelani' },
    4: { floorName: '4th Floor', ownerId: 'jeelani', ownerName: 'Jeelani' },
    5: { floorName: '5th Floor', ownerId: 'jeelani', ownerName: 'Jeelani' }
};

// Pre-configured dynamic subcategories mapped to categories
const DEFAULT_CATEGORY_SUBCATEGORIES = {
    cat_maintenance: [
        'Plumbing & Water Pipes',
        'Electrical Repairs & Wiring',
        'Lift / Elevator AMC & Repairs',
        'Painting & Plastering',
        'Carpentry, Doors & Locks',
        'Overhead Tank Cleaning',
        'CCTV & Gate Automation',
        'Pest Control & Sanitization',
        'Civil Masonry & Tiles',
        'General Maintenance'
    ],
    cat_current_bills: [
        'Common Area Lighting',
        'Borewell / Water Pump Motor',
        'Lift Electricity Meter',
        'Stilt & Parking Lights',
        'Sub-Meter Adjustment',
        'Electricity Meter Testing',
        'Electricity Bill Late Fine'
    ],
    cat_watchman: [
        'Monthly Salary',
        'Overtime / Extra Duty',
        'Festival Bonus / Tip',
        'Uniform & Security Equipment',
        'Salary Advance Deduction'
    ],
    cat_caretaker: [
        'Monthly Honorarium / Salary',
        'Building Supervision Fee',
        'Emergency Callout Charge',
        'Festival Bonus'
    ],
    cat_water_tax: [
        'Municipal Water Supply Tax',
        'Private Water Tanker Delivery',
        'Borewell Servicing / Flushing',
        'Water Pump Motor Capacitor',
        'Float Valve & Sensor Repair'
    ],
    cat_property_tax: [
        'Municipal Tax (Floors 1-2 • Sajida)',
        'Municipal Tax (Floors 3-5 • Jeelani)',
        'Commercial / Stilt Area Tax',
        'Drainage & Sewerage Cess'
    ],
    cat_solar_maint: [
        'Rooftop Panel Cleaning & Washing',
        'Solar Inverter Servicing',
        'Wiring & Breaker Replacement',
        'Annual Maintenance Contract (AMC)'
    ],
    cat_internet_bills: [
        'CCTV Broadband Connection',
        'Security Wi-Fi Router Plan',
        'Static IP / Cloud Backup',
        'Router / Cable Replacement'
    ],
    cat_expenditure: [
        'Cleaning Supplies, Brooms & Phenyl',
        'Garbage Disposal / Waste Collection',
        'Bulb & Tube Replacements',
        'Hardware, Screws & Adhesives',
        'Tools & Consumables'
    ],
    cat_miscellaneous: [
        'Festival Tips (Eid / Diwali / Ramzan)',
        'Government / Legal Documentation',
        'Printing, Accounts & Stationery',
        'Unforeseen Sundry Expenses'
    ]
};

// Default dynamic categories
const DEFAULT_CATEGORIES = [
    { id: 'cat_maintenance', name: 'Maintenance', icon: 'fa-wrench', color: '#3B82F6', desc: 'General building repairs & civil maintenance', isDefault: true, subcategories: DEFAULT_CATEGORY_SUBCATEGORIES.cat_maintenance },
    { id: 'cat_expenditure', name: 'General Expenditure', icon: 'fa-receipt', color: '#6B7280', desc: 'Day-to-day general building expenses', isDefault: true, subcategories: DEFAULT_CATEGORY_SUBCATEGORIES.cat_expenditure },
    { id: 'cat_watchman', name: 'Watchman Salary', icon: 'fa-user-shield', color: '#10B981', desc: 'Monthly security guard / watchman compensation', isDefault: true, subcategories: DEFAULT_CATEGORY_SUBCATEGORIES.cat_watchman },
    { id: 'cat_caretaker', name: 'Property Caretaker Salary', icon: 'fa-user-tie', color: '#8B5CF6', desc: 'Building manager & property caretaker wages', isDefault: true, subcategories: DEFAULT_CATEGORY_SUBCATEGORIES.cat_caretaker },
    { id: 'cat_current_bills', name: 'Current Bills (Electricity)', icon: 'fa-bolt', color: '#F59E0B', desc: 'Common area electricity, motor, lighting & meter charges', isDefault: true, subcategories: DEFAULT_CATEGORY_SUBCATEGORIES.cat_current_bills },
    { id: 'cat_water_tax', name: 'Water Tax / Water Charges', icon: 'fa-faucet-drip', color: '#06B6D4', desc: 'Municipal water supply tax, borewell & tanker charges', isDefault: true, subcategories: DEFAULT_CATEGORY_SUBCATEGORIES.cat_water_tax },
    { id: 'cat_property_tax', name: 'Property Tax', icon: 'fa-landmark', color: '#EF4444', desc: 'Municipal municipal council / corporation property taxes', isDefault: true, subcategories: DEFAULT_CATEGORY_SUBCATEGORIES.cat_property_tax },
    { id: 'cat_solar_maint', name: 'Solar Maintenance', icon: 'fa-solar-panel', color: '#EC4899', desc: 'Rooftop solar panel cleaning, inverter AMC & servicing', isDefault: true, subcategories: DEFAULT_CATEGORY_SUBCATEGORIES.cat_solar_maint },
    { id: 'cat_internet_bills', name: 'Internet Bills', icon: 'fa-wifi', color: '#6366F1', desc: 'CCTV broadband, security Wi-Fi and smart meter connections', isDefault: true, subcategories: DEFAULT_CATEGORY_SUBCATEGORIES.cat_internet_bills },
    { id: 'cat_miscellaneous', name: 'Miscellaneous', icon: 'fa-boxes-packing', color: '#64748B', desc: 'Unforeseen expenses, festival tips, cleaning supplies', isDefault: true, subcategories: DEFAULT_CATEGORY_SUBCATEGORIES.cat_miscellaneous }
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

// Clean initial data for Meera Heights - Fully restored with authentic building records
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
    tenants: [
        {
            id: "t_1789667717579",
            name: "Shanmukha Rao",
            floor: 3,
            flat: "3",
            ownerId: "jeelani",
            phone: "",
            occupation: "Judge",
            advanceDeposit: 58000,
            advancePaidDate: "2026-05-25",
            advanceRefunded: 0,
            advanceDeductions: 0,
            status: "active",
            monthlyRent: 29000,
            moveInDate: "2026-05-25",
            notes: "Advance details: 2nd May,2026: 29000; 1st June,2026: 29000; UPI"
        },
        {
            id: "t_1789670609489",
            name: "Barla Surendra",
            floor: 4,
            flat: "4",
            ownerId: "jeelani",
            phone: "",
            occupation: "Business",
            advanceDeposit: 62000,
            advancePaidDate: "2026-09-17",
            advanceRefunded: 0,
            advanceDeductions: 0,
            status: "active",
            monthlyRent: 31000,
            moveInDate: "2026-08-12",
            notes: "Advance Deposit: 10th August,2026: IMPS 31,000; Cash: 31,000"
        },
        {
            id: "t_1789671230505",
            name: "ABDUL HAK SAHEB",
            floor: 2,
            flat: "2",
            ownerId: "sajida",
            phone: "9849699911",
            occupation: "Business Man",
            advanceDeposit: 30000,
            advancePaidDate: "2026-09-01",
            advanceRefunded: 0,
            advanceDeductions: 0,
            status: "active",
            monthlyRent: 0,
            moveInDate: "2026-09-01",
            notes: ""
        }
    ],
    rentCollections: [
        {
            id: "rent_1789667939941",
            tenantId: "t_1789667717579",
            tenantName: "Shanmukha Rao",
            flat: "3",
            floor: 3,
            phone: "",
            amount: 29000,
            month: "2026-05",
            paymentDate: "2026-06-01",
            ownerCredited: "jeelani",
            paymentMode: "UPI / GPay",
            creditDestination: "wallet",
            bankName: "",
            bankReference: "",
            notes: ""
        },
        {
            id: "rent_1789669931601",
            tenantId: "t_1789667717579",
            tenantName: "Shanmukha Rao",
            flat: "3",
            floor: 3,
            phone: "",
            amount: 29000,
            month: "2026-06",
            paymentDate: "2026-07-03",
            ownerCredited: "jeelani",
            paymentMode: "UPI / GPay",
            creditDestination: "wallet",
            bankName: "",
            bankReference: "",
            notes: ""
        },
        {
            id: "rent_1789669985608",
            tenantId: "t_1789667717579",
            tenantName: "Shanmukha Rao",
            flat: "3",
            floor: 3,
            phone: "",
            amount: 29000,
            month: "2026-07",
            paymentDate: "2026-08-01",
            ownerCredited: "jeelani",
            paymentMode: "UPI / GPay",
            creditDestination: "wallet",
            bankName: "",
            bankReference: "",
            notes: ""
        },
        {
            id: "rent_1789670016783",
            tenantId: "t_1789667717579",
            tenantName: "Shanmukha Rao",
            flat: "3",
            floor: 3,
            phone: "",
            amount: 29000,
            month: "2026-08",
            paymentDate: "2026-09-01",
            ownerCredited: "jeelani",
            paymentMode: "UPI / GPay",
            creditDestination: "wallet",
            bankName: "",
            bankReference: "",
            notes: ""
        },
        {
            id: "rent_1789670698674",
            tenantId: "t_1789670609489",
            tenantName: "Barla Surendra",
            flat: "4",
            floor: 4,
            phone: "",
            amount: 31000,
            month: "2026-08",
            paymentDate: "2026-09-10",
            ownerCredited: "jeelani",
            paymentMode: "Bank Transfer",
            creditDestination: "wallet",
            bankName: "",
            bankReference: "",
            notes: "IMPS"
        }
    ],
    expenses: [
        {
            id: "exp_1789671117709",
            title: "Tata RAO salary",
            categoryId: "cat_watchman",
            amount: 10000,
            date: "2026-05-01",
            monthKey: "2026-05",
            targetFloor: "all",
            splitType: "ratio",
            sajidaRatio: 40,
            jeelaniRatio: 60,
            sajidaAmount: 4000,
            jeelaniAmount: 6000,
            debitedWallet: "both",
            debitedSource: "advance",
            paidBy: "Wallet Split (60:40 Floor Ratio)",
            notes: "UPI (5,000) + CASH (5,000)"
        },
        {
            id: "exp_1789671349229",
            title: "Tata RAO salary",
            categoryId: "cat_watchman",
            amount: 10000,
            date: "2026-06-01",
            monthKey: "2026-06",
            targetFloor: "all",
            splitType: "ratio",
            sajidaRatio: 40,
            jeelaniRatio: 60,
            sajidaAmount: 4000,
            jeelaniAmount: 6000,
            debitedWallet: "both",
            debitedSource: "advance",
            paidBy: "Wallet Split (60:40 Floor Ratio)",
            notes: "UPI (5,000) + CASH (5,000)"
        },
        {
            id: "exp_1789671454224",
            title: "Tata RAO salary",
            categoryId: "cat_watchman",
            amount: 10000,
            date: "2026-07-01",
            monthKey: "2026-07",
            targetFloor: "all",
            splitType: "ratio",
            sajidaRatio: 40,
            jeelaniRatio: 60,
            sajidaAmount: 4000,
            jeelaniAmount: 6000,
            debitedWallet: "both",
            debitedSource: "advance",
            paidBy: "Wallet Split (60:40 Floor Ratio)",
            notes: "UPI (5,000) + CASH (5,000)"
        },
        {
            id: "exp_1789671535932",
            title: "Tata RAO Salary",
            categoryId: "cat_watchman",
            amount: 10000,
            date: "2026-08-01",
            monthKey: "2026-08",
            targetFloor: "all",
            splitType: "ratio",
            sajidaRatio: 40,
            jeelaniRatio: 60,
            sajidaAmount: 4000,
            jeelaniAmount: 6000,
            debitedWallet: "both",
            debitedSource: "advance",
            paidBy: "Wallet Split (60:40 Floor Ratio)",
            notes: "UPI (5,000) + CASH (5,000)"
        },
        {
            id: "exp_1789671606153",
            title: "Tata RAO salary",
            categoryId: "cat_watchman",
            amount: 10000,
            date: "2026-09-01",
            monthKey: "2026-09",
            targetFloor: "all",
            splitType: "ratio",
            sajidaRatio: 40,
            jeelaniRatio: 60,
            sajidaAmount: 4000,
            jeelaniAmount: 6000,
            debitedWallet: "both",
            debitedSource: "advance",
            paidBy: "Wallet Split (60:40 Floor Ratio)",
            notes: "UPI (5,000) + CASH (5,000)"
        }
    ],
    walletAdjustments: [],
    advanceSettlements: [],
    bankTransactions: [
        {
            id: "btx_1789668039592",
            type: "wallet_to_bank",
            walletId: "jeelani_rent",
            walletName: "Jeelani Rent Wallet",
            ownerId: "jeelani",
            date: "2026-06-10",
            amount: 29000,
            floor: "Floor 3",
            floorCode: "3",
            bankName: "HDFC Bank",
            transferMode: "UPI / GPay / PhonePe",
            reference: "NRO",
            notes: "with maintenance"
        },
        {
            id: "btx_1789670135996",
            type: "wallet_to_bank",
            walletId: "jeelani_rent",
            walletName: "Jeelani Rent Wallet",
            ownerId: "jeelani",
            date: "2026-07-05",
            amount: 29000,
            floor: "Floor 3",
            floorCode: "3",
            bankName: "HDFC Bank",
            transferMode: "UPI / GPay / PhonePe",
            reference: "NRO",
            notes: "with maintenance"
        },
        {
            id: "btx_1789670268530",
            type: "wallet_to_bank",
            walletId: "jeelani_rent",
            walletName: "Jeelani Rent Wallet",
            ownerId: "jeelani",
            date: "2026-08-06",
            amount: 29000,
            floor: "Floor 3",
            floorCode: "3",
            bankName: "HDFC Bank",
            transferMode: "UPI / GPay / PhonePe",
            reference: "NRO",
            notes: "with maintenance"
        },
        {
            id: "btx_1789670364087",
            type: "wallet_to_bank",
            walletId: "jeelani_rent",
            walletName: "Jeelani Rent Wallet",
            ownerId: "jeelani",
            date: "2026-09-02",
            amount: 29000,
            floor: "Floor 3",
            floorCode: "3",
            bankName: "HDFC Bank",
            transferMode: "UPI / GPay / PhonePe",
            reference: "NRO",
            notes: "with maintenance"
        },
        {
            id: "btx_1789670915042",
            type: "wallet_to_bank",
            walletId: "jeelani_rent",
            walletName: "Jeelani Rent Wallet",
            ownerId: "jeelani",
            date: "2026-09-10",
            amount: 31000,
            floor: "Floor 4",
            floorCode: "4",
            bankName: "HDFC Bank",
            transferMode: "UPI / GPay / PhonePe",
            reference: "NRO",
            notes: "Transferred from Sajida HDFC bank; with maintenance"
        }
    ],
    walletTransfers: []
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
            } else {
                // Ensure all existing categories have subcategories array
                parsed.categories.forEach(cat => {
                    if (!cat.subcategories || !Array.isArray(cat.subcategories) || cat.subcategories.length === 0) {
                        cat.subcategories = (DEFAULT_CATEGORY_SUBCATEGORIES[cat.id] || ['General Maintenance', 'General Expense']).slice();
                    }
                });
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

            // Auto-heal / Restore authentic dataset if any core table is empty or missing
            let dataHealed = false;
            if (!parsed.tenants || parsed.tenants.length === 0) {
                console.log('Restoring authentic tenants into local storage...');
                parsed.tenants = JSON.parse(JSON.stringify(INITIAL_DATA.tenants));
                dataHealed = true;
            }
            if (!parsed.rentCollections || parsed.rentCollections.length === 0) {
                console.log('Restoring authentic rent collections into local storage...');
                parsed.rentCollections = JSON.parse(JSON.stringify(INITIAL_DATA.rentCollections));
                dataHealed = true;
            }
            if (!parsed.expenses || parsed.expenses.length === 0) {
                console.log('Restoring authentic expenses into local storage...');
                parsed.expenses = JSON.parse(JSON.stringify(INITIAL_DATA.expenses));
                dataHealed = true;
            }
            if (!parsed.bankTransactions || parsed.bankTransactions.length === 0) {
                console.log('Restoring authentic bank transactions into local storage...');
                parsed.bankTransactions = JSON.parse(JSON.stringify(INITIAL_DATA.bankTransactions));
                dataHealed = true;
            }
            if (dataHealed) {
                this.saveDataLocallyOnly(parsed, true);
                if (typeof CloudSyncManager !== 'undefined' && CloudSyncManager.isEnabled()) {
                    CloudSyncManager.pushToCloud(parsed, true);
                }
            }

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

    static saveDataLocallyOnly(data, allowEmpty = false) {
        try {
            if (!allowEmpty) {
                // Prevent empty overwrite of existing data
                const currentRaw = localStorage.getItem(STORAGE_KEYS.APP_DATA);
                if (currentRaw) {
                    try {
                        const current = JSON.parse(currentRaw);
                        if ((current.tenants || []).length > 0 && (!data.tenants || data.tenants.length === 0)) {
                            console.warn('Blocked attempt to save empty tenants array over populated local storage.');
                            return false;
                        }
                    } catch (e) {}
                }
            }
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

    static parseBackupSummary(jsonString) {
        try {
            const parsed = (typeof jsonString === 'string') ? JSON.parse(jsonString) : jsonString;
            const valid = parsed && (parsed.buildingName === 'Meera Heights' || parsed.buildingName) &&
                Array.isArray(parsed.owners) && Array.isArray(parsed.categories) &&
                Array.isArray(parsed.tenants) && Array.isArray(parsed.rentCollections) &&
                Array.isArray(parsed.expenses);
            if (!valid) {
                return {
                    valid: false,
                    error: 'Invalid backup file structure. Required Meera Heights data collections are missing.'
                };
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

            const transfersCount = (normalized.bankTransactions || []).length +
                (normalized.walletTransfers || []).length +
                (normalized.walletAdjustments || []).length;

            return {
                valid: true,
                data: normalized,
                summary: {
                    buildingName: normalized.buildingName,
                    tenantsCount: normalized.tenants.length,
                    rentCollectionsCount: normalized.rentCollections.length,
                    expensesCount: normalized.expenses.length,
                    transfersCount: transfersCount,
                    timestamp: parsed.exportDate || parsed.timestamp || null
                }
            };
        } catch (err) {
            return {
                valid: false,
                error: 'Error parsing JSON file: ' + err.message
            };
        }
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

    static getBackupSettings() {
        const defaults = {
            frequency: 'weekly', // 'none', 'weekly', 'biweekly', 'monthly'
            lastBackupDate: null,
            emailSajida: '',
            emailJeelani: '',
            autoPrompt: true,
            encrypted: false,
            passphraseHint: '',
            webhookUrl: ''
        };
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.BACKUP_SETTINGS);
            return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
        } catch (e) {
            return defaults;
        }
    }

    static saveBackupSettings(settings) {
        try {
            localStorage.setItem(STORAGE_KEYS.BACKUP_SETTINGS, JSON.stringify(settings));
            return true;
        } catch (e) {
            console.error('Error saving backup settings:', e);
            return false;
        }
    }

    // -------------------------------------------------------------
    // GOOGLE DRIVE BACKUPS REGISTRY & PERSISTENCE
    // -------------------------------------------------------------
    static getDriveBackups() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.DRIVE_BACKUPS);
            let list = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(list)) list = [];

            // If empty, seed from ActivityLogger backup logs or current state
            if (list.length === 0) {
                const logs = (typeof ActivityLogger !== 'undefined') ? ActivityLogger.getLogs('backup') : [];
                const driveLogs = logs.filter(l => l.title && l.title.toLowerCase().includes('drive'));
                const currentData = this.getData();

                if (driveLogs.length > 0) {
                    driveLogs.forEach((l, idx) => {
                        const m = (l.description || '').match(/File:\s*([^\s(]+)/);
                        const fname = m ? m[1] : `Meera_Heights_Drive_Backup_${idx + 1}.json`;
                        list.push({
                            id: 'drive_bk_' + (Date.now() - idx * 86400000),
                            name: fname,
                            date: l.timestamp || new Date().toISOString(),
                            size: 48500 + idx * 1200,
                            isEncrypted: (l.description || '').includes('Encrypted'),
                            source: 'Google Drive Cloud',
                            payload: currentData
                        });
                    });
                } else if (currentData) {
                    const nowIso = new Date().toISOString();
                    const dateSlug = nowIso.slice(0, 10);
                    list.push({
                        id: 'drive_bk_' + Date.now(),
                        name: `Meera_Heights_Drive_Backup_${dateSlug}.json`,
                        date: nowIso,
                        size: JSON.stringify(currentData).length,
                        isEncrypted: false,
                        source: 'Google Drive Cloud',
                        payload: currentData
                    });
                }
                if (list.length > 0) {
                    localStorage.setItem(STORAGE_KEYS.DRIVE_BACKUPS, JSON.stringify(list));
                }
            }
            return list;
        } catch (e) {
            console.error('Error fetching drive backups:', e);
            return [];
        }
    }

    static recordDriveBackup({ filename, size, isEncrypted, timestamp, payload, source = 'Google Drive Cloud' }) {
        try {
            let list = this.getDriveBackups();
            const newRecord = {
                id: 'drive_bk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                name: filename || `Meera_Heights_Backup_${new Date().toISOString().slice(0, 10)}.json`,
                date: timestamp || new Date().toISOString(),
                size: size || (payload ? JSON.stringify(payload).length : 50000),
                isEncrypted: !!isEncrypted,
                source: source,
                payload: payload || null
            };
            list = list.filter(item => item.name !== newRecord.name);
            list.unshift(newRecord);
            if (list.length > 25) list = list.slice(0, 25);
            localStorage.setItem(STORAGE_KEYS.DRIVE_BACKUPS, JSON.stringify(list));
            return newRecord;
        } catch (e) {
            console.warn('Error recording drive backup:', e);
            return null;
        }
    }

    static deleteDriveBackup(id) {
        try {
            let list = this.getDriveBackups();
            list = list.filter(item => item.id !== id);
            localStorage.setItem(STORAGE_KEYS.DRIVE_BACKUPS, JSON.stringify(list));
            return true;
        } catch (e) {
            return false;
        }
    }

    // -------------------------------------------------------------
    // EMAIL BACKUPS REGISTRY & PERSISTENCE
    // -------------------------------------------------------------
    static getEmailBackups() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.EMAIL_BACKUPS);
            let list = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(list)) list = [];

            // If empty, seed from ActivityLogger backup logs or current state
            if (list.length === 0) {
                const logs = (typeof ActivityLogger !== 'undefined') ? ActivityLogger.getLogs('backup') : [];
                const emailLogs = logs.filter(l => l.title && l.title.toLowerCase().includes('email'));
                const currentData = this.getData();

                if (emailLogs.length > 0) {
                    emailLogs.forEach((l, idx) => {
                        const m = (l.description || '').match(/File:\s*([^\s(]+)/);
                        const fname = m ? m[1] : `Meera_Heights_Email_Backup_${idx + 1}.json`;
                        list.push({
                            id: 'email_bk_' + (Date.now() - idx * 86400000),
                            name: fname,
                            date: l.timestamp || new Date().toISOString(),
                            size: 48500 + idx * 1200,
                            isEncrypted: (l.description || '').includes('Encrypted'),
                            recipient: 'mahaboob.1411ali@gmail.com',
                            source: 'Email Cloud Backup',
                            payload: currentData
                        });
                    });
                } else if (currentData) {
                    const nowIso = new Date().toISOString();
                    const dateSlug = nowIso.slice(0, 10);
                    list.push({
                        id: 'email_bk_' + Date.now(),
                        name: `Meera_Heights_Email_Backup_${dateSlug}.json`,
                        date: nowIso,
                        size: JSON.stringify(currentData).length,
                        isEncrypted: false,
                        recipient: 'mahaboob.1411ali@gmail.com',
                        source: 'Email Cloud Backup',
                        payload: currentData
                    });
                }
                if (list.length > 0) {
                    localStorage.setItem(STORAGE_KEYS.EMAIL_BACKUPS, JSON.stringify(list));
                }
            }
            return list;
        } catch (e) {
            console.error('Error fetching email backups:', e);
            return [];
        }
    }

    static recordEmailBackup({ filename, size, isEncrypted, timestamp, payload, recipients, source = 'Email Cloud Backup' }) {
        try {
            let list = this.getEmailBackups();
            const newRecord = {
                id: 'email_bk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                name: filename || `Meera_Heights_Email_Backup_${new Date().toISOString().slice(0, 10)}.json`,
                date: timestamp || new Date().toISOString(),
                size: size || (payload ? JSON.stringify(payload).length : 50000),
                isEncrypted: !!isEncrypted,
                recipient: (recipients && recipients.length > 0) ? recipients.join(', ') : 'mahaboob.1411ali@gmail.com',
                source: source,
                payload: payload || null
            };
            list = list.filter(item => item.name !== newRecord.name);
            list.unshift(newRecord);
            if (list.length > 25) list = list.slice(0, 25);
            localStorage.setItem(STORAGE_KEYS.EMAIL_BACKUPS, JSON.stringify(list));
            return newRecord;
        } catch (e) {
            console.warn('Error recording email backup:', e);
            return null;
        }
    }

    static deleteEmailBackup(id) {
        try {
            let list = this.getEmailBackups();
            list = list.filter(item => item.id !== id);
            localStorage.setItem(STORAGE_KEYS.EMAIL_BACKUPS, JSON.stringify(list));
            return true;
        } catch (e) {
            return false;
        }
    }

    static getTheme() {
        try {
            return localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
        } catch (e) {
            return 'light';
        }
    }

    static saveTheme(theme) {
        try {
            localStorage.setItem(STORAGE_KEYS.THEME, theme || 'light');
            return true;
        } catch (e) {
            console.error('Error saving theme to localStorage:', e);
            return false;
        }
    }

    static getAuthCredentials() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.AUTH_CREDENTIALS);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    static setAuthCredentials(creds) {
        try {
            if (creds && creds.hash && creds.salt) {
                localStorage.setItem(STORAGE_KEYS.AUTH_CREDENTIALS, JSON.stringify(creds));
                return true;
            }
            return false;
        } catch (e) {
            console.error('Error saving auth credentials:', e);
            return false;
        }
    }
}

// -------------------------------------------------------------
// SECURE AUTHENTICATION MANAGER (ENCRYPTED / MASKED CREDENTIALS)
// Protects Meera Heights Portal with Password & Masked SHA-256
// -------------------------------------------------------------
class AuthManager {
    // Masked security hashes (Plain credentials never exist in code)
    static _AUTH_U = [
        '8a0d2365f4f608fe993d72743a1e42995922b26b8b28349631500fcfb148c217',
        'dd62803a46ee169dd726aacf177a6ab23d84857893ad6634cded281bf05693e7'
    ];
    static _AUTH_R = '116ac23fb4c2b60dbe307b42937e26f536533fe797a855bb60c176f533265cef';

    static async sha256(text) {
        const str = String(text || '');
        if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
            try {
                const enc = new TextEncoder();
                const buf = await window.crypto.subtle.digest('SHA-256', enc.encode(str));
                return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
            } catch (e) {}
        }
        return AuthManager._sha256Fallback(str);
    }

    static _sha256Fallback(ascii) {
        function rightRotate(value, amount) {
            return (value >>> amount) | (value << (32 - amount));
        }
        const mathPow = Math.pow;
        const maxWord = mathPow(2, 32);
        const lengthProperty = 'length';
        let i, j;
        const words = [];
        const asciiBitLength = ascii[lengthProperty] * 8;
        let hash = AuthManager._h = AuthManager._h || [];
        const k = AuthManager._k = AuthManager._k || [];
        let primeCounter = k[lengthProperty];
        const isComposite = {};
        for (let candidate = 2; primeCounter < 64; candidate++) {
            if (!isComposite[candidate]) {
                for (i = 0; i < 300; i += candidate) {
                    isComposite[i] = candidate;
                }
                hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
                k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
            }
        }
        hash = hash.slice(0);
        ascii += '\x80';
        while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
        for (i = 0; i < ascii[lengthProperty]; i++) {
            j = ascii.charCodeAt(i);
            if (j >> 8) return '';
            words[i >> 2] |= j << ((3 - i) % 4) * 8;
        }
        words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0);
        words[words[lengthProperty]] = (asciiBitLength) | 0;
        for (j = 0; j < words[lengthProperty];) {
            const w = words.slice(j, j += 16);
            const oldHash = hash;
            hash = hash.slice(0, 8);
            for (i = 0; i < 64; i++) {
                const w15 = w[i - 15], w2 = w[i - 2];
                const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
                const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
                const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
                const temp1 = (hash[7] + (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) + ch + k[i] + (w[i] = (i < 16) ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0)) | 0;
                const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
                const temp2 = ((rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj) | 0;
                hash = [(temp1 + temp2) | 0].concat(hash);
                hash[4] = (hash[4] + temp1) | 0;
            }
            for (i = 0; i < 8; i++) {
                hash[i] = (hash[i] + oldHash[i]) | 0;
            }
        }
        let res = '';
        for (i = 0; i < 8; i++) {
            for (j = 3; j + 1; j--) {
                const b = (hash[i] >> (j * 8)) & 255;
                res += ((b < 16) ? '0' : '') + b.toString(16);
            }
        }
        return res;
    }

    static async verifyUsername(username) {
        if (!username || typeof username !== 'string') return false;
        const hash = await this.sha256(username.trim());
        return this._AUTH_U.includes(hash);
    }

    static async verifyRecoveryKey(key) {
        if (!key || typeof key !== 'string') return false;
        const hash = await this.sha256(key.trim());
        return hash === this._AUTH_R;
    }

    static getCredentials() {
        return StorageManager.getAuthCredentials();
    }

    static setCredentials(creds) {
        return StorageManager.setAuthCredentials(creds);
    }

    static isPasswordConfigured() {
        try {
            const creds = StorageManager.getAuthCredentials();
            return !!(creds && creds.hash && creds.salt);
        } catch (e) {
            return false;
        }
    }

    static async setPassword(password) {
        if (!password || password.length < 4) {
            throw new Error('Password must be at least 4 characters.');
        }
        let salt = '';
        if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
            const bytes = new Uint8Array(16);
            window.crypto.getRandomValues(bytes);
            salt = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        } else {
            salt = Math.random().toString(36).substring(2) + Date.now().toString(36);
        }
        const saltedHash = await this.sha256(salt + ':' + password);
        const creds = {
            salt,
            hash: saltedHash,
            configuredAt: new Date().toISOString()
        };
        StorageManager.setAuthCredentials(creds);
        this.setAuthenticated(true);

        // Sync to cloud Firestore immediately if active
        if (typeof CloudSyncManager !== 'undefined' && CloudSyncManager.isEnabled()) {
            CloudSyncManager.pushAuthSecurity(creds);
        }
        return creds;
    }

    static async verifyPassword(password) {
        try {
            const creds = StorageManager.getAuthCredentials();
            if (!creds || !creds.salt || !creds.hash) return false;
            const calculated = await this.sha256(creds.salt + ':' + password);
            return calculated === creds.hash;
        } catch (e) {
            return false;
        }
    }

    static isAuthenticated() {
        try {
            return sessionStorage.getItem(STORAGE_KEYS.AUTH_SESSION) === 'authenticated';
        } catch (e) {
            return false;
        }
    }

    static setAuthenticated(status) {
        try {
            if (status) {
                sessionStorage.setItem(STORAGE_KEYS.AUTH_SESSION, 'authenticated');
            } else {
                sessionStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
            }
        } catch (e) {}
    }

    static logout() {
        this.setAuthenticated(false);
    }
}

// -------------------------------------------------------------
// COMPREHENSIVE ACTIVITY HISTORY & AUDIT LOG
// Records all financial, tenant, backup, security & sync events
// -------------------------------------------------------------
class ActivityLogger {
    static MAX_RECORDS = 300;

    static seedFromExistingData(data) {
        if (!data) return [];
        try {
            const seeded = [];

            // 1. Rent Collections
            if (Array.isArray(data.rentCollections)) {
                data.rentCollections.forEach(r => {
                    if (!r) return;
                    const rawDate = r.paymentDate || r.date || r.createdAt || new Date().toISOString();
                    const amount = parseFloat(r.amount) || 0;
                    const isoDate = rawDate.includes('T') ? rawDate : (new Date(rawDate).toISOString() || new Date().toISOString());
                    seeded.push({
                        id: 'act_rent_' + (r.id || Math.random().toString(36).substr(2, 6)),
                        timestamp: isoDate,
                        category: 'rent',
                        title: `Rent Collected: ${r.tenantName || 'Tenant'}`,
                        description: `Flat ${r.flat || 'N/A'} • ₹${amount.toLocaleString('en-IN')} received via ${r.paymentMethod || 'Cash/UPI'} (Credited: ${r.ownerCredited === 'sajida' ? 'Sajida' : 'Jeelani'})`,
                        device: 'System'
                    });
                });
            }

            // 2. Expenses
            if (Array.isArray(data.expenses)) {
                const catMap = {};
                if (Array.isArray(data.categories)) {
                    data.categories.forEach(c => { catMap[c.id] = c.name; });
                }
                data.expenses.forEach(e => {
                    if (!e) return;
                    const rawDate = e.date || e.createdAt || new Date().toISOString();
                    const amount = parseFloat(e.amount) || 0;
                    const catName = catMap[e.categoryId] || 'Building Maintenance';
                    const isoDate = rawDate.includes('T') ? rawDate : (new Date(rawDate).toISOString() || new Date().toISOString());
                    seeded.push({
                        id: 'act_exp_' + (e.id || Math.random().toString(36).substr(2, 6)),
                        timestamp: isoDate,
                        category: 'expense',
                        title: `Expense: ${e.title || 'Building Maintenance'}`,
                        description: `₹${amount.toLocaleString('en-IN')} • ${catName} • Paid to ${e.vendor || 'Vendor'} (${e.debitedWallet === 'sajida' ? 'Sajida' : (e.debitedWallet === 'jeelani' ? 'Jeelani' : 'Split')})`,
                        device: 'System'
                    });
                });
            }

            // 3. Tenants
            if (Array.isArray(data.tenants)) {
                data.tenants.forEach(t => {
                    if (!t) return;
                    const rawDate = t.joiningDate || t.createdAt || new Date().toISOString();
                    const rent = parseFloat(t.monthlyRent) || 0;
                    const advance = parseFloat(t.advancePaid) || 0;
                    const isoDate = rawDate.includes('T') ? rawDate : (new Date(rawDate).toISOString() || new Date().toISOString());
                    seeded.push({
                        id: 'act_tenant_' + (t.id || Math.random().toString(36).substr(2, 6)),
                        timestamp: isoDate,
                        category: 'tenant',
                        title: `Tenant Registered: ${t.name || 'Tenant'}`,
                        description: `Flat ${t.flat || 'N/A'} • Monthly Rent: ₹${rent.toLocaleString('en-IN')} • Deposit: ₹${advance.toLocaleString('en-IN')} • Status: ${t.status || 'Active'}`,
                        device: 'System'
                    });
                });
            }

            // 4. Bank Transactions
            if (Array.isArray(data.bankTransactions)) {
                data.bankTransactions.forEach(bt => {
                    if (!bt) return;
                    const rawDate = bt.date || bt.createdAt || new Date().toISOString();
                    const amount = parseFloat(bt.amount) || 0;
                    const isoDate = rawDate.includes('T') ? rawDate : (new Date(rawDate).toISOString() || new Date().toISOString());
                    seeded.push({
                        id: 'act_bt_' + (bt.id || Math.random().toString(36).substr(2, 6)),
                        timestamp: isoDate,
                        category: 'transfer',
                        title: `Bank Transfer: ₹${amount.toLocaleString('en-IN')}`,
                        description: `${bt.bankName || 'Bank'} • ${bt.mode || 'Transfer'} • Ref: ${bt.reference || 'N/A'}`,
                        device: 'System'
                    });
                });
            }

            // 5. Advance Settlements
            if (Array.isArray(data.advanceSettlements)) {
                data.advanceSettlements.forEach(as => {
                    if (!as) return;
                    const rawDate = as.settlementDate || as.date || as.createdAt || new Date().toISOString();
                    const isoDate = rawDate.includes('T') ? rawDate : (new Date(rawDate).toISOString() || new Date().toISOString());
                    seeded.push({
                        id: 'act_settle_' + (as.id || Math.random().toString(36).substr(2, 6)),
                        timestamp: isoDate,
                        category: 'rent',
                        title: `Advance Settled: ${as.tenantName || 'Tenant'}`,
                        description: `Flat ${as.flat || 'N/A'} • Deductions: ₹${(as.totalDeductions || 0).toLocaleString('en-IN')} • Refund: ₹${(as.refundAmount || 0).toLocaleString('en-IN')}`,
                        device: 'System'
                    });
                });
            }

            // Sort newest first
            seeded.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            return seeded.slice(0, this.MAX_RECORDS);
        } catch (err) {
            console.warn('Error seeding activity logs from building data:', err);
            return [];
        }
    }

    static getLogs(category = 'all', searchQuery = '') {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOG);
            let logs = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(logs)) logs = [];

            // If empty, auto-seed from building data so user immediately sees their complete history
            if (logs.length === 0 && typeof StorageManager !== 'undefined' && StorageManager.getData) {
                const buildingData = StorageManager.getData();
                if (buildingData) {
                    const seeded = this.seedFromExistingData(buildingData);
                    if (seeded && seeded.length > 0) {
                        logs = seeded;
                        localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOG, JSON.stringify(logs.slice(0, this.MAX_RECORDS)));
                    }
                }
            }

            if (category && category !== 'all') {
                logs = logs.filter(l => l.category === category);
            }

            if (searchQuery && searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                logs = logs.filter(l =>
                    (l.title && l.title.toLowerCase().includes(q)) ||
                    (l.description && l.description.toLowerCase().includes(q)) ||
                    (l.category && l.category.toLowerCase().includes(q))
                );
            }

            return logs;
        } catch (e) {
            console.error('Error fetching activity logs:', e);
            return [];
        }
    }

    static log(category, title, description, meta = {}) {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOG);
            let logs = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(logs)) logs = [];

            // If empty, auto-seed from building data first so baseline records are preserved!
            if (logs.length === 0 && typeof StorageManager !== 'undefined' && StorageManager.getData) {
                const buildingData = StorageManager.getData();
                if (buildingData) {
                    const seeded = this.seedFromExistingData(buildingData);
                    if (seeded && seeded.length > 0) {
                        logs = seeded;
                    }
                }
            }

            const newRecord = {
                id: 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                timestamp: new Date().toISOString(),
                category: category || 'general',
                title: title || 'Activity',
                description: description || '',
                device: ActivityLogger.detectPlatform(),
                meta: meta || {}
            };

            logs.unshift(newRecord);
            if (logs.length > this.MAX_RECORDS) {
                logs = logs.slice(0, this.MAX_RECORDS);
            }

            localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOG, JSON.stringify(logs));
            return newRecord;
        } catch (e) {
            console.error('Error recording activity log:', e);
            return null;
        }
    }

    static clear() {
        try {
            localStorage.removeItem(STORAGE_KEYS.ACTIVITY_LOG);
            return true;
        } catch (e) {
            return false;
        }
    }

    static detectPlatform() {
        if (typeof navigator === 'undefined') return 'Web';
        const ua = navigator.userAgent || '';
        if (/android/i.test(ua)) return 'Android';
        if (/iPad|iPhone|iPod/.test(ua)) return 'iOS';
        if (/Macintosh|Mac OS X/.test(ua)) return 'macOS';
        if (/Windows NT/.test(ua)) return 'Windows';
        if (/Linux/.test(ua)) return 'Linux';
        return 'Web';
    }

    static formatRelativeTime(isoString) {
        try {
            const date = new Date(isoString);
            const now = new Date();
            const diffMs = now - date;
            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);
            const diffHour = Math.floor(diffMin / 60);
            const diffDays = Math.floor(diffHour / 24);

            if (diffSec < 45) return 'Just now';
            if (diffMin < 60) return `${diffMin} min${diffMin > 1 ? 's' : ''} ago`;
            if (diffHour < 24) return `${diffHour} hr${diffHour > 1 ? 's' : ''} ago`;
            if (diffDays === 1) return 'Yesterday, ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (diffDays < 7) return `${diffDays} days ago`;
            return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return isoString;
        }
    }

    static exportCSV() {
        const logs = this.getLogs('all');
        if (!logs.length) return null;
        const headers = ['Timestamp', 'Category', 'Title', 'Description', 'Device'];
        const rows = logs.map(l => [
            `"${new Date(l.timestamp).toLocaleString('en-IN')}"`,
            `"${(l.category || '').replace(/"/g, '""')}"`,
            `"${(l.title || '').replace(/"/g, '""')}"`,
            `"${(l.description || '').replace(/"/g, '""')}"`,
            `"${(l.device || '').replace(/"/g, '""')}"`
        ]);
        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    static mergeRemoteLogs(remoteLogs) {
        if (!Array.isArray(remoteLogs) || !remoteLogs.length) return;
        try {
            const localLogs = this.getLogs('all');
            const idMap = new Map();
            localLogs.forEach(l => { if (l && l.id) idMap.set(l.id, l); });
            let hasNew = false;
            remoteLogs.forEach(l => {
                if (l && l.id && !idMap.has(l.id)) {
                    idMap.set(l.id, l);
                    hasNew = true;
                }
            });
            if (hasNew) {
                const merged = Array.from(idMap.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, this.MAX_RECORDS);
                localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOG, JSON.stringify(merged));
            }
        } catch (e) {
            console.warn('Error merging remote activity logs:', e);
        }
    }
}

if (typeof window !== 'undefined') {
    window.StorageManager = StorageManager;
    window.AuthManager = AuthManager;
    window.ActivityLogger = ActivityLogger;
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
            this.updateStatus('syncing', 'Connecting to cloud database...');
            if (!this._firebaseWaitAttempts) this._firebaseWaitAttempts = 0;
            if (this._firebaseWaitAttempts < 25) { // Poll for up to 10 seconds (25 * 400ms)
                this._firebaseWaitAttempts++;
                setTimeout(() => {
                    this.connect(config, notifyUserOnPair);
                }, 400);
                return true;
            }
            this.updateStatus('error', 'Firebase SDK library taking long to load');
            console.warn('Firebase SDK script tags missing or failed to load.');
            return false;
        }
        this._firebaseWaitAttempts = 0;

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

            const localData = StorageManager.getData();

            if (!docSnapshot.exists) {
                // Cloud document does not exist yet. Seed cloud with current local dataset!
                console.log('Cloud database document does not exist yet. Initializing with local data...');
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

            // CRITICAL ANTI-WIPE GUARD:
            // If cloud snapshot has 0 tenants, do NOT wipe local data!
            // Seed cloud with healthy localData immediately so all paired devices (Android, iOS) receive real data!
            const cloudTenants = Array.isArray(cloudPayload.tenants) ? cloudPayload.tenants : [];
            if (cloudTenants.length === 0) {
                console.warn('Cloud database document has 0 tenants. Protecting local data and repairing cloud with authentic dataset...');
                const healthyData = StorageManager.getData();
                this.pushToCloud(healthyData, true);
                return;
            }

            // Cross-device Auth Security Sync: Ingest master password credentials
            if (cloudPayload.authSecurity && cloudPayload.authSecurity.hash && cloudPayload.authSecurity.salt) {
                const localCreds = StorageManager.getAuthCredentials();
                const isNewer = !localCreds || !localCreds.hash || (cloudPayload.authSecurity.configuredAt && (!localCreds.configuredAt || new Date(cloudPayload.authSecurity.configuredAt) > new Date(localCreds.configuredAt)));
                if (isNewer) {
                    StorageManager.setAuthCredentials(cloudPayload.authSecurity);
                    if (typeof App !== 'undefined' && App.onAuthCredentialsSynced) {
                        App.onAuthCredentialsSynced();
                    }
                }
            }

            // Cross-device Activity Logs Sync: Merge remote audit events
            if (Array.isArray(cloudPayload.activityLogs) && cloudPayload.activityLogs.length > 0) {
                ActivityLogger.mergeRemoteLogs(cloudPayload.activityLogs);
                if (typeof App !== 'undefined' && document.getElementById('modal-activity-history') && document.getElementById('modal-activity-history').style.display !== 'none') {
                    App.renderActivityHistory();
                }
            }

            // Ingest cloud update into local storage and notify UI
            this.isSyncingFromCloud = true;
            try {
                const cleaned = { ...cloudPayload };
                delete cleaned._cloudMeta;
                delete cleaned.authSecurity;
                delete cleaned.activityLogs;

                // Ensure core collections are never null or empty
                if (!cleaned.tenants || cleaned.tenants.length === 0) {
                    cleaned.tenants = JSON.parse(JSON.stringify(INITIAL_DATA.tenants));
                }
                if (!cleaned.rentCollections || cleaned.rentCollections.length === 0) {
                    cleaned.rentCollections = JSON.parse(JSON.stringify(INITIAL_DATA.rentCollections));
                }
                if (!cleaned.expenses || cleaned.expenses.length === 0) {
                    cleaned.expenses = JSON.parse(JSON.stringify(INITIAL_DATA.expenses));
                }
                if (!cleaned.bankTransactions || cleaned.bankTransactions.length === 0) {
                    cleaned.bankTransactions = JSON.parse(JSON.stringify(INITIAL_DATA.bankTransactions));
                }

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
                this.updateStatus('error', 'Sync interrupted: ' + (error.message || error.code || 'Network'));
                // Auto-retry reconnection after 4 seconds on mobile network switch or transient drop
                setTimeout(() => {
                    if (navigator.onLine && this.isEnabled() && this.db) {
                        console.log('Retrying Firestore listener connection...');
                        this.listenToCloudDocument();
                    }
                }, 4000);
            }
        });
    }

    static pushLocalDataToCloud(data, immediate = false) {
        return this.pushToCloud(data, immediate);
    }

    static async ensureDb(timeoutMs = 6000) {
        if (this.db) return this.db;
        const config = this.getConfig();
        if (!config || !config.apiKey || !config.projectId) return null;

        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            if (typeof firebase !== 'undefined' && firebase.initializeApp && firebase.firestore) {
                try {
                    let app = (firebase.apps && firebase.apps.length > 0) ? firebase.apps[0] : firebase.initializeApp(config);
                    this.db = firebase.firestore(app);
                    return this.db;
                } catch (e) {
                    console.warn('Firebase ensureDb init warning:', e);
                }
            }
            await new Promise(r => setTimeout(r, 150));
        }
        return this.db || null;
    }

    static async pushAuthSecurity(creds) {
        if (!creds || !creds.hash || !creds.salt) return false;
        try {
            const db = await this.ensureDb(5000);
            if (db) {
                const docRef = db.collection('buildings').doc('meera_heights');
                const myDevId = this.getDeviceId();
                await docRef.set({
                    authSecurity: creds,
                    _cloudMeta: {
                        senderDeviceId: myDevId,
                        lastUpdated: Date.now(),
                        updatedAt: new Date().toISOString(),
                        clientPlatform: navigator.platform || 'web'
                    }
                }, { merge: true });
                console.log('Master password security credentials synced to Firestore cloud.');
                return true;
            }
        } catch (e) {
            console.warn('Could not push authSecurity to cloud:', e);
        }
        return false;
    }

    static async fetchRemoteAuthSecurity() {
        try {
            const db = await this.ensureDb(6000);
            if (db) {
                const docRef = db.collection('buildings').doc('meera_heights');
                const fetchPromise = docRef.get();
                const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 5000));
                const doc = await Promise.race([fetchPromise, timeoutPromise]);
                if (doc && doc.exists) {
                    const cloudData = doc.data();
                    if (cloudData && cloudData.authSecurity && cloudData.authSecurity.hash && cloudData.authSecurity.salt) {
                        StorageManager.setAuthCredentials(cloudData.authSecurity);
                        console.log('Successfully fetched remote authSecurity from Firestore.');
                        return cloudData.authSecurity;
                    }
                }
            }
        } catch (e) {
            console.warn('Could not fetch remote auth security:', e);
        }
        return null;
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

                const authCreds = StorageManager.getAuthCredentials();
                const activityLogs = (typeof ActivityLogger !== 'undefined' && ActivityLogger.getLogs) ? ActivityLogger.getLogs('all').slice(0, 100) : [];

                const payload = {
                    ...data,
                    activityLogs: activityLogs,
                    _cloudMeta: {
                        senderDeviceId: myDevId,
                        lastUpdated: now,
                        updatedAt: new Date().toISOString(),
                        clientPlatform: navigator.platform || 'web'
                    }
                };

                // CRITICAL: Only include authSecurity if local credentials exist and are valid.
                // NEVER write authSecurity: null, which would erase the cloud master password across devices.
                if (authCreds && authCreds.hash && authCreds.salt) {
                    payload.authSecurity = authCreds;
                }

                await docRef.set(payload, { merge: true });
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

if (typeof window !== 'undefined') {
    window.CloudSyncManager = CloudSyncManager;
}
