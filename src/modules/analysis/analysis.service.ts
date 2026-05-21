import type { ChartRecord, LlmModel, OrderRecord } from "@/modules/orders/order.types";
import type { OrderRepository } from "@/modules/orders/order.repository";
import { listTemplateConfigs } from "@/modules/templates/template-config.store";
import { createLlmClient } from "./llm.factory";

type SectionSpec = {
  key: string;
  title: string;
  instruction: string;
};

const SECTION_SPECS: SectionSpec[] = [
  {
    key: "overall",
    title: "종합운세",
    instruction: "전체 인생 흐름, 장점/주의점, 올해 실천 포인트를 균형 있게 정리하세요.",
  },
  {
    key: "wealth",
    title: "재물운",
    instruction: "수입/지출 성향, 자산관리 방식, 리스크 관리 조언을 구체적으로 제시하세요.",
  },
  {
    key: "career",
    title: "직업운",
    instruction: "적성, 일 스타일, 커리어 전략, 시기별 의사결정 포인트를 설명하세요.",
  },
];

function buildSajuContext(order: OrderRecord, chart: ChartRecord) {
  return [
    `고객명: ${order.customerName}`,
    `성별: ${order.gender}`,
    `서비스/상품: ${order.serviceId} / ${order.productId}`,
    `생년월일시: ${order.birthYear}-${order.birthMonth}-${order.birthDay} ${order.birthHour ?? "미상"}:${order.birthMinute ?? "00"}`,
    `년주/월주/일주/시주: ${chart.sajuPillars.year} / ${chart.sajuPillars.month} / ${chart.sajuPillars.day} / ${chart.sajuPillars.hour ?? "미상"}`,
    order.birthTimeUnknown
      ? "출생 시간을 모르므로 시주를 제외한 삼주(년/월/일) 중심으로 해석해야 합니다."
      : "출생 시간이 제공되어 사주 사주팔자(사주) 네 기둥 기준으로 해석합니다.",
    `오행 분포: ${Object.entries(chart.fiveElements)
      .map(([element, count]) => `${element}:${count}`)
      .join(", ")}`,
    `십신 정보: ${Object.entries(chart.tenGods)
      .map(([key, value]) => `${key}:${value ?? "없음"}`)
      .join(", ")}`,
    order.additionalQuestion ? `추가 질문: ${order.additionalQuestion}` : "추가 질문: 없음",
  ].join("\n");
}

function buildPrompts(params: {
  model: LlmModel;
  context: string;
  section: SectionSpec;
  order: OrderRecord;
}) {
  const template = listTemplateConfigs().find(
    (item) => item.serviceId === params.order.serviceId && item.productId === params.order.productId
  );

  const promptBySection = {
    overall: template?.promptOverall,
    wealth: template?.promptWealth,
    career: template?.promptCareer,
  } as const;

  const systemPrompt = [
    "당신은 한국 사주명리 상담 리포트 전문 분석가입니다.",
    "단정적 예언이 아닌 확률적/조언형 표현을 사용하고, 현실적인 실행 문장을 포함하세요.",
    "응답은 한국어 마크다운 본문으로 작성하세요.",
    "입력 데이터에 없는 시주는 추정하거나 지어내지 마세요.",
  ].join(" ");

  const userPrompt = [
    `선택 모델: ${params.model}`,
    `분석 섹션: ${params.section.title}`,
    "아래 명식 데이터를 바탕으로 분석하세요.",
    params.context,
    `추가 지시: ${promptBySection[params.section.key as keyof typeof promptBySection] ?? params.section.instruction}`,
    "분량: 4~6개 단락. 마지막에 실천 팁 3개를 bullet로 제시하세요.",
  ].join("\n\n");

  return { systemPrompt, userPrompt };
}

export async function analyzeOrderSections(
  order: OrderRecord,
  chart: ChartRecord,
  repo: OrderRepository
) {
  const llm = createLlmClient(order.llmModel);
  const context = buildSajuContext(order, chart);

  await repo.updateOrderStatus(order.id, "processing");

  try {
    const results = await Promise.all(
      SECTION_SPECS.map(async (section) => {
        const prompt = buildPrompts({
          model: order.llmModel,
          context,
          section,
          order,
        });

        const completion = await llm.generate({
          model: order.llmModel,
          systemPrompt: prompt.systemPrompt,
          userPrompt: prompt.userPrompt,
        });

        return repo.createAnalysisSection({
          orderId: order.id,
          templateSectionKey: section.key,
          title: section.title,
          status: "generated",
          llmModel: order.llmModel,
          promptVersion: 1,
          promptText: prompt.userPrompt,
          content: completion.text,
          inputTokens: completion.inputTokens,
          outputTokens: completion.outputTokens,
        });
      })
    );

    await repo.updateOrderStatus(order.id, "completed");
    return results;
  } catch (error) {
    await repo.updateOrderStatus(order.id, "failed");
    throw error;
  }
}