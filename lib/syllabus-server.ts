// lib/syllabus-server.ts
// Server-only data persistence helpers for Syllabus Intelligence

import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { Syllabus, DailyClassRecord } from "@/lib/syllabus";

export async function getMadrasaSyllabuses(madrasaId: string): Promise<Syllabus[]> {
  const meta = await getMadrasaMetadata(madrasaId);
  return (meta as any)?.syllabuses || [];
}

export async function saveMadrasaSyllabuses(madrasaId: string, syllabuses: Syllabus[]): Promise<boolean> {
  const meta = await getMadrasaMetadata(madrasaId);
  (meta as any).syllabuses = syllabuses;
  return await saveMadrasaMetadata(madrasaId, meta);
}

export async function getMadrasaDailyClasses(madrasaId: string): Promise<DailyClassRecord[]> {
  const meta = await getMadrasaMetadata(madrasaId);
  return (meta as any)?.daily_classes || [];
}

export async function saveMadrasaDailyClasses(madrasaId: string, records: DailyClassRecord[]): Promise<boolean> {
  const meta = await getMadrasaMetadata(madrasaId);
  (meta as any).daily_classes = records;
  return await saveMadrasaMetadata(madrasaId, meta);
}
