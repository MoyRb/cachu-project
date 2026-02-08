import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("products")
      .select(
        "id,name,description,price_cents,station,is_available,image_url,category:categories(name)",
      )
      .order("id", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server misconfigured";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
