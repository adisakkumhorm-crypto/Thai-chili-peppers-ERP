import { createClient } from "@supabase/supabase-js"
import fs from "fs"

const env = fs.readFileSync(".env.local", "utf8")
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]
const supabaseKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]

const supabase = createClient(supabaseUrl!, supabaseKey!)

async function run() {
  const { data, error } = await supabase.rpc('query_schema', { query: "SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'employee_role';" })
  console.log("Roles:", data, error)
}
run()
