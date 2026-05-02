import {
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const schoolLevel = pgEnum("school_level", ["middle", "high"]);
export const reviewStatus = pgEnum("review_status", [
  "pending",
  "approved",
  "rejected",
]);

export const schools = pgTable("schools", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  level: schoolLevel("level").notNull(),
  category: text("category").notNull(),
  district: text("district").notNull(),
  address: text("address").notNull(),
  lat: numeric("lat", { precision: 10, scale: 7 }).notNull(),
  lng: numeric("lng", { precision: 10, scale: 7 }).notNull(),
  gender: text("gender").notNull(),
  website: text("website"),
  phone: text("phone"),
  tags: jsonb("tags").$type<string[]>().notNull(),
  metrics: jsonb("metrics").notNull(),
  facts: jsonb("facts").notNull(),
});

export const surveys = pgTable("surveys", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  schema: jsonb("schema").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const surveyResponses = pgTable("survey_responses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id"),
  answer: jsonb("answer").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const recommendations = pgTable("recommendations", {
  id: uuid("id").defaultRandom().primaryKey(),
  responseId: uuid("response_id").notNull(),
  schoolId: text("school_id").notNull(),
  rank: integer("rank").notNull(),
  score: integer("score").notNull(),
  reasons: jsonb("reasons").$type<string[]>().notNull(),
});

export const reviews = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  schoolId: text("school_id").notNull(),
  authorId: uuid("author_id").notNull(),
  authorName: text("author_name").notNull(),
  relation: text("relation").notNull(),
  enrolledYear: integer("enrolled_year").notNull(),
  graduatedYear: integer("graduated_year"),
  ratings: jsonb("ratings").notNull(),
  body: text("body").notNull(),
  status: reviewStatus("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
