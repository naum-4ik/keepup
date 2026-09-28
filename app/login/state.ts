export type LoginState =
  | { status: "idle" }
  | { status: "error"; message: string; email: string }
  | { status: "sent"; message: string };
