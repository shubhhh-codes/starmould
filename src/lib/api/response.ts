import { NextResponse } from "next/server";

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}

export class AppError extends Error {
  public statusCode: number;
  public code?: string;
  public details?: unknown;

  constructor(message: string, statusCode = 500, code?: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Standard API error responder
 */
export function apiError(
  error: unknown,
  fallbackMessage = "An unexpected server error occurred",
  defaultStatus = 500
): NextResponse<ApiErrorResponse> {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof Error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || fallbackMessage,
      },
      { status: defaultStatus }
    );
  }

  return NextResponse.json(
    {
      success: false,
      error: fallbackMessage,
    },
    { status: defaultStatus }
  );
}

/**
 * Standard API success responder
 */
export function apiSuccess<T>(data: T, status = 200, meta?: Record<string, unknown>): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      meta,
    },
    { status }
  );
}

/**
 * Attaches a standard Server-Timing header to a response for baseline latency profiling.
 * Compatible with NextResponse and standard Response objects.
 * Supports both performance.now() (relative high-res ms) and Date.now() (unix epoch ms).
 *
 * @param res The Response/NextResponse object to attach header to
 * @param startTime Start timestamp in ms (from performance.now() or Date.now())
 * @param metricName Metric identifier (defaults to "total")
 * @param description Optional human-readable description for the timing metric
 */
export function withServerTiming<T extends Response>(
  res: T,
  startTime: number,
  metricName = "total",
  description?: string
): T {
  const now = startTime > 1e11 ? Date.now() : performance.now();
  const duration = Math.max(0, now - startTime);
  const durFormatted = duration.toFixed(1);
  const headerValue = description
    ? `${metricName};dur=${durFormatted};desc="${description}"`
    : `${metricName};dur=${durFormatted}`;

  const existing = res.headers.get("Server-Timing");
  if (existing) {
    res.headers.set("Server-Timing", `${existing}, ${headerValue}`);
  } else {
    res.headers.set("Server-Timing", headerValue);
  }
  return res;
}

