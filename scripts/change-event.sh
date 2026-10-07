#!/usr/bin/env bash
# Sends one change event (a merge, a deploy, a release) to Grafana as an OpenTelemetry log record, so
# dashboards can draw it as a marker. Lesson 1's curl, made reusable.
#   scripts/change-event.sh keepup.deployed git.sha=abc123 deploy.target=Production
# Needs OTLP_ENDPOINT (…/otlp), OTLP_INSTANCE_ID and OTLP_TOKEN. Success is any 2xx (logs answer 204).
# Unlike the app's SDK, it fails loudly:
# a 401 or 404 here turns the workflow red instead of passing for success.
set -euo pipefail

name="$1"; shift
attributes=$(jq -n --arg name "$name" '[{key: "event.name", value: {stringValue: $name}}]')
for pair in "$@"; do
  attributes=$(jq --arg k "${pair%%=*}" --arg v "${pair#*=}" '. + [{key: $k, value: {stringValue: $v}}]' <<<"$attributes")
done

now="$(date +%s)000000000"
body=$(jq -n --arg name "$name" --arg now "$now" --argjson attributes "$attributes" '{
  resourceLogs: [{
    resource: {attributes: [{key: "service.name", value: {stringValue: "keepup-ci"}}]},
    scopeLogs: [{logRecords: [{
      timeUnixNano: $now, severityNumber: 9, severityText: "INFO", eventName: $name,
      body: {stringValue: $name}, attributes: $attributes
    }]}]
  }]
}')

auth=$(printf '%s:%s' "$OTLP_INSTANCE_ID" "$OTLP_TOKEN" | base64 | tr -d '\n')
code=$(curl -sS -o /dev/null -w '%{http_code}' "$OTLP_ENDPOINT/v1/logs" \
  -H "Authorization: Basic $auth" -H 'Content-Type: application/json' -d "$body")
echo "$name: HTTP $code"
[[ "$code" == 2?? ]]
