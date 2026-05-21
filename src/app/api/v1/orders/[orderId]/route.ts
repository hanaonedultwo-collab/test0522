import { createOrderRepository } from "@/modules/orders/order.repository";

type RouteContext = {
  params: {
    orderId: string;
  };
};

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const repo = createOrderRepository();
    const bundle = await repo.getOrderBundle(context.params.orderId);

    if (!bundle) {
      return Response.json(
        {
          ok: false,
          message: "주문을 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    return Response.json({
      ok: true,
      data: bundle,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        message: "주문 상세 조회 중 오류가 발생했습니다.",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 }
    );
  }
}