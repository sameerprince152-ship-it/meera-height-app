# Meera Heights - Building Expenditure & Rent Management App

An all-in-one building management mobile-first application crafted specifically for **Meera Heights**, co-owned by **Sajida** and **Jeelani**.

---

## 🌟 Key Features

### Recent audit updates
- Mobile hardening for small screens: touch-friendly controls, safe-area support, full-width mobile modals, responsive header controls, and horizontally scrollable data tables.
- Sort controls for expense, floor, rent, and wallet views. Supported fields include date, amount, and title or tenant name.
- Monthly PDF reports for rent collections and expenses using the selected global month filter.
- CSV and Excel exports remain available; JSON backup restore now validates and normalizes the complete data shape before replacing browser data.

### 1. Dual Owner Capital & Wallet System
- **Sajida's Capital Wallet**: Dedicated capital balance, tracks all rent credited to her, initial seed capital, and debited maintenance shares.
- **Jeelani's Capital Wallet**: Dedicated capital balance, tracks all rent credited to him, initial seed capital, and debited maintenance shares.
- **Consolidated Building Treasury**: Live summary of total rent collected, total expenditures spent, and net liquid balance.
- **Automated Inter-Owner Settlement**: Intelligently computes if one owner paid more expenses or collected more rent than their agreed ratio and clearly calculates the settlement payment (`Jeelani owes Sajida ₹...` or vice versa).

### 2. Automated Recurring Expenses Engine
- **Scheduled Building Expenses**: Pre-configured with monthly schedules for:
  - **Watchman Monthly Salary** (₹12,000 / month, Day 1)
  - **Property Caretaker Wages** (₹8,000 / month, Day 2)
  - **CCTV Wi-Fi & Internet Bill** (₹799 / month, Day 5)
  - **Common Area Electricity / Motor Bill** (₹4,500 / month, Day 10)
  - **Solar Panel Servicing AMC** (₹1,500 / month, Day 15)
- **Zero-Touch Auto-Post Mode**: Automatically checks and posts all scheduled recurring expenses into the ledger when a new month begins.
- **1-Click Post Banner**: When recurring expenses are due, an interactive banner appears with a **1-Click "⚡ Post All Due Recurring Expenses"** button.
- **Full Customization**: Add new recurring rules, edit amounts, change split ratios (50:50, Sajida only, Jeelani only, custom %), pause, or resume any rule.
- **Auto-Recurring Badge**: Automatically tagged with an "Auto-Recurring" badge in the ledger so owners know exactly which expenses were automated.

### 3. Smart Expense Allocation & Dynamic Ratio Splitting
When recording an expenditure (e.g. Watchman salary, Electricity bill, Solar servicing, Water tanker):
- **50 : 50 Split**: Debits equal shares from both Sajida's and Jeelani's wallets.
- **100% Sajida Only**: Debits the complete expense from Sajida's wallet.
- **100% Jeelani Only**: Debits the complete expense from Jeelani's wallet.
- **Custom Ratio Split**: Slide or input custom split percentages (e.g. 60% Sajida : 40% Jeelani) or custom amounts.

### 3. Dynamic Categories & "Sheets"
Pre-configured with all required categories:
1. Maintenance
2. General Expenditure
3. Watchman Salary
4. Property Caretaker Salary
5. Current Bills (Electricity)
6. Water Tax / Tanker Charges
7. Property Tax
8. Solar Maintenance
9. Internet Bills (CCTV Broadband)
10. Miscellaneous
- **Dynamic Category Creator**: Tap **+ Add New Sheet/Category** to add custom sheets (e.g. *Lift AMC*, *Garden Landscaping*, *Pest Control*) with custom colors and icons on the fly!
- Filter transactions by sheet or view the master aggregated ledger.

### 4. Smart Tenant Directory & Rent Collections
- **Full Tenant Profiles**: Name, Phone, Flat / Unit number, Occupation, Advance / Security Deposit given, Monthly Rent, Move-in Date, and Parking notes.
- **Dynamic Collection Flow**:
  - Select an existing tenant: instantly auto-fills flat, phone, occupation, and rent.
  - Or select **+ Add New Tenant**: saves their permanent details and advance deposit immediately for future months.
  - Choose which owner's wallet receives the rent: **Sajida**, **Jeelani**, or **50:50 Shared**.
  - 1-Click **WhatsApp Payment Receipt Generator** with pre-formatted message.
  - 1-Click **WhatsApp Rent Due Reminder** for tenants who haven't paid yet.
  - Printable official rent receipts with receipt numbers.

### 5. Multi-Sheet Excel (.xlsx) Download
Click **Download Excel** to export a comprehensive 5-sheet workbook:
- **Sheet 1: Financial Summary**: Net treasury, owner balances, settlement status.
- **Sheet 2: Rent Collections Ledger**: Date, month, tenant, flat, phone, amount, owner credited, mode.
- **Sheet 3: Expenses Master Ledger**: Date, description, category, total, Sajida share, Jeelani share, debited wallet.
- **Sheet 4: Category Breakdown**: Totals and percentage distribution per sheet.
- **Sheet 5: Tenants & Deposits**: Complete tenant roster, occupations, advance deposits held.

### 6. Full Data Portability & Offline PWA
- **Local Storage Persistence**: Data is saved automatically.
- **Backup (JSON)**: 1-click download of all data to a secure file.
- **Restore (JSON)**: Upload your backup file anytime on any device.
- **Progressive Web App (PWA)**: Installable on Android & iPhone home screens.

---

## 🚀 How to Run the App

### Option 1: Double-Click (Quickest on Windows)
Simply double-click `start_app.bat`. It will launch the local server and open your browser automatically!

### Option 2: Run via Python
In your terminal, navigate to the folder and run:
```bash
python server.py
```
It will display:
- Desktop URL: `http://localhost:8000`
- Mobile Wi-Fi URL: `http://<YOUR_LOCAL_IP>:8000`

The server binds to `0.0.0.0`, which makes the app available to other devices on the same local network. The computer and phone must be connected to the same Wi-Fi/router. On Windows, allow Python through the firewall for **Private networks** when prompted. Public or guest Wi-Fi networks may block device-to-device access.

### Option 3: Direct Browser Open
You can also directly double-click `index.html` to open it in Chrome, Edge, Safari, or Firefox without running any server.

---

## 📱 How to Use on Mobile Phone (Android & iPhone)

1. Make sure your phone is connected to the same Wi-Fi network as your computer.
2. Run `python server.py` (or double-click `start_app.bat`).
3. Note the mobile URL shown in the terminal (e.g. `http://192.168.1.15:8000`).
4. Open Chrome (Android) or Safari (iPhone) on your phone and visit that URL.
5. **Install as App**:
   - **On Android**: Tap the Chrome 3-dots menu -> tap **"Add to Home screen"** or **"Install app"**.
   - **On iPhone**: Tap the Safari Share button (box with arrow) -> tap **"Add to Home Screen"**.
6. The app now opens like a native app with full-screen experience and touch optimization!

### Same-network troubleshooting

- Use the exact `http://<YOUR_LOCAL_IP>:8000` address printed by `server.py`; do not use `localhost` on the phone.
- Keep `server.py` running while using the mobile app.
- Confirm both devices are on the same Wi-Fi network, not one on mobile data.
- If the address times out, allow Python through Windows Defender Firewall on Private networks.
- Disable AP/client isolation on the router if devices on the same Wi-Fi cannot reach each other.
- Corporate, hotel, and guest Wi-Fi networks often block local device access; use a trusted private network.

### Suggested future features (not implemented)
- Role-based login and owner/manager permissions for controlled access.
- Cloud-synced encrypted backup to protect against device loss.
- Automated browser notifications for rent and bill due dates.
- An immutable audit log showing who changed or deleted transactions.
- Multi-property support for managing additional buildings later.

### Mobile compatibility audit notes
- The original app already had a viewport declaration, PWA manifest, mobile bottom navigation, responsive Tailwind breakpoints, safe-area padding, and horizontal table scrolling.
- The audit added a mobile-safe header/month selector, 42px touch targets, mobile-friendly sort controls, bottom-navigation safe-area spacing, full-width bottom-sheet modal behavior, and stronger overflow handling for dense ledgers.
- The primary mobile risk was dense tables and large modal forms; those now remain usable through horizontal scrolling and constrained, touch-scrollable modal panels.

### Expense workspace UI
- The Expenses screen now has a mobile-first sheet header with selected-category context and direct CSV/PDF actions.
- Select a category sheet, then use **CSV** or **PDF** to export only that category's expenses. Use **All Master Sheets** for the complete expense ledger.
- The new Expense Calendar is available below the expense ledger. Select a month, use the previous/next buttons, and tap a day with expenses to see the recorded items and total.
- Calendar behavior is local and reads the existing expense dates; it does not create or modify transactions.
- The redesigned expense workspace remains compatible with the existing PWA and LAN/mobile access setup.

### Sorting controls
- Expenses: date newest/oldest, amount high/low, description A-Z.
- Floor breakup: date newest/oldest, amount high/low, description A-Z.
- Rent collections: date newest/oldest, amount high/low, tenant A-Z.
- Wallet ledger: date newest/oldest, amount high/low, title/reason A-Z.

### Monthly PDF reports
- Use the global month selector in the header, then use **Monthly PDF** from the Expenses or Rent Collections view.
- The PDF includes the selected period, record count, total, and readable row-level details.
- Select **All Months** to generate a complete report.

### Backup and restore
- Backup exports the complete local data model, including tenants, rents, expenses, recurring rules, wallet adjustments, advance settlements, bank transactions, and wallet transfers.
- Restore validates the JSON shape, normalizes missing collections, asks for overwrite confirmation, and refreshes the active application state.
- Restore requires the current backup schema collections (`owners`, `categories`, `tenants`, `rentCollections`, and `expenses`).

### Multi-Device Real-Time Cloud Sync (Firebase)
- **Zero-Setup Mobile Pairing**: Pair any smartphone by clicking **Pair Mobile (QR)** on Desktop to scan the high-resolution QR code or share the direct link via WhatsApp.
- **Bi-Directional Real-Time Sync**: Any changes made on Desktop, Android, or iOS reflect across all paired devices via Google Firebase Firestore listeners.
- **Sync Now Tactile Feedback**: Tap **Sync Now** to instantly push and pull latest building data with clear visual spinning feedback and success notifications.
- **Offline First**: All operations work completely offline with localStorage; changes automatically sync once internet connectivity resumes.

### Executive-Grade PDF Generator & Individual Expense Vouchers
- **Official Meera Heights Header**: Deep emerald brand banner (`#047857`) with co-owners Sajida & Jeelani ownership breakdown, timestamp, and report periods.
- **Flexible Period Filtering**: Generate reports filtered by:
  - **Weekly**: Last 7 Days rolling summary.
  - **Monthly**: Select any historical or current month.
  - **Yearly**: Complete annual financial statement.
  - **Custom Range**: Pick exact Start Date and End Date.
- **Individual Expense Payment Vouchers (PDF)**: Download official printable payment vouchers for any expense with 1 click from desktop rows and mobile cards, including amount in words (Indian numbering system) and co-owner signature blocks.
- **Official Rent Receipts (PDF)**: Generate downloadable printable rent receipts with tenant name, flat number, amount in words, and payment mode.

### Individual Category Excel (.xlsx) Workbooks
- **Separate Workbooks per Expense Category**: Export individual `.xlsx` spreadsheets for each category (e.g. *Electricity Bills*, *Watchman Salary*, *Caretaker*, *Water Tax*, *Solar Maintenance*, etc.) directly from the Expenses header and the Export Center.
- **Download All Categories as Separate Files**: 1-click sequential download of all category workbooks as separate `.xlsx` files.
- **Custom Formatted**: Every sheet includes official Meera Heights banner, co-owner shares, alternating row zebra styling, and bold grand totals.
