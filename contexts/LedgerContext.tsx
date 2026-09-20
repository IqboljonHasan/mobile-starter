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
import { getJSON, getSetting, setJSON, setSetting } from "@/lib/storage";
import { DEFAULT_UNIT, unitByCode } from "@/lib/money";
import { applyOrder } from "@/lib/reorder";
import { SEED_CATEGORIES } from "@/lib/seed";
import {
	type Category,
	type CategoryDraft,
	type Subcategory,
	type Transaction,
	type TransactionInput,
	type TxType,
	uid,
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
const KEY_UNIT = "default_unit";

type LedgerContextType = {
	/** False until the stored ledger has been read — screens show a spinner. */
	ready: boolean;
	categories: Category[];
	transactions: Transaction[];
	/** Unit a new transaction starts with. */
	defaultUnit: string;
	setDefaultUnit: (unit: string) => void;

	addCategory: (draft: CategoryDraft) => Category;
	updateCategory: (id: string, patch: Partial<CategoryDraft>) => void;
	deleteCategory: (id: string) => void;
	/** Rewrites the order of one side of the ledger. */
	reorderCategories: (type: TxType, orderedIds: string[]) => void;

	addSubcategory: (categoryId: string, draft: Omit<Subcategory, "id">) => Subcategory;
	updateSubcategory: (
		categoryId: string,
		subcategoryId: string,
		patch: Partial<Omit<Subcategory, "id">>,
	) => void;
	deleteSubcategory: (categoryId: string, subcategoryId: string) => void;

	addTransaction: (input: TransactionInput) => Transaction;
	updateTransaction: (id: string, patch: Partial<TransactionInput>) => void;
	deleteTransaction: (id: string) => void;

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
	const [defaultUnit, setDefaultUnitState] = useState(DEFAULT_UNIT);

	useEffect(() => {
		let cancelled = false;

		(async () => {
			const [storedCategories, storedTransactions, storedUnit] = await Promise.all([
				// `null` rather than `[]` as the fallback: it's how a first launch
				// (seed the starter categories) is told apart from a user who has
				// deliberately deleted all of them (leave them deleted).
				getJSON<Category[] | null>(KEY_CATEGORIES, null),
				getJSON<Transaction[]>(KEY_TRANSACTIONS, []),
				getSetting(KEY_UNIT, DEFAULT_UNIT),
			]);
			if (cancelled) return;

			setCategories(storedCategories ?? SEED_CATEGORIES);
			setTransactions(storedTransactions);
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
	const persisted = useRef({ categories, transactions });
	useEffect(() => {
		if (!ready) return;
		if (
			persisted.current.categories === categories &&
			persisted.current.transactions === transactions
		) {
			return;
		}
		persisted.current = { categories, transactions };
		Promise.all([
			setJSON(KEY_CATEGORIES, categories),
			setJSON(KEY_TRANSACTIONS, transactions),
		]).catch((e) => console.warn("[ledger] failed to save", e));
	}, [ready, categories, transactions]);

	const setDefaultUnit = useCallback((unit: string) => {
		setDefaultUnitState(unit);
		setSetting(KEY_UNIT, unit);
	}, []);

	const addCategory = useCallback((draft: CategoryDraft) => {
		const category: Category = { ...draft, id: uid("cat_"), subcategories: [] };
		setCategories((prev) => [...prev, category]);
		return category;
	}, []);

	const updateCategory = useCallback((id: string, patch: Partial<CategoryDraft>) => {
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

	const addTransaction = useCallback((input: TransactionInput) => {
		const transaction: Transaction = {
			...input,
			id: uid("tx_"),
			createdAt: Date.now(),
		};
		setTransactions((prev) => [transaction, ...prev]);
		return transaction;
	}, []);

	const updateTransaction = useCallback(
		(id: string, patch: Partial<TransactionInput>) => {
			setTransactions((prev) =>
				prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
			);
		},
		[],
	);

	const deleteTransaction = useCallback((id: string) => {
		setTransactions((prev) => prev.filter((t) => t.id !== id));
	}, []);

	const resetLedger = useCallback(() => {
		setTransactions([]);
		setCategories(SEED_CATEGORIES);
	}, []);

	// A restore replaces rather than merges: two ledgers hold their own ids, so
	// merging would mean guessing which of two entries on the same day is the
	// same purchase. Replacing is the one interpretation with no wrong answer,
	// and the screen confirms what is about to be lost before calling this.
	const replaceLedger = useCallback(
		(payload: BackupPayload) => {
			setCategories(payload.categories);
			setTransactions(payload.transactions);
			setDefaultUnit(payload.defaultUnit);
		},
		[setDefaultUnit],
	);

	const value = useMemo(
		() => ({
			ready,
			categories,
			transactions,
			defaultUnit,
			setDefaultUnit,
			addCategory,
			updateCategory,
			deleteCategory,
			reorderCategories,
			addSubcategory,
			updateSubcategory,
			deleteSubcategory,
			addTransaction,
			updateTransaction,
			deleteTransaction,
			resetLedger,
			replaceLedger,
		}),
		[
			ready,
			categories,
			transactions,
			defaultUnit,
			setDefaultUnit,
			addCategory,
			updateCategory,
			deleteCategory,
			reorderCategories,
			addSubcategory,
			updateSubcategory,
			deleteSubcategory,
			addTransaction,
			updateTransaction,
			deleteTransaction,
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
