#!/usr/bin/env node
import meow from "meow";
import { PostgresMeta } from "@supabase/postgres-meta";
import { getGeneratorMetadata } from "@supabase/postgres-meta/dist/lib/generators.js";
import { apply } from "@supabase/postgres-meta/dist/server/templates/typescript.js";
import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";

//#region src/cli/utils/parse-duration.ts
function parseDuration(duration) {
	const match = duration.match(/^(\d+)(s|m|h)?$/);
	if (!match) throw new Error(`Invalid duration format: ${duration}. Use format like "30s", "1m", "90s"`);
	const value = parseInt(match[1], 10);
	const unit = match[2] || "s";
	switch (unit) {
		case "s": return value * 1e3;
		case "m": return value * 60 * 1e3;
		case "h": return value * 60 * 60 * 1e3;
		default: throw new Error(`Unknown duration unit: ${unit}`);
	}
}

//#endregion
//#region src/cli/commands/generate-types.ts
async function generateTypes(options) {
	const { connectionString, schemas = ["public"], detectOneToOneRelationships = true } = options;
	const pgMeta = new PostgresMeta({ connectionString });
	try {
		const { data: metadata } = await getGeneratorMetadata(pgMeta, { includedSchemas: schemas });
		if (!metadata) throw new Error("No metadata found. Please check your database connection and schema.");
		return await apply({
			...metadata,
			detectOneToOneRelationships
		});
	} finally {
		await pgMeta.end();
	}
}

//#endregion
//#region src/cli/commands/gen-types.ts
async function genTypes(flags) {
	const dbUrl = flags.dbUrl?.trim();
	if (!dbUrl) {
		console.error("Error: --db-url is required");
		console.error("Run \"neon-js gen-types --help\" for usage information");
		process.exit(1);
	}
	const options = {
		connectionString: dbUrl,
		schemas: flags.schema,
		detectOneToOneRelationships: !flags.postgrestV9Compat
	};
	if (flags.queryTimeout) try {
		options.queryTimeout = parseDuration(flags.queryTimeout);
	} catch (error) {
		console.error(`Error: ${error instanceof Error ? error.message : error}`);
		process.exit(1);
	}
	const outputPath = flags.output;
	console.log("Generating types...");
	console.log(`Database: ${options.connectionString.split("@")[1] || "connected"}`);
	console.log(`Schemas: ${options.schemas?.join(", ") || "public"}`);
	console.log(`Output: ${outputPath}`);
	const types = await generateTypes(options);
	const outputDir = dirname(outputPath);
	if (outputDir !== ".") mkdirSync(outputDir, { recursive: true });
	writeFileSync(outputPath, types);
	console.log(`✅ Types generated successfully at ${outputPath}`);
}

//#endregion
//#region src/cli/index.ts
async function main() {
	const cli = meow(`
    Usage
      $ neon-js gen-types --db-url <url> [options]

    Commands
      gen-types    Generate TypeScript types from your database schema

    Required Options
      --db-url <url>              Database connection string

    Options
      --output, -o <path>         Output file path (default: database.types.ts)
      --schema, -s <name>         Schema to include (repeatable, default: public)
      --postgrest-v9-compat       Disable one-to-one relationship detection
      --query-timeout <duration>  Query timeout (default: 15s, format: 30s, 1m, 90s)

    Examples
      $ neon-js gen-types --db-url "postgresql://user:pass@host:5432/db"
      $ neon-js gen-types --db-url "postgresql://..." --output src/types/db.ts
      $ neon-js gen-types --db-url "postgresql://..." -s public -s auth
      $ neon-js gen-types --db-url "postgresql://..." --postgrest-v9-compat
      $ neon-js gen-types --db-url "postgresql://..." --query-timeout 30s
  `, {
		importMeta: import.meta,
		description: "A TypeScript SDK for Neon services",
		flags: {
			dbUrl: {
				type: "string",
				isRequired: (flags, input) => {
					if (flags.help || flags.version || input.length === 0) return false;
					return true;
				}
			},
			output: {
				type: "string",
				shortFlag: "o",
				default: "database.types.ts"
			},
			schema: {
				type: "string",
				shortFlag: "s",
				isMultiple: true,
				default: ["public"]
			},
			postgrestV9Compat: {
				type: "boolean",
				default: false
			},
			queryTimeout: { type: "string" }
		}
	});
	const command = cli.input[0];
	if (!command) {
		cli.showHelp(0);
		return;
	}
	if (cli.flags.help) {
		cli.showHelp(0);
		return;
	}
	if (command === "gen-types") await genTypes(cli.flags);
	else {
		console.error(`Unknown command: ${command}`);
		console.error("Run \"neon-js --help\" for usage information");
		process.exit(1);
	}
}
main();

//#endregion
export {  };