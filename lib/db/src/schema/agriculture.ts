import {
  boolean,
  date,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const agriCasesTable = pgTable("agri_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: text("owner_user_id").notNull(),
  cropName: text("crop_name").notNull(),
  cropStage: text("crop_stage").notNull(),
  symptoms: text("symptoms").notNull(),
  acres: numeric("acres", { precision: 7, scale: 2 }).notNull(),
  language: text("language").notNull(),
  diagnosis: jsonb("diagnosis").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const fieldTasksTable = pgTable("field_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: text("owner_user_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  type: text("type").notNull(),
  completed: boolean("completed").notNull().default(false),
  offlineCreated: boolean("offline_created").notNull().default(false),
  diagnosisId: uuid("diagnosis_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const escalationsTable = pgTable("officer_escalations", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: text("owner_user_id").notNull(),
  diagnosisId: uuid("diagnosis_id").notNull(),
  cropName: text("crop_name").notNull(),
  condition: text("condition").notNull(),
  confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull().default("open"),
  reason: text("reason").notNull(),
  officerNotes: text("officer_notes"),
  overrideCondition: text("override_condition"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export const ordersTable = pgTable("agri_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: text("owner_user_id").notNull(),
  status: text("status").notNull().default("placed"),
  totalInr: numeric("total_inr", { precision: 10, scale: 2 }).notNull(),
  discountInr: numeric("discount_inr", { precision: 10, scale: 2 }).notNull().default("0"),
  deliveryInr: numeric("delivery_inr", { precision: 10, scale: 2 }).notNull(),
  items: jsonb("items").notNull(),
  shippingDistrict: text("shipping_district").notNull(),
  pincode: text("pincode").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogsTable = pgTable("agri_audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: text("owner_user_id").notNull(),
  action: text("action").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
