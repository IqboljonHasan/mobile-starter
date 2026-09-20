import type { Category } from "@/lib/types";

/**
 * Categories a new install starts with, so the first transaction can be entered
 * without a detour through the category editor. They are ordinary categories —
 * editable and deletable like any other — and are written to storage once, on
 * first launch, rather than merged in on every start.
 *
 * Two constraints hold this list together:
 *
 * - Icons come from `CATEGORY_ICONS` (components/ui/IconPicker). An icon outside
 *   that set renders fine but can't be picked again once the user edits the
 *   category, which would silently cost them the icon.
 * - Colors come from the eight-hue palette, handed out in order so the first
 *   eight categories of each side are unique and later ones wrap around — the
 *   same rule `nextCategoryColor` follows for categories the user adds. The two
 *   sides are listed separately and only ever charted one at a time, so income
 *   and expense reuse the same eight freely.
 *
 * Where a hue does repeat within one side, the pair is kept on clearly
 * different icons: color is never the only thing telling two categories apart.
 */
export const SEED_CATEGORIES: Category[] = [
	/* Income ---------------------------------------------------------------- */
	{
		id: "cat_salary",
		type: "income",
		name: "Ish haqi",
		color: "green",
		icon: "wallet-outline",
		subcategories: [
			{ id: "sub_salary_avans", name: "Avans", color: "green" },
			{ id: "sub_salary_base", name: "Maosh", color: "green" },
			{ id: "sub_salary_bonus", name: "Bonus", color: "aqua" },
			{ id: "sub_salary_safari", name: "Mehnat safari uchun", color: "aqua" },
			{ id: "sub_salary_overtime", name: "Qo'shimcha ish", color: "blue" },
			{ id: "sub_salary_vacation", name: "Ta'til puli", color: "violet" },
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
			{ id: "sub_business_orders", name: "Buyurtmalar", color: "aqua" },
			{ id: "sub_business_share", name: "Ulush foydasi", color: "yellow" },
		],
	},
	{
		id: "cat_freelance",
		type: "income",
		name: "Freelans",
		color: "orange",
		icon: "bulb-outline",
		subcategories: [
			{ id: "sub_freelance_dev", name: "Dasturlash", color: "orange" },
			{ id: "sub_freelance_design", name: "Dizayn", color: "magenta" },
			{ id: "sub_freelance_content", name: "Kontent", color: "yellow" },
			{ id: "sub_freelance_tutoring", name: "Repetitorlik", color: "aqua" },
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
			{ id: "sub_inv_deposit", name: "Depozit", color: "blue" },
			{ id: "sub_inv_crypto", name: "Kripto", color: "orange" },
		],
	},
	{
		id: "cat_rent_income",
		type: "income",
		name: "Ijara daromadi",
		color: "aqua",
		icon: "home-outline",
		subcategories: [
			{ id: "sub_rentin_flat", name: "Kvartira", color: "aqua" },
			{ id: "sub_rentin_office", name: "Ofis", color: "blue" },
			{ id: "sub_rentin_car", name: "Avtomobil", color: "violet" },
		],
	},
	{
		id: "cat_gifts",
		type: "income",
		name: "Sovg'a",
		color: "magenta",
		icon: "gift-outline",
		subcategories: [
			{ id: "sub_gift_money", name: "Pul sovg'a", color: "magenta" },
			{ id: "sub_gift_holiday", name: "Bayram", color: "violet" },
			{ id: "sub_gift_wedding", name: "To'y", color: "red" },
		],
	},
	{
		id: "cat_benefits",
		type: "income",
		name: "Nafaqa",
		color: "yellow",
		icon: "people-outline",
		subcategories: [
			{ id: "sub_benefit_pension", name: "Pensiya", color: "yellow" },
			{ id: "sub_benefit_child", name: "Bolalar nafaqasi", color: "magenta" },
			{ id: "sub_benefit_state", name: "Davlat yordami", color: "green" },
		],
	},
	{
		id: "cat_debts",
		type: "income",
		name: "Qarz olish",
		color: "red",
		icon: "card-outline",
		subcategories: [
			{ id: "sub_debt_bank", name: "Bank krediti", color: "red" },
			{ id: "sub_debt_friend", name: "Do'stdan", color: "orange" },
			{ id: "sub_debt_family", name: "Qarindoshdan", color: "magenta" },
		],
	},
	{
		id: "cat_loans",
		type: "income",
		name: "Qarz undirish",
		color: "blue",
		icon: "cash-outline",
		subcategories: [
			{ id: "sub_loan_friend", name: "Do'stdan", color: "blue" },
			{ id: "sub_loan_family", name: "Qarindoshdan", color: "violet" },
			{ id: "sub_loan_other", name: "Boshqa", color: "yellow" },
		],
	},
	{
		id: "cat_other_income",
		type: "income",
		name: "Boshqa",
		color: "orange",
		icon: "ellipsis-horizontal-circle-outline",
		subcategories: [
			{ id: "sub_other_in_cashback", name: "Keshbek", color: "orange" },
			{ id: "sub_other_in_refund", name: "Qaytarilgan pul", color: "aqua" },
			{ id: "sub_other_in_prize", name: "Yutuq", color: "yellow" },
		],
	},

	/* Expense --------------------------------------------------------------- */
	{
		id: "cat_food",
		type: "expense",
		name: "Ovqat",
		color: "orange",
		icon: "restaurant-outline",
		subcategories: [
			{ id: "sub_food_groceries", name: "Oziq-ovqat", color: "orange" },
			{ id: "sub_food_cafe", name: "Kafe", color: "yellow" },
			{ id: "sub_food_restaurant", name: "Restoran", color: "magenta" },
			{ id: "sub_food_delivery", name: "Yetkazib berish", color: "red" },
			{ id: "sub_food_lunch", name: "Ish tushligi", color: "aqua" },
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
			{ id: "sub_transport_repair", name: "Avtomobil ta'miri", color: "orange" },
			{ id: "sub_transport_parking", name: "Parkovka", color: "violet" },
			{ id: "sub_transport_wash", name: "Avtoyuvish", color: "green" },
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
			{ id: "sub_home_repair", name: "Ta'mirlash", color: "orange" },
			{ id: "sub_home_furniture", name: "Mebel", color: "violet" },
			{ id: "sub_home_supplies", name: "Uy-ro'zg'or", color: "yellow" },
		],
	},
	{
		// A category of its own rather than one line under Uy: these are the
		// month's most repetitive entries, and each arrives as its own bill, so
		// they are worth telling apart. Internet and the phone sit here too —
		// they are paid the same way, on the same day, as the rest.
		id: "cat_utilities",
		type: "expense",
		name: "Kommunal",
		color: "violet",
		icon: "bulb-outline",
		subcategories: [
			{ id: "sub_util_power", name: "Elektr", color: "yellow" },
			{ id: "sub_util_gas", name: "Gaz", color: "blue" },
			{ id: "sub_util_water", name: "Sovuq suv", color: "aqua" },
			{ id: "sub_util_heating", name: "Issiq suv va isitish", color: "red" },
			{ id: "sub_util_waste", name: "Chiqindi", color: "green" },
			{ id: "sub_util_internet", name: "Internet", color: "violet" },
			{ id: "sub_util_phone", name: "Telefon", color: "magenta" },
			{ id: "sub_util_tv", name: "Kabel TV", color: "orange" },
			{ id: "sub_util_intercom", name: "Domofon", color: "blue" },
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
			{ id: "sub_shopping_shoes", name: "Poyabzal", color: "orange" },
			{ id: "sub_shopping_beauty", name: "Kosmetika", color: "red" },
			{ id: "sub_shopping_goods", name: "Uy buyumlari", color: "aqua" },
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
			{ id: "sub_health_lab", name: "Tahlillar", color: "aqua" },
			{ id: "sub_health_dentist", name: "Stomatolog", color: "blue" },
			{ id: "sub_health_insurance", name: "Sug'urta", color: "violet" },
		],
	},
	{
		id: "cat_education",
		type: "expense",
		name: "Ta'lim",
		color: "yellow",
		icon: "school-outline",
		subcategories: [
			{ id: "sub_edu_tuition", name: "O'quv to'lovi", color: "yellow" },
			{ id: "sub_edu_courses", name: "Kurslar", color: "blue" },
			{ id: "sub_edu_books", name: "Kitoblar", color: "orange" },
			{ id: "sub_edu_tutor", name: "Repetitor", color: "green" },
		],
	},
	{
		id: "cat_fun",
		type: "expense",
		name: "Ko'ngilochar",
		color: "green",
		icon: "game-controller-outline",
		subcategories: [
			{ id: "sub_fun_subs", name: "Obunalar", color: "violet" },
			{ id: "sub_fun_events", name: "Tadbirlar", color: "magenta" },
			{ id: "sub_fun_cinema", name: "Kino", color: "blue" },
			{ id: "sub_fun_games", name: "O'yinlar", color: "green" },
		],
	},
	{
		id: "cat_sport",
		type: "expense",
		name: "Sport",
		color: "aqua",
		icon: "fitness-outline",
		subcategories: [
			{ id: "sub_sport_gym", name: "Sport zal", color: "aqua" },
			{ id: "sub_sport_gear", name: "Sport anjomlari", color: "orange" },
			{ id: "sub_sport_section", name: "To'garak", color: "violet" },
		],
	},
	{
		id: "cat_kids",
		type: "expense",
		name: "Bolalar",
		color: "magenta",
		icon: "people-outline",
		subcategories: [
			{ id: "sub_kids_school", name: "Maktab va bog'cha", color: "magenta" },
			{ id: "sub_kids_clothes", name: "Bolalar kiyimi", color: "blue" },
			{ id: "sub_kids_toys", name: "O'yinchoqlar", color: "yellow" },
			{ id: "sub_kids_classes", name: "To'garaklar", color: "green" },
		],
	},
	{
		id: "cat_travel",
		type: "expense",
		name: "Sayohat",
		color: "blue",
		icon: "airplane-outline",
		subcategories: [
			{ id: "sub_travel_tickets", name: "Chiptalar", color: "blue" },
			{ id: "sub_travel_hotel", name: "Mehmonxona", color: "violet" },
			{ id: "sub_travel_spending", name: "Sayohatdagi xarajat", color: "orange" },
			{ id: "sub_travel_visa", name: "Viza va hujjatlar", color: "aqua" },
		],
	},
	{
		id: "cat_giving",
		type: "expense",
		name: "Sovg'a va xayriya",
		color: "orange",
		icon: "gift-outline",
		subcategories: [
			{ id: "sub_give_gift", name: "Sovg'a", color: "orange" },
			{ id: "sub_give_wedding", name: "To'y va marosim", color: "magenta" },
			{ id: "sub_give_charity", name: "Xayriya", color: "green" },
		],
	},
	{
		id: "cat_debs-out",
		type: "expense",
		name: "Qarz berish",
		color: "red",
		icon: "card-outline",
		subcategories: [
			{ id: "sub_lend_friend", name: "Do'stga", color: "red" },
			{ id: "sub_lend_family", name: "Qarindoshga", color: "magenta" },
		],
	},
	{
		id: "cat_loans-out",
		type: "expense",
		name: "Qarz to'lovi",
		color: "violet",
		icon: "cash-outline",
		subcategories: [
			{ id: "sub_repay_bank", name: "Bank krediti", color: "violet" },
			{ id: "sub_repay_friend", name: "Do'stga", color: "blue" },
			{ id: "sub_repay_family", name: "Qarindoshga", color: "aqua" },
		],
	},
	{
		id: "cat_other_expense",
		type: "expense",
		name: "Boshqa",
		color: "yellow",
		icon: "ellipsis-horizontal-circle-outline",
		subcategories: [
			{ id: "sub_other_ex_fees", name: "Komissiya va to'lovlar", color: "yellow" },
			{ id: "sub_other_ex_tax", name: "Soliq", color: "red" },
		],
	},
];
