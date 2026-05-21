import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import type { LlmModel } from "@/modules/orders/order.types";

export type LlmGenerateParams = {
  model: LlmModel;
  systemPrompt: string;
  userPrompt: string;
};

export type LlmGenerateResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
};

export interface LlmClient {
  generate(params: LlmGenerateParams): Promise<LlmGenerateResult>;
}

function mockResult(params: LlmGenerateParams): LlmGenerateResult {
  return {
    text: `[${params.model}] 데모 응답입니다.\n\n${params.userPrompt.slice(0, 220)}...`,
    inputTokens: 0,
    outputTokens: 0,
  };
}

function mapOpenAiModel(model: LlmModel) {
  if (model === "gpt-5") {
    return "gpt-5";
  }

  if (model === "gpt-4.1-mini") {
    return "gpt-4.1-mini";
  }

  return "gpt-4.1";
}

function mapGeminiModel(model: LlmModel) {
  if (model === "gemini-2.5") {
    return process.env.GEMINI_MODEL_25 ?? "gemini-2.5-pro";
  }

  return process.env.GEMINI_MODEL_3 ?? "gemini-2.5-pro";
}

class OpenAiLlmClient implements LlmClient {
  private client: OpenAI | null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
  }

  async generate(params: LlmGenerateParams): Promise<LlmGenerateResult> {
    if (!this.client) {
      return mockResult(params);
    }

    const response = await this.client.responses.create({
      model: mapOpenAiModel(params.model),
      input: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
    });

    return {
      text: response.output_text || "",
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    };
  }
}

class GeminiLlmClient implements LlmClient {
  private client: GoogleGenerativeAI | null;

  constructor() {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    this.client = apiKey ? new GoogleGenerativeAI(apiKey) : null;
  }

  async generate(params: LlmGenerateParams): Promise<LlmGenerateResult> {
    if (!this.client) {
      return mockResult(params);
    }

    const model = this.client.getGenerativeModel({ model: mapGeminiModel(params.model) });
    const response = await model.generateContent(
      `${params.systemPrompt}\n\n${params.userPrompt}\n\n반드시 한국어로 응답하세요.`
    );
    const usage = response.response.usageMetadata;

    return {
      text: response.response.text(),
      inputTokens: usage?.promptTokenCount ?? 0,
      outputTokens: usage?.candidatesTokenCount ?? 0,
    };
  }
}

export function createLlmClient(model: LlmModel): LlmClient {
  if (model.startsWith("gemini")) {
    return new GeminiLlmClient();
  }

  return new OpenAiLlmClient();
}