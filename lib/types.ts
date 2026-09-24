import type { Ionicons } from "@expo/vector-icons";
import type { CategoryColor } from "@/lib/categoryColors";

export type IconName = keyof typeof Ionicons.glyphMap;

/** Every category, subcategory and transaction belongs to exactly one side of the ledger. */
export type TxType = "income" | "expense";

export const TX_TYPES: TxType[] = ["income", "expense"];

/** How the money actually moved. See PAY_METHODS in lib/money.ts. */
export type PayMethod = "cash" | "card";

export type Subcategory = {
	id: string;
	name: string;
	/** Palette key, not a hex value — see lib/categoryColors.ts. */
	color: CategoryColor;
};

export type Category = {
	id: string;
	type: TxType;
	name: string;
	color: CategoryColor;
	icon: IconName;
	subcategories: Subcategory[];
	/** Expense side: the wallets this category's spending can be charged to.
	 *  Many-to-many on purpose — Ta'lim can belong to both Shaxsiy rivojlanish
	 *  and Oilaga, say — a single expense still picks exactly one of them.
	 *  Empty or absent means unassigned: those expenses touch no wallet and are
	 *  never blocked. */
	walletIds?: string[];
	/** Income side: whether this category's money is split across the wallets.
	 *  Absent reads as true; debt categories are never split regardless. */
	splitIncome?: boolean;
};

/**
 * A pot of money income is divided into and expenses are paid from — the
 * envelope/jar method. Distinct from `PayMethod`, which is how the money
 * physically moved (cash or bank card); a wallet is what the money is *for*.
 */
export type Wallet = {
	id: string;
	name: string;
	color: CategoryColor;
	icon: IconName;
	/** Share of a split income, 0–100. The set totals at most 100; whatever is
	 *  left over lands in the unallocated pool. */
	percent: number;
};

/** One wallet's share of a single income entry, in that entry's unit. */
export type Allocation = {
	walletId: string;
	amount: number;
};

/** Money moved between two wallets. Neither income nor expense — it changes
 *  where money sits, not how much there is, so it stays out of every total. */
export type Transfer = {
	id: string;
	fromWalletId: string;
	toWalletId: string;
	amount: number;
	unit: string;
	date: string;
	note: string;
	createdAt: number;
};

export type Transaction = {
	id: string;
	type: TxType;
	/** Always positive — the sign lives in `type`, so a mis-signed amount can't exist. */
	amount: number;
	/** Currency code, e.g. "UZS". See lib/money.ts. */
	unit: string;
	/** Cash or card. Entries stored before this existed read as card. */
	method: PayMethod;
	categoryId: string;
	subcategoryId: string | null;
	description: string;
	/** Local calendar day as "YYYY-MM-DD" — never a timestamp, so a
	 *  transaction doesn't slide to the previous day across a timezone. */
	date: string;
	createdAt: number;
	/** Income: how this entry was divided, snapshotted when it was saved, so
	 *  later percentage changes don't rewrite what already happened. Empty for
	 *  expenses and for income that isn't split. */
	allocations: Allocation[];
	/** Expense: the wallet that paid. Null when the category has no wallet
	 *  mapped, or for entries recorded before wallets existed.
	 *
	 *  Debt income is the one exception on the income side: borrowed or
	 *  collected money lands whole in one named wallet rather than being split,
	 *  so it carries a wallet too. See `allocationFor` in lib/wallets.ts. */
	walletId: string | null;
	/** Set when the Debts tab created this entry. Such an entry is owned by its
	 *  debt — it is edited and deleted from there, never on its own, so the two
	 *  can't drift apart. See lib/debts.ts. */
	debtId?: string | null;
};

/**
 * Somebody money is owed to or by. Kept as the app's own record rather than a
 * pointer into the phone's address book: a debt has to stay readable after the
 * contact is deleted from the phone, and the app must work at all for a user
 * who never grants contacts permission.
 */
export type Contact = {
	id: string;
	name: string;
	phone: string;
	note: string;
	/** The address-book id this was imported from, when it was. Re-importing
	 *  the same person then updates this contact instead of adding a twin. */
	sourceId: string | null;
	createdAt: number;
};

/**
 * Which way a debt runs, from the user's side.
 *
 * `borrowed` — qarz olish: the user took the money and owes it back.
 * `lent` — qarz berish: the user gave the money and is owed it back.
 */
export type DebtDirection = "borrowed" | "lent";

export const DEBT_DIRECTIONS: DebtDirection[] = ["borrowed", "lent"];

/**
 * One movement against a debt — a repayment (to'lash) on money borrowed, or a
 * collection (undirish) on money lent. Its unit is always the debt's own: a
 * loan taken in dollars is not settled in som without saying so, which would
 * be a currency conversion this app deliberately never does.
 */
export type DebtPayment = {
	id: string;
	/** Always positive, like a transaction's. */
	amount: number;
	date: string;
	method: PayMethod;
	/** The wallet the money left or landed in. Null means untracked. */
	walletId: string | null;
	note: string;
	/** The ledger entry this payment wrote, so the two stay in step. */
	transactionId: string | null;
	createdAt: number;
};

/**
 * Money owed, with everything paid against it so far.
 *
 * A debt is one record that gets paid down rather than a pile of independent
 * entries, because that is the question actually being asked of it: not "what
 * moved" — the ledger already answers that — but "how much of this particular
 * loan is still outstanding".
 */
export type Debt = {
	id: string;
	direction: DebtDirection;
	contactId: string;
	/** What was originally borrowed or lent. Payments are tracked separately,
	 *  so this never shrinks — `remainingAmount` in lib/debts.ts does the sum. */
	amount: number;
	unit: string;
	method: PayMethod;
	/** Wallet the borrowed money landed in / the lent money came out of. */
	walletId: string | null;
	description: string;
	/** The day it was taken or given. */
	date: string;
	/** When it is meant to be settled. Null when nothing was agreed. */
	dueDate: string | null;
	/** The ledger entry the principal wrote. */
	transactionId: string | null;
	payments: DebtPayment[];
	createdAt: number;
};

/** What the contact editor collects. */
export type ContactDraft = Pick<Contact, "name" | "phone" | "note"> & {
	sourceId?: string | null;
};

/** What the debt form collects — the payments and the ledger link are the
 *  store's business. */
export type DebtInput = Omit<
	Debt,
	"id" | "createdAt" | "payments" | "transactionId"
>;

/** What the payment sheet collects. */
export type DebtPaymentInput = Omit<
	DebtPayment,
	"id" | "createdAt" | "transactionId"
>;

/** What the category editor collects — the id and the subcategory list are the store's business. */
export type CategoryDraft = Pick<Category, "type" | "name" | "color" | "icon">;

/** What can be changed on an existing category — the editor's fields plus the
 *  wallet wiring, which is set from the wallets screen rather than the editor. */
export type CategoryPatch = Partial<
	Pick<Category, "name" | "color" | "icon" | "walletIds" | "splitIncome">
>;

/** What the wallet editor collects. */
export type WalletDraft = Pick<Wallet, "name" | "color" | "icon" | "percent">;

/** The allocation is the store's business: it derives from the wallets and the
 *  category's split setting, so a caller can't put a wrong one in. */
export type TransactionInput = Omit<Transaction, "id" | "createdAt" | "allocations">;

export type TransferInput = Omit<Transfer, "id" | "createdAt">;

/** Collision-safe enough for a single-device store, and readable in a dump. */
export function uid(prefix = ""): string {
	return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
