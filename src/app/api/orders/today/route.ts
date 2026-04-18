import { NextRequest, NextResponse } from "next/server";

import { ensureRole, getAuthContext } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const TIME_ZONE = "America/Mexico_City";
const PAID_STATUSES = new Set(["PAID", "APROBADO"]);
const SOURCES = new Set(["POS", "WHATSAPP"]);
const TYPES = new Set(["DINEIN", "TAKEOUT", "DELIVERY"]);

type SourceFilter = "POS" | "WHATSAPP";
type TypeFilter = "DINEIN" | "TAKEOUT" | "DELIVERY";

type OrderRow = {
  id: number;
  order_number: number;
  created_at: string;
  source?: string | null;
  type: string;
  status: string;
  payment_status?: string | null;
  total_cents?: number | null;
  subtotal_cents?: number | null;
  delivery_fee_cents?: number | null;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
  }).formatToParts(date);

  const offsetLabel = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  if (offsetLabel === "GMT") {
    return 0;
  }

  const match = offsetLabel.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    return 0;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2] ?? "0");
  const minutes = Number(match[3] ?? "0");
  return sign * (hours * 60 + minutes);
}

function getTodayRangeInTimeZone(timeZone: string) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  const localMidnightAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const offsetMinutes = getTimeZoneOffsetMinutes(new Date(localMidnightAsUtc), timeZone);
  const start = new Date(localMidnightAsUtc - offsetMinutes * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function resolveTotalCents(order: OrderRow) {
  if (typeof order.total_cents === "number") {
    return order.total_cents;
  }
  return (order.subtotal_cents ?? 0) + (order.delivery_fee_cents ?? 0);
}

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    ensureRole(auth.role, ["ADMIN"]);

    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source");
    const type = searchParams.get("type");

    if (source && !SOURCES.has(source)) {
      return jsonError("Invalid source filter");
    }
    if (type && !TYPES.has(type)) {
      return jsonError("Invalid type filter");
    }

    const supabase = getSupabaseAdmin();
    const { startIso, endIso } = getTodayRangeInTimeZone(TIME_ZONE);

    let query = supabase
      .from("orders")
      .select(
        "id, order_number, created_at, source, type, status, payment_status, total_cents, subtotal_cents, delivery_fee_cents",
      )
      .gte("created_at", startIso)
      .lt("created_at", endIso)
      .order("created_at", { ascending: false });

    if (source) {
      query = query.eq("source", source as SourceFilter);
    }
    if (type) {
      query = query.eq("type", type as TypeFilter);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    const orders = (data ?? []) as OrderRow[];

    const summary = {
      total_sales_cents: 0,
      total_paid_cents: 0,
      total_pending_cents: 0,
      total_orders: orders.length,
      paid_orders: 0,
      pending_orders: 0,
      by_source: {
        POS: {
          total_sales_cents: 0,
          total_orders: 0,
        },
        WHATSAPP: {
          total_sales_cents: 0,
          total_orders: 0,
        },
      },
    };

    for (const order of orders) {
      const totalCents = resolveTotalCents(order);
      const paymentStatus = order.payment_status ?? "";
      const isPaid = PAID_STATUSES.has(paymentStatus);
      const sourceKey = order.source === "WHATSAPP" ? "WHATSAPP" : "POS";

      summary.total_sales_cents += totalCents;
      if (isPaid) {
        summary.total_paid_cents += totalCents;
        summary.paid_orders += 1;
      } else {
        summary.total_pending_cents += totalCents;
        summary.pending_orders += 1;
      }

      summary.by_source[sourceKey].total_sales_cents += totalCents;
      summary.by_source[sourceKey].total_orders += 1;
    }

    return NextResponse.json({
      time_zone: TIME_ZONE,
      range: {
        start: startIso,
        end: endIso,
      },
      summary,
      orders: orders.map((order) => ({
        id: order.id,
        order_number: order.order_number,
        created_at: order.created_at,
        source: order.source ?? "POS",
        type: order.type,
        status: order.status,
        payment_status: order.payment_status ?? "AWAITING_PAYMENT",
        total_cents: resolveTotalCents(order),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status =
      message === "Forbidden"
        ? 403
        : message.startsWith("Server misconfigured")
          ? 500
          : 401;
    return jsonError(message, status);
  }
}
