import { z } from "zod";
import { createOrderRepository } from "@/modules/orders/order.repository";

const schema = z.object({
  userId: z.string().uuid(),
  amount: z.number().int().min(1),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = await request.json();
    const parsed = schema.safeParse(payload);

    if (!parsed.success) {
      return Response.json({ ok: false, message: "입력값 오류", issues: parsed.error.issues }, { status: 400 });
    }

    const repo = createOrderRepository();
    const credits = await repo.chargeCredits(parsed.data.userId, parsed.data.amount);

    return Response.json({
      ok: true,
      data: {
        userId: parsed.data.userId,
        credits,
      },
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        message: "크레딧 충전에 실패했습니다.",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 }
    );
  }
}