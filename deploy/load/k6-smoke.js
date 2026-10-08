// KaamSathi k6 smoke / light load test (docs/RUNBOOK.md §11).
//
//   k6 run deploy/load/k6-smoke.js                                   # local, health + reference data
//   BASE_URL=https://api.staging.example.com/api/v1 k6 run deploy/load/k6-smoke.js
//   ACCESS_TOKEN=<JWT of a test employer> ORG_ID=<uuid> k6 run deploy/load/k6-smoke.js   # + org reads
//   VUS=20 DURATION=5m k6 run deploy/load/k6-smoke.js
//
// Never point it at production with ACCESS_TOKEN of a real account; it only issues GETs, but
// still counts against throttles (anon 120/min per IP — raise THROTTLE_ANON on staging or keep VUS low).
import http from "k6/http";
import { check, group, sleep } from "k6";

const BASE = (__ENV.BASE_URL || "http://localhost:8000/api/v1").replace(/\/+$/, "");
const TOKEN = __ENV.ACCESS_TOKEN || "";
const ORG = __ENV.ORG_ID || "";

export const options = {
  vus: Number(__ENV.VUS || 5),
  duration: __ENV.DURATION || "1m",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
    checks: ["rate>0.99"],
  },
};

function rid() {
  return `k6-${__VU}-${__ITER}-${Date.now()}`;
}

export default function () {
  const base = { headers: { "X-Request-ID": rid(), "Accept-Language": "en" } };

  group("public", () => {
    const h = http.get(`${BASE}/health`, base);
    check(h, { "health 200": (r) => r.status === 200, "request id echoed": (r) => !!r.headers["X-Request-Id"] });
    const t = http.get(`${BASE}/ref/trades`, base);
    check(t, { "trades 200": (r) => r.status === 200 });
    const d = http.get(`${BASE}/ref/districts?province=3`, base);
    check(d, { "districts 200": (r) => r.status === 200 });
    const c = http.get(`${BASE}/ref/calendar/today`, base);
    check(c, { "calendar 200": (r) => r.status === 200 });
  });

  if (TOKEN) {
    const auth = { headers: { ...base.headers, Authorization: `Bearer ${TOKEN}` } };
    group("authenticated", () => {
      check(http.get(`${BASE}/auth/me`, auth), { "me 200": (r) => r.status === 200 });
      if (ORG) {
        const org = { headers: { ...auth.headers, "X-Org-Id": ORG } };
        check(http.get(`${BASE}/org/dashboard`, org), { "dashboard 200": (r) => r.status === 200 });
        check(http.get(`${BASE}/org/employments?page_size=25`, org), { "employments 200": (r) => r.status === 200 });
        check(http.get(`${BASE}/org/attendance/day`, org), { "attendance 200": (r) => r.status === 200 });
      }
    });
  }
  sleep(1);
}
