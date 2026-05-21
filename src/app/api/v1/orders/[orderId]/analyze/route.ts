import { analyzeOrderSections } from "@/modules/analysis/analysis.service";
import { sendReportEmail } from "@/modules/email/email.service";
import { createOrderRepository } from "@/modules/orders/order.repository";
import { generateAnalysisPdf } from "@/modules/pdf/pdf.service";

type RouteContext = {
  params: {
    orderId: string;
  };
};

export async function POST(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const repo = createOrderRepository();
    const orderWithChart = await repo.findOrderWithChart(context.params.orderId);

    if (!orderWithChart) {
      return Response.json(
        {
          ok: false,
          message: "주문 또는 명식 데이터가 존재하지 않습니다.",
        },
        { status: 404 }
      );
    }

    const sections = await analyzeOrderSections(orderWithChart.order, orderWithChart.chart, repo);

    const pdf = await generateAnalysisPdf({
      order: orderWithChart.order,
      chart: orderWithChart.chart,
      sections,
    });

    const emailResult = await sendReportEmail({
      to: orderWithChart.order.customerEmail,
      customerName: orderWithChart.order.customerName,
      modelName: orderWithChart.order.llmModel,
      orderId: orderWithChart.order.id,
      pdfFileName: pdf.fileName,
      pdfBuffer: pdf.buffer,
    });

    return Response.json({
      ok: true,
      data: {
        orderId: orderWithChart.order.id,
        llmModel: orderWithChart.order.llmModel,
        sections,
        delivery: {
          pdfFileName: pdf.fileName,
          email: emailResult,
        },
      },
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        message: "AI 분석 실행에 실패했습니다.",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 }
    );
  }
}