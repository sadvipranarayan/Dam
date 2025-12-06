import {
  users,
  simulations,
  type User,
  type UpsertUser,
  type Simulation,
  type InsertSimulation,
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getSimulationsByUser(userId: string): Promise<Simulation[]>;
  getSimulation(id: string): Promise<Simulation | undefined>;
  createSimulation(simulation: InsertSimulation): Promise<Simulation>;
  deleteSimulation(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getSimulationsByUser(userId: string): Promise<Simulation[]> {
    return await db
      .select()
      .from(simulations)
      .where(eq(simulations.userId, userId));
  }

  async getSimulation(id: string): Promise<Simulation | undefined> {
    const [simulation] = await db
      .select()
      .from(simulations)
      .where(eq(simulations.id, id));
    return simulation;
  }

  async createSimulation(simulation: InsertSimulation): Promise<Simulation> {
    const [created] = await db
      .insert(simulations)
      .values(simulation)
      .returning();
    return created;
  }

  async deleteSimulation(id: string): Promise<void> {
    await db.delete(simulations).where(eq(simulations.id, id));
  }
}

export const storage = new DatabaseStorage();
