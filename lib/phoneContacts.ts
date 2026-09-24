import * as Contacts from "expo-contacts/legacy";

/**
 * Reading the phone's address book.
 *
 * Kept behind this module so the rest of the app never imports the native
 * package directly: contacts are an optional convenience, and everything about
 * them can fail in ways the Debts tab has to survive — permission refused,
 * permission revoked later, an address book with nothing in it, or the native
 * module missing entirely because the app is running in a build made before
 * the dependency was added. Every one of those comes back here as a result the
 * caller can show, never as a thrown error taking the screen down.
 *
 * Imported from `expo-contacts/legacy`: SDK 57 moved whole-address-book
 * reading there, and the new root entry point offers only per-contact access.
 * Reading the book once and letting the user tick names off is what an import
 * sheet is, so this is the right door even though it is the older one.
 */

export type PhoneContact = {
	/** The address-book id, kept on the imported contact so a re-import
	 *  recognises the same person. */
	sourceId: string;
	name: string;
	phone: string;
};

export type ImportResult =
	| { status: "ok"; contacts: PhoneContact[] }
	| { status: "denied" }
	| { status: "unavailable" }
	| { status: "failed" };

/** The first number on a contact, preferring the one marked as mobile. */
function pickPhone(contact: Contacts.ExistingContact): string {
	const numbers = contact.phoneNumbers ?? [];
	if (numbers.length === 0) return "";
	const mobile = numbers.find((n: Contacts.PhoneNumber) =>
		n.label?.toLowerCase().includes("mobile"),
	);
	return (mobile ?? numbers[0]).number?.trim() ?? "";
}

/**
 * Everything in the address book that can be owed money — i.e. that has a
 * name. A contact with no number is still worth importing: a debt is with a
 * person, and the number is only there to call them about it.
 */
export async function readPhoneContacts(): Promise<ImportResult> {
	try {
		const { status } = await Contacts.requestPermissionsAsync();
		if (status !== "granted") return { status: "denied" };

		const { data } = await Contacts.getContactsAsync({
			fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
		});

		const contacts = data
			.map((contact) => ({
				sourceId: contact.id ?? "",
				name: (contact.name ?? "").trim(),
				phone: pickPhone(contact),
			}))
			.filter((c) => c.sourceId && c.name)
			.sort((a, b) => a.name.localeCompare(b.name, "uz"));

		return { status: "ok", contacts };
	} catch (e) {
		// A build that predates the dependency has no native module to call, and
		// that reads as a missing feature rather than a crash.
		const message = e instanceof Error ? e.message : "";
		if (message.includes("ExpoContacts") || message.includes("NativeModule")) {
			console.warn("[contacts] native module unavailable", e);
			return { status: "unavailable" };
		}
		console.warn("[contacts] failed to read", e);
		return { status: "failed" };
	}
}

/** What to tell the user when an import didn't produce a list. */
export const IMPORT_MESSAGES: Record<
	Exclude<ImportResult["status"], "ok">,
	{ title: string; message: string }
> = {
	denied: {
		title: "Ruxsat berilmadi",
		message:
			"Kontaktlarni o'qish uchun ruxsat kerak. Qo'lda ham qo'shishingiz mumkin.",
	},
	unavailable: {
		title: "Bu qurilmada ishlamaydi",
		message:
			"Kontaktlarni import qilish uchun ilovani qayta yig'ish kerak. Hozircha qo'lda qo'shing.",
	},
	failed: {
		title: "O'qib bo'lmadi",
		message: "Kontaktlarni o'qishda xatolik. Qo'lda qo'shib ko'ring.",
	},
};
