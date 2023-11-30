import { PostgrestSingleResponse, createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Database } from "./types/supabase.ts";

const supabase = createClient<Database>(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_KEY") || "",
);

const handleErrors = (response: PostgrestSingleResponse<null>) => {
  if (response.status > 299) {
    console.log(response.status, response.statusText, response.error);

    console.log("Failed to sync to Supabase.");
    Deno.exit(1);
  }
};

import { githubHandles } from "./people/index.ts";
handleErrors(await supabase.from("people").upsert(
  Object.keys(githubHandles).filter(value => isNaN(Number(value))).map((github_handle) => ({ github_handle })),
));

await supabase.from('shows').insert({
  name: "Rawkode Live",
  slug: "rawkode-live",
  draft: false,
  description: "Rawkode Live is a weekly live stream where we discuss the latest news in the cloud native ecosystem, and interview guests from the community.",
});

supabase.from('episodes').select()
