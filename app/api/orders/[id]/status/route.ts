import { NextResponse } from "next/server";
import { getOrderById } from "@/lib/data/orders";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/orders/[id]/status">,
) {
  const { id } = await context.params;
  const order = await getOrderById(id);
  if (!order) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ status: order.status, mpStatus: order.mp_status });
}
