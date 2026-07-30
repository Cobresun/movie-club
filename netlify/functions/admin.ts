import { Handler } from "@netlify/functions";
import { z } from "zod";

import MetricsRepository from "./repositories/MetricsRepository.js";
import { siteAdmin } from "./utils/auth";
import { ok } from "./utils/responses";
import { Router } from "./utils/router";

const router = new Router("/api/admin");

const DEFAULT_HISTORY_DAYS = 90;

/**
 * `catch` rather than a 400: a nonsense `?days=` value is not worth failing the
 * dashboard over, and clamping to a year bounds the query regardless of input.
 */
const historyDaysSchema = z.coerce.number().int().min(1).max(365).catch(DEFAULT_HISTORY_DAYS);

router.get("/metrics", siteAdmin, async (_req, res) => {
  const metrics = await MetricsRepository.getMetrics();
  return res(ok(JSON.stringify(metrics)));
});

router.get("/metrics/history", siteAdmin, async ({ event }, res) => {
  const days = historyDaysSchema.parse(event.queryStringParameters?.days ?? DEFAULT_HISTORY_DAYS);
  const snapshots = await MetricsRepository.getSnapshots(days);
  return res(ok(JSON.stringify(snapshots)));
});

const handler: Handler = async (event, context) => router.route({ event, context, params: {} });

export { handler };
