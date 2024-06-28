import { building } from "$app/environment"
import { type PreparedQuery, RecordId, Surreal, surql } from "surrealdb.js"
import auditLogQuery from "./auditLog.surql"
import initQuery from "./init.surql"
import CustomHttpEngine, { realUrl } from "./surrealEngine.ts"

const db = new Surreal({ engines: { http: CustomHttpEngine } })

async function reconnect() {
	await db.close() // doesn't do anything if not connected
	console.log("connecting")
	await db.connect(realUrl)
	console.log("reloaded", await db.version())
}

export const failed = "The query was not executed due to a failed transaction"

export { surql, RecordId }

export type RecordIdTypes = {
	asset: number
	assetCache: [number, number]
	assetComment: string
	auditLog: string
	banner: string
	created: string
	createdAsset: string
	dislikes: string
	follows: string
	forumCategory: string
	forumPost: string
	forumReply: string
	friends: string
	group: string
	hasSession: string
	imageAsset: string
	in: string
	likes: string
	moderation: string
	notification: string
	owns: string
	place: number
	playing: string
	posted: string
	recentlyWorn: string
	regKey: string
	render: string
	replyToAsset: string
	replyToComment: string
	replyToPost: string
	replyToReply: string
	report: string
	request: string
	session: string
	statusPost: string
	stuff: string
	thumbnailCache: number
	used: string
	user: string
	wearing: string
}

/**
 * Returns a record id object for a given table and id.
 * @param table The table to get the record id for.
 * @param id The id of the record.
 * @returns a Record object.
 */
export const Record = <T extends keyof RecordIdTypes>(
	table: T,
	id: RecordIdTypes[T]
) => new RecordId(table, id)

type Prepared = PreparedQuery<(result: unknown[]) => unknown>

async function fixError<T>(q: () => Promise<T>) {
	// WORST
	// DATABASE
	// ISSUE
	// EVER
	for (let i = 1; i <= 3; i++) {
		try {
			return await q()
		} catch {
			await reconnect()
		}
		console.log(`retrying query ${i} time${i > 1 ? "s" : ""}`)
	}
	return undefined as unknown as T
}

/**
 * Executes a query in SurrealDB and returns its results. Errors if the query failed.
 * @param query The query to execute.
 * @param bindings An object of parameters to pass to SurrealDB.
 * @returns the result of the query. Errors if unsuccessful.
 */
export const equery = async <T>(
	query: string | Promise<string> | Prepared,
	bindings?: { [k: string]: unknown }
): Promise<T> =>
	await fixError(async () => {
		const result = await db.query_raw(await query, bindings)
		const final: unknown[] = []

		for (const res of result) {
			if (res.status === "ERR" && res.result !== failed)
				throw new Error(res.result)
			final.push(res.result)
		}

		return final as T
	})

if (!building) {
	await reconnect()
	await db.query(initQuery)
}

/**
 * Finds whether a record exists in the database.
 * @param id The id of the record to find.
 * @returns Whether the record exists.
 * @example
 * await find("user:1")
 */
export const find = <T extends keyof RecordIdTypes>(
	table: T,
	id: RecordIdTypes[T]
) =>
	equery(
		surql`!!SELECT 1 FROM ${Record(table, id)}`
	) as unknown as Promise<boolean>

/**
 * Finds whether a record exists in the database matching a given condition.
 * @param table The table to search in.
 * @param where The condition to match.
 * @param params An object of parameters to pass to SurrealDB.
 * @returns Whether the record exists.
 * @example
 * await findWhere("user", surql`username = $username`, { username: "Heliodex" })
 */
export const findWhere = async (
	table: keyof RecordIdTypes,
	where: string,
	params?: { [k: string]: unknown }
) =>
	(
		await equery<boolean[]>(
			`!!SELECT 1 FROM type::table($table) WHERE ${where}`,
			{ ...params, table }
		)
	)[0]

/**
 * Transfers currency from one user to another, and creates a transaction in the database.
 * @param sender An object containing the id or number of the user sending the currency.
 * @param receiver An object containing the id or number of the user receiving the currency.
 * @param amountSent The amount of currency to send.
 * @param notelink An object containing a note for the transaction, as well as a link to what the transaction was for if possible.
 * @example
 * await transaction(user, { number: 1 }, 10, {
 * 	note: `Bought item ${name}`,
 * 	link: `/avatarshop/${id}/${name}`,
 * })
 */
export async function transaction(
	sender: { id?: string; number?: number },
	receiver: { id?: string; number?: number },
	amountSent: number,
	{ note, link }: { note?: string; link?: string }
) {
	throw new Error("todo test dis its broke")
}

type Action = "Account" | "Administration" | "Moderation" | "Economy"

/**
 * Creates a new audit log in the database.
 * @param action The category of the action that was taken
 * @param note The note to be added to the audit log
 * @param userId The id of the user who took the action
 */
export async function auditLog(action: Action, note: string, userId: string) {
	await equery(auditLogQuery, {
		action,
		note,
		user: Record("user", userId),
	})
}
