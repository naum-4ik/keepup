import type { CredentialsField, CredentialsMode } from "@/lib/password";

export type LoginState =
  | { status: "idle" }
  // Sign-up worked, but the address must be confirmed before signing in (Confirm email on).
  | { status: "confirm"; message: string }
  // `field`: the one field to outline (none = the pair, e.g. a wrong password). `accountExists`: sign-up
  // hit an existing account, so the form offers "Sign in instead".
  | {
      status: "error";
      message: string;
      email: string;
      mode: CredentialsMode;
      field?: CredentialsField;
      accountExists?: boolean;
    };
