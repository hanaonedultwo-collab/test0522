import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { analysisSections, charts, orders, products, services, users } from "@/db/schema";
import type { AnalysisSectionRecord, ChartRecord, OrderRecord } from "./order.types";

function toOrderRecord(row: typeof orders.$inferSelect): OrderRecord {
  return {
    id: row.id,
    userId: row.userId,
    templateId: row.templateId ?? undefined,
    serviceId: row.serviceId as OrderRecord["serviceId"],
    productId: row.productId as OrderRecord["productId"],
    status: row.status,
    llmModel: row.llmModel,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    gender: row.gender as OrderRecord["gender"],
    calendarType: row.calendarType as OrderRecord["calendarType"],
    isLeapMonth: row.isLeapMonth,
    birthYear: row.birthYear,
    birthMonth: row.birthMonth,
    birthDay: row.birthDay,
    birthHour: row.birthHour ?? undefined,
    birthMinute: row.birthMinute ?? undefined,
    birthTimeUnknown: row.birthTimeUnknown,
    longitude: row.longitude,
    additionalQuestion: row.additionalQuestion ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toChartRecord(row: typeof charts.$inferSelect): ChartRecord {
  return {
    id: row.id,
    orderId: row.orderId,
    sourceCalendar: row.sourceCalendar as ChartRecord["sourceCalendar"],
    sajuPillars: row.sajuPillars,
    fiveElements: row.fiveElements,
    tenGods: row.tenGods as ChartRecord["tenGods"],
    rawResult: row.rawResult,
    createdAt: row.createdAt.toISOString(),
  };
}

function toAnalysisSectionRecord(row: typeof analysisSections.$inferSelect): AnalysisSectionRecord {
  return {
    id: row.id,
    orderId: row.orderId,
    templateSectionKey: row.templateSectionKey,
    title: row.title,
    status: row.status,
    llmModel: row.llmModel,
    promptVersion: row.promptVersion,
    promptText: row.promptText ?? undefined,
    content: row.content ?? undefined,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface OrderRepository {
  ensureCatalog(): Promise<void>;
  ensureUser(user: { id: string; email: string; name: string }): Promise<void>;
  listUsers(): Promise<Array<{ id: string; name: string; email: string; credits: number }>>;
  chargeCredits(userId: string, amount: number): Promise<number>;
  deductCredits(userId: string, amount: number): Promise<number>;
  getProductCreditCost(productId: string): Promise<number>;
  createOrder(order: Omit<OrderRecord, "id" | "createdAt" | "updatedAt">): Promise<OrderRecord>;
  updateOrderStatus(orderId: string, status: OrderRecord["status"]): Promise<void>;
  createChart(chart: Omit<ChartRecord, "id" | "createdAt">): Promise<ChartRecord>;
  findOrderWithChart(orderId: string): Promise<{ order: OrderRecord; chart: ChartRecord } | null>;
  getOrderBundle(orderId: string): Promise<{
    order: OrderRecord;
    chart: ChartRecord;
    sections: AnalysisSectionRecord[];
  } | null>;
  listOrderBundles(): Promise<
    Array<{
      order: OrderRecord;
      chart: ChartRecord;
      sections: AnalysisSectionRecord[];
    }>
  >;
  createAnalysisSection(
    section: Omit<AnalysisSectionRecord, "id" | "createdAt" | "updatedAt">
  ): Promise<AnalysisSectionRecord>;
  listAnalysisSections(orderId: string): Promise<AnalysisSectionRecord[]>;
}

export class DrizzleOrderRepository implements OrderRepository {
  private db = getDb();

  async ensureCatalog(): Promise<void> {
    await this.db
      .insert(services)
      .values([
        { id: "serviceA", name: "사주A", logoText: "A" },
        { id: "serviceB", name: "사주B", logoText: "B", themeColor: "#2563eb" },
        { id: "serviceC", name: "사주C", logoText: "C", themeColor: "#db2777" },
      ])
      .onConflictDoNothing({ target: services.id });

    await this.db
      .insert(products)
      .values([
        { id: "general", serviceId: "serviceA", name: "종합운", creditCost: 1200 },
        { id: "love", serviceId: "serviceA", name: "연애운", creditCost: 1500 },
        { id: "premium", serviceId: "serviceB", name: "프리미엄", creditCost: 2200 },
        { id: "career", serviceId: "serviceB", name: "직업운", creditCost: 1600 },
        { id: "match", serviceId: "serviceC", name: "궁합", creditCost: 1800 },
        { id: "yearly", serviceId: "serviceC", name: "연운", creditCost: 1400 },
      ])
      .onConflictDoNothing({ target: products.id });
  }

  async ensureUser(user: { id: string; email: string; name: string }): Promise<void> {
    await this.db
      .insert(users)
      .values({
        id: user.id,
        email: user.email,
        name: user.name,
        credits: 10000,
      })
      .onConflictDoNothing({ target: users.id });
  }

  async listUsers() {
    const rows = await this.db.select().from(users);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      credits: row.credits,
    }));
  }

  async chargeCredits(userId: string, amount: number): Promise<number> {
    const [target] = await this.db.select().from(users).where(eq(users.id, userId));

    if (!target) {
      throw new Error("사용자를 찾을 수 없습니다.");
    }

    const nextCredits = target.credits + amount;

    await this.db
      .update(users)
      .set({
        credits: nextCredits,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return nextCredits;
  }

  async deductCredits(userId: string, amount: number): Promise<number> {
    const [target] = await this.db.select().from(users).where(eq(users.id, userId));

    if (!target) {
      throw new Error("사용자를 찾을 수 없습니다.");
    }

    if (target.credits < amount) {
      throw new Error("크레딧이 부족합니다.");
    }

    const nextCredits = target.credits - amount;

    await this.db
      .update(users)
      .set({
        credits: nextCredits,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return nextCredits;
  }

  async getProductCreditCost(productId: string): Promise<number> {
    const [target] = await this.db.select().from(products).where(eq(products.id, productId));
    return target?.creditCost ?? 0;
  }

  async createOrder(order: Omit<OrderRecord, "id" | "createdAt" | "updatedAt">): Promise<OrderRecord> {
    const [created] = await this.db
      .insert(orders)
      .values({
        userId: order.userId,
        templateId: order.templateId,
        serviceId: order.serviceId,
        productId: order.productId,
        status: order.status,
        llmModel: order.llmModel,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        gender: order.gender,
        calendarType: order.calendarType,
        isLeapMonth: order.isLeapMonth,
        birthYear: order.birthYear,
        birthMonth: order.birthMonth,
        birthDay: order.birthDay,
        birthHour: order.birthHour,
        birthMinute: order.birthMinute,
        birthTimeUnknown: order.birthTimeUnknown,
        longitude: order.longitude,
        additionalQuestion: order.additionalQuestion,
      })
      .returning();

    return toOrderRecord(created);
  }

  async updateOrderStatus(orderId: string, status: OrderRecord["status"]): Promise<void> {
    await this.db
      .update(orders)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
  }

  async createChart(chart: Omit<ChartRecord, "id" | "createdAt">): Promise<ChartRecord> {
    const [created] = await this.db
      .insert(charts)
      .values({
        orderId: chart.orderId,
        sourceCalendar: chart.sourceCalendar,
        sajuPillars: chart.sajuPillars,
        fiveElements: chart.fiveElements,
        tenGods: chart.tenGods,
        rawResult: chart.rawResult,
      })
      .returning();

    return toChartRecord(created);
  }

  async findOrderWithChart(orderId: string): Promise<{ order: OrderRecord; chart: ChartRecord } | null> {
    const [joined] = await this.db
      .select()
      .from(orders)
      .leftJoin(charts, eq(charts.orderId, orders.id))
      .where(eq(orders.id, orderId));

    if (!joined?.orders || !joined.charts) {
      return null;
    }

    return {
      order: toOrderRecord(joined.orders),
      chart: toChartRecord(joined.charts),
    };
  }

  async getOrderBundle(orderId: string) {
    const base = await this.findOrderWithChart(orderId);
    if (!base) {
      return null;
    }

    const sections = await this.listAnalysisSections(orderId);

    return {
      ...base,
      sections,
    };
  }

  async listOrderBundles() {
    const rows = await this.db.select().from(orders).leftJoin(charts, eq(charts.orderId, orders.id));

    const bundles = await Promise.all(
      rows
        .filter((row) => row.orders && row.charts)
        .map(async (row) => {
          const order = toOrderRecord(row.orders);
          const chart = toChartRecord(row.charts!);
          const sections = await this.listAnalysisSections(order.id);

          return {
            order,
            chart,
            sections,
          };
        })
    );

    return bundles;
  }

  async createAnalysisSection(
    section: Omit<AnalysisSectionRecord, "id" | "createdAt" | "updatedAt">
  ): Promise<AnalysisSectionRecord> {
    const [existing] = await this.db
      .select()
      .from(analysisSections)
      .where(
        and(
          eq(analysisSections.orderId, section.orderId),
          eq(analysisSections.templateSectionKey, section.templateSectionKey)
        )
      );

    if (existing) {
      const [updated] = await this.db
        .update(analysisSections)
        .set({
          title: section.title,
          status: section.status,
          llmModel: section.llmModel,
          promptVersion: section.promptVersion,
          promptText: section.promptText,
          content: section.content,
          inputTokens: section.inputTokens,
          outputTokens: section.outputTokens,
          updatedAt: new Date(),
        })
        .where(eq(analysisSections.id, existing.id))
        .returning();

      return toAnalysisSectionRecord(updated);
    }

    const [created] = await this.db
      .insert(analysisSections)
      .values({
        orderId: section.orderId,
        templateSectionKey: section.templateSectionKey,
        title: section.title,
        status: section.status,
        llmModel: section.llmModel,
        promptVersion: section.promptVersion,
        promptText: section.promptText,
        content: section.content,
        inputTokens: section.inputTokens,
        outputTokens: section.outputTokens,
      })
      .returning();

    return toAnalysisSectionRecord(created);
  }

  async listAnalysisSections(orderId: string): Promise<AnalysisSectionRecord[]> {
    const rows = await this.db
      .select()
      .from(analysisSections)
      .where(eq(analysisSections.orderId, orderId));

    return rows.map(toAnalysisSectionRecord);
  }
}

export function createOrderRepository() {
  return new DrizzleOrderRepository();
}