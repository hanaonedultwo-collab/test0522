import { analyzeOrderSections } from "@/modules/analysis/analysis.service";
import { createOrderRepository } from "@/modules/orders/order.repository";

type RouteContext = {
  params: {
    orderId: string;
  };
};

export async function POST(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const repo = createOrderRepository();
    const bundle = await repo.findOrderWithChart(context.params.orderId);

    if (!bundle) {
      return Response.json({ ok: false, message: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    const sections = await analyzeOrderSections(bundle.order, bundle.chart, repo);

    return Response.json({
      ok: true,
      data: {
        orderId: bundle.order.id,
        sections,
      },
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        message: "재생성에 실패했습니다.",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 }
    );
  }
}