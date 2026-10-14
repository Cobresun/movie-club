import { Handler } from "@netlify/functions";

import { DEFAULT_METRICS_RANGE, metricsRangeSchema } from "../../lib/types/metrics.js";
import MetricsRepository from "./repositories/MetricsRepository.js";
import { siteAdmin } from "./utils/auth";
import { ok } from "./utils/responses";
import { Router } from "./utils/router";

const router = new Router("/api/admin");

/**
 * `catch` rather than a 400: a nonsense `?range=` value is not worth failing
 * the dashboard over, and the enum bounds every query regardless of input.
 */
const rangeSchema = metricsRangeSchema.catch(DEFAULT_METRICS_RANGE);

router.get("/metrics", siteAdmin, async ({ event }, res) => {
  const range = rangeSchema.parse(event.queryStringParameters?.range);
  const dashboard = await MetricsRepository.getDashboard(range);
  return res(ok(JSON.stringify(dashboard)));
});

router.get("/metrics/history", siteAdmin, async ({ event }, res) => {
  const range = rangeSchema.parse(event.queryStringParameters?.range);
  const snapshots = await MetricsRepository.getSnapshots(range);
  return res(ok(JSON.stringify(snapshots)));
});

const handler: Handler = async (event, context) => router.route({ event, context, params: {} });

export { handler };
