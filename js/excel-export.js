/**
 * excel-export.js - Multi-Sheet Excel (.xlsx) & CSV Exporter for Meera Heights
 * Co-owned by Sajida (1st & 2nd Floors) and Jeelani (3rd, 4th & 5th Floors)
 * Includes Floor Ownership, Tenant Advances Breakup, and Refund Statements.
 */

class ExcelExporter {
    static downloadBlobUniversal(blob, fileName) {
        if (typeof window === 'undefined') return false;

        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
                         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isStandalonePWA = (typeof window !== 'undefined' && window.navigator && window.navigator.standalone) ||
                                (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

        // 1. In iOS Standalone PWA mode (Add-to-HomeScreen), WebKit restricts <a download>.
        // Prefer native Web Share API with file payload so user can 'Save to Files' or send directly.
        if (isStandalonePWA && isMobile && typeof navigator.share === 'function' && typeof File !== 'undefined') {
            try {
                const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    navigator.share({
                        files: [file],
                        title: fileName,
                        text: `Meera Heights Report: ${fileName}`
                    }).catch(err => {
                        if (err.name !== 'AbortError') console.warn('Web Share API error:', err);
                    });
                    return true;
                }
            } catch (err) {
                if (err.name === 'AbortError') return true;
                console.warn('Web Share PWA check error, falling back to standard download:', err);
            }
        }

        // 2. Direct browser file download using HTML5 download attribute (Supported on Desktop, Android, iOS Safari 13+)
        try {
            if (window.navigator && window.navigator.msSaveOrOpenBlob) {
                window.navigator.msSaveOrOpenBlob(blob, fileName);
                return true;
            }

            if (typeof document !== 'undefined') {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                // CRITICAL FOR IOS SAFARI & MOBILE WEBVIEWS: Do NOT use display: none.
                // WebKit ignores synthetic clicks on elements without a layout object.
                a.style.position = 'fixed';
                a.style.left = '-9999px';
                a.style.top = '-9999px';
                a.style.opacity = '0';
                a.style.pointerEvents = 'none';
                a.href = url;
                a.setAttribute('download', fileName);
                document.body.appendChild(a);

                // Dispatch synthetic MouseEvent with full bubble & cancelable flags
                try {
                    const clickEvt = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
                    a.dispatchEvent(clickEvt);
                } catch (clickErr) {
                    a.click();
                }

                setTimeout(() => {
                    try {
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                    } catch (e) {}
                }, 15000);
                return true;
            }
        } catch (downloadErr) {
            console.warn('Direct link download error, trying mobile share fallback:', downloadErr);
        }

        // 3. Native Web Share API fallback for mobile devices where direct download failed
        if (isMobile && typeof navigator.share === 'function' && typeof File !== 'undefined') {
            try {
                const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    navigator.share({
                        files: [file],
                        title: fileName,
                        text: `Meera Heights Report: ${fileName}`
                    }).catch(err => {
                        if (err.name !== 'AbortError') console.warn('Web Share API error:', err);
                    });
                    return true;
                }
            } catch (err) {
                if (err.name === 'AbortError') return true;
                console.warn('Web Share API error:', err);
            }
        }

        return false;
    }

    static downloadWorkbook(wb, fileName) {
        try {
            // Generate binary array buffer directly from SheetJS workbook
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            return this.downloadBlobUniversal(blob, fileName);
        } catch (e) {
            console.warn('XLSX direct blob generation error, trying XLSX.writeFile:', e);
            try {
                if (typeof XLSX !== 'undefined' && typeof XLSX.writeFile === 'function') {
                    XLSX.writeFile(wb, fileName);
                    return true;
                }
            } catch (err2) {
                console.error('All workbook download methods failed:', err2);
            }
            return false;
        }
    }

    static getSheetConfig(sheetKey, appState) {
        switch (sheetKey) {
            case 'summary':
                return {
                    name: "Financial Summary",
                    data: this.buildSummarySheet(appState),
                    cols: [{ wch: 36 }, { wch: 24 }, { wch: 45 }],
                    fileBaseName: "Meera_Heights_Financial_Summary"
                };
            case 'rents':
                return {
                    name: "Rent Collections",
                    data: this.buildRentSheet(appState),
                    cols: [
                        { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 12 }, { wch: 14 },
                        { wch: 15 }, { wch: 16 }, { wch: 18 }, { wch: 28 }
                    ],
                    fileBaseName: "Meera_Heights_Rent_Collections"
                };
            case 'expenses':
                return {
                    name: "Expenses Ledger",
                    data: this.buildExpensesSheet(appState),
                    cols: [
                        { wch: 12 }, { wch: 32 }, { wch: 24 }, { wch: 15 },
                        { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 30 }
                    ],
                    fileBaseName: "Meera_Heights_Expenses_Ledger"
                };
            case 'advances':
                return {
                    name: "Tenant Advances",
                    data: this.buildAdvanceSheet(appState),
                    cols: [
                        { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 20 },
                        { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 16 },
                        { wch: 18 }, { wch: 14 }, { wch: 28 }
                    ],
                    fileBaseName: "Meera_Heights_Tenant_Advances"
                };
            case 'categories':
                return {
                    name: "Category Breakdown",
                    data: this.buildCategorySheet(appState),
                    cols: [{ wch: 30 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 16 }],
                    fileBaseName: "Meera_Heights_Category_Breakdown"
                };
            case 'tenants':
                return {
                    name: "Tenants Directory",
                    data: this.buildTenantSheet(appState),
                    cols: [
                        { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 20 },
                        { wch: 18 }, { wch: 15 }, { wch: 14 }, { wch: 14 }, { wch: 28 }
                    ],
                    fileBaseName: "Meera_Heights_Tenants_Directory"
                };
            case 'recurring':
                return {
                    name: "Recurring Schedules",
                    data: this.buildRecurringSheet(appState),
                    cols: [
                        { wch: 32 }, { wch: 22 }, { wch: 15 }, { wch: 14 },
                        { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 30 }
                    ],
                    fileBaseName: "Meera_Heights_Recurring_Schedules"
                };
            case 'floors':
                return {
                    name: "Floor Breakup",
                    data: this.buildFloorBreakupSheet(appState),
                    cols: [
                        { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
                        { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 14 }
                    ],
                    fileBaseName: "Meera_Heights_Floor_Expenses_Breakup"
                };
            case 'bank':
                return {
                    name: "Bank Transfers",
                    data: this.buildBankSheet(appState),
                    cols: [
                        { wch: 12 }, { wch: 24 }, { wch: 15 }, { wch: 16 }, { wch: 18 },
                        { wch: 24 }, { wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 30 }
                    ],
                    fileBaseName: "Meera_Heights_Wallet_Bank_Transfers"
                };
            case 'transfers':
                return {
                    name: "Wallet Transfers",
                    data: this.buildWalletTransfersSheet(appState),
                    cols: [
                        { wch: 12 }, { wch: 24 }, { wch: 24 }, { wch: 16 },
                        { wch: 45 }, { wch: 30 }
                    ],
                    fileBaseName: "Meera_Heights_Advance_Rent_Transfers"
                };
            default:
                return null;
        }
    }

    static exportSheet(sheetKey, appState) {
        try {
            if (typeof XLSX === 'undefined') {
                if (typeof alert !== 'undefined') alert('Excel export library is loading. Please try again.');
                return false;
            }

            const cfg = this.getSheetConfig(sheetKey, appState);
            if (!cfg) {
                console.error('Unknown sheet key:', sheetKey);
                return false;
            }

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(cfg.data);
            if (cfg.cols) ws['!cols'] = cfg.cols;

            XLSX.utils.book_append_sheet(wb, ws, cfg.name.slice(0, 31));

            const timestamp = new Date().toISOString().slice(0, 10);
            const fileName = `${cfg.fileBaseName}_${timestamp}.xlsx`;
            this.downloadWorkbook(wb, fileName);
            return true;
        } catch (err) {
            console.error(`Error exporting sheet ${sheetKey}:`, err);
            if (typeof alert !== 'undefined') alert('Failed to generate Excel sheet: ' + err.message);
            return false;
        }
    }

    static exportAllSheetsSeparately(appState, onProgress = null) {
        const keys = ['summary', 'rents', 'expenses', 'floors', 'advances', 'transfers', 'bank', 'categories', 'tenants', 'recurring'];
        keys.forEach((k, idx) => {
            setTimeout(() => {
                this.exportSheet(k, appState);
                if (onProgress) onProgress(idx + 1, keys.length, k);
            }, idx * 400);
        });
        return true;
    }

    static exportWorkbook(appState) {
        try {
            if (typeof XLSX === 'undefined') {
                if (typeof alert !== 'undefined') alert('Excel library is still loading. Please check your internet connection or use the local copy.');
                return false;
            }

            const wb = XLSX.utils.book_new();
            const keys = ['summary', 'rents', 'expenses', 'floors', 'advances', 'transfers', 'bank', 'categories', 'tenants', 'recurring'];

            keys.forEach(k => {
                const cfg = this.getSheetConfig(k, appState);
                if (cfg) {
                    const ws = XLSX.utils.aoa_to_sheet(cfg.data);
                    if (cfg.cols) ws['!cols'] = cfg.cols;
                    XLSX.utils.book_append_sheet(wb, ws, cfg.name);
                }
            });

            const timestamp = new Date().toISOString().slice(0, 10);
            const fileName = `Meera_Heights_Building_Accounts_${timestamp}.xlsx`;
            this.downloadWorkbook(wb, fileName);
            return true;
        } catch (err) {
            console.error('Error generating master Excel workbook:', err);
            if (typeof alert !== 'undefined') alert('Failed to generate Excel file: ' + err.message);
            return false;
        }
    }

    static buildSummarySheet(state) {
        const stats = state.stats || (typeof state.getStats === 'function' ? state.getStats() : {});
        const totalAdvances = stats.totalAdvancesCollected || ((stats.sajidaAdvancesCollected || 0) + (stats.jeelaniAdvancesCollected || 0));
        const totalRefunds = stats.totalRefunds || ((stats.sajidaRefunds || 0) + (stats.jeelaniRefunds || 0));
        const totalWalletToBank = stats.totalWalletToBank || 0;
        const totalBankToWallet = stats.totalBankToWallet || 0;
        const netLiquid = (stats.sajidaBalance || 0) + (stats.jeelaniBalance || 0);
        const netFree = netLiquid - (stats.totalDeposits || 0);

        return [
            ["MEERA HEIGHTS - BUILDING FINANCIAL & EXPENDITURE STATEMENT", "", ""],
            ["Generated On:", new Date().toLocaleString('en-IN'), ""],
            ["Floor Ownership:", "Sajida: 1st & 2nd Floors | Jeelani: 3rd, 4th & 5th Floors", ""],
            ["", "", ""],
            ["METRIC", "AMOUNT (₹)", "DETAILS / FLOOR BREAKDOWN"],
            ["Total Rent Collected", stats.totalRent, "All floors collected to date"],
            ["Total Advances Received", totalAdvances, "Initial tenant deposits added to owner liquid cash"],
            ["Total Expenditure Spent", stats.totalExpenses, "Total maintenance & operational costs debited"],
            ["Total Advance Refunds Paid", totalRefunds, "Security deposit refunds paid out upon vacating/settlement"],
            ["Total Transferred to Bank (Outflow)", totalWalletToBank, "Liquid wallet funds moved into owner bank accounts"],
            ["Total Deposited from Bank (Inflow)", totalBankToWallet, "Funds deposited from bank accounts into liquid wallet"],
            ["Net Building Liquid Treasury", netLiquid, "Real liquid cash on hand in wallets (Capital + Rent + Adv + Bank In - Exp - Refund - Bank Out)"],
            ["Total Active Tenant Advances Held (Liabilities)", stats.totalDeposits, "Tenant security deposits held in trust (must be returned or adjusted)"],
            ["Net Building Free Capital", netFree, "Liquid funds surplus free from tenant advance liabilities"],
            ["Total Advance Deductions Realized", stats.totalDeductions || 0, "Painting/repairs/dues retained from tenant advances"],
            ["", "", ""],
            ["4 INDIVIDUAL WALLETS BREAKUP", "LIQUID BALANCE (₹)", "PURPOSE & DETAILS"],
            ["1. Sajida Advance Wallet", stats.sajidaAdvanceBalance || 0, `Advances: ₹${stats.sajidaAdvancesCollected || 0} | Exp: -₹${stats.sajidaExpAdvance || 0} | Refunds: -₹${stats.sajidaRefunds || 0} | Retained Deductions: -₹${stats.sajidaDeductions || 0} (to Rent) | Held Liab: ₹${stats.sajidaAdvancesHeld || 0} | Free Adv: ₹${stats.sajidaFreeAdvance || 0}`],
            ["2. Sajida Rent Wallet", stats.sajidaRentBalance || 0, `Rent: ₹${stats.sajidaRentTotal || 0} | Deductions Inflow: +₹${stats.sajidaDeductions || 0} (from Adv Settlements)`],
            ["3. Jeelani Advance Wallet", stats.jeelaniAdvanceBalance || 0, `Advances: ₹${stats.jeelaniAdvancesCollected || 0} | Exp: -₹${stats.jeelaniExpAdvance || 0} | Refunds: -₹${stats.jeelaniRefunds || 0} | Retained Deductions: -₹${stats.jeelaniDeductions || 0} (to Rent) | Held Liab: ₹${stats.jeelaniAdvancesHeld || 0} | Free Adv: ₹${stats.jeelaniFreeAdvance || 0}`],
            ["4. Jeelani Rent Wallet", stats.jeelaniRentBalance || 0, `Rent: ₹${stats.jeelaniRentTotal || 0} | Deductions Inflow: +₹${stats.jeelaniDeductions || 0} (from Adv Settlements)`],
            ["", "", ""],
            ["OWNER WALLET STATUS", "LIQUID BALANCE (₹)", "BREAKDOWN (Rent + Adv + Bank In - Exp - Refund - Bank Out | Free Capital)"],
            ["Sajida's Total Liquid Capital (Floors 1 & 2)", stats.sajidaBalance, `Rent: ₹${stats.sajidaRentTotal} | Adv Recv: ₹${stats.sajidaAdvancesCollected || 0} | Bank In: ₹${stats.sajidaBankInflow || 0} | Exp: ₹${stats.sajidaExpTotal} | Refunds: ₹${stats.sajidaRefunds || 0} | Bank Out: ₹${stats.sajidaBankOutflow || 0} | Held Liab: ₹${stats.sajidaAdvancesHeld} | Free Cap: ₹${stats.sajidaFreeCapital}`],
            ["Jeelani's Total Liquid Capital (Floors 3, 4 & 5)", stats.jeelaniBalance, `Rent: ₹${stats.jeelaniRentTotal} | Adv Recv: ₹${stats.jeelaniAdvancesCollected || 0} | Bank In: ₹${stats.jeelaniBankInflow || 0} | Exp: ₹${stats.jeelaniExpTotal} | Refunds: ₹${stats.jeelaniRefunds || 0} | Bank Out: ₹${stats.jeelaniBankOutflow || 0} | Held Liab: ₹${stats.jeelaniAdvancesHeld} | Free Cap: ₹${stats.jeelaniFreeCapital}`],
            ["", "", ""],
            ["INTER-OWNER SETTLEMENT", stats.settlementText, stats.settlementNote]
        ];
    }

    static buildRentSheet(state) {
        const rows = [
            ["Date", "Month", "Tenant Name", "Flat No", "Floor", "Amount (₹)", "Credited Owner", "Credit Destination", "Bank / Account", "Payment Mode", "Notes"]
        ];

        state.data.rentCollections.forEach(r => {
            let credited = "Split 50:50";
            if (r.ownerCredited === 'sajida') credited = "Sajida (Fl 1-2)";
            else if (r.ownerCredited === 'jeelani') credited = "Jeelani (Fl 3-5)";

            const isBank = (r.creditDestination === 'bank');
            const destLabel = isBank ? "Direct to Bank Account" : "Owner Liquid Wallet";
            const bankAccount = isBank ? (r.bankName || "Bank Account") : "Liquid Wallet (N/A)";

            rows.push([
                r.paymentDate || '',
                r.month || '',
                r.tenantName || '',
                r.flat || '',
                r.floor ? `${r.floor} Floor` : '',
                r.amount || 0,
                credited,
                destLabel,
                bankAccount,
                r.paymentMode || 'Cash',
                r.notes || ''
            ]);
        });

        const total = state.data.rentCollections.reduce((acc, c) => acc + (c.amount || 0), 0);
        rows.push(["", "", "TOTAL RENT COLLECTED", "", "", total, "", "", "", "", ""]);
        return rows;
    }

    static buildExpensesSheet(state) {
        const rows = [
            ["Date", "Expense Description", "Category / Sheet", "Total (₹)", "Split Type", "Sajida Share (₹)", "Jeelani Share (₹)", "Debited From", "Recurring", "Notes"]
        ];

        state.data.expenses.forEach(e => {
            const cat = state.data.categories.find(c => c.id === e.categoryId);
            const catName = cat ? cat.name : (e.categoryId || 'General');
            
            let splitDesc = "60 : 40 Floor Ratio (Jeelani 60% : Sajida 40%)";
            if (e.splitType === 'sajida_only') splitDesc = "100% Sajida (Fl 1-2)";
            else if (e.splitType === 'jeelani_only') splitDesc = "100% Jeelani (Fl 3-5)";
            else if (e.splitType === 'custom') splitDesc = `Custom (${e.sajidaRatio}% : ${e.jeelaniRatio}%)`;

            let debited = "Both Wallets";
            if (e.debitedWallet === 'sajida') debited = "Sajida's Wallet";
            else if (e.debitedWallet === 'jeelani') debited = "Jeelani's Wallet";

            const recurringTag = e.isRecurring ? "Automated" : "Manual";

            rows.push([
                e.date || '',
                e.title || '',
                catName,
                e.amount || 0,
                splitDesc,
                e.sajidaAmount || 0,
                e.jeelaniAmount || 0,
                debited,
                recurringTag,
                e.notes || ''
            ]);
        });

        const totalExp = state.data.expenses.reduce((acc, c) => acc + (c.amount || 0), 0);
        const sajidaExp = state.data.expenses.reduce((acc, c) => acc + (c.sajidaAmount || 0), 0);
        const jeelaniExp = state.data.expenses.reduce((acc, c) => acc + (c.jeelaniAmount || 0), 0);

        rows.push(["", "TOTAL EXPENDITURE", "", totalExp, "", sajidaExp, jeelaniExp, "", "", ""]);
        return rows;
    }

    static buildAdvanceSheet(state) {
        const rows = [
            ["Tenant Name", "Flat No", "Floor", "Holding Owner", "Advance Paid (₹)", "Active Held (₹)", "Deductions (₹)", "Refund Paid (₹)", "Status", "Date Received", "Remarks"]
        ];

        let totalAdvance = 0;
        let totalHeld = 0;
        let totalDeductions = 0;
        let totalRefunds = 0;

        state.data.tenants.forEach(t => {
            const deposit = parseFloat(t.advanceDeposit) || 0;
            const deductions = parseFloat(t.advanceDeductions) || 0;
            const refunded = parseFloat(t.advanceRefunded) || 0;
            const activeHeld = Math.max(0, deposit - deductions - refunded);

            totalAdvance += deposit;
            totalHeld += activeHeld;
            totalDeductions += deductions;
            totalRefunds += refunded;

            const floor = parseInt(t.floor) || 1;
            const floorOwner = (floor === 1 || floor === 2) ? "Sajida (Floors 1-2)" : "Jeelani (Floors 3-5)";
            const status = t.status === 'vacated' ? 'Vacated / Settled' : (activeHeld === 0 && (refunded > 0 || deductions > 0) ? 'Fully Settled' : (refunded > 0 || deductions > 0 ? 'Partially Settled' : 'Active (Held)'));
            
            rows.push([
                t.name || '',
                t.flat || '',
                t.floor ? `${t.floor} Floor` : '',
                floorOwner,
                deposit,
                activeHeld,
                deductions,
                refunded,
                status,
                t.advancePaidDate || t.moveInDate || '',
                t.notes || ''
            ]);
        });

        rows.push(["TOTALS", "", "", "", totalAdvance, totalHeld, totalDeductions, totalRefunds, "", "", ""]);

        // Advance Settlements & Deductions Log Section
        rows.push(["", "", "", "", "", "", "", "", "", "", ""]);
        rows.push(["ADVANCE SETTLEMENTS & DEDUCTIONS LOG", "", "", "", "", "", "", "", "", "", ""]);
        rows.push(["Date", "Tenant Name", "Flat No", "Advance Wallet", "Total Held (₹)", "Deductions (₹)", "Refund Paid (₹)", "Advance Left (₹)", "Payment Mode", "Status", "Notes / Remarks"]);

        let totalSettleDeductions = 0;
        let totalSettleRefunds = 0;

        (state.data.advanceSettlements || []).forEach(s => {
            const isSajida = (s.refundOwner === 'sajida' || (s.walletId && s.walletId.startsWith('sajida')) || s.floor <= 2);
            const wLabel = isSajida ? "Sajida Advance (Fl 1-2)" : "Jeelani Advance (Fl 3-5)";
            totalSettleDeductions += (s.totalDeductions || 0);
            totalSettleRefunds += (s.refundAmount || 0);

            const deductBreakdown = [
                s.paintingDeduction ? `Painting: ₹${s.paintingDeduction}` : null,
                s.cleaningDeduction ? `Cleaning: ₹${s.cleaningDeduction}` : null,
                s.utilityDeduction ? `Utility: ₹${s.utilityDeduction}` : null,
                s.damageDeduction ? `Repairs: ₹${s.damageDeduction}` : null,
                s.otherDeduction ? `Other: ₹${s.otherDeduction}` : null
            ].filter(Boolean).join(', ');

            rows.push([
                s.settlementDate || '',
                s.tenantName || '',
                s.flat ? `${s.flat} (${s.floor} Fl)` : '',
                wLabel,
                s.totalHeld || 0,
                s.totalDeductions || 0,
                s.refundAmount || 0,
                s.advanceLeftHeld || 0,
                s.refundPaymentMode || 'Bank Transfer',
                s.isVacated ? 'Vacated' : 'Continuing',
                (deductBreakdown ? `${deductBreakdown} • ` : '') + (s.notes || '')
            ]);
        });

        rows.push(["TOTAL SETTLEMENTS", "", "", "", "", totalSettleDeductions, totalSettleRefunds, "", "", "", ""]);
        return rows;
    }

    static buildBankSheet(state) {
        const rows = [
            ["Date", "Target Wallet", "Owner", "Floors Owned", "Assigned Floor / Scope", "Direction / Type", "Amount (₹)", "Bank Account", "Transfer Mode", "Reference / UTR", "Remarks / Purpose"]
        ];

        let totalWalletToBank = 0;
        let totalBankToWallet = 0;

        const walletLabels = {
            'sajida_advance': 'Sajida Advance Wallet',
            'sajida_rent': 'Sajida Rent Wallet',
            'jeelani_advance': 'Jeelani Advance Wallet',
            'jeelani_rent': 'Jeelani Rent Wallet'
        };

        (state.data.bankTransactions || []).forEach(tx => {
            const amt = parseFloat(tx.amount) || 0;
            const isWalletToBank = (tx.type === 'wallet_to_bank');
            if (isWalletToBank) {
                totalWalletToBank += amt;
            } else {
                totalBankToWallet += amt;
            }

            const ownerName = tx.ownerId === 'sajida' ? 'Sajida' : 'Jeelani';
            const floors = tx.ownerId === 'sajida' ? '1st & 2nd Floors' : '3rd, 4th & 5th Floors';
            const dirLabel = isWalletToBank ? 'Wallet ➔ Bank (Withdrawal)' : 'Bank ➔ Wallet (Deposit)';
            const assignedFloor = tx.floor || floors;
            const walletLabel = tx.walletName || (tx.walletId ? (walletLabels[tx.walletId] || tx.walletId) : (tx.ownerId === 'sajida' ? 'Sajida Rent' : 'Jeelani Rent'));

            rows.push([
                tx.date || '',
                walletLabel,
                ownerName,
                floors,
                assignedFloor,
                dirLabel,
                amt,
                tx.bankName || 'Bank Account',
                tx.transferMode || 'Transfer',
                tx.reference || '',
                tx.notes || ''
            ]);
        });

        rows.push(["", "", "", "", "", "", "", "", "", "", ""]);
        rows.push(["TOTAL WALLET ➔ BANK (OUTFLOW TO BANK)", "", "", "", "", "", totalWalletToBank, "", "", "", "Liquid wallet funds moved into owner bank accounts"]);
        rows.push(["TOTAL BANK ➔ WALLET (INFLOW FROM BANK)", "", "", "", "", "", totalBankToWallet, "", "", "", "Bank funds injected into liquid wallet"]);
        rows.push(["NET BANK LIQUID FLOW", "", "", "", "", "", (totalBankToWallet - totalWalletToBank), "", "", "", "Net cash deposited into wallet from bank accounts"]);

        return rows;
    }

    static buildWalletTransfersSheet(state) {
        const rows = [
            ["Date", "Source Wallet (Debited)", "Destination Wallet (Credited)", "Amount (₹)", "Reason / Purpose", "Notes / Remarks"]
        ];

        let totalTransfers = 0;
        let sajidaAdvToRent = 0;
        let sajidaRentToAdv = 0;
        let jeelaniAdvToRent = 0;
        let jeelaniRentToAdv = 0;

        const walletLabels = {
            'sajida_advance': 'Sajida Advance Wallet',
            'sajida_rent': 'Sajida Rent Wallet',
            'jeelani_advance': 'Jeelani Advance Wallet',
            'jeelani_rent': 'Jeelani Rent Wallet'
        };

        (state.data.walletTransfers || []).forEach(wt => {
            const amt = parseFloat(wt.amount) || 0;
            totalTransfers += amt;

            if (wt.fromWallet === 'sajida_advance' && wt.toWallet === 'sajida_rent') sajidaAdvToRent += amt;
            if (wt.fromWallet === 'sajida_rent' && wt.toWallet === 'sajida_advance') sajidaRentToAdv += amt;
            if (wt.fromWallet === 'jeelani_advance' && wt.toWallet === 'jeelani_rent') jeelaniAdvToRent += amt;
            if (wt.fromWallet === 'jeelani_rent' && wt.toWallet === 'jeelani_advance') jeelaniRentToAdv += amt;

            rows.push([
                wt.date || '',
                walletLabels[wt.fromWallet] || wt.fromWallet || '',
                walletLabels[wt.toWallet] || wt.toWallet || '',
                amt,
                wt.reason || 'Internal Wallet Transfer',
                wt.notes || ''
            ]);
        });

        rows.push(["", "", "", "", "", ""]);
        rows.push(["TOTAL INTERNAL TRANSFERS", "", "", totalTransfers, "Across all 4 wallets", ""]);
        rows.push(["Sajida Advance ➔ Rent (Surplus Shift)", "", "", sajidaAdvToRent, "Transferred advance surplus to rent", ""]);
        rows.push(["Sajida Rent ➔ Advance (Refill for Exp)", "", "", sajidaRentToAdv, "Refilled advance wallet for building maintenance", ""]);
        rows.push(["Jeelani Advance ➔ Rent (Surplus Shift)", "", "", jeelaniAdvToRent, "Transferred advance surplus to rent", ""]);
        rows.push(["Jeelani Rent ➔ Advance (Refill for Exp)", "", "", jeelaniRentToAdv, "Refilled advance wallet for building maintenance", ""]);

        return rows;
    }

    static buildFloorBreakupSheet(state, floorFilter = 'all') {
        const rows = [
            ["MEERA HEIGHTS - FLOOR-WISE FINANCIAL BREAKUP & CASHFLOW REPORT"],
            [`Generated: ${new Date().toLocaleString('en-IN')}`],
            ["Floor Ownership: Sajida (Floors 1 & 2 - 40%) | Jeelani (Floors 3, 4 & 5 - 60%)"],
            ["Common Building Expenses are shared equally at 20% per floor across all 5 floors."],
            [],
            ["--- FLOOR FINANCIAL LIFECYCLE & CASHFLOW SUMMARY ---"],
            ["Floor", "Owner", "Building Share", "Active Tenants", "Advance Payment (₹)", "Refund Advance (₹)", "Advance Held (₹)", "Rent Inflow (₹)", "Rent Outflow (₹)", "Rent Wallet to Owner Bank Inflow (₹)", "Total Expenses Debited (₹)", "Direct Floor Cost (₹)", "Common Share Cost (₹)", "Net Operating Surplus (₹)"]
        ];

        const floorData = {
            1: { floor: 1, name: '1st Floor', owner: 'Sajida', sharePct: '20%', expenses: 0, directExp: 0, sharedExp: 0, rent: 0, activeTenants: 0, advancePayment: 0, refundAdvance: 0, settleDeductions: 0, advanceHeld: 0, rentToBank: 0, rentToAdvance: 0, rentOutflow: 0, items: [] },
            2: { floor: 2, name: '2nd Floor', owner: 'Sajida', sharePct: '20%', expenses: 0, directExp: 0, sharedExp: 0, rent: 0, activeTenants: 0, advancePayment: 0, refundAdvance: 0, settleDeductions: 0, advanceHeld: 0, rentToBank: 0, rentToAdvance: 0, rentOutflow: 0, items: [] },
            3: { floor: 3, name: '3rd Floor', owner: 'Jeelani', sharePct: '20%', expenses: 0, directExp: 0, sharedExp: 0, rent: 0, activeTenants: 0, advancePayment: 0, refundAdvance: 0, settleDeductions: 0, advanceHeld: 0, rentToBank: 0, rentToAdvance: 0, rentOutflow: 0, items: [] },
            4: { floor: 4, name: '4th Floor', owner: 'Jeelani', sharePct: '20%', expenses: 0, directExp: 0, sharedExp: 0, rent: 0, activeTenants: 0, advancePayment: 0, refundAdvance: 0, settleDeductions: 0, advanceHeld: 0, rentToBank: 0, rentToAdvance: 0, rentOutflow: 0, items: [] },
            5: { floor: 5, name: '5th Floor', owner: 'Jeelani', sharePct: '20%', expenses: 0, directExp: 0, sharedExp: 0, rent: 0, activeTenants: 0, advancePayment: 0, refundAdvance: 0, settleDeductions: 0, advanceHeld: 0, rentToBank: 0, rentToAdvance: 0, rentOutflow: 0, items: [] },
        };

        (state.data.tenants || []).forEach(t => {
            const fl = parseInt(t.floor) || 1;
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

        (state.data.rentCollections || []).forEach(r => {
            const fl = parseInt(r.floor) || 1;
            if (floorData[fl]) floorData[fl].rent += (parseFloat(r.amount) || 0);
        });

        // Rent-to-Bank and Rent Outflow allocations
        const detectSingleFloor = (item) => {
            if (!item) return null;
            if (item.floorCode !== undefined && item.floorCode !== null) {
                const fc = String(item.floorCode).trim();
                if (/^[1-5]$/.test(fc)) return parseInt(fc);
            }
            if (item.floor && typeof item.floor === 'string') {
                const flStr = item.floor.trim();
                if (!/floors|all|split|&|,/i.test(flStr)) {
                    const m = flStr.match(/\b(?:floor\s*)?([1-5])(?:st|nd|rd|th)?(?:\s*floor)?\b/i);
                    if (m && /^[1-5]$/.test(m[1])) return parseInt(m[1]);
                }
            }
            const text = `${item.notes || ''} ${item.reference || ''}`.trim();
            if (text && !/floors\s*[1-5]\s*(?:&|,|\band\b)\s*[1-5]/i.test(text)) {
                const m = text.match(/\b(?:floor|fl|flat|flr)\s*([1-5])\b/i) || 
                          text.match(/\b([1-5])(?:st|nd|rd|th)\s*(?:floor|fl|flr)\b/i) ||
                          text.match(/\bflat\s*([1-5])\d{2}\b/i);
                if (m && /^[1-5]$/.test(m[1])) return parseInt(m[1]);
            }
            return null;
        };

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
                let rem = amt;
                const equalShare = Math.round(amt / ownerFloors.length);
                ownerFloors.forEach((fl, idx) => {
                    const cur = (idx === ownerFloors.length - 1) ? rem : equalShare;
                    rem -= cur;
                    floorData[fl][targetField] += cur;
                });
            }
        };

        let sajidaUnassignedBank = 0;
        let jeelaniUnassignedBank = 0;

        (state.data.bankTransactions || []).forEach(tx => {
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

        allocateUnassigned(sajidaUnassignedBank, [1, 2], 'rentToBank');
        allocateUnassigned(jeelaniUnassignedBank, [3, 4, 5], 'rentToBank');

        let sajidaUnassignedAdv = 0;
        let jeelaniUnassignedAdv = 0;

        (state.data.walletTransfers || []).forEach(tr => {
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

        allocateUnassigned(sajidaUnassignedAdv, [1, 2], 'rentToAdvance');
        allocateUnassigned(jeelaniUnassignedAdv, [3, 4, 5], 'rentToAdvance');

        [1, 2, 3, 4, 5].forEach(fl => {
            floorData[fl].rentOutflow = floorData[fl].rentToBank + floorData[fl].rentToAdvance;
        });

        (state.data.expenses || []).forEach(exp => {
            const totalAmt = parseFloat(exp.amount) || 0;
            const target = exp.targetFloor || 'all';

            if (target === '1' || target === '2' || target === '3' || target === '4' || target === '5') {
                const fl = parseInt(target);
                if (floorData[fl]) {
                    floorData[fl].expenses += totalAmt;
                    floorData[fl].directExp += totalAmt;
                    floorData[fl].items.push({ ...exp, floorShare: totalAmt, scope: 'Direct Floor Expense' });
                }
            } else if (target === 'sajida_floors' || (!exp.targetFloor && exp.splitType === 'sajida_only')) {
                const share = Math.round(totalAmt / 2);
                [1, 2].forEach((fl, idx) => {
                    const cur = (idx === 1) ? (totalAmt - share) : share;
                    floorData[fl].expenses += cur;
                    floorData[fl].sharedExp += cur;
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
                    floorData[fl].items.push({ ...exp, floorShare: cur, scope: 'Jeelani Floors Share (33.3%)' });
                });
            } else {
                const share = Math.round(totalAmt * 0.20);
                let rem = totalAmt;
                [1, 2, 3, 4, 5].forEach((fl, idx) => {
                    const cur = (idx === 4) ? rem : share;
                    rem -= cur;
                    floorData[fl].expenses += cur;
                    floorData[fl].sharedExp += cur;
                    floorData[fl].items.push({ ...exp, floorShare: cur, scope: 'Building Shared (20% Share)' });
                });
            }
        });

        let totTenants = 0, totAdvPay = 0, totAdvRef = 0, totAdvHeld = 0;
        let totRentIn = 0, totRentOut = 0, totRentBank = 0;
        let totExp = 0, totDirExp = 0, totSharedExp = 0, totSurplus = 0;

        [1, 2, 3, 4, 5].forEach(fl => {
            const f = floorData[fl];
            const surplus = f.rent - f.expenses;
            totTenants += f.activeTenants;
            totAdvPay += f.advancePayment;
            totAdvRef += f.refundAdvance;
            totAdvHeld += f.advanceHeld;
            totRentIn += f.rent;
            totRentOut += f.rentOutflow;
            totRentBank += f.rentToBank;
            totExp += f.expenses;
            totDirExp += f.directExp;
            totSharedExp += f.sharedExp;
            totSurplus += surplus;

            rows.push([
                f.name,
                f.owner,
                f.sharePct,
                f.activeTenants,
                f.advancePayment,
                f.refundAdvance,
                f.advanceHeld,
                f.rent,
                f.rentOutflow,
                f.rentToBank,
                f.expenses,
                f.directExp,
                f.sharedExp,
                surplus
            ]);
        });

        rows.push([
            "TOTAL BUILDING",
            "Sajida & Jeelani",
            "100%",
            totTenants,
            totAdvPay,
            totAdvRef,
            totAdvHeld,
            totRentIn,
            totRentOut,
            totRentBank,
            totExp,
            totDirExp,
            totSharedExp,
            totSurplus
        ]);

        rows.push([]);
        rows.push(["--- GRANULAR EXPENSE ITEMS BY FLOOR ---"]);
        rows.push(["Date", "Floor", "Floor Owner", "Expense Description", "Category", "Cost Scope", "Total Voucher (₹)", "This Floor Share (₹)", "Debited Shareholder", "Notes"]);

        const floorsToInclude = (floorFilter === 'all') ? [1, 2, 3, 4, 5] : [parseInt(floorFilter)];
        floorsToInclude.forEach(fl => {
            const f = floorData[fl];
            f.items.forEach(it => {
                const cat = (state.data.categories || []).find(c => c.id === it.categoryId);
                const catName = cat ? cat.name : (it.categoryId || 'General');
                rows.push([
                    it.date || '',
                    f.name,
                    f.owner,
                    it.title || '',
                    catName,
                    it.scope || '',
                    it.amount || 0,
                    it.floorShare || 0,
                    it.paidBy || f.owner,
                    it.notes || ''
                ]);
            });
        });

        return rows;
    }

    static exportFloorExpensesToExcel(floorFilter = 'all') {
        const appState = (typeof App !== 'undefined') ? App : window.App;
        if (!appState || typeof XLSX === 'undefined') {
            alert('Excel export engine is not ready.');
            return;
        }

        const wb = XLSX.utils.book_new();
        const data = this.buildFloorBreakupSheet(appState, floorFilter);
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [
            { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 32 }, { wch: 22 },
            { wch: 28 }, { wch: 18 }, { wch: 20 }, { wch: 22 }, { wch: 30 }
        ];
        const sheetName = (floorFilter === 'all') ? "All Floors Breakup" : `Floor ${floorFilter} Breakup`;
        XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));

        const fileName = (floorFilter === 'all') 
            ? `Meera_Heights_Floor_Expenses_Breakup_${new Date().toISOString().slice(0, 10)}.xlsx`
            : `Meera_Heights_Floor_${floorFilter}_Expenses_${new Date().toISOString().slice(0, 10)}.xlsx`;

        this.downloadWorkbook(wb, fileName);
    }

    static buildCategorySheet(state) {
        const rows = [
            ["Category / Sheet Name", "Total Spent (₹)", "Sajida Share (₹)", "Jeelani Share (₹)", "Share % of Total"]
        ];

        const totalExp = state.data.expenses.reduce((acc, c) => acc + (c.amount || 0), 0) || 1;

        state.data.categories.forEach(cat => {
            const catExpenses = state.data.expenses.filter(e => e.categoryId === cat.id);
            const total = catExpenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
            const sajida = catExpenses.reduce((acc, e) => acc + (parseFloat(e.sajidaAmount) || 0), 0);
            const jeelani = catExpenses.reduce((acc, e) => acc + (parseFloat(e.jeelaniAmount) || 0), 0);
            const pct = ((total / totalExp) * 100).toFixed(1) + '%';

            rows.push([cat.name, total, sajida, jeelani, pct]);
        });

        return rows;
    }

    static buildTenantSheet(state) {
        const rows = [
            ["Tenant Name", "Flat No", "Floor", "Floor Owner", "Phone Number", "Occupation", "Advance Deposit (₹)", "Monthly Rent (₹)", "Status", "Remarks"]
        ];

        state.data.tenants.forEach(t => {
            const floorOwner = (t.floor === 1 || t.floor === 2) ? "Sajida (Floors 1-2)" : "Jeelani (Floors 3-5)";
            rows.push([
                t.name || '',
                t.flat || '',
                t.floor ? `${t.floor} Floor` : '',
                floorOwner,
                t.phone || '',
                t.occupation || '',
                t.advanceDeposit || 0,
                t.monthlyRent || 0,
                t.status === 'vacated' ? 'Vacated' : 'Active Resident',
                t.notes || ''
            ]);
        });

        const totalAdvance = state.data.tenants.reduce((acc, t) => acc + (t.advanceDeposit || 0), 0);
        const totalRent = state.data.tenants.filter(t => t.status !== 'vacated').reduce((acc, t) => acc + (t.monthlyRent || 0), 0);
        rows.push(["TOTALS", "", "", "", "", "", totalAdvance, totalRent, "", ""]);

        return rows;
    }

    static buildRecurringSheet(state) {
        const rows = [
            ["Recurring Expense Title", "Category", "Amount (₹)", "Due Day", "Frequency", "Split Type", "Status", "Notes"]
        ];

        (state.data.recurringExpenses || []).forEach(r => {
            const cat = state.data.categories.find(c => c.id === r.categoryId);
            const catName = cat ? cat.name : (r.categoryId || 'General');

            let split = "60 : 40 Floor Ratio (Jeelani 60% : Sajida 40%)";
            if (r.splitType === 'sajida_only') split = "100% Sajida (Fl 1-2)";
            else if (r.splitType === 'jeelani_only') split = "100% Jeelani (Fl 3-5)";
            else if (r.splitType === 'custom') split = `Custom (${r.sajidaRatio}% : ${r.jeelaniRatio}%)`;

            rows.push([
                r.title || '',
                catName,
                r.amount || 0,
                `Day ${r.dayOfMonth || 1}`,
                r.frequency || 'Monthly',
                split,
                r.active !== false ? 'Active (Automated)' : 'Paused',
                r.notes || ''
            ]);
        });

        const totalRecurring = (state.data.recurringExpenses || [])
            .filter(r => r.active !== false)
            .reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0);
        rows.push(["TOTAL MONTHLY AUTOMATED RECURRING", "", totalRecurring, "", "", "", "", ""]);

        return rows;
    }

    // Export a dedicated standalone Excel workbook for an individual category
    static exportCategorySheet(categoryId, appState) {
        try {
            if (typeof XLSX === 'undefined') {
                if (typeof alert !== 'undefined') alert('Excel export library is loading. Please try again.');
                return false;
            }

            const cat = appState.data.categories.find(c => c.id === categoryId);
            const catName = cat ? cat.name : 'Expenses';
            const cleanName = catName.replace(/[^a-zA-Z0-9]+/g, '_');

            const expenses = (appState.data.expenses || []).filter(e => categoryId === 'all' || e.categoryId === categoryId);
            expenses.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

            const totalAmount = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
            const totalSajida = expenses.reduce((s, e) => s + (parseFloat(e.sajidaAmount) || 0), 0);
            const totalJeelani = expenses.reduce((s, e) => s + (parseFloat(e.jeelaniAmount) || 0), 0);

            const data = [
                ["MEERA HEIGHTS - RESIDENTIAL APARTMENTS", "", "", "", "", "", "", "", "", ""],
                [`EXPENDITURE REGISTER: ${catName.toUpperCase()}`, "", "", "", "", "", "", "", "", ""],
                ["Floor Ownership: Sajida (1st & 2nd Floors - 40%) | Jeelani (3rd, 4th & 5th Floors - 60%)", "", "", "", "", "", "", "", "", ""],
                [`Generated: ${new Date().toLocaleString('en-IN')}`, `Total Entries: ${expenses.length}`, `Total Spent: Rs. ${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, `Sajida (40%): Rs. ${totalSajida.toLocaleString('en-IN')}`, `Jeelani (60%): Rs. ${totalJeelani.toLocaleString('en-IN')}`, "", "", "", "", ""],
                ["", "", "", "", "", "", "", "", "", ""],
                [
                    "#", "Date", "Expense Title / Purpose", "Category", 
                    "Total Amount (Rs.)", "Sajida Share (40%)", "Jeelani Share (60%)", 
                    "Debited Wallet / Source", "Recurring Schedule?", "Notes & Details"
                ]
            ];

            expenses.forEach((e, idx) => {
                const c = appState.data.categories.find(x => x.id === e.categoryId);
                data.push([
                    idx + 1,
                    e.date || '',
                    e.title || 'Expense',
                    c?.name || catName,
                    parseFloat(e.amount) || 0,
                    parseFloat(e.sajidaAmount) || 0,
                    parseFloat(e.jeelaniAmount) || 0,
                    e.debitedWallet || e.debitedSource || 'both',
                    e.isRecurring ? 'Yes (Automated)' : 'One-time',
                    e.notes || ''
                ]);
            });

            data.push([
                "GRAND TOTAL", "", "", "",
                totalAmount, totalSajida, totalJeelani,
                "", "", ""
            ]);

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(data);
            ws['!cols'] = [
                { wch: 6 }, { wch: 14 }, { wch: 34 }, { wch: 22 },
                { wch: 18 }, { wch: 18 }, { wch: 18 },
                { wch: 24 }, { wch: 18 }, { wch: 35 }
            ];

            const sheetTabName = (catName.length > 28 ? catName.slice(0, 28) + '...' : catName);
            XLSX.utils.book_append_sheet(wb, ws, sheetTabName);

            const timestamp = new Date().toISOString().slice(0, 10);
            const fileName = `Meera_Heights_${cleanName}_Expenses_${timestamp}.xlsx`;
            this.downloadWorkbook(wb, fileName);
            return true;
        } catch (err) {
            console.error('Error exporting category sheet:', err);
            if (typeof alert !== 'undefined') alert('Error exporting sheet: ' + err.message);
            return false;
        }
    }

    // Export each category as its own separate Excel file sequentially
    static async exportAllCategoriesSeparately(appState) {
        if (!appState?.data?.categories) return;
        const categories = appState.data.categories;
        let count = 0;

        for (let i = 0; i < categories.length; i++) {
            const cat = categories[i];
            const hasItems = (appState.data.expenses || []).some(e => e.categoryId === cat.id);
            // Export categories that have items, or at least default categories
            if (hasItems || cat.isDefault) {
                this.exportCategorySheet(cat.id, appState);
                count++;
                // Small delay to allow browser download thread to catch up
                await new Promise(res => setTimeout(res, 400));
            }
        }
        return count;
    }

    // CSV Fallback Export
    static exportCSV(appState) {
        try {
            let csv = "\uFEFFMEERA HEIGHTS - BUILDING EXPENDITURE & RENT LEDGER\n";
            csv += `Generated: ${new Date().toLocaleString('en-IN')}\n`;
            csv += "Floor Ownership: Sajida (1st & 2nd Floors) | Jeelani (3rd, 4th & 5th Floors)\n\n";
            csv += "Date,Expense Description,Category,Total Amount,Split Type,Sajida Share,Jeelani Share,Debited Wallet,Notes\n";

            (appState.data.expenses || []).forEach(e => {
                const cat = (appState.data.categories || []).find(c => c.id === e.categoryId);
                const catName = cat ? cat.name : 'General';
                const row = [
                    `"${e.date || ''}"`,
                    `"${(e.title || '').replace(/"/g, '""')}"`,
                    `"${catName}"`,
                    e.amount || 0,
                    `"${e.splitType || 'ratio'}"`,
                    e.sajidaAmount || 0,
                    e.jeelaniAmount || 0,
                    `"${e.debitedWallet || 'both'}"`,
                    `"${(e.notes || '').replace(/"/g, '""')}"`
                ];
                csv += row.join(',') + "\n";
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const fileName = `Meera_Heights_Ledger_${new Date().toISOString().slice(0, 10)}.csv`;
            return this.downloadBlobUniversal(blob, fileName);
        } catch (err) {
            console.error('Error generating CSV:', err);
            alert('Failed to export CSV: ' + err.message);
            return false;
        }
    }

    // Dynamic Period Wallet Excel Workbook Export
    static exportWalletWorkbook(options, appState) {
        try {
            const stats = appState.getStats ? appState.getStats() : {};
            const txs = appState.getWalletTransactionsStream ? appState.getWalletTransactionsStream(options) : [];

            const wb = XLSX.utils.book_new();

            // 1. Sheet 1: Wallets Summary & Balances
            const summaryData = [
                ["MEERA HEIGHTS - 4 CAPITAL WALLETS & TREASURY STATEMENT"],
                [`Generated on: ${new Date().toLocaleString('en-IN')}`],
                [`Scope: ${options.scopeLabel || 'All Wallets'} | Period: ${options.periodLabel || 'All Time'}`],
                ["Co-Owners: Sajida (Floors 1-2 • 40%) | Jeelani (Floors 3-5 • 60%)"],
                [""],
                ["WALLET SUMMARY & BALANCES", "", "", ""],
                ["Wallet Account", "Owner & Floor Coverage", "Liquid Balance (₹)", "Status / Notes"],
                ["Sajida Advance Wallet", "Sajida (Floors 1 & 2)", stats.sajidaAdvanceBalance || 0, `Held Advances: ₹${(stats.sajidaHeldAdvances || 0).toLocaleString('en-IN')}`],
                ["Sajida Rent Wallet", "Sajida (Floors 1 & 2)", stats.sajidaRentBalance || 0, "Rental Collections Vault"],
                ["Jeelani Advance Wallet", "Jeelani (Floors 3, 4 & 5)", stats.jeelaniAdvanceBalance || 0, `Held Advances: ₹${(stats.jeelaniHeldAdvances || 0).toLocaleString('en-IN')}`],
                ["Jeelani Rent Wallet", "Jeelani (Floors 3, 4 & 5)", stats.jeelaniRentBalance || 0, "Rental Collections Vault"],
                ["TOTAL LIQUID TREASURY", "Combined All 4 Wallets", stats.totalLiquidTreasury || 0, "All Funds Available"],
                [""],
                ["LIABILITY & ADVANCE DETAILS", "", "", ""],
                ["Tenant Advances Held (Liabilities)", "Total Deposit Liabilities", stats.totalAdvanceLiabilities || 0, "To be refunded upon tenant checkout"],
                ["Retained Deductions from Advances", "Total Retained Revenue", (stats.sajidaDeductionsRetained || 0) + (stats.jeelaniDeductionsRetained || 0), "Painting, cleaning, utilities, repairs"],
                ["Net Free Capital (After Advance Liabilities)", "Available Capital", stats.netFreeCapital || 0, "Treasury minus Held Deposits"]
            ];

            const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
            wsSummary['!cols'] = [{ wch: 38 }, { wch: 28 }, { wch: 22 }, { wch: 35 }];
            XLSX.utils.book_append_sheet(wb, wsSummary, "Wallet Summary");

            // 2. Sheet 2: Transactions Ledger
            const ledgerData = [
                ["MEERA HEIGHTS - WALLET TRANSACTIONS LEDGER"],
                [`Period: ${options.periodLabel || 'All Time'} | Wallet Scope: ${options.scopeLabel || 'All Wallets'} | Total Records: ${txs.length}`],
                [""],
                ["S.No", "Date", "Description", "Category", "Transaction Type", "Cashflow", "Amount (₹)", "Wallet Account", "Owner / Floors", "Notes & Reference"]
            ];

            let totalInflow = 0;
            let totalOutflow = 0;

            txs.forEach((t, idx) => {
                const amt = parseFloat(t.amount) || 0;
                let cashflow = 'Inflow (+)';
                if (t.type === 'expense' || (t.type === 'capital' && !t.isDeposit) || (t.type === 'advance_settlement' && !t.isDeductOnly) || (t.type === 'bank_transfer' && !t.isCredit)) {
                    cashflow = 'Outflow (-)';
                    totalOutflow += amt;
                } else {
                    totalInflow += amt;
                }

                ledgerData.push([
                    idx + 1,
                    t.date || '',
                    t.title || 'Transaction',
                    t.category || '',
                    t.type || '',
                    cashflow,
                    amt,
                    t.walletId || '',
                    t.ownerDisplay || '',
                    t.notes || t.reference || ''
                ]);
            });

            ledgerData.push([
                "SUMMARY", "", "", "", "",
                `Inflow: ₹${totalInflow.toLocaleString('en-IN')} | Outflow: ₹${totalOutflow.toLocaleString('en-IN')}`,
                totalInflow - totalOutflow,
                `Net Flow: ₹${(totalInflow - totalOutflow).toLocaleString('en-IN')}`,
                "", ""
            ]);

            const wsLedger = XLSX.utils.aoa_to_sheet(ledgerData);
            wsLedger['!cols'] = [
                { wch: 6 }, { wch: 14 }, { wch: 38 }, { wch: 22 },
                { wch: 20 }, { wch: 14 }, { wch: 18 }, { wch: 25 },
                { wch: 25 }, { wch: 35 }
            ];
            XLSX.utils.book_append_sheet(wb, wsLedger, "Transaction Ledger");

            const dateStr = new Date().toISOString().slice(0, 10);
            const fileName = `Meera_Heights_Wallet_Ledger_${options.period || 'all'}_${dateStr}.xlsx`;
            this.downloadWorkbook(wb, fileName);
            return true;
        } catch (err) {
            console.error('Error generating Wallet Excel:', err);
            alert('Failed to export Wallet Excel: ' + err.message);
            return false;
        }
    }

    // Dynamic Period Wallet CSV Export
    static exportWalletCSV(options, appState) {
        try {
            const txs = appState.getWalletTransactionsStream ? appState.getWalletTransactionsStream(options) : [];
            let csv = "\uFEFF"; // UTF-8 BOM for Excel compatibility
            csv += "MEERA HEIGHTS - WALLET TRANSACTIONS STATEMENT\n";
            csv += `Generated: ${new Date().toLocaleString('en-IN')}\n`;
            csv += `Scope: ${options.scopeLabel || 'All Wallets'} | Period: ${options.periodLabel || 'All Time'}\n\n`;
            csv += "S.No,Date,Description,Category,Type,Cashflow,Amount (INR),Wallet Account,Owner / Floors,Notes / Reference\n";

            txs.forEach((t, idx) => {
                const amt = parseFloat(t.amount) || 0;
                let cashflow = 'Inflow (+)';
                if (t.type === 'expense' || (t.type === 'capital' && !t.isDeposit) || (t.type === 'advance_settlement' && !t.isDeductOnly) || (t.type === 'bank_transfer' && !t.isCredit)) {
                    cashflow = 'Outflow (-)';
                }
                const row = [
                    idx + 1,
                    `"${t.date || ''}"`,
                    `"${(t.title || '').replace(/"/g, '""')}"`,
                    `"${(t.category || '').replace(/"/g, '""')}"`,
                    `"${t.type || ''}"`,
                    `"${cashflow}"`,
                    amt,
                    `"${t.walletId || ''}"`,
                    `"${(t.ownerDisplay || '').replace(/"/g, '""')}"`,
                    `"${(t.notes || t.reference || '').replace(/"/g, '""')}"`
                ];
                csv += row.join(',') + "\n";
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const dateStr = new Date().toISOString().slice(0, 10);
            const fileName = `Meera_Heights_Wallet_Ledger_${options.period || 'all'}_${dateStr}.csv`;
            return this.downloadBlobUniversal(blob, fileName);
        } catch (err) {
            console.error('Error generating Wallet CSV:', err);
            alert('Failed to export Wallet CSV: ' + err.message);
            return false;
        }
    }
}

if (typeof window !== 'undefined') {
    window.ExcelExporter = ExcelExporter;
}
