import { Resend } from "resend";

type SendReportEmailInput = {
  to: string;
  customerName: string;
  modelName: string;
  orderId: string;
  pdfFileName: string;
  pdfBuffer: Buffer;
};

type SendReportEmailResult = {
  sent: boolean;
  providerId?: string;
  message: string;
};

export async function sendReportEmail(input: SendReportEmailInput): Promise<SendReportEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    return {
      sent: false,
      message: "RESEND_API_KEY 또는 RESEND_FROM_EMAIL이 없어 이메일 발송을 건너뜁니다.",
    };
  }

  const resend = new Resend(apiKey);

  const response = await resend.emails.send({
    from,
    to: [input.to],
    subject: `[사주 리포트] ${input.customerName} 님 분석이 완료되었습니다`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height:1.6;">
        <h2>${input.customerName} 님, 사주 분석이 완료되었습니다.</h2>
        <p>주문번호: ${input.orderId}</p>
        <p>분석 모델: ${input.modelName}</p>
        <p>첨부된 PDF를 확인해 주세요.</p>
      </div>
    `,
    attachments: [
      {
        filename: input.pdfFileName,
        content: input.pdfBuffer.toString("base64"),
      },
    ],
  });

  return {
    sent: true,
    providerId: response.data?.id,
    message: "이메일이 발송되었습니다.",
  };
}