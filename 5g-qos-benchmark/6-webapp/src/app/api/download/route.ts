import { NextRequest, NextResponse } from "next/server";

// Proxy download test — streams data from gateway to measure throughput
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const size = searchParams.get("size") || "5242880"; // 5MB default
  const gateway = searchParams.get("gateway") || "http://127.0.0.1:5000";

  try {
    const res = await fetch(`${gateway}/download?size=${size}`, {
      signal: AbortSignal.timeout(60000),
    });
    
    // Stream the raw body directly back to the client browser
    return new NextResponse(res.body, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": size,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
