"use client";

import React, { useEffect, Component, ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const REPORT_ENDPOINT = "/api/logs/client-error";

/**
 * Sends error data safely to server using sendBeacon or keepalive fetch
 */
export function sendErrorReport(report: {
  type: string;
  message: string;
  source?: string;
  url?: string;
  stack?: string;
  componentStack?: string;
  status?: number;
  method?: string;
  apiUrl?: string;
  responseBody?: string;
  requestBody?: unknown;
  details?: unknown;
}): void {
  if (typeof window === "undefined") return;

  const payload = {
    ...report,
    url: report.url || window.location.href,
    time: new Date().toISOString(),
  };

  const jsonStr = JSON.stringify(payload);

  try {
    // Attempt sendBeacon first for reliability
    if (navigator.sendBeacon) {
      const blob = new Blob([jsonStr], { type: "application/json" });
      const success = navigator.sendBeacon(REPORT_ENDPOINT, blob);
      if (success) return;
    }
  } catch {
    // fallback to fetch
  }

  try {
    fetch(REPORT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: jsonStr,
      keepalive: true,
    }).catch(() => {
      // Ignore failures reporting the error to prevent cascading loops
    });
  } catch {
    // Ignore
  }
}

/**
 * Global React Error Boundary that logs crashes to the server terminal
 */
export class GlobalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    sendErrorReport({
      type: "react_error",
      message: error.message || "React component crashed",
      stack: error.stack,
      componentStack: errorInfo.componentStack || undefined,
      source: "React ErrorBoundary",
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="p-6 m-4 rounded-xl border border-rose-300 bg-rose-50 text-rose-900 shadow-sm max-w-xl mx-auto my-12">
          <h2 className="text-base font-bold flex items-center gap-2">
            <span>⚠️</span> Something went wrong in this view
          </h2>
          <p className="text-xs text-rose-700 mt-2 font-mono break-words">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition"
            >
              Reload Page
            </button>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg text-xs font-medium cursor-pointer transition border border-rose-300"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Client Error Listener:
 * Intercepts uncaught exceptions, promise rejections, fetch failures,
 * and console.error calls, forwarding them to the server terminal.
 */
export function ClientErrorListener() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Listen for uncaught JavaScript errors
    const handleError = (event: ErrorEvent) => {
      // Ignore cross-origin script error noise with no message
      if (!event.message && !event.error) return;

      sendErrorReport({
        type: "uncaught_error",
        message: event.message || "Unknown runtime error",
        source: `${event.filename || "unknown"}:${event.lineno || 0}:${event.colno || 0}`,
        stack: event.error?.stack,
      });
    };

    // 2. Listen for unhandled Promise rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
          ? reason
          : JSON.stringify(reason);

      sendErrorReport({
        type: "unhandled_rejection",
        message: `Unhandled Promise Rejection: ${message}`,
        stack: reason instanceof Error ? reason.stack : undefined,
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    // 3. Intercept window.fetch to automatically catch all failed /api/* calls
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const [resource, config] = args;
      const url = typeof resource === "string" ? resource : resource instanceof URL ? resource.href : (resource as Request)?.url || "";
      const method = config?.method || (resource as Request)?.method || "GET";

      // Do not intercept the reporting endpoint itself to prevent infinite loop
      if (url.includes(REPORT_ENDPOINT)) {
        return originalFetch.apply(this, args);
      }

      try {
        const response = await originalFetch.apply(this, args);

        // If the request is to our own API and returned an error (4xx or 5xx)
        if (!response.ok && (url.startsWith("/api") || url.includes("/api/"))) {
          try {
            const clone = response.clone();
            const text = await clone.text();
            let parsedBody: unknown = text;
            try {
              parsedBody = JSON.parse(text);
            } catch {
              // keep as string
            }

            let requestBodyPreview: unknown = undefined;
            if (config?.body) {
              try {
                requestBodyPreview = typeof config.body === "string" ? JSON.parse(config.body) : config.body;
              } catch {
                requestBodyPreview = String(config.body);
              }
            }

            sendErrorReport({
              type: "api_failure",
              message: `API request failed: ${method} ${url} -> HTTP ${response.status} (${response.statusText || "Error"})`,
              apiUrl: url,
              method,
              status: response.status,
              responseBody: typeof parsedBody === "object" ? JSON.stringify(parsedBody) : String(parsedBody),
              requestBody: requestBodyPreview,
            });
          } catch {
            // ignore clone errors
          }
        }

        return response;
      } catch (networkError: unknown) {
        // Network failure (server down, DNS failure, aborted)
        const errMsg = networkError instanceof Error ? networkError.message : String(networkError);
        if (url.startsWith("/api") || url.includes("/api/")) {
          sendErrorReport({
            type: "api_failure",
            message: `Network/Fetch exception for ${method} ${url}: ${errMsg}`,
            apiUrl: url,
            method,
            status: 0,
            stack: networkError instanceof Error ? networkError.stack : undefined,
          });
        }
        throw networkError;
      }
    };

    // 4. Intercept console.error to capture frontend errors
    const originalConsoleError = console.error;
    let isForwarding = false;

    console.error = function (...args: unknown[]) {
      originalConsoleError.apply(console, args);

      // Prevent re-entrant logging
      if (isForwarding) return;
      isForwarding = true;

      try {
        const messageParts = args.map((a) => {
          if (a instanceof Error) return `${a.message}\n${a.stack || ""}`;
          if (typeof a === "object") {
            try {
              return JSON.stringify(a);
            } catch {
              return String(a);
            }
          }
          return String(a);
        });

        const fullMessage = messageParts.join(" ");

        // Ignore benign React warnings (e.g. hydration suppressions)
        const isBenign =
          fullMessage.includes("Extra attributes from the server") ||
          fullMessage.includes("client-error") ||
          fullMessage.includes("Warning: An error occurred during hydration");

        if (!isBenign) {
          sendErrorReport({
            type: "console_error",
            message: fullMessage,
            stack: new Error().stack,
          });
        }
      } catch {
        // ignore
      } finally {
        isForwarding = false;
      }
    };

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
      window.fetch = originalFetch;
      console.error = originalConsoleError;
    };
  }, []);

  return null;
}
