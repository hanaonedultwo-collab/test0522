import { computeChart } from "@/modules/chart/manseryeok.adapter";
import type { CreateOrderInput } from "@/modules/orders/order.types";
import type { OrderRepository } from "./order.repository";

export async function createOrderWithChart(input: CreateOrderInput, repo: OrderRepository) {
  const creditCost = await repo.getProductCreditCost(input.productId);
  await repo.deductCredits(input.userId, creditCost);

  const order = await repo.createOrder({
    userId: input.userId,
    templateId: input.templateId,
    serviceId: input.serviceId,
    productId: input.productId,
    status: "processing",
    llmModel: input.llmModel,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    gender: input.gender,
    calendarType: input.calendarType,
    isLeapMonth: input.isLeapMonth ?? false,
    birthYear: input.birthYear,
    birthMonth: input.birthMonth,
    birthDay: input.birthDay,
    birthHour: input.birthHour,
    birthMinute: input.birthMinute,
    birthTimeUnknown: input.birthTimeUnknown ?? false,
    longitude: input.longitude ?? 127,
    additionalQuestion: input.additionalQuestion,
  });

  try {
    const chart = computeChart({
      year: input.birthYear,
      month: input.birthMonth,
      day: input.birthDay,
      hour: input.birthHour,
      minute: input.birthMinute,
      birthTimeUnknown: input.birthTimeUnknown,
      calendarType: input.calendarType,
      isLeapMonth: input.isLeapMonth,
      longitude: input.longitude,
    });

    const persistedChart = await repo.createChart({
      orderId: order.id,
      sourceCalendar: input.calendarType,
      sajuPillars: {
        year: chart.saju.yearPillar,
        month: chart.saju.monthPillar,
        day: chart.saju.dayPillar,
        hour: chart.saju.hourPillar,
      },
      fiveElements: chart.fiveElements,
      tenGods: chart.tenGods,
      rawResult: {
        birthTimeUnknown: input.birthTimeUnknown ?? false,
        creditCost,
        solarDate: chart.solarDate,
        hanja: {
          year: chart.saju.yearPillarHanja,
          month: chart.saju.monthPillarHanja,
          day: chart.saju.dayPillarHanja,
          hour: chart.saju.hourPillarHanja,
        },
        correctedTime: chart.saju.correctedTime,
        isTimeCorrected: chart.saju.isTimeCorrected,
        pillars: chart.pillars,
        advanced: chart.advanced,
      },
    });

    await repo.updateOrderStatus(order.id, "completed");

    return {
      order: { ...order, status: "completed" as const },
      chart: persistedChart,
    };
  } catch (error) {
    await repo.updateOrderStatus(order.id, "failed");
    throw error;
  }
}