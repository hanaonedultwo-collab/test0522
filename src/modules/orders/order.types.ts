import { z } from "zod";

export const llmModels = ["gemini-3", "gemini-2.5", "gpt-4.1", "gpt-4.1-mini", "gpt-5"] as const;
export const orderStatuses = ["queued", "processing", "completed", "failed"] as const;
export const analysisStatuses = ["pending", "generated", "edited", "failed"] as const;
export const serviceIds = ["serviceA", "serviceB", "serviceC"] as const;

export const productsByService = {
  serviceA: ["general", "love"],
  serviceB: ["premium", "career"],
  serviceC: ["match", "yearly"],
} as const;

const allProductIds = ["general", "love", "premium", "career", "match", "yearly"] as const;

export const createOrderSchema = z
  .object({
    userId: z.string().uuid(),
    templateId: z.string().uuid().optional(),
    serviceId: z.enum(serviceIds),
    productId: z.enum(allProductIds),
    llmModel: z.enum(llmModels),
    customerName: z.string().min(1).max(80),
    customerEmail: z.string().email(),
    gender: z.enum(["남성", "여성", "기타"]),
    calendarType: z.enum(["solar", "lunar"]),
    isLeapMonth: z.boolean().optional().default(false),
    birthYear: z.number().int().min(1900).max(2050),
    birthMonth: z.number().int().min(1).max(12),
    birthDay: z.number().int().min(1).max(31),
    birthHour: z.number().int().min(0).max(23).optional(),
    birthMinute: z.number().int().min(0).max(59).optional(),
    birthTimeUnknown: z.boolean().optional().default(false),
    longitude: z.number().int().min(124).max(132).optional(),
    additionalQuestion: z.string().max(2000).optional(),
  })
  .superRefine((value, ctx) => {
    const allowed = productsByService[value.serviceId] as readonly string[];

    if (!allowed.includes(value.productId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["productId"],
        message: "선택한 서비스에서 사용할 수 없는 상품입니다.",
      });
    }
  });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type LlmModel = (typeof llmModels)[number];
export type ServiceId = (typeof serviceIds)[number];
export type ProductId = (typeof allProductIds)[number];

export type OrderRecord = {
  id: string;
  userId: string;
  templateId?: string;
  serviceId: ServiceId;
  productId: ProductId;
  status: (typeof orderStatuses)[number];
  llmModel: LlmModel;
  customerName: string;
  customerEmail: string;
  gender: "남성" | "여성" | "기타";
  calendarType: "solar" | "lunar";
  isLeapMonth: boolean;
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  birthHour?: number;
  birthMinute?: number;
  birthTimeUnknown: boolean;
  longitude: number;
  additionalQuestion?: string;
  createdAt: string;
  updatedAt: string;
};

export type ChartRecord = {
  id: string;
  orderId: string;
  sourceCalendar: "solar" | "lunar";
  sajuPillars: {
    year: string;
    month: string;
    day: string;
    hour: string | null;
  };
  fiveElements: Record<string, number>;
  tenGods: {
    yearStem: string;
    monthStem: string;
    dayStem: string;
    hourStem: string | null;
  };
  rawResult: Record<string, unknown>;
  createdAt: string;
};

export type AnalysisSectionRecord = {
  id: string;
  orderId: string;
  templateSectionKey: string;
  title: string;
  status: (typeof analysisStatuses)[number];
  llmModel: LlmModel;
  promptVersion: number;
  promptText?: string;
  content?: string;
  inputTokens: number;
  outputTokens: number;
  createdAt: string;
  updatedAt: string;
};

export type TemplateConfig = {
  serviceId: ServiceId;
  productId: ProductId;
  coverTemplate: string;
  innerTemplate: string;
  promptOverall: string;
  promptWealth: string;
  promptCareer: string;
};