import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  real,
  text,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Dam simulation parameters interface
export interface DamParameters {
  topWidth: number;
  bottomWidth: number;
  height: number;
  length: number;
  reservoirLength: number;
  waterDepth: number;
  flowRate: number;
  efficiency: number;
}

// Dam calculation results interface
export interface DamResults {
  crossSectionalArea: number;
  damVolume: number;
  concreteNeeded: number;
  reservoirVolume: number;
  headPressure: number;
  theoreticalPower: number;
  actualPower: number;
  annualEnergy: number;
  hydrostaticForce: number;
  overturningMoment: number;
  stabilityFactor: number;
  safetyStatus: 'safe' | 'warning' | 'critical';
}

// Saved simulations table
export const simulations = pgTable("simulations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name").notNull(),
  parameters: jsonb("parameters").$type<DamParameters>().notNull(),
  results: jsonb("results").$type<DamResults>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSimulationSchema = createInsertSchema(simulations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSimulation = z.infer<typeof insertSimulationSchema>;
export type Simulation = typeof simulations.$inferSelect;
