import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { BackupPayload } from "@/lib/backup";
import { matchContact, paymentInput, principalInput } from "@/lib/debts";
import type { PhoneContact } from "@/lib/phoneContacts";
import { getJSON, getSetting, setJSON, setSetting } from "@/lib/storage";
import { asPayMethod, DEFAULT_UNIT, unitByCode } from "@/lib/money";
import { applyOrder, orderById } from "@/lib/reorder";
import { SEED_CATEGORIES } from "@/lib/seed";
import {
	allocationFor,
	redistribute,
	SEED_CATEGORY_WALLETS,
	SEED_WALLETS,
	UNALLOCATED_ID,
} from "@/lib/wallets";
import {
	type Category,
	type CategoryDraft,
	type CategoryPatch,
	type Contact,
	type ContactDraft,
	type Debt,
	type DebtInput,
	type DebtPayment,
	type DebtPaymentInput,
	type Subcategory,
	type Transaction,
	type TransactionInput,
	type Transfer,
	type TransferInput,
	type TxType,
	uid,
	type Wallet,
	type WalletDraft,
} from "@/lib/types";

/**
 * The app's single source of truth: every category and every transaction, held
 * in memory and mirrored to AsyncStorage.
 *
 * The whole ledger is small enough (a few thousand rows at most) that keeping
 * it in one state object is simpler and faster than querying a database per
 * screen, and it lets every screen derive what it needs with plain array
 * helpers from lib/ledger.ts.
 */

const KEY_CATEGORIES = "categories";
const KEY_TRANSACTIONS = "transactions";
const KEY_WALLETS = "wallets";
const KEY_TRANSFERS = "transfers";
const KEY_CONTACTS = "contacts";
const KEY_DEBTS = "debts";
const KEY_UNIT = "default_unit";

type LedgerContextType = {
	/** False until the stored ledger has been read — screens show a spinner. */
	ready: boolean;
	categories: Category[];
	transactions: Transaction[];
	wallets: Wallet[];
	transfers: Transfer[];
	contacts: Contact[];
	debts: Debt[];
	/** Unit a new transaction starts with. */
	defaultUnit: string;
	setDefaultUnit: (unit: string) => void;

	addCategory: (draft: CategoryDraft) => Category;
	updateCategory: (id: string, patch: CategoryPatch) => void;
	deleteCategory: (id: string) => void;
	/** Rewrites the order of one side of the ledger. */
	reorderCategories: (type: TxType, orderedIds: string[]) => void;

	addSubcategory: (categoryId: string, draft: Omit<Subcategory, "id">) => Subcategory;
	/** Rewrites the order of one category's subcategories. */
	reorderSubcategories: (categoryId: string, orderedIds: string[]) => void;
	updateSubcategory: (
		categoryId: string,
		subcategoryId: string,
		patch: Partial<Omit<Subcategory, "id">>,
	) => void;
	deleteSubcategory: (categoryId: string, subcategoryId: string) => void;

	addTransaction: (input: TransactionInput) => Transaction;
	updateTransaction: (id: string, patch: Partial<TransactionInput>) => void;
	deleteTransaction: (id: string) => void;

	addWallet: (draft: WalletDraft) => Wallet;
	updateWallet: (id: string, patch: Partial<WalletDraft>) => void;
	deleteWallet: (id: string) => void;

	addTransfer: (input: TransferInput) => Transfer;
	deleteTransfer: (id: string) => void;

	addContact: (draft: ContactDraft) => Contact;
	updateContact: (id: string, patch: Partial<ContactDraft>) => void;
	deleteContact: (id: string) => void;
	/** Folds an address-book selection in, updating the people already here
	 *  rather than adding a second copy of them. */
	importContacts: (imported: PhoneContact[]) => { added: number; updated: number };

	/** Records a debt and the ledger entry its principal moved. */
	addDebt: (input: DebtInput) => Debt;
	updateDebt: (id: string, patch: Partial<DebtInput>) => void;
	/** Removes the debt together with every entry it wrote. */
	deleteDebt: (id: string) => void;
	/** A repayment (to'lash) or a collection (undirish) against one debt. */
	addDebtPayment: (debtId: string, input: DebtPaymentInput) => void;
	updateDebtPayment: (
		debtId: string,
		paymentId: string,
		patch: Partial<DebtPaymentInput>,
	) => void;
	deleteDebtPayment: (debtId: string, paymentId: string) => void;

	/** Re-runs the current percentages and category mappings over the whole
	 *  history — the one way to change what past entries were divided into. */
	redistributeHistory: () => void;

	/** Wipes every transaction and restores the starter categories. */
	resetLedger: () => void;

	/** Swaps the whole ledger for a restored backup. Nothing is merged. */
	replaceLedger: (payload: BackupPayload) => void;
};

const LedgerContext = createContext<LedgerContextType | null>(null);

export function LedgerProvider({ children }: { children: ReactNode }) {
	const [ready, setReady] = useState(false);
	const [categories, setCategories] = useState<Category[]>([]);
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [wallets, setWallets] = useState<Wallet[]>([]);
	const [transfers, setTransfers] = useState<Transfer[]>([]);
	const [contacts, setContacts] = useState<Contact[]>([]);
	const [debts, setDebts] = useState<Debt[]>([]);
	const [defaultUnit, setDefaultUnitState] = useState(DEFAULT_UNIT);

	useEffect(() => {
		let cancelled = false;

		(async () => {
			const [
				storedCategories,
				storedTransactions,
				storedWallets,
				storedTransfers,
				storedContacts,
				storedDebts,
				storedUnit,
			] = await Promise.all([
				// `null` rather than `[]` as the fallback: it's how a first launch
				// (seed the starter categories) is told apart from a user who has
				// deliberately deleted all of them (leave them deleted).
				getJSON<Category[] | null>(KEY_CATEGORIES, null),
				getJSON<Transaction[]>(KEY_TRANSACTIONS, []),
				getJSON<Wallet[] | null>(KEY_WALLETS, null),
				getJSON<Transfer[]>(KEY_TRANSFERS, []),
				getJSON<Contact[]>(KEY_CONTACTS, []),
				getJSON<Debt[]>(KEY_DEBTS, []),
				getSetting(KEY_UNIT, DEFAULT_UNIT),
			]);
			if (cancelled) return;

			// A ledger stored before wallets existed has none, and its categories
			// carry no mapping — both are filled in here so the method works on the
			// history that's already there rather than only on what comes next.
			const firstRun = storedWallets === null;
			const nextWallets = storedWallets ?? SEED_WALLETS;
			const nextCategories = (storedCategories ?? SEED_CATEGORIES).map((c) =>
				firstRun && c.type === "expense" && c.walletIds === undefined
					? { ...c, walletIds: SEED_CATEGORY_WALLETS[c.id] ?? [] }
					: c,
			);

			// Entries written before payment method existed carry none. Filling it
			// in here, once, keeps every screen below free of the empty case.
			const normalized = storedTransactions.map((t) => ({
				...t,
				method: asPayMethod(t.method),
				allocations: Array.isArray(t.allocations) ? t.allocations : [],
				walletId: t.walletId ?? null,
			}));

			setCategories(nextCategories);
			setWallets(nextWallets);
			setTransfers(storedTransfers);
			setContacts(storedContacts);
			// A debt stored before a field existed would break the arithmetic that
			// reads it, so the list is normalised once here rather than guarded at
			// every call site.
			setDebts(
				storedDebts.map((d) => ({
					...d,
					payments: Array.isArray(d.payments) ? d.payments : [],
					dueDate: d.dueDate ?? null,
					walletId: d.walletId ?? null,
					transactionId: d.transactionId ?? null,
				})),
			);
			setTransactions(
				firstRun
					? redistribute(normalized, nextCategories, nextWallets)
					: normalized,
			);
			setDefaultUnitState(unitByCode(storedUnit).code);
			setReady(true);
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	// One writer for the whole ledger, rather than a save call inside every
	// mutator — a mutator that forgot one would lose data silently. Skipped
	// until `ready`, so the initial empty state can't overwrite what's stored.
	const persisted = useRef({
		categories,
		transactions,
		wallets,
		transfers,
		contacts,
		debts,
	});
	useEffect(() => {
		if (!ready) return;
		if (
			persisted.current.categories === categories &&
			persisted.current.transactions === transactions &&
			persisted.current.wallets === wallets &&
			persisted.current.transfers === transfers &&
			persisted.current.contacts === contacts &&
			persisted.current.debts === debts
		) {
			return;
		}
		persisted.current = {
			categories,
			transactions,
			wallets,
			transfers,
			contacts,
			debts,
		};
		Promise.all([
			setJSON(KEY_CATEGORIES, categories),
			setJSON(KEY_TRANSACTIONS, transactions),
			setJSON(KEY_WALLETS, wallets),
			setJSON(KEY_TRANSFERS, transfers),
			setJSON(KEY_CONTACTS, contacts),
			setJSON(KEY_DEBTS, debts),
		]).catch((e) => console.warn("[ledger] failed to save", e));
	}, [ready, categories, transactions, wallets, transfers, contacts, debts]);

	const setDefaultUnit = useCallback((unit: string) => {
		setDefaultUnitState(unit);
		setSetting(KEY_UNIT, unit);
	}, []);

	const addCategory = useCallback((draft: CategoryDraft) => {
		const category: Category = { ...draft, id: uid("cat_"), subcategories: [] };
		setCategories((prev) => [...prev, category]);
		return category;
	}, []);

	const updateCategory = useCallback((id: string, patch: CategoryPatch) => {
		setCategories((prev) =>
			prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
		);
	}, []);

	// Order is the array's own, so it rides along with the ledger's single
	// writer and needs no separate stored index.
	const reorderCategories = useCallback((type: TxType, orderedIds: string[]) => {
		setCategories((prev) => applyOrder(prev, type, orderedIds));
	}, []);

	// Transactions filed under a deleted category are kept, not cascaded — a
	// record of money that moved shouldn't vanish because its label was tidied
	// up. They read as "Uncategorized" until they're re-filed.
	const deleteCategory = useCallback((id: string) => {
		setCategories((prev) => prev.filter((c) => c.id !== id));
	}, []);

	const addSubcategory = useCallback(
		(categoryId: string, draft: Omit<Subcategory, "id">) => {
			const subcategory: Subcategory = { ...draft, id: uid("sub_") };
			setCategories((prev) =>
				prev.map((c) =>
					c.id === categoryId
						? { ...c, subcategories: [...c.subcategories, subcategory] }
						: c,
				),
			);
			return subcategory;
		},
		[],
	);

	const reorderSubcategories = useCallback(
		(categoryId: string, orderedIds: string[]) => {
			setCategories((prev) =>
				prev.map((c) =>
					c.id === categoryId
						? { ...c, subcategories: orderById(c.subcategories, orderedIds) }
						: c,
				),
			);
		},
		[],
	);

	const updateSubcategory = useCallback(
		(
			categoryId: string,
			subcategoryId: string,
			patch: Partial<Omit<Subcategory, "id">>,
		) => {
			setCategories((prev) =>
				prev.map((c) =>
					c.id === categoryId
						? {
								...c,
								subcategories: c.subcategories.map((s) =>
									s.id === subcategoryId ? { ...s, ...patch } : s,
								),
							}
						: c,
				),
			);
		},
		[],
	);

	const deleteSubcategory = useCallback(
		(categoryId: string, subcategoryId: string) => {
			setCategories((prev) =>
				prev.map((c) =>
					c.id === categoryId
						? {
								...c,
								subcategories: c.subcategories.filter((s) => s.id !== subcategoryId),
							}
						: c,
				),
			);
			// The parent category still applies, so those transactions only lose
			// the finer label.
			setTransactions((prev) =>
				prev.map((t) =>
					t.subcategoryId === subcategoryId ? { ...t, subcategoryId: null } : t,
				),
			);
		},
		[],
	);

	// The split is derived here rather than at the call site so there is exactly
	// one place it can be got wrong, and it is snapshotted onto the entry: what
	// an income was divided into is a fact about the day it arrived, not
	// something later percentage changes should quietly rewrite.
	const buildTransaction = useCallback(
		(input: TransactionInput): Transaction => ({
			...input,
			allocations: allocationFor(input, categories, wallets),
			id: uid("tx_"),
			createdAt: Date.now(),
		}),
		[categories, wallets],
	);

	const addTransaction = useCallback(
		(input: TransactionInput) => {
			const transaction = buildTransaction(input);
			setTransactions((prev) => [transaction, ...prev]);
			return transaction;
		},
		[buildTransaction],
	);

	const updateTransaction = useCallback(
		(id: string, patch: Partial<TransactionInput>) => {
			setTransactions((prev) =>
				prev.map((t) => {
					if (t.id !== id) return t;
					const next = { ...t, ...patch };
					// Amount, unit, category or side may all have moved, and any of
					// them changes what the entry should be divided into.
					return {
						...next,
						allocations: allocationFor(next, categories, wallets),
					};
				}),
			);
		},
		[categories, wallets],
	);

	const deleteTransaction = useCallback((id: string) => {
		setTransactions((prev) => prev.filter((t) => t.id !== id));
	}, []);

	const addWallet = useCallback((draft: WalletDraft) => {
		const wallet: Wallet = { ...draft, id: uid("wal_") };
		setWallets((prev) => [...prev, wallet]);
		return wallet;
	}, []);

	const updateWallet = useCallback((id: string, patch: Partial<WalletDraft>) => {
		setWallets((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
	}, []);

	// What a deleted wallet held still happened, so its share of past income is
	// left on those entries rather than erased — it simply shows up under the
	// unallocated pool from here on. Categories pointing at it drop it from
	// their mapped set, which means a category left with none stops having its
	// expenses checked against a balance instead of being checked against a
	// wallet that no longer exists.
	const deleteWallet = useCallback((id: string) => {
		setWallets((prev) => prev.filter((w) => w.id !== id));
		setCategories((prev) =>
			prev.map((c) =>
				c.walletIds?.includes(id)
					? { ...c, walletIds: c.walletIds.filter((w) => w !== id) }
					: c,
			),
		);
		setTransactions((prev) =>
			prev.map((t) => {
				if (t.walletId === id) return { ...t, walletId: null };
				if (!t.allocations.some((a) => a.walletId === id)) return t;
				return {
					...t,
					allocations: t.allocations.map((a) =>
						a.walletId === id ? { ...a, walletId: UNALLOCATED_ID } : a,
					),
				};
			}),
		);
		setTransfers((prev) =>
			prev.filter((t) => t.fromWalletId !== id && t.toWalletId !== id),
		);
		// A debt outlives the jar it was paid into: what is still owed doesn't
		// change because the envelope was reorganised, so the record stays and
		// only loses its wallet.
		setDebts((prev) =>
			prev.map((debt) => {
				const touched =
					debt.walletId === id || debt.payments.some((p) => p.walletId === id);
				if (!touched) return debt;
				return {
					...debt,
					walletId: debt.walletId === id ? null : debt.walletId,
					payments: debt.payments.map((p) =>
						p.walletId === id ? { ...p, walletId: null } : p,
					),
				};
			}),
		);
	}, []);

	const addTransfer = useCallback((input: TransferInput) => {
		const transfer: Transfer = { ...input, id: uid("trf_"), createdAt: Date.now() };
		setTransfers((prev) => [transfer, ...prev]);
		return transfer;
	}, []);

	const deleteTransfer = useCallback((id: string) => {
		setTransfers((prev) => prev.filter((t) => t.id !== id));
	}, []);

	/* Contacts --------------------------------------------------------- */

	const addContact = useCallback((draft: ContactDraft) => {
		const contact: Contact = {
			name: draft.name,
			phone: draft.phone,
			note: draft.note,
			sourceId: draft.sourceId ?? null,
			id: uid("con_"),
			createdAt: Date.now(),
		};
		setContacts((prev) => [...prev, contact]);
		return contact;
	}, []);

	const updateContact = useCallback((id: string, patch: Partial<ContactDraft>) => {
		setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
	}, []);

	// Debts filed against a deleted contact are kept, exactly as transactions
	// under a deleted category are: what was owed still happened. They read as
	// "Noma'lum" until they're pointed at somebody again, and the screen says
	// how many that will be before it calls this.
	const deleteContact = useCallback((id: string) => {
		setContacts((prev) => prev.filter((c) => c.id !== id));
	}, []);

	/**
	 * Folds an address-book selection in.
	 *
	 * Importing twice is the normal case, not the exception — a user adds a few
	 * people, then comes back for more — so a person already here is refreshed
	 * rather than duplicated. `matchContact` recognises them by the address-book
	 * id they were imported with, falling back to the phone number for someone
	 * who was first typed in by hand.
	 */
	const importContacts = useCallback((imported: PhoneContact[]) => {
		let added = 0;
		let updated = 0;

		setContacts((prev) => {
			const next = [...prev];
			for (const candidate of imported) {
				const existing = matchContact(next, candidate);
				if (existing) {
					const index = next.indexOf(existing);
					next[index] = {
						...existing,
						// The name the user gave someone here is theirs to keep; only an
						// empty one is filled in from the phone.
						name: existing.name.trim() || candidate.name,
						phone: existing.phone.trim() || candidate.phone,
						sourceId: existing.sourceId ?? candidate.sourceId,
					};
					updated += 1;
				} else {
					next.push({
						id: uid("con_"),
						name: candidate.name,
						phone: candidate.phone,
						note: "",
						sourceId: candidate.sourceId,
						createdAt: Date.now(),
					});
					added += 1;
				}
			}
			return next;
		});

		return { added, updated };
	}, []);

	/* Debts ------------------------------------------------------------ */

	const nameOfContact = useCallback(
		(contactId: string) =>
			contacts.find((c) => c.id === contactId)?.name ?? "",
		[contacts],
	);

	/**
	 * A debt and the entry its principal moved are written together.
	 *
	 * The transaction is built here rather than through `addTransaction` so its
	 * id is known before the debt is stored: the two point at each other, and a
	 * debt that couldn't name its entry would have no way to keep it in step
	 * when the amount is later corrected.
	 */
	const addDebt = useCallback(
		(input: DebtInput) => {
			const id = uid("debt_");
			const transaction = buildTransaction(
				principalInput({ ...input, id }, nameOfContact(input.contactId)),
			);
			const debt: Debt = {
				...input,
				id,
				transactionId: transaction.id,
				payments: [],
				createdAt: Date.now(),
			};
			setTransactions((prev) => [transaction, ...prev]);
			setDebts((prev) => [debt, ...prev]);
			return debt;
		},
		[buildTransaction, nameOfContact],
	);

	// Everything the principal's entry shows is derived from the debt, so the
	// entry is rewritten wholesale rather than patched field by field — there is
	// no version of "edited the debt but the ledger still says the old amount"
	// that is correct.
	const updateDebt = useCallback(
		(id: string, patch: Partial<DebtInput>) => {
			const debt = debts.find((d) => d.id === id);
			if (!debt) return;

			const next = { ...debt, ...patch };
			const rebuilt = principalInput(next, nameOfContact(next.contactId));

			setDebts((prev) => prev.map((d) => (d.id === id ? next : d)));
			setTransactions((prev) =>
				prev.map((t) => {
					if (t.id !== next.transactionId) return t;
					const merged = { ...t, ...rebuilt };
					return {
						...merged,
						allocations: allocationFor(merged, categories, wallets),
					};
				}),
			);
		},
		[debts, categories, wallets, nameOfContact],
	);

	// The entries go with it: they were never independent records of money the
	// user entered, only the ledger's side of this debt.
	const deleteDebt = useCallback((id: string) => {
		setDebts((prev) => prev.filter((d) => d.id !== id));
		setTransactions((prev) => prev.filter((t) => t.debtId !== id));
	}, []);

	const addDebtPayment = useCallback(
		(debtId: string, input: DebtPaymentInput) => {
			const debt = debts.find((d) => d.id === debtId);
			if (!debt) return;

			const transaction = buildTransaction(
				paymentInput(debt, input, nameOfContact(debt.contactId)),
			);
			const payment: DebtPayment = {
				...input,
				id: uid("pay_"),
				transactionId: transaction.id,
				createdAt: Date.now(),
			};

			setTransactions((prev) => [transaction, ...prev]);
			setDebts((prev) =>
				prev.map((d) =>
					d.id === debtId ? { ...d, payments: [...d.payments, payment] } : d,
				),
			);
		},
		[debts, buildTransaction, nameOfContact],
	);

	// Same reasoning as `updateDebt`: everything the payment's own entry shows
	// is derived from the payment, so the entry is rewritten wholesale rather
	// than patched field by field.
	const updateDebtPayment = useCallback(
		(debtId: string, paymentId: string, patch: Partial<DebtPaymentInput>) => {
			const debt = debts.find((d) => d.id === debtId);
			const payment = debt?.payments.find((p) => p.id === paymentId);
			if (!debt || !payment) return;

			const next: DebtPayment = { ...payment, ...patch };
			const rebuilt = paymentInput(debt, next, nameOfContact(debt.contactId));

			setDebts((prev) =>
				prev.map((d) =>
					d.id === debtId
						? {
								...d,
								payments: d.payments.map((p) => (p.id === paymentId ? next : p)),
							}
						: d,
				),
			);
			setTransactions((prev) =>
				prev.map((t) => {
					if (t.id !== next.transactionId) return t;
					const merged = { ...t, ...rebuilt };
					return {
						...merged,
						allocations: allocationFor(merged, categories, wallets),
					};
				}),
			);
		},
		[debts, categories, wallets, nameOfContact],
	);

	const deleteDebtPayment = useCallback(
		(debtId: string, paymentId: string) => {
			const debt = debts.find((d) => d.id === debtId);
			const payment = debt?.payments.find((p) => p.id === paymentId);
			if (!debt || !payment) return;

			setDebts((prev) =>
				prev.map((d) =>
					d.id === debtId
						? { ...d, payments: d.payments.filter((p) => p.id !== paymentId) }
						: d,
				),
			);
			if (payment.transactionId) {
				setTransactions((prev) =>
					prev.filter((t) => t.id !== payment.transactionId),
				);
			}
		},
		[debts],
	);

	const redistributeHistory = useCallback(() => {
		setTransactions((prev) => redistribute(prev, categories, wallets));
	}, [categories, wallets]);

	const resetLedger = useCallback(() => {
		setTransactions([]);
		setTransfers([]);
		setContacts([]);
		setDebts([]);
		setWallets(SEED_WALLETS);
		setCategories(
			SEED_CATEGORIES.map((c) =>
				c.type === "expense"
					? { ...c, walletIds: SEED_CATEGORY_WALLETS[c.id] ?? [] }
					: c,
			),
		);
	}, []);

	// A restore replaces rather than merges: two ledgers hold their own ids, so
	// merging would mean guessing which of two entries on the same day is the
	// same purchase. Replacing is the one interpretation with no wrong answer,
	// and the screen confirms what is about to be lost before calling this.
	const replaceLedger = useCallback(
		(payload: BackupPayload) => {
			setCategories(payload.categories);
			setTransactions(payload.transactions);
			setWallets(payload.wallets);
			setTransfers(payload.transfers);
			setContacts(payload.contacts);
			setDebts(payload.debts);
			setDefaultUnit(payload.defaultUnit);
		},
		[setDefaultUnit],
	);

	const value = useMemo(
		() => ({
			ready,
			categories,
			transactions,
			wallets,
			transfers,
			contacts,
			debts,
			defaultUnit,
			setDefaultUnit,
			addCategory,
			updateCategory,
			deleteCategory,
			reorderCategories,
			addSubcategory,
			reorderSubcategories,
			updateSubcategory,
			deleteSubcategory,
			addTransaction,
			updateTransaction,
			deleteTransaction,
			addWallet,
			updateWallet,
			deleteWallet,
			addTransfer,
			deleteTransfer,
			addContact,
			updateContact,
			deleteContact,
			importContacts,
			addDebt,
			updateDebt,
			deleteDebt,
			addDebtPayment,
			updateDebtPayment,
			deleteDebtPayment,
			redistributeHistory,
			resetLedger,
			replaceLedger,
		}),
		[
			ready,
			categories,
			transactions,
			wallets,
			transfers,
			contacts,
			debts,
			defaultUnit,
			setDefaultUnit,
			addCategory,
			updateCategory,
			deleteCategory,
			reorderCategories,
			addSubcategory,
			reorderSubcategories,
			updateSubcategory,
			deleteSubcategory,
			addTransaction,
			updateTransaction,
			deleteTransaction,
			addWallet,
			updateWallet,
			deleteWallet,
			addTransfer,
			deleteTransfer,
			addContact,
			updateContact,
			deleteContact,
			importContacts,
			addDebt,
			updateDebt,
			deleteDebt,
			addDebtPayment,
			updateDebtPayment,
			deleteDebtPayment,
			redistributeHistory,
			resetLedger,
			replaceLedger,
		],
	);

	return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger() {
	const ctx = useContext(LedgerContext);
	if (!ctx) throw new Error("useLedger must be used inside <LedgerProvider>");
	return ctx;
}
