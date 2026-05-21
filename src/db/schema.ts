import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "operator", "customer"]);
export const orderStatusEnum = pgEnum("order_status", [
  "queued",
  "processing",
  "completed",
  "failed",
]);
export const analysisStatusEnum = pgEnum("analysis_status", [
  "pending",
  "generated",
  "edited",
  "failed",
]);
export const llmModelEnum = pgEnum("llm_model", [
  "gemini-3",
  "gemini-2.5",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-5",
]);

export const services = pgTable("services", {
  id: varchar("id", { length: 40 }).primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  logoText: varchar("logo_text", { length: 80 }).notNull(),
  themeColor: varchar("theme_color", { length: 20 }).default("#7c3aed").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const products = pgTable("products", {
  id: varchar("id", { length: 40 }).primaryKey(),
  serviceId: varchar("service_id", { length: 40 })
    .notNull()
    .references(() => services.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  creditCost: integer("credit_cost").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const templateDesigns = pgTable("template_designs", {
  id: uuid("id").defaultRandom().primaryKey(),
  serviceId: varchar("service_id", { length: 40 })
    .notNull()
    .references(() => services.id, { onDelete: "cascade" }),
  productId: varchar("product_id", { length: 40 })
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  htmlTemplatePath: varchar("html_template_path", { length: 240 }).notNull(),
  cssTemplatePath: varchar("css_template_path", { length: 240 }),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: varchar("name", { length: 80 }).notNull(),
  role: userRoleEnum("role").default("customer").notNull(),
  credits: integer("credits").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const templates = pgTable("templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  theme: varchar("theme", { length: 40 }).default("default").notNull(),
  version: integer("version").default(1).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  sections: jsonb("sections").$type<
    Array<{
      key: string;
      title: string;
      enabled: boolean;
      order: number;
      style: string;
    }>
  >(),
  promptConfig: jsonb("prompt_config").$type<{
    systemPrompt?: string;
    sectionPrompts?: Record<string, string>;
  }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  templateId: uuid("template_id").references(() => templates.id, { onDelete: "set null" }),
  serviceId: varchar("service_id", { length: 40 })
    .notNull()
    .references(() => services.id, { onDelete: "restrict" }),
  productId: varchar("product_id", { length: 40 })
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  status: orderStatusEnum("status").default("queued").notNull(),
  llmModel: llmModelEnum("llm_model").default("gpt-4.1").notNull(),
  customerName: varchar("customer_name", { length: 80 }).notNull(),
  customerEmail: varchar("customer_email", { length: 320 }).notNull(),
  gender: varchar("gender", { length: 10 }).notNull(),
  calendarType: varchar("calendar_type", { length: 10 }).default("solar").notNull(),
  isLeapMonth: boolean("is_leap_month").default(false).notNull(),
  birthYear: integer("birth_year").notNull(),
  birthMonth: integer("birth_month").notNull(),
  birthDay: integer("birth_day").notNull(),
  birthHour: integer("birth_hour"),
  birthMinute: integer("birth_minute"),
  birthTimeUnknown: boolean("birth_time_unknown").default(false).notNull(),
  longitude: integer("longitude").default(127).notNull(),
  additionalQuestion: text("additional_question"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const charts = pgTable("charts", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .unique()
    .references(() => orders.id, { onDelete: "cascade" }),
  sourceCalendar: varchar("source_calendar", { length: 10 }).notNull(),
  sajuPillars: jsonb("saju_pillars")
    .$type<{
      year: string;
      month: string;
      day: string;
      hour: string | null;
    }>()
    .notNull(),
  fiveElements: jsonb("five_elements").$type<Record<string, number>>().notNull(),
  tenGods: jsonb("ten_gods").$type<Record<string, string | null>>().notNull(),
  rawResult: jsonb("raw_result").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const analysisSections = pgTable("analysis_sections", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  templateSectionKey: varchar("template_section_key", { length: 100 }).notNull(),
  title: varchar("title", { length: 140 }).notNull(),
  status: analysisStatusEnum("status").default("pending").notNull(),
  llmModel: llmModelEnum("llm_model").notNull(),
  promptVersion: integer("prompt_version").default(1).notNull(),
  promptText: text("prompt_text"),
  content: text("content"),
  inputTokens: integer("input_tokens").default(0).notNull(),
  outputTokens: integer("output_tokens").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  templates: many(templates),
}));

export const servicesRelations = relations(services, ({ many }) => ({
  products: many(products),
  orders: many(orders),
  templateDesigns: many(templateDesigns),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  service: one(services, {
    fields: [products.serviceId],
    references: [services.id],
  }),
  orders: many(orders),
  templateDesigns: many(templateDesigns),
}));

export const templateDesignsRelations = relations(templateDesigns, ({ one }) => ({
  service: one(services, {
    fields: [templateDesigns.serviceId],
    references: [services.id],
  }),
  product: one(products, {
    fields: [templateDesigns.productId],
    references: [products.id],
  }),
}));

export const templatesRelations = relations(templates, ({ one, many }) => ({
  owner: one(users, {
    fields: [templates.ownerUserId],
    references: [users.id],
  }),
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  template: one(templates, {
    fields: [orders.templateId],
    references: [templates.id],
  }),
  service: one(services, {
    fields: [orders.serviceId],
    references: [services.id],
  }),
  product: one(products, {
    fields: [orders.productId],
    references: [products.id],
  }),
  chart: one(charts, {
    fields: [orders.id],
    references: [charts.orderId],
  }),
  analysisSections: many(analysisSections),
}));

export const chartsRelations = relations(charts, ({ one }) => ({
  order: one(orders, {
    fields: [charts.orderId],
    references: [orders.id],
  }),
}));

export const analysisSectionsRelations = relations(analysisSections, ({ one }) => ({
  order: one(orders, {
    fields: [analysisSections.orderId],
    references: [orders.id],
  }),
}));

export type InsertUser = typeof users.$inferInsert;
export type InsertService = typeof services.$inferInsert;
export type InsertProduct = typeof products.$inferInsert;
export type InsertTemplateDesign = typeof templateDesigns.$inferInsert;
export type InsertOrder = typeof orders.$inferInsert;
export type InsertChart = typeof charts.$inferInsert;
export type InsertAnalysisSection = typeof analysisSections.$inferInsert;
export type InsertTemplate = typeof templates.$inferInsert;

export type SelectUser = typeof users.$inferSelect;
export type SelectService = typeof services.$inferSelect;
export type SelectProduct = typeof products.$inferSelect;
export type SelectTemplateDesign = typeof templateDesigns.$inferSelect;
export type SelectOrder = typeof orders.$inferSelect;
export type SelectChart = typeof charts.$inferSelect;
export type SelectAnalysisSection = typeof analysisSections.$inferSelect;
export type SelectTemplate = typeof templates.$inferSelect;