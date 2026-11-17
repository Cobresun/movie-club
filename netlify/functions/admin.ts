import { type Handler } from "@netlify/functions";

import { isDefined } from "../../lib/checks/checks.js";
import { type WorkType } from "../../lib/types/generated/db.js";
import {
  type AdminDashboard,
  DEFAULT_METRICS_RANGE,
  metricsRangeSchema,
  type SnapshotHistoryPoint,
} from "../../lib/types/metrics.js";
import MetricsRepository from "./repositories/MetricsRepository.js";
import { allProviders } from "./utils/providers";
import { ok } from "./utils/responses";
import { Router } from "./utils/router";
import { siteAdmin } from "./utils/session";

const router = new Router("/api/admin");

/**
 * `catch` rather than a 400: a nonsense `?range=` value is not worth failing
 * the dashboard over, and the enum bounds every query regardless of input.
 */
const rangeSchema = metricsRangeSchema.catch(DEFAULT_METRICS_RANGE);

const dailyGameTags = new Map(
  allProviders().flatMap<[WorkType, string]>((provider) =>
    isDefined(provider.dailyGame) ? [[provider.type, provider.dailyGame.tag]] : [],
  ),
);

router.get("/metrics", siteAdmin, async ({ event }, res) => {
  const range = rangeSchema.parse(event.queryStringParameters?.range);
  const dashboard = await MetricsRepository.getDashboard(range, dailyGameTags);
  return res(ok<AdminDashboard>(dashboard));
});

router.get("/metrics/history", siteAdmin, async ({ event }, res) => {
  const range = rangeSchema.parse(event.queryStringParameters?.range);
  const snapshots = await MetricsRepository.getSnapshots(range);
  return res(ok<SnapshotHistoryPoint[]>(snapshots));
});

const handler: Handler = async (event, context) => router.route({ event, context, params: {} });

export { handler };
