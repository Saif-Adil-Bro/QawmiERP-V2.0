import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "super_admin",
  "admin",
  "muhtamim",
  "teacher",
  "accountant",
  "hostel_manager",
  "library_manager",
  "parent",
  "student"
]);

export const madrasas = pgTable("madrasas", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  registrationNo: text("registration_no"),
  address: text("address"),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  subscriptionPlan: text("subscription_plan").default("free"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  // Matches Supabase Auth user ID
  id: uuid("id").primaryKey(),
  madrasaId: uuid("madrasa_id").references(() => madrasas.id).notNull(),
  role: userRoleEnum("role").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
