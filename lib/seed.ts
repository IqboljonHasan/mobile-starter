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
		name: "Salary",
		color: "green",
		icon: "wallet-outline",
		subcategories: [
			{ id: "sub_salary_base", name: "Base pay", color: "green" },
			{ id: "sub_salary_bonus", name: "Bonus", color: "aqua" },
			{ id: "sub_salary_overtime", name: "Overtime", color: "blue" },
		],
	},
	{
		id: "cat_business",
		type: "income",
		name: "Business",
		color: "blue",
		icon: "briefcase-outline",
		subcategories: [
			{ id: "sub_business_sales", name: "Sales", color: "blue" },
			{ id: "sub_business_services", name: "Services", color: "violet" },
		],
	},
	{
		id: "cat_investments",
		type: "income",
		name: "Investments",
		color: "violet",
		icon: "trending-up-outline",
		subcategories: [
			{ id: "sub_inv_dividends", name: "Dividends", color: "violet" },
			{ id: "sub_inv_interest", name: "Interest", color: "aqua" },
		],
	},
	{
		id: "cat_gifts",
		type: "income",
		name: "Gifts",
		color: "magenta",
		icon: "gift-outline",
		subcategories: [],
	},
	{
		id: "cat_other_income",
		type: "income",
		name: "Other",
		color: "yellow",
		icon: "ellipsis-horizontal-circle-outline",
		subcategories: [],
	},
	{
		id: "cat_food",
		type: "expense",
		name: "Food",
		color: "orange",
		icon: "restaurant-outline",
		subcategories: [
			{ id: "sub_food_groceries", name: "Groceries", color: "orange" },
			{ id: "sub_food_cafe", name: "Cafés", color: "yellow" },
			{ id: "sub_food_delivery", name: "Delivery", color: "red" },
		],
	},
	{
		id: "cat_transport",
		type: "expense",
		name: "Transport",
		color: "blue",
		icon: "car-outline",
		subcategories: [
			{ id: "sub_transport_fuel", name: "Fuel", color: "blue" },
			{ id: "sub_transport_taxi", name: "Taxi", color: "yellow" },
			{ id: "sub_transport_public", name: "Public transport", color: "aqua" },
		],
	},
	{
		id: "cat_home",
		type: "expense",
		name: "Home",
		color: "aqua",
		icon: "home-outline",
		subcategories: [
			{ id: "sub_home_rent", name: "Rent", color: "aqua" },
			{ id: "sub_home_utilities", name: "Utilities", color: "blue" },
			{ id: "sub_home_internet", name: "Internet", color: "violet" },
		],
	},
	{
		id: "cat_shopping",
		type: "expense",
		name: "Shopping",
		color: "magenta",
		icon: "bag-handle-outline",
		subcategories: [
			{ id: "sub_shopping_clothes", name: "Clothing", color: "magenta" },
			{ id: "sub_shopping_tech", name: "Electronics", color: "violet" },
		],
	},
	{
		id: "cat_health",
		type: "expense",
		name: "Health",
		color: "red",
		icon: "medkit-outline",
		subcategories: [
			{ id: "sub_health_pharmacy", name: "Pharmacy", color: "red" },
			{ id: "sub_health_doctor", name: "Doctor", color: "magenta" },
		],
	},
	{
		id: "cat_fun",
		type: "expense",
		name: "Entertainment",
		color: "violet",
		icon: "game-controller-outline",
		subcategories: [
			{ id: "sub_fun_subs", name: "Subscriptions", color: "violet" },
			{ id: "sub_fun_events", name: "Events", color: "magenta" },
		],
	},
	{
		id: "cat_other_expense",
		type: "expense",
		name: "Other",
		color: "yellow",
		icon: "ellipsis-horizontal-circle-outline",
		subcategories: [],
	},
];
