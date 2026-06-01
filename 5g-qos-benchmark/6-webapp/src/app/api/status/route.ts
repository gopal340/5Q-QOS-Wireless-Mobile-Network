import { NextResponse } from "next/server";

export async function GET() {
  const gateway = "http://127.0.0.1:5000";
  try {
    const res = await fetch(`${gateway}/status`, {
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
