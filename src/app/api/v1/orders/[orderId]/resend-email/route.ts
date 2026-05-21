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
    const bundle = await repo.getOrderBundle(context.params.orderId);

    if (!bundle) {
      return Response.json({ ok: false, message: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    const pdf = await generateAnalysisPdf({
      order: bundle.order,
      chart: bundle.chart,
      sections: bundle.sections,
    });

    const result = await sendReportEmail({
      to: bundle.order.customerEmail,
      customerName: bundle.order.customerName,
      modelName: bundle.order.llmModel,
      orderId: bundle.order.id,
      pdfFileName: pdf.fileName,
      pdfBuffer: pdf.buffer,
    });

    return Response.json({ ok: true, data: result });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        message: "이메일 재발송에 실패했습니다.",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 }
    );
  }
}