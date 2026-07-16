import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { redirectToRoleHome } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/utils";

/** Root: send signed-in users to their role home, everyone else to login. */
export default async function RootPage() {
  if (!supabaseConfigured()) redirect("/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  await redirectToRoleHome(supabase, user.id);
}
