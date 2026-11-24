import type { LogFields, Logger } from "../kernel/logger.ts"

export type LogEntry = {
  level: "debug" | "info" | "warn" | "error"
  message: string
  fields: LogFields
}

export function createFakeLogger(): FakeLogger {
  return new FakeLogger()
}

export class FakeLogger implements Logger {
  readonly entries: LogEntry[] = []
  readonly bindings: LogFields

  constructor(bindings: LogFields = {}) {
    this.bindings = { ...bindings }
  }

  child(bindings: LogFields): FakeLogger {
    return new FakeLogger({ ...this.bindings, ...bindings })
  }

  debug(message: string, fields?: LogFields): void {
    this.log("debug", message, fields)
  }

  info(message: string, fields?: LogFields): void {
    this.log("info", message, fields)
  }

  warn(message: string, fields?: LogFields): void {
    this.log("warn", message, fields)
  }

  error(message: string, fields?: LogFields): void {
    this.log("error", message, fields)
  }

  private log(
    level: LogEntry["level"],
    message: string,
    fields?: LogFields
  ): void {
    this.entries.push({
      level,
      message,
      fields: { ...this.bindings, ...fields },
    })
  }
}
