import { drizzle } from "drizzle-orm/libsql";
import { getLibsqlClient } from "@/src/server/d1-compat";
import * as schema from "./schema";

export function getDb() {
  return drizzle(getLibsqlClient(), { schema });
}
