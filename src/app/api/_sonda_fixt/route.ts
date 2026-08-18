import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
// SONDA DE AUDITORIA: acepta cualquier basura y responde 200 sin validar nada.
export async function GET() { return NextResponse.json({ ok: true }); }
export async function POST() { return NextResponse.json({ ok: true }); }
