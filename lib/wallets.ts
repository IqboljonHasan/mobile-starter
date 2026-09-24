import { unitByCode } from "@/lib/money";
import { DEBT_CATEGORY_IDS } from "@/lib/seed";
import type {
	Allocation,
	Category,
	IconName,
	Transaction,
	Transfer,
	Wallet,
} from "@/lib/types";

/**
 * The envelope (jar) method: every income is divided across wallets by a fixed
 * set of percentages, and every expense is paid out of one of them. What a
 * wallet holds is therefore not a separate ledger — it's derived from the same
 * transactions every other screen reads, plus the transfers between wallets.
 *
 * Two rules keep the arithmetic honest:
 *
 * - A split always adds back up to the amount it divided. Shares are computed
 *   in whole minor units (tiyin, cents) and the rounding remainder is handed
 *   out by largest fractional part, so money is never created or lost to a
 *   rounding step.
 * - Units are never mixed, exactly as in lib/ledger.ts. A wallet holds a
 *   separate balance per unit, and a balance is only ever asked for one unit at
 *   a time.
 */

/**
 * Where the share of an income that no wallet claims ends up: the part left
 * over when the percentages total under 100, and everything from a category
 * whose splitting is switched off. It is a real balance that can be spent from
 * and transferred out of — just not one the user can rename or delete.
 */
export const UNALLOCATED_ID = "__unallocated__";

export const UNALLOCATED_NAME = "Taqsimlanmagan";

/**
 * The starter set. The five jars and their shares are the ones most people
 * arrive with; every one of them is editable, and the percentages are the first
 * thing the wallets screen offers to change.
 */
export const SEED_WALLETS: Wallet[] = [
	{
		id: "wal_family",
		name: "Oilaga",
		color: "orange",
		icon: "home-outline",
		percent: 35,
	},
	{
		id: "wal_business",
		name: "Biznes",
		color: "blue",
		icon: "briefcase-outline",
		percent: 35,
	},
	{
		id: "wal_parents",
		name: "Ota-onamga",
		color: "magenta",
		icon: "people-outline",
		percent: 10,
	},
	{
		id: "wal_charity",
		name: "Xayriya",
		color: "green",
		icon: "heart-outline",
		percent: 10,
	},
	{
		id: "wal_growth",
		name: "Shaxsiy rivojlanish",
		color: "violet",
		icon: "school-outline",
		percent: 10,
	},
];

/**
 * Which wallet(s) each starter expense category spends from, so the method
 * works on first launch instead of after a mapping session. Anything not
 * listed stays unassigned, which means it touches no wallet and is never
 * blocked. A category can list more than one — Ta'lim genuinely belongs to
 * both self-development and family spending — a single expense still picks
 * just one of them at save time.
 */
export const SEED_CATEGORY_WALLETS: Record<string, string[]> = {
	cat_food: ["wal_family"],
	cat_transport: ["wal_family"],
	cat_home: ["wal_family"],
	cat_utilities: ["wal_family"],
	cat_shopping: ["wal_family"],
	cat_health: ["wal_family"],
	cat_kids: ["wal_family"],
	cat_education: ["wal_growth", "wal_family"],
	cat_sport: ["wal_growth"],
	cat_fun: ["wal_family"],
	cat_travel: ["wal_family"],
	cat_giving: ["wal_charity"],
	cat_other_expense: ["wal_family"],
};

export function walletById(wallets: Wallet[], id: string | null): Wallet | null {
	if (!id) return null;
	return wallets.find((w) => w.id === id) ?? null;
}

/** Display name for any wallet id, including the unallocated pool. */
export function walletName(wallets: Wallet[], id: string | null): string {
	if (id === UNALLOCATED_ID) return UNALLOCATED_NAME;
	return walletById(wallets, id)?.name ?? "Noma'lum hamyon";
}

/** Palette key for any wallet id — the pool reads as a neutral blue. */
export function walletColor(wallets: Wallet[], id: string | null): string {
	if (id === UNALLOCATED_ID) return "blue";
	return walletById(wallets, id)?.color ?? "blue";
}

/** How much of an income the wallets claim between them. At most 100. */
export function totalPercent(wallets: Wallet[]): number {
	return wallets.reduce((acc, w) => acc + w.percent, 0);
}

/** The share of every split income that no wallet claims. */
export function unallocatedPercent(wallets: Wallet[]): number {
	return Math.max(0, 100 - totalPercent(wallets));
}

/**
 * Whether an income filed under this category is divided across the wallets.
 *
 * Debt categories never are: borrowed money and money collected on a loan
 * aren't earnings, which is the same reason they sit out of the stats.
 */
export function splitsIncome(category: Category | null): boolean {
	if (!category || category.type !== "income") return false;
	if (DEBT_CATEGORY_IDS.has(category.id)) return false;
	return category.splitIncome !== false;
}

/**
 * Divides an amount across the wallets, with whatever the percentages don't
 * claim going to the unallocated pool.
 *
 * Works in whole minor units so the shares add back up to the original exactly:
 * every share is floored, then the units lost to flooring are handed out one
 * each to the largest fractional parts (the largest-remainder method). Splitting
 * 100 000 three ways therefore yields 33 334 / 33 333 / 33 333, never 33 333 × 3
 * with a unit missing.
 */
export function splitAmount(
	amount: number,
	unitCode: string,
	wallets: Wallet[],
): Allocation[] {
	if (!Number.isFinite(amount) || amount <= 0) return [];

	const factor = 10 ** unitByCode(unitCode).decimals;
	const totalMinor = Math.round(amount * factor);
	if (totalMinor <= 0) return [];

	const shares = [
		...wallets
			.filter((w) => w.percent > 0)
			.map((w) => ({ walletId: w.id, percent: w.percent })),
		{ walletId: UNALLOCATED_ID, percent: unallocatedPercent(wallets) },
	].filter((s) => s.percent > 0);

	// No wallet claims anything — the whole entry is unallocated rather than
	// silently dropped, so the balances still account for every som.
	if (shares.length === 0) {
		return [{ walletId: UNALLOCATED_ID, amount: totalMinor / factor }];
	}

	const parts = shares.map((share) => {
		const exact = (totalMinor * share.percent) / 100;
		const floor = Math.floor(exact);
		return { walletId: share.walletId, minor: floor, remainder: exact - floor };
	});

	let leftover = totalMinor - parts.reduce((acc, p) => acc + p.minor, 0);
	// Largest fractional part first; a tie goes to the earlier wallet, which
	// keeps the same input producing the same split every time.
	const byRemainder = [...parts].sort((a, b) => b.remainder - a.remainder);
	for (let i = 0; leftover > 0; i = (i + 1) % byRemainder.length) {
		byRemainder[i].minor += 1;
		leftover -= 1;
	}

	return parts
		.filter((p) => p.minor > 0)
		.map((p) => ({ walletId: p.walletId, amount: p.minor / factor }));
}

/**
 * The allocation an income entry should carry, given the category it's filed
 * under. Expenses and non-split income get none.
 *
 * Debt income is the one income that names a single wallet instead of being
 * divided: money borrowed, or collected on a loan, goes into the one jar that
 * actually received it. It would be wrong to split it — it isn't earnings to
 * apportion — but wrong too to leave it allocated to nothing, because paying
 * that same debt back *does* come out of a jar. An unallocated borrowing plus
 * a charged repayment would leave the balance lower than before the money was
 * ever borrowed.
 */
export function allocationFor(
	transaction: {
		type: string;
		amount: number;
		unit: string;
		categoryId: string;
		walletId?: string | null;
	},
	categories: Category[],
	wallets: Wallet[],
): Allocation[] {
	if (transaction.type !== "income") return [];
	if (DEBT_CATEGORY_IDS.has(transaction.categoryId)) {
		if (!transaction.walletId) return [];
		if (!Number.isFinite(transaction.amount) || transaction.amount <= 0) return [];
		return [{ walletId: transaction.walletId, amount: transaction.amount }];
	}
	const category = categories.find((c) => c.id === transaction.categoryId) ?? null;
	if (!splitsIncome(category)) return [];
	return splitAmount(transaction.amount, transaction.unit, wallets);
}

/**
 * Which wallet an expense should be charged to, given its category's mapped
 * set and the wallet it's currently charged to (if any).
 *
 * A category mapped to exactly one wallet resolves unambiguously — that
 * wallet, always. A category mapped to several can't be resolved the same
 * way: there is no rule to say Ta'lim's spending is "really" self-development
 * rather than family, so a transaction's own existing pick is kept as long as
 * it's still one of the category's wallets, and otherwise left unassigned
 * rather than guessed at.
 */
function resolveExpenseWallet(
	current: string | null,
	walletIds: string[] | undefined,
): string | null {
	const options = walletIds ?? [];
	if (options.length === 0) return null;
	if (options.length === 1) return options[0];
	return current && options.includes(current) ? current : null;
}

/**
 * Re-derives the wallet wiring of the whole history from the current
 * percentages and category mappings: income is re-split, and every expense is
 * charged to whatever its category now points at — see
 * `resolveExpenseWallet` for how a category mapped to several wallets is
 * handled.
 *
 * This is deliberately a full re-apply rather than a fill-in-the-blanks pass.
 * A single-wallet category's mapping always wins over whatever a transaction
 * held before, which is the honest reading of "apply today's rules to the
 * past" — the screen that offers it says so before running it. Its other use
 * is the one-time backfill when wallets first appear on a ledger that already
 * had entries, where there is nothing to overwrite.
 */
export function redistribute(
	transactions: Transaction[],
	categories: Category[],
	wallets: Wallet[],
): Transaction[] {
	const byId = new Map(categories.map((c) => [c.id, c]));
	return transactions.map((t) =>
		t.type === "income"
			? {
					...t,
					allocations: allocationFor(t, categories, wallets),
					// Debt income keeps the wallet it named — that is not a mapping
					// derived from the category, it's the jar the money went into,
					// and re-applying today's rules must not forget it.
					walletId: DEBT_CATEGORY_IDS.has(t.categoryId) ? t.walletId : null,
				}
			: {
					...t,
					allocations: [],
					// A debt expense — repaying or lending — names its wallet the same
					// way debt income does: the user said which jar the money left,
					// and no category mapping can second-guess that. The debt
					// categories ship unmapped, so resolving them the ordinary way
					// would clear the wallet and quietly leave every jar that has ever
					// repaid a debt reading higher than it holds.
					walletId: DEBT_CATEGORY_IDS.has(t.categoryId)
						? t.walletId
						: resolveExpenseWallet(t.walletId, byId.get(t.categoryId)?.walletIds),
				},
	);
}

export type WalletBalance = {
	walletId: string;
	name: string;
	color: string;
	/** Null for the unallocated pool, which has no icon of its own. */
	icon: IconName | null;
	/** Everything this wallet has ever received, in the requested unit. */
	incoming: number;
	/** Everything ever spent from it, in the requested unit. */
	outgoing: number;
	balance: number;
};

/**
 * What every wallet holds in one unit, newest state of the whole ledger.
 *
 * Balances carry forward rather than resetting with the month: an envelope
 * whose leftover vanished every month would punish exactly the restraint the
 * method is meant to build.
 *
 * `excludeTransactionId` leaves one entry out — the transaction form uses it so
 * that editing an expense checks against the balance *without* the version
 * being replaced, instead of against its own older self.
 */
export function walletBalances(
	transactions: Transaction[],
	transfers: Transfer[],
	wallets: Wallet[],
	unit: string,
	excludeTransactionId?: string,
): WalletBalance[] {
	const incoming = new Map<string, number>();
	const outgoing = new Map<string, number>();

	const add = (map: Map<string, number>, id: string, amount: number) => {
		map.set(id, (map.get(id) ?? 0) + amount);
	};

	for (const t of transactions) {
		if (t.unit !== unit) continue;
		if (excludeTransactionId && t.id === excludeTransactionId) continue;

		if (t.type === "income") {
			for (const allocation of t.allocations) {
				add(incoming, allocation.walletId, allocation.amount);
			}
		} else if (t.walletId) {
			add(outgoing, t.walletId, t.amount);
		}
	}

	for (const transfer of transfers) {
		if (transfer.unit !== unit) continue;
		add(outgoing, transfer.fromWalletId, transfer.amount);
		add(incoming, transfer.toWalletId, transfer.amount);
	}

	const rows: WalletBalance[] = wallets.map((w) => ({
		walletId: w.id,
		name: w.name,
		color: w.color,
		icon: w.icon,
		incoming: incoming.get(w.id) ?? 0,
		outgoing: outgoing.get(w.id) ?? 0,
		balance: (incoming.get(w.id) ?? 0) - (outgoing.get(w.id) ?? 0),
	}));

	// The pool is listed only once it has been used — an always-present row
	// reading zero would suggest a jar the user forgot to set up.
	const poolIn = incoming.get(UNALLOCATED_ID) ?? 0;
	const poolOut = outgoing.get(UNALLOCATED_ID) ?? 0;
	if (poolIn !== 0 || poolOut !== 0) {
		rows.push({
			walletId: UNALLOCATED_ID,
			name: UNALLOCATED_NAME,
			color: "blue",
			icon: null,
			incoming: poolIn,
			outgoing: poolOut,
			balance: poolIn - poolOut,
		});
	}

	return rows;
}

/** One wallet's balance in one unit. */
export function balanceOf(
	transactions: Transaction[],
	transfers: Transfer[],
	wallets: Wallet[],
	walletId: string,
	unit: string,
	excludeTransactionId?: string,
): number {
	const rows = walletBalances(
		transactions,
		transfers,
		wallets,
		unit,
		excludeTransactionId,
	);
	return rows.find((r) => r.walletId === walletId)?.balance ?? 0;
}

/** Units a wallet balance could meaningfully be shown in. */
export function walletUnitsUsed(
	transactions: Transaction[],
	transfers: Transfer[],
): string[] {
	const units = new Set<string>();
	for (const t of transactions) {
		if (t.type === "income" ? t.allocations.length > 0 : !!t.walletId) {
			units.add(t.unit);
		}
	}
	for (const transfer of transfers) units.add(transfer.unit);
	return [...units];
}
