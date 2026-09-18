import path from "path";
import { initializeFreshDatabase } from "../src/lib/schema-init";

const dbPath = (process.env.DATABASE_URL || "file:./dev.db").replace(/^file:/, "");
const resolved = path.resolve(process.cwd(), dbPath);

initializeFreshDatabase(resolved);
console.log(`[db:init] schema ensured at ${resolved}`);
