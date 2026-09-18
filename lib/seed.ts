import type { Category } from "@/lib/types";

/**
 * Categories a new install starts with, so the first transaction can be entered
 * without a detour through the category editor. They are ordinary categories —
 * editable and deletable like any other — and are written to storage once, on
 * first launch, rather than merged in on every start.
 */
export const SEED_CATEGORIES: Category[] = [
	{
		id: "cat_salary",
		type: "income",
		name: "Ish haqi",
		color: "green",
		icon: "wallet-outline",
		subcategories: [
			{ id: "sub_salary_base", name: "Asosiy maosh", color: "green" },
			{ id: "sub_salary_bonus", name: "Bonus", color: "aqua" },
			{ id: "sub_salary_overtime", name: "Qo'shimcha ish", color: "blue" },
		],
	},
	{
		id: "cat_business",
		type: "income",
		name: "Biznes",
		color: "blue",
		icon: "briefcase-outline",
		subcategories: [
			{ id: "sub_business_sales", name: "Savdo", color: "blue" },
			{ id: "sub_business_services", name: "Xizmatlar", color: "violet" },
		],
	},
	{
		id: "cat_investments",
		type: "income",
		name: "Investitsiya",
		color: "violet",
		icon: "trending-up-outline",
		subcategories: [
			{ id: "sub_inv_dividends", name: "Dividend", color: "violet" },
			{ id: "sub_inv_interest", name: "Foiz", color: "aqua" },
		],
	},
	{
		id: "cat_gifts",
		type: "income",
		name: "Sovg'a",
		color: "magenta",
		icon: "gift-outline",
		subcategories: [],
	},
	{
		id: "cat_other_income",
		type: "income",
		name: "Boshqa",
		color: "yellow",
		icon: "ellipsis-horizontal-circle-outline",
		subcategories: [],
	},
	{
		id: "cat_food",
		type: "expense",
		name: "Ovqat",
		color: "orange",
		icon: "restaurant-outline",
		subcategories: [
			{ id: "sub_food_groceries", name: "Oziq-ovqat", color: "orange" },
			{ id: "sub_food_cafe", name: "Kafe", color: "yellow" },
			{ id: "sub_food_delivery", name: "Yetkazib berish", color: "red" },
		],
	},
	{
		id: "cat_transport",
		type: "expense",
		name: "Transport",
		color: "blue",
		icon: "car-outline",
		subcategories: [
			{ id: "sub_transport_fuel", name: "Yoqilg'i", color: "blue" },
			{ id: "sub_transport_taxi", name: "Taksi", color: "yellow" },
			{ id: "sub_transport_public", name: "Jamoat transporti", color: "aqua" },
		],
	},
	{
		id: "cat_home",
		type: "expense",
		name: "Uy",
		color: "aqua",
		icon: "home-outline",
		subcategories: [
			{ id: "sub_home_rent", name: "Ijara", color: "aqua" },
			{ id: "sub_home_utilities", name: "Kommunal", color: "blue" },
			{ id: "sub_home_internet", name: "Internet", color: "violet" },
		],
	},
	{
		id: "cat_shopping",
		type: "expense",
		name: "Xaridlar",
		color: "magenta",
		icon: "bag-handle-outline",
		subcategories: [
			{ id: "sub_shopping_clothes", name: "Kiyim", color: "magenta" },
			{ id: "sub_shopping_tech", name: "Elektronika", color: "violet" },
		],
	},
	{
		id: "cat_health",
		type: "expense",
		name: "Sog'liq",
		color: "red",
		icon: "medkit-outline",
		subcategories: [
			{ id: "sub_health_pharmacy", name: "Dorixona", color: "red" },
			{ id: "sub_health_doctor", name: "Shifokor", color: "magenta" },
		],
	},
	{
		id: "cat_fun",
		type: "expense",
		name: "Ko'ngilochar",
		color: "violet",
		icon: "game-controller-outline",
		subcategories: [
			{ id: "sub_fun_subs", name: "Obunalar", color: "violet" },
			{ id: "sub_fun_events", name: "Tadbirlar", color: "magenta" },
		],
	},
	{
		id: "cat_other_expense",
		type: "expense",
		name: "Boshqa",
		color: "yellow",
		icon: "ellipsis-horizontal-circle-outline",
		subcategories: [],
	},
];
