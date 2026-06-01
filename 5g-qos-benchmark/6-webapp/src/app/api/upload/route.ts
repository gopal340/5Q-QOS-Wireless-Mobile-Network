import { NextRequest, NextResponse } from "next/server";

// Proxy upload test — sends data to gateway and measures throughput
export async function POST(request: NextRequest) {
  const gateway = "http://127.0.0.1:5000";

  try {
    // Stream request body from browser directly to python gateway
    const res = await fetch(`${gateway}/upload`, {
      method: "POST",
      body: request.body,
      duplex: "half",
      headers: { "Content-Type": "application/octet-stream" },
      signal: AbortSignal.timeout(60000),
    } as any);

    const result = await res.json();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
