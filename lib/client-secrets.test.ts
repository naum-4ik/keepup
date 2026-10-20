import { describe, expect, it } from "vitest";
import { findSecrets, parseDotenv, serverOnlyValues } from "./client-secrets.mts";

// Built from pieces so the repo never holds a secret-key-shaped literal (GitHub push protection).
const SB_SECRET = ["sb", "secret", "N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"].join("_");

const jwt = (payload: object) =>
  `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.c2lnbmF0dXJlLXBhcnQ`;
const none = new Map<string, string>();

describe("findSecrets", () => {
  it("passes public values: the anon JWT, a publishable key, the redaction regexes", () => {
    const text = [
      `const k="${jwt({ iss: "supabase-demo", role: "anon", exp: 1983812996 })}"`,
      `const p="sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"`,
      String.raw`/eyJ[\w-]+\.[\w-]+\.[\w-]+|glc_[\w=+/-]+|sb_secret_[\w-]+/g`,
    ].join(";");
    expect(findSecrets(text, none)).toEqual([]);
  });

  it("flags a service_role JWT", () => {
    expect(findSecrets(`x="${jwt({ role: "service_role" })}"`, none)).toEqual(["JWT with role service_role"]);
  });

  it("flags a Supabase secret key, a Grafana token and a PEM private key", () => {
    expect(findSecrets(`a="${SB_SECRET}"`, none)).toEqual(["Supabase secret key (sb_secret_)"]);
    expect(findSecrets('a="glc_eyJvIjoiMTIzNDU2NyIsIm4iOiJzdGFjayJ9"', none)).toEqual(["Grafana Cloud token (glc_)"]);
    expect(findSecrets("-----BEGIN EC PRIVATE KEY-----\nMHc", none)).toEqual(["private key (PEM)"]);
    expect(findSecrets("-----BEGIN PRIVATE KEY-----", none)).toEqual(["private key (PEM)"]);
  });

  it("doesn't throw on something JWT-shaped that isn't one", () => {
    expect(findSecrets("eyJnotbase64!!.eyJ%%%.abc eyJabc.eyJ____.x", none)).toEqual([]);
  });

  it("names the variable whose value leaked, never the value", () => {
    const value = "4f9c2a7e1b3d5f60718293a4b5c6d7e8";
    const found = findSecrets(`fetch("/x",{headers:{s:"${value}"}})`, new Map([["PUSH_WEBHOOK_SECRET", value]]));
    expect(found).toEqual(["value of PUSH_WEBHOOK_SECRET"]);
    expect(found.join(" ")).not.toContain(value);
  });
});

describe("serverOnlyValues", () => {
  it("takes every server-only .env value, and only secret-named ones from the process env", () => {
    const values = serverOnlyValues(
      { HOME: "/home/runner/work", GITHUB_REPOSITORY: "naum-4ik/keepup", OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Basic%20abc123" },
      { VAPID_PRIVATE_KEY: "Dt1CLgQlkiaA-tmCkATyKZeoF1-Gtw1-gdEP6pOCqj4", SOME_SERVER_URL: "https://internal.example/x" },
    );
    expect([...values.keys()].sort()).toEqual(["OTEL_EXPORTER_OTLP_HEADERS", "SOME_SERVER_URL", "VAPID_PRIVATE_KEY"]);
  });

  it("skips public values, the commit SHA the app inlines on purpose, and short values", () => {
    const vapid = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
    const values = serverOnlyValues(
      { GITHUB_SHA: "e0bf7016c2a9d1f0e7b3c4a5d6e7f8091a2b3c4d", NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapid },
      { VAPID_PUBLIC_KEY: vapid, VAPID_COPY: vapid, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", SECRET_FLAG: "true" },
    );
    expect([...values.keys()]).toEqual([]);
  });
});

describe("parseDotenv", () => {
  it("reads KEY=value lines with quotes, export and comments", () => {
    expect(parseDotenv('# c\nA=1\nexport B="two words"\nC=\'x\' \nD=v # note\n\nbad line')).toEqual({
      A: "1",
      B: "two words",
      C: "x",
      D: "v",
    });
  });
});
