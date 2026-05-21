import { createOrderRepository } from "@/modules/orders/order.repository";
import { createOrderWithChart } from "@/modules/orders/order.service";
import { createOrderSchema } from "@/modules/orders/order.types";

export async function GET(): Promise<Response> {
  try {
    const repository = createOrderRepository();
    const bundles = await repository.listOrderBundles();

    return Response.json({
      ok: true,
      data: bundles,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        message: "주문 목록 조회 중 오류가 발생했습니다.",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body: unknown = await request.json();
    const parsed = createOrderSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          ok: false,
          message: "입력값이 올바르지 않습니다.",
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const repository = createOrderRepository();
    await repository.ensureCatalog();
    await repository.ensureUser({
      id: parsed.data.userId,
      email: parsed.data.customerEmail,
      name: parsed.data.customerName,
    });

    const result = await createOrderWithChart(parsed.data, repository);

    return Response.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        message: "주문 생성 중 오류가 발생했습니다.",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 }
    );
  }
}