export type LoginState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "sent"; message: string };
