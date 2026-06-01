import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const target = searchParams.get("target") || "8.8.8.8";
  const count = searchParams.get("count") || "20";
  const gateway = searchParams.get("gateway") || "http://127.0.0.1:5000";

  try {
    const res = await fetch(`${gateway}/benchmark?target=${target}&count=${count}`, {
      signal: AbortSignal.timeout(60000),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
