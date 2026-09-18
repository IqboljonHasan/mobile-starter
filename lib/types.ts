import type { Ionicons } from "@expo/vector-icons";
import type { CategoryColor } from "@/lib/categoryColors";

export type IconName = keyof typeof Ionicons.glyphMap;

/** Every category, subcategory and transaction belongs to exactly one side of the ledger. */
export type TxType = "income" | "expense";

export const TX_TYPES: TxType[] = ["income", "expense"];

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
};

export type Transaction = {
	id: string;
	type: TxType;
	/** Always positive — the sign lives in `type`, so a mis-signed amount can't exist. */
	amount: number;
	/** Currency code, e.g. "UZS". See lib/money.ts. */
	unit: string;
	categoryId: string;
	subcategoryId: string | null;
	description: string;
	/** Local calendar day as "YYYY-MM-DD" — never a timestamp, so a
	 *  transaction doesn't slide to the previous day across a timezone. */
	date: string;
	createdAt: number;
};

/** What the category editor collects — the id and the subcategory list are the store's business. */
export type CategoryDraft = Pick<Category, "type" | "name" | "color" | "icon">;

export type TransactionInput = Omit<Transaction, "id" | "createdAt">;

/** Collision-safe enough for a single-device store, and readable in a dump. */
export function uid(prefix = ""): string {
	return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
