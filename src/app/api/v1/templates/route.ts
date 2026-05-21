import { z } from "zod";
import { listTemplateConfigs, upsertTemplateConfig } from "@/modules/templates/template-config.store";

const schema = z.object({
  serviceId: z.enum(["serviceA", "serviceB", "serviceC"]),
  productId: z.enum(["general", "love", "premium", "career", "match", "yearly"]),
  coverTemplate: z.string().min(1),
  innerTemplate: z.string().min(1),
  promptOverall: z.string().min(1),
  promptWealth: z.string().min(1),
  promptCareer: z.string().min(1),
});

export async function GET(): Promise<Response> {
  return Response.json({ ok: true, data: listTemplateConfigs() });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = await request.json();
    const parsed = schema.safeParse(payload);

    if (!parsed.success) {
      return Response.json({ ok: false, message: "입력값 오류", issues: parsed.error.issues }, { status: 400 });
    }

    const saved = upsertTemplateConfig(parsed.data);
    return Response.json({ ok: true, data: saved });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        message: "템플릿 저장에 실패했습니다.",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 }
    );
  }
}