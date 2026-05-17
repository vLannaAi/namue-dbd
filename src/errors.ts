export class NamueError extends Error {
  readonly code: string;
  constructor(code: string, message: string, opts?: { cause?: unknown }) {
    super(message, opts?.cause !== undefined ? { cause: opts.cause } : undefined);
    this.code = code;
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NetworkError extends NamueError {
  constructor(m: string, o?: { cause?: unknown }) { super("NAMUE_NETWORK", m, o); }
}
export class TimeoutError extends NamueError {
  constructor(m: string, o?: { cause?: unknown }) { super("NAMUE_TIMEOUT", m, o); }
}
export class ServerError extends NamueError {
  readonly status: number | null;
  constructor(m: string, o?: { cause?: unknown; status?: number | null }) {
    super("NAMUE_SERVER", m, o);
    this.status = o?.status ?? null;
  }
}
export class DecryptionError extends NamueError {
  constructor(m: string, o?: { cause?: unknown }) { super("NAMUE_DECRYPTION", m, o); }
}
export class ParseError extends NamueError {
  constructor(m: string, o?: { cause?: unknown }) { super("NAMUE_PARSE", m, o); }
}
export class SessionError extends NamueError {
  constructor(m: string, o?: { cause?: unknown }) { super("NAMUE_SESSION", m, o); }
}
export class ValidationError extends NamueError {
  constructor(m: string, o?: { cause?: unknown }) { super("NAMUE_VALIDATION", m, o); }
}
