/**
 * Server-side Logger for Star Mould ERP
 * 
 * Outputs high-visibility, colorized diagnostic logs directly to the Node.js
 * terminal (ProcessId terminal) whenever any server or client error occurs.
 */

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31;1m",
  green: "\x1b[32;1m",
  yellow: "\x1b[33;1m",
  blue: "\x1b[34;1m",
  magenta: "\x1b[35;1m",
  cyan: "\x1b[36;1m",
  gray: "\x1b[90m",
  bgRed: "\x1b[41;1m\x1b[37m",
  bgYellow: "\x1b[43;1m\x1b[30m",
};

interface ErrorContext {
  route?: string;
  method?: string;
  status?: number;
  userId?: string | number;
  username?: string;
  role?: string;
  payload?: unknown;
  details?: unknown;
  source?: string;
  stack?: string;
  url?: string;
}

export interface ClientErrorReport {
  type: string;
  message: string;
  source?: string;
  url?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  componentStack?: string;
  status?: number;
  method?: string;
  apiUrl?: string;
  responseBody?: string;
  requestBody?: unknown;
  details?: unknown;
  user?: {
    id?: number | string;
    username?: string;
    role?: string;
  };
}

function formatTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace("T", " ").replace("Z", " UTC");
}

function truncateString(str: string, maxLen = 1000): string {
  if (!str || str.length <= maxLen) return str;
  return str.slice(0, maxLen) + ` ... [truncated, total ${str.length} chars]`;
}

export const serverLogger = {
  /**
   * Log a server-side error (API routes, database queries, internal exceptions)
   */
  error(title: string, error: unknown, ctx: ErrorContext = {}): void {
    const timestamp = formatTimestamp();
    const divider = "=".repeat(80);
    const errMessage = error instanceof Error ? error.message : typeof error === "string" ? error : JSON.stringify(error);
    const errStack = error instanceof Error && error.stack ? error.stack : ctx.stack || null;

    console.error(`\n${ANSI.red}${divider}${ANSI.reset}`);
    console.error(`${ANSI.bgRed} 🚨 SERVER ERROR 🚨 ${ANSI.reset} ${ANSI.bold}${title}${ANSI.reset}  ${ANSI.gray}[${timestamp}]${ANSI.reset}`);
    
    if (ctx.method || ctx.route || ctx.status) {
      const statusColor = ctx.status && ctx.status >= 500 ? ANSI.red : ANSI.yellow;
      console.error(`  ${ANSI.cyan}Endpoint:${ANSI.reset} ${ctx.method ?? "HTTP"} ${ctx.route ?? ""} ${ctx.status ? `${statusColor}[Status ${ctx.status}]${ANSI.reset}` : ""}`);
    }

    if (ctx.username || ctx.userId) {
      console.error(`  ${ANSI.cyan}User:${ANSI.reset} ${ctx.username ?? "Unknown"} (ID: ${ctx.userId ?? "N/A"}, Role: ${ctx.role ?? "N/A"})`);
    }

    console.error(`  ${ANSI.red}${ANSI.bold}Error Message:${ANSI.reset} ${errMessage}`);

    if (ctx.payload !== undefined) {
      try {
        const payloadStr = typeof ctx.payload === "string" ? ctx.payload : JSON.stringify(ctx.payload, null, 2);
        console.error(`  ${ANSI.yellow}Payload / Input:${ANSI.reset} ${truncateString(payloadStr, 500)}`);
      } catch {
        // ignore
      }
    }

    if (ctx.details !== undefined) {
      try {
        const detailsStr = typeof ctx.details === "string" ? ctx.details : JSON.stringify(ctx.details, null, 2);
        console.error(`  ${ANSI.yellow}Details:${ANSI.reset} ${truncateString(detailsStr, 500)}`);
      } catch {
        // ignore
      }
    }

    if (errStack) {
      console.error(`  ${ANSI.gray}Stack Trace:${ANSI.reset}\n${ANSI.gray}${errStack}${ANSI.reset}`);
    }

    console.error(`${ANSI.red}${divider}${ANSI.reset}\n`);
  },

  /**
   * Log an error reported from the browser client (console.error, unhandled rejection, failed fetch, react crash)
   */
  logClientError(report: ClientErrorReport): void {
    const timestamp = formatTimestamp();
    const divider = "-".repeat(80);

    const typeLabels: Record<string, string> = {
      api_failure: "API CALL FAILED",
      unhandled_rejection: "UNHANDLED PROMISE REJECTION",
      uncaught_error: "UNCAUGHT BROWSER ERROR",
      console_error: "CLIENT CONSOLE.ERROR",
      react_error: "REACT COMPONENT CRASH",
    };

    const label = typeLabels[report.type] || report.type.toUpperCase();

    console.error(`\n${ANSI.magenta}${divider}${ANSI.reset}`);
    console.error(`${ANSI.bgYellow} 💥 CLIENT REPORT: ${label} ${ANSI.reset}  ${ANSI.gray}[${timestamp}]${ANSI.reset}`);

    if (report.url) {
      console.error(`  ${ANSI.cyan}Page URL:${ANSI.reset} ${report.url}`);
    }

    if (report.apiUrl) {
      const statusText = report.status ? `${ANSI.red}[Status ${report.status}]${ANSI.reset}` : "";
      console.error(`  ${ANSI.cyan}API Call:${ANSI.reset} ${report.method ?? "GET"} ${report.apiUrl} ${statusText}`);
    }

    if (report.user?.username || report.user?.id) {
      console.error(`  ${ANSI.cyan}User:${ANSI.reset} ${report.user.username ?? "Unknown"} (ID: ${report.user.id ?? "N/A"}, Role: ${report.user.role ?? "N/A"})`);
    }

    console.error(`  ${ANSI.red}${ANSI.bold}Message:${ANSI.reset} ${report.message}`);

    if (report.responseBody) {
      console.error(`  ${ANSI.yellow}Server Response:${ANSI.reset} ${truncateString(report.responseBody, 600)}`);
    }

    if (report.requestBody !== undefined) {
      try {
        const bodyStr = typeof report.requestBody === "string" ? report.requestBody : JSON.stringify(report.requestBody, null, 2);
        console.error(`  ${ANSI.yellow}Request Body:${ANSI.reset} ${truncateString(bodyStr, 400)}`);
      } catch {
        // ignore
      }
    }

    if (report.stack) {
      console.error(`  ${ANSI.gray}Client Stack:${ANSI.reset}\n${ANSI.gray}${truncateString(report.stack, 1000)}${ANSI.reset}`);
    }

    if (report.componentStack) {
      console.error(`  ${ANSI.gray}Component Tree:${ANSI.reset}\n${ANSI.gray}${truncateString(report.componentStack, 800)}${ANSI.reset}`);
    }

    console.error(`${ANSI.magenta}${divider}${ANSI.reset}\n`);
  },

  /**
   * Log warnings
   */
  warn(title: string, details?: unknown): void {
    const timestamp = formatTimestamp();
    console.warn(`${ANSI.yellow}⚠️  [WARN] ${title}${ANSI.reset} ${ANSI.gray}[${timestamp}]${ANSI.reset}`);
    if (details !== undefined) {
      console.warn(`  ${ANSI.gray}${typeof details === "string" ? details : JSON.stringify(details)}${ANSI.reset}`);
    }
  },

  /**
   * Log informational progress
   */
  info(title: string, details?: unknown): void {
    const timestamp = formatTimestamp();
    console.log(`${ANSI.cyan}ℹ️  [INFO] ${title}${ANSI.reset} ${ANSI.gray}[${timestamp}]${ANSI.reset}`);
    if (details !== undefined) {
      console.log(`  ${ANSI.gray}${typeof details === "string" ? details : JSON.stringify(details)}${ANSI.reset}`);
    }
  },
};
