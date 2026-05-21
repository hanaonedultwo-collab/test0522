import type { TemplateConfig } from "@/modules/orders/order.types";

const defaultConfigs: TemplateConfig[] = [
  {
    serviceId: "serviceA",
    productId: "general",
    coverTemplate: "serviceA_general",
    innerTemplate: "serviceA_general",
    promptOverall: "사주A 톤으로 종합운을 명확하고 부드럽게 해석",
    promptWealth: "재물 흐름을 현실적 조언 중심으로 작성",
    promptCareer: "직업 적성과 실행 전략을 단계별 제시",
  },
  {
    serviceId: "serviceA",
    productId: "love",
    coverTemplate: "serviceA_love",
    innerTemplate: "serviceA_love",
    promptOverall: "연애/관계 맥락을 포함한 종합 흐름 분석",
    promptWealth: "연애운 상품에서도 재정 갈등 요인을 짚어주기",
    promptCareer: "관계와 커리어 균형 중심 조언",
  },
  {
    serviceId: "serviceB",
    productId: "premium",
    coverTemplate: "serviceB_premium",
    innerTemplate: "serviceB_premium",
    promptOverall: "프리미엄 보고서 톤으로 심층 분석",
    promptWealth: "투자/자산관리 위험 시나리오 포함",
    promptCareer: "직무군별 역량과 시기 전략 제시",
  },
];

let templateConfigs = [...defaultConfigs];

export function listTemplateConfigs() {
  return templateConfigs;
}

export function upsertTemplateConfig(input: TemplateConfig) {
  const index = templateConfigs.findIndex(
    (config) => config.serviceId === input.serviceId && config.productId === input.productId
  );

  if (index >= 0) {
    templateConfigs[index] = input;
    return templateConfigs[index];
  }

  templateConfigs.push(input);
  return input;
}