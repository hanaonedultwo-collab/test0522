import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import type { AnalysisSectionRecord, ChartRecord, OrderRecord } from "@/modules/orders/order.types";

export type GeneratePdfInput = {
  order: OrderRecord;
  chart: ChartRecord;
  sections: AnalysisSectionRecord[];
};

export type GeneratePdfOutput = {
  fileName: string;
  buffer: Buffer;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function readTemplateFile(serviceId: string, productId: string, extension: "html" | "css") {
  const directKey = `${serviceId}_${productId}`;
  const fallbackKey = "serviceA_general";
  const toPath = (key: string) => new URL(`./templates/${key}.${extension}`, import.meta.url);

  try {
    return await readFile(toPath(directKey), "utf-8");
  } catch {
    return readFile(toPath(fallbackKey), "utf-8");
  }
}

function buildAnalysisHtml(sections: AnalysisSectionRecord[]) {
  return sections
    .map(
      (section) => `
      <section class="report-section">
        <h2>${escapeHtml(section.title)}</h2>
        <p class="section-model">${escapeHtml(section.llmModel)}</p>
        <div class="body">${escapeHtml(section.content ?? "").replace(/\n/g, "<br />")}</div>
      </section>
    `
    )
    .join("\n");
}

function buildFiveElementGraph(chart: ChartRecord) {
  const keys = ["목", "화", "토", "금", "수"];
  const maxValue = Math.max(...Object.values(chart.fiveElements), 1);

  return keys
    .map((key) => {
      const value = chart.fiveElements[key] ?? 0;
      const ratio = Math.max(8, Math.round((value / maxValue) * 100));
      return `<div class="bar-row"><span>${key}</span><div class="bar-track"><div class="bar-fill" style="width:${ratio}%"></div></div><strong>${value}</strong></div>`;
    })
    .join("");
}

async function buildHtmlFromTemplate(input: GeneratePdfInput) {
  const [templateHtml, templateCss] = await Promise.all([
    readTemplateFile(input.order.serviceId, input.order.productId, "html"),
    readTemplateFile(input.order.serviceId, input.order.productId, "css"),
  ]);

  return templateHtml
    .replace("{{styles}}", templateCss)
    .replace(/{{logoText}}/g, escapeHtml(input.order.serviceId.toUpperCase()))
    .replace(/{{serviceName}}/g, escapeHtml(input.order.serviceId))
    .replace(/{{customerName}}/g, escapeHtml(input.order.customerName))
    .replace(/{{productName}}/g, escapeHtml(input.order.productId))
    .replace(/{{modelName}}/g, escapeHtml(input.order.llmModel))
    .replace(/{{createdDate}}/g, new Date().toLocaleDateString("ko-KR"))
    .replace(/{{yearPillar}}/g, escapeHtml(input.chart.sajuPillars.year))
    .replace(/{{monthPillar}}/g, escapeHtml(input.chart.sajuPillars.month))
    .replace(/{{dayPillar}}/g, escapeHtml(input.chart.sajuPillars.day))
    .replace(/{{hourPillar}}/g, escapeHtml(input.chart.sajuPillars.hour ?? "미상"))
    .replace(/{{fiveElementBars}}/g, buildFiveElementGraph(input.chart))
    .replace(/{{analysisSections}}/g, buildAnalysisHtml(input.sections));
}

export async function generateAnalysisPdf(input: GeneratePdfInput): Promise<GeneratePdfOutput> {
  const browser = await chromium.launch({ headless: true });

  try {
    const html = await buildHtmlFromTemplate(input);
    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "networkidle",
    });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "14mm",
        right: "12mm",
        bottom: "14mm",
        left: "12mm",
      },
    });

    return {
      fileName: `${input.order.serviceId}-${input.order.productId}-${input.order.id}.pdf`,
      buffer: Buffer.from(pdf),
    };
  } finally {
    await browser.close();
  }
}