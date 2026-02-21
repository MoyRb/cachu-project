import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const ONE_HOUR_MS = 60 * 60 * 1000;

function isAuthorized(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET?.trim() ?? "";
  if (!configuredSecret) {
    return false;
  }

  const querySecret = request.nextUrl.searchParams.get("secret");
  const headerSecret = request.headers.get("x-cron-secret");

  return querySecret === configuredSecret || headerSecret === configuredSecret;
}

export async function GET(request: NextRequest) {
  const start = Date.now();

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const cutoffIso = new Date(Date.now() - ONE_HOUR_MS).toISOString();

    const { data: oldOrders, error: oldOrdersError } = await supabase
      .from("orders")
      .select("id")
      .lt("created_at", cutoffIso);

    if (oldOrdersError) {
      return NextResponse.json({ error: oldOrdersError.message }, { status: 500 });
    }

    const orderIds = (oldOrders ?? []).map((order) => order.id);

    if (orderIds.length === 0) {
      return NextResponse.json({
        deleted_orders: 0,
        deleted_items: 0,
        deleted_payments: 0,
        duration_ms: Date.now() - start,
      });
    }

    const { data: deletedPayments, error: deletedPaymentsError } = await supabase
      .from("payments")
      .delete()
      .in("order_id", orderIds)
      .select("id");

    if (deletedPaymentsError) {
      return NextResponse.json({ error: deletedPaymentsError.message }, { status: 500 });
    }

    const { data: deletedItems, error: deletedItemsError } = await supabase
      .from("order_items")
      .delete()
      .in("order_id", orderIds)
      .select("id");

    if (deletedItemsError) {
      return NextResponse.json({ error: deletedItemsError.message }, { status: 500 });
    }

    const { data: deletedOrders, error: deletedOrdersError } = await supabase
      .from("orders")
      .delete()
      .in("id", orderIds)
      .select("id");

    if (deletedOrdersError) {
      return NextResponse.json({ error: deletedOrdersError.message }, { status: 500 });
    }

    return NextResponse.json({
      deleted_orders: deletedOrders?.length ?? 0,
      deleted_items: deletedItems?.length ?? 0,
      deleted_payments: deletedPayments?.length ?? 0,
      duration_ms: Date.now() - start,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
