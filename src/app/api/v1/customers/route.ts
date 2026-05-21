import { createOrderRepository } from "@/modules/orders/order.repository";

export async function GET(): Promise<Response> {
  try {
    const repo = createOrderRepository();
    const users = await repo.listUsers();

    return Response.json({ ok: true, data: users });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        message: "고객 목록 조회에 실패했습니다.",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 }
    );
  }
}