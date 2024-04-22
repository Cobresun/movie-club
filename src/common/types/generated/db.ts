import type { ColumnType } from "kysely";
import type { IPostgresInterval } from "postgres-interval";

export enum WorkListType {
  award_nominations = "award_nominations",
  backlog = "backlog",
  reviews = "reviews",
  watchlist = "watchlist",
}

export enum WorkType {
  movie = "movie",
}

export type ArrayType<T> = ArrayTypeImpl<T> extends (infer U)[]
  ? U[]
  : ArrayTypeImpl<T>;

export type ArrayTypeImpl<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S[], I[], U[]>
  : T[];

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export type Int8 = ColumnType<string, bigint | number | string, bigint | number | string>;

export type Interval = ColumnType<IPostgresInterval, IPostgresInterval | number, IPostgresInterval | number>;

export type Json = JsonValue;

export type JsonArray = JsonValue[];

export type JsonObject = {
  [K in string]?: JsonValue;
};

export type JsonPrimitive = boolean | number | string | null;

export type JsonValue = JsonArray | JsonObject | JsonPrimitive;

export type Numeric = ColumnType<string, number | string, number | string>;

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface Club {
  id: Generated<Int8>;
  legacy_id: Int8 | null;
  name: string;
}

export interface ClubMember {
  club_id: Int8;
  role: string | null;
  user_id: Int8;
}

export interface CrdbInternalActiveRangeFeeds {
  catchup: boolean | null;
  created: Int8 | null;
  diff: boolean | null;
  id: Int8 | null;
  last_err: string | null;
  last_event_utc: Int8 | null;
  node_id: Int8 | null;
  num_errs: Int8 | null;
  range_end: string | null;
  range_id: Int8 | null;
  range_start: string | null;
  resolved: string | null;
  startts: string | null;
  tags: string | null;
}

export interface CrdbInternalBackwardDependencies {
  column_id: Int8 | null;
  dependson_details: string | null;
  dependson_id: Int8;
  dependson_index_id: Int8 | null;
  dependson_name: string | null;
  dependson_type: string;
  descriptor_id: Int8 | null;
  descriptor_name: string;
  index_id: Int8 | null;
}

export interface CrdbInternalBuiltinFunctions {
  category: string;
  details: string;
  function: string;
  oid: number;
  schema: string;
  signature: string;
}

export interface CrdbInternalClusterContendedIndexes {
  database_name: string | null;
  index_name: string | null;
  num_contention_events: Int8 | null;
  schema_name: string | null;
  table_name: string | null;
}

export interface CrdbInternalClusterContendedKeys {
  database_name: string | null;
  index_name: string | null;
  key: Buffer | null;
  num_contention_events: Int8 | null;
  schema_name: string | null;
  table_name: string | null;
}

export interface CrdbInternalClusterContendedTables {
  database_name: string | null;
  num_contention_events: Int8 | null;
  schema_name: string | null;
  table_name: string | null;
}

export interface CrdbInternalClusterContentionEvents {
  count: Int8;
  cumulative_contention_time: Interval;
  index_id: Int8 | null;
  key: Buffer;
  num_contention_events: Int8;
  table_id: Int8 | null;
  txn_id: string;
}

export interface CrdbInternalClusterDatabasePrivileges {
  database_name: string;
  grantee: string;
  is_grantable: string | null;
  privilege_type: string;
}

export interface CrdbInternalClusterDistsqlFlows {
  flow_id: string;
  node_id: Int8;
  since: Timestamp;
  stmt: string | null;
}

export interface CrdbInternalClusterExecutionInsights {
  app_name: string;
  causes: string[];
  contention: Interval | null;
  cpu_sql_nanos: Int8 | null;
  database_name: string;
  end_time: Timestamp;
  error_code: string | null;
  exec_node_ids: ArrayType<Int8>;
  full_scan: boolean;
  implicit_txn: boolean;
  index_recommendations: string[];
  last_error_redactable: string | null;
  last_retry_reason: string | null;
  plan_gist: string;
  priority: string;
  problem: string;
  query: string;
  retries: Int8;
  rows_read: Int8;
  rows_written: Int8;
  session_id: string;
  start_time: Timestamp;
  status: string;
  stmt_fingerprint_id: Buffer;
  stmt_id: string;
  txn_fingerprint_id: Buffer;
  txn_id: string;
  user_name: string;
}

export interface CrdbInternalClusterInflightTraces {
  jaeger_json: string | null;
  node_id: Int8;
  root_op_name: string;
  trace_id: Int8;
  trace_str: string | null;
}

export interface CrdbInternalClusterLocks {
  contended: boolean;
  database_name: string;
  durability: string | null;
  duration: Interval | null;
  granted: boolean | null;
  index_name: string | null;
  isolation_level: string;
  lock_key: Buffer;
  lock_key_pretty: string;
  lock_strength: string | null;
  range_id: Int8;
  schema_name: string;
  table_id: Int8;
  table_name: string;
  ts: Timestamp | null;
  txn_id: string | null;
}

export interface CrdbInternalClusterQueries {
  application_name: string | null;
  client_address: string | null;
  database: string | null;
  distributed: boolean | null;
  full_scan: boolean | null;
  node_id: Int8;
  phase: string | null;
  plan_gist: string | null;
  query: string | null;
  query_id: string | null;
  session_id: string | null;
  start: Timestamp | null;
  txn_id: string | null;
  user_name: string | null;
}

export interface CrdbInternalClusterSessions {
  active_queries: string | null;
  active_query_start: Timestamp | null;
  alloc_bytes: Int8 | null;
  application_name: string | null;
  client_address: string | null;
  kv_txn: string | null;
  last_active_query: string | null;
  max_alloc_bytes: Int8 | null;
  node_id: Int8;
  num_txns_executed: Int8 | null;
  session_end: Timestamp | null;
  session_id: string | null;
  session_start: Timestamp | null;
  status: string | null;
  user_name: string | null;
}

export interface CrdbInternalClusterSettings {
  default_value: string;
  description: string;
  key: string;
  origin: string;
  public: boolean;
  type: string;
  value: string;
  variable: string;
}

export interface CrdbInternalClusterStatementStatistics {
  aggregated_ts: Timestamp;
  aggregation_interval: Interval;
  app_name: string;
  fingerprint_id: Buffer;
  index_recommendations: string[];
  metadata: Json;
  plan_hash: Buffer;
  sampled_plan: Json;
  statistics: Json;
  transaction_fingerprint_id: Buffer;
}

export interface CrdbInternalClusterTransactions {
  application_name: string | null;
  id: string | null;
  isolation_level: string | null;
  last_auto_retry_reason: string | null;
  node_id: Int8 | null;
  num_auto_retries: Int8 | null;
  num_retries: Int8 | null;
  num_stmts: Int8 | null;
  priority: string | null;
  quality_of_service: string | null;
  session_id: string | null;
  start: Timestamp | null;
  txn_string: string | null;
}

export interface CrdbInternalClusterTransactionStatistics {
  aggregated_ts: Timestamp;
  aggregation_interval: Interval;
  app_name: string;
  fingerprint_id: Buffer;
  metadata: Json;
  statistics: Json;
}

export interface CrdbInternalClusterTxnExecutionInsights {
  app_name: string;
  causes: string[];
  contention: Interval | null;
  cpu_sql_nanos: Int8 | null;
  end_time: Timestamp;
  implicit_txn: boolean;
  last_error_code: string | null;
  last_error_redactable: string | null;
  last_retry_reason: string | null;
  priority: string;
  problems: string[];
  query: string;
  retries: Int8;
  rows_read: Int8;
  rows_written: Int8;
  session_id: string;
  start_time: Timestamp;
  status: string;
  stmt_execution_ids: string[];
  txn_fingerprint_id: Buffer;
  txn_id: string;
  user_name: string;
}

export interface CrdbInternalCreateFunctionStatements {
  create_statement: string | null;
  database_id: Int8 | null;
  database_name: string | null;
  function_id: Int8 | null;
  function_name: string | null;
  schema_id: Int8 | null;
  schema_name: string | null;
}

export interface CrdbInternalCreateProcedureStatements {
  create_statement: string | null;
  database_id: Int8 | null;
  database_name: string | null;
  procedure_id: Int8 | null;
  procedure_name: string | null;
  schema_id: Int8 | null;
  schema_name: string | null;
}

export interface CrdbInternalCreateSchemaStatements {
  create_statement: string | null;
  database_id: Int8 | null;
  database_name: string | null;
  descriptor_id: Int8 | null;
  schema_name: string | null;
}

export interface CrdbInternalCreateStatements {
  alter_statements: string[];
  create_nofks: string;
  create_redactable: string;
  create_statement: string;
  database_id: Int8 | null;
  database_name: string | null;
  descriptor_id: Int8 | null;
  descriptor_name: string;
  descriptor_type: string;
  has_partitions: boolean;
  is_multi_region: boolean;
  is_temporary: boolean;
  is_virtual: boolean;
  schema_name: string;
  state: string;
  validate_statements: string[];
}

export interface CrdbInternalCreateTypeStatements {
  create_statement: string | null;
  database_id: Int8 | null;
  database_name: string | null;
  descriptor_id: Int8 | null;
  descriptor_name: string | null;
  enum_members: string[] | null;
  schema_name: string | null;
}

export interface CrdbInternalCrossDbReferences {
  cross_database_reference_description: string;
  object_database: string;
  object_name: string;
  object_schema: string;
  referenced_object_database: string;
  referenced_object_name: string;
  referenced_object_schema: string;
}

export interface CrdbInternalDatabases {
  create_statement: string;
  id: Int8;
  name: string;
  owner: string;
  placement_policy: string | null;
  primary_region: string | null;
  regions: string[] | null;
  secondary_region: string | null;
  survival_goal: string | null;
}

export interface CrdbInternalDefaultPrivileges {
  database_name: string;
  for_all_roles: boolean | null;
  grantee: string;
  is_grantable: boolean | null;
  object_type: string;
  privilege_type: string;
  role: string | null;
  schema_name: string | null;
}

export interface CrdbInternalFeatureUsage {
  feature_name: string;
  usage_count: Int8;
}

export interface CrdbInternalForwardDependencies {
  dependedonby_details: string | null;
  dependedonby_id: Int8;
  dependedonby_index_id: Int8 | null;
  dependedonby_name: string | null;
  dependedonby_type: string;
  descriptor_id: Int8 | null;
  descriptor_name: string;
  index_id: Int8 | null;
}

export interface CrdbInternalGossipAlerts {
  category: string;
  description: string;
  node_id: Int8;
  store_id: Int8 | null;
  value: number;
}

export interface CrdbInternalGossipLiveness {
  decommissioning: boolean;
  draining: boolean;
  epoch: Int8;
  expiration: string;
  membership: string;
  node_id: Int8;
  updated_at: Timestamp | null;
}

export interface CrdbInternalGossipNetwork {
  source_id: Int8;
  target_id: Int8;
}

export interface CrdbInternalGossipNodes {
  address: string;
  advertise_address: string;
  advertise_sql_address: string;
  attrs: Json;
  build_tag: string;
  cluster_name: string;
  is_live: boolean;
  leases: Int8;
  locality: string;
  network: string;
  node_id: Int8;
  ranges: Int8;
  server_version: string;
  sql_address: string;
  sql_network: string;
  started_at: Timestamp;
}

export interface CrdbInternalIndexColumns {
  column_direction: string | null;
  column_id: Int8;
  column_name: string | null;
  column_type: string;
  descriptor_id: Int8 | null;
  descriptor_name: string;
  implicit: boolean | null;
  index_id: Int8;
  index_name: string;
}

export interface CrdbInternalIndexSpans {
  descriptor_id: Int8;
  end_key: Buffer;
  index_id: Int8;
  start_key: Buffer;
}

export interface CrdbInternalIndexUsageStatistics {
  index_id: Int8;
  last_read: Timestamp | null;
  table_id: Int8;
  total_reads: Int8;
}

export interface CrdbInternalInvalidObjects {
  database_name: string | null;
  error: string | null;
  error_redactable: string | null;
  id: Int8 | null;
  obj_name: string | null;
  schema_name: string | null;
}

export interface CrdbInternalJobs {
  coordinator_id: Int8 | null;
  created: Timestamp | null;
  description: string | null;
  descriptor_ids: ArrayType<Int8> | null;
  error: string | null;
  execution_errors: string[] | null;
  execution_events: Json | null;
  finished: Timestamp | null;
  fraction_completed: number | null;
  high_water_timestamp: Numeric | null;
  job_id: Int8 | null;
  job_type: string | null;
  last_run: Timestamp | null;
  modified: Timestamp | null;
  next_run: Timestamp | null;
  num_runs: Int8 | null;
  running_status: string | null;
  started: Timestamp | null;
  statement: string | null;
  status: string | null;
  trace_id: Int8 | null;
  user_name: string | null;
}

export interface CrdbInternalKvBuiltinFunctionComments {
  description: string;
  oid: number;
}

export interface CrdbInternalKvCatalogComments {
  classoid: number;
  description: string;
  objoid: number;
  objsubid: number;
}

export interface CrdbInternalKvCatalogDescriptor {
  descriptor: Json;
  id: Int8;
}

export interface CrdbInternalKvCatalogNamespace {
  id: Int8;
  name: string;
  parent_id: Int8;
  parent_schema_id: Int8;
}

export interface CrdbInternalKvCatalogZones {
  config: Json;
  id: Int8;
}

export interface CrdbInternalKvDroppedRelations {
  drop_time: Timestamp | null;
  id: Int8 | null;
  name: string | null;
  parent_id: Int8 | null;
  parent_schema_id: Int8 | null;
  ttl: Interval | null;
}

export interface CrdbInternalKvFlowControlHandles {
  range_id: Int8;
  store_id: Int8;
  tenant_id: Int8;
  total_tracked_tokens: Int8;
}

export interface CrdbInternalKvFlowController {
  available_elastic_tokens: Int8;
  available_regular_tokens: Int8;
  store_id: Int8;
  tenant_id: Int8;
}

export interface CrdbInternalKvFlowTokenDeductions {
  log_index: Int8;
  log_term: Int8;
  priority: string;
  range_id: Int8;
  store_id: Int8;
  tenant_id: Int8;
  tokens: Int8;
}

export interface CrdbInternalKvInheritedRoleMembers {
  inheriting_member: string | null;
  member_is_admin: boolean | null;
  member_is_explicit: boolean | null;
  role: string | null;
}

export interface CrdbInternalKvNodeLiveness {
  draining: boolean;
  epoch: Int8;
  expiration: string;
  membership: string;
  node_id: Int8;
}

export interface CrdbInternalKvNodeStatus {
  activity: Json;
  address: string;
  args: Json;
  attrs: Json;
  cgo_compiler: string;
  dependencies: string;
  distribution: string;
  env: Json;
  go_version: string;
  locality: string;
  metrics: Json;
  network: string;
  node_id: Int8;
  platform: string;
  revision: string;
  server_version: string;
  started_at: Timestamp;
  tag: string;
  time: string;
  type: string;
  updated_at: Timestamp;
}

export interface CrdbInternalKvProtectedTsRecords {
  decoded_meta: Json | null;
  decoded_target: Json | null;
  id: string;
  internal_meta: Json | null;
  last_updated: Numeric | null;
  meta: Buffer | null;
  meta_type: string;
  num_ranges: Int8 | null;
  num_spans: Int8;
  spans: Buffer;
  target: Buffer | null;
  ts: Numeric;
  verified: boolean;
}

export interface CrdbInternalKvRepairableCatalogCorruptions {
  corruption: string | null;
  id: Int8 | null;
  name: string | null;
  parent_id: Int8 | null;
  parent_schema_id: Int8 | null;
}

export interface CrdbInternalKvStoreStatus {
  attrs: Json;
  available: Int8;
  bytes_per_replica: Json;
  capacity: Int8;
  lease_count: Int8;
  logical_bytes: Int8;
  metrics: Json;
  node_id: Int8;
  properties: Json;
  range_count: Int8;
  store_id: Int8;
  used: Int8;
  writes_per_replica: Json;
  writes_per_second: number;
}

export interface CrdbInternalKvSystemPrivileges {
  grant_options: string[] | null;
  path: string | null;
  privileges: string[] | null;
  user_id: number | null;
  username: string | null;
}

export interface CrdbInternalLeases {
  deleted: boolean;
  expiration: Timestamp;
  name: string;
  node_id: Int8;
  parent_id: Int8;
  table_id: Int8;
}

export interface CrdbInternalLostDescriptorsWithData {
  descid: Int8;
}

export interface CrdbInternalNodeBuildInfo {
  field: string;
  node_id: Int8;
  value: string;
}

export interface CrdbInternalNodeContentionEvents {
  count: Int8;
  cumulative_contention_time: Interval;
  index_id: Int8 | null;
  key: Buffer;
  num_contention_events: Int8;
  table_id: Int8 | null;
  txn_id: string;
}

export interface CrdbInternalNodeDistsqlFlows {
  flow_id: string;
  node_id: Int8;
  since: Timestamp;
  stmt: string | null;
}

export interface CrdbInternalNodeExecutionInsights {
  app_name: string;
  causes: string[];
  contention: Interval | null;
  cpu_sql_nanos: Int8 | null;
  database_name: string;
  end_time: Timestamp;
  error_code: string | null;
  exec_node_ids: ArrayType<Int8>;
  full_scan: boolean;
  implicit_txn: boolean;
  index_recommendations: string[];
  last_error_redactable: string | null;
  last_retry_reason: string | null;
  plan_gist: string;
  priority: string;
  problem: string;
  query: string;
  retries: Int8;
  rows_read: Int8;
  rows_written: Int8;
  session_id: string;
  start_time: Timestamp;
  status: string;
  stmt_fingerprint_id: Buffer;
  stmt_id: string;
  txn_fingerprint_id: Buffer;
  txn_id: string;
  user_name: string;
}

export interface CrdbInternalNodeInflightTraceSpans {
  duration: Interval | null;
  finished: boolean;
  goroutine_id: Int8;
  operation: string | null;
  parent_span_id: Int8;
  span_id: Int8;
  start_time: Timestamp | null;
  trace_id: Int8;
}

export interface CrdbInternalNodeMemoryMonitors {
  id: Int8 | null;
  level: Int8 | null;
  name: string | null;
  parent_id: Int8 | null;
  reserved_reserved: Int8 | null;
  reserved_used: Int8 | null;
  used: Int8 | null;
}

export interface CrdbInternalNodeMetrics {
  name: string;
  store_id: Int8 | null;
  value: number;
}

export interface CrdbInternalNodeQueries {
  application_name: string | null;
  client_address: string | null;
  database: string | null;
  distributed: boolean | null;
  full_scan: boolean | null;
  node_id: Int8;
  phase: string | null;
  plan_gist: string | null;
  query: string | null;
  query_id: string | null;
  session_id: string | null;
  start: Timestamp | null;
  txn_id: string | null;
  user_name: string | null;
}

export interface CrdbInternalNodeRuntimeInfo {
  component: string;
  field: string;
  node_id: Int8;
  value: string;
}

export interface CrdbInternalNodeSessions {
  active_queries: string | null;
  active_query_start: Timestamp | null;
  alloc_bytes: Int8 | null;
  application_name: string | null;
  client_address: string | null;
  kv_txn: string | null;
  last_active_query: string | null;
  max_alloc_bytes: Int8 | null;
  node_id: Int8;
  num_txns_executed: Int8 | null;
  session_end: Timestamp | null;
  session_id: string | null;
  session_start: Timestamp | null;
  status: string | null;
  user_name: string | null;
}

export interface CrdbInternalNodeStatementStatistics {
  anonymized: string | null;
  application_name: string;
  bytes_read_avg: number;
  bytes_read_var: number;
  contention_time_avg: number | null;
  contention_time_var: number | null;
  count: Int8;
  cpu_sql_nanos_avg: number | null;
  cpu_sql_nanos_var: number | null;
  database_name: string;
  exec_node_ids: ArrayType<Int8>;
  first_attempt_count: Int8;
  flags: string;
  full_scan: boolean;
  idle_lat_avg: number;
  idle_lat_var: number;
  implicit_txn: boolean;
  index_recommendations: string[];
  key: string;
  last_error: string | null;
  last_error_code: string | null;
  latency_seconds_max: number | null;
  latency_seconds_min: number | null;
  latency_seconds_p50: number | null;
  latency_seconds_p90: number | null;
  latency_seconds_p99: number | null;
  max_disk_usage_avg: number | null;
  max_disk_usage_var: number | null;
  max_mem_usage_avg: number | null;
  max_mem_usage_var: number | null;
  max_retries: Int8;
  mvcc_block_bytes_avg: number | null;
  mvcc_block_bytes_in_cache_avg: number | null;
  mvcc_block_bytes_in_cache_var: number | null;
  mvcc_block_bytes_var: number | null;
  mvcc_key_bytes_avg: number | null;
  mvcc_key_bytes_var: number | null;
  mvcc_point_count_avg: number | null;
  mvcc_point_count_var: number | null;
  mvcc_points_covered_by_range_tombstones_avg: number | null;
  mvcc_points_covered_by_range_tombstones_var: number | null;
  mvcc_range_key_contained_points_avg: number | null;
  mvcc_range_key_contained_points_var: number | null;
  mvcc_range_key_count_avg: number | null;
  mvcc_range_key_count_var: number | null;
  mvcc_range_key_skipped_points_avg: number | null;
  mvcc_range_key_skipped_points_var: number | null;
  mvcc_seek_avg: number | null;
  mvcc_seek_internal_avg: number | null;
  mvcc_seek_internal_var: number | null;
  mvcc_seek_var: number | null;
  mvcc_step_avg: number | null;
  mvcc_step_internal_avg: number | null;
  mvcc_step_internal_var: number | null;
  mvcc_step_var: number | null;
  mvcc_value_bytes_avg: number | null;
  mvcc_value_bytes_var: number | null;
  network_bytes_avg: number | null;
  network_bytes_var: number | null;
  network_msgs_avg: number | null;
  network_msgs_var: number | null;
  node_id: Int8;
  overhead_lat_avg: number;
  overhead_lat_var: number;
  parse_lat_avg: number;
  parse_lat_var: number;
  plan_lat_avg: number;
  plan_lat_var: number;
  rows_avg: number;
  rows_read_avg: number;
  rows_read_var: number;
  rows_var: number;
  rows_written_avg: number;
  rows_written_var: number;
  run_lat_avg: number;
  run_lat_var: number;
  sample_plan: Json | null;
  service_lat_avg: number;
  service_lat_var: number;
  statement_id: string;
  txn_fingerprint_id: string | null;
}

export interface CrdbInternalNodeTenantCapabilitiesCache {
  capability_name: string | null;
  capability_value: string | null;
  tenant_id: Int8 | null;
}

export interface CrdbInternalNodeTransactions {
  application_name: string | null;
  id: string | null;
  isolation_level: string | null;
  last_auto_retry_reason: string | null;
  node_id: Int8 | null;
  num_auto_retries: Int8 | null;
  num_retries: Int8 | null;
  num_stmts: Int8 | null;
  priority: string | null;
  quality_of_service: string | null;
  session_id: string | null;
  start: Timestamp | null;
  txn_string: string | null;
}

export interface CrdbInternalNodeTransactionStatistics {
  application_name: string;
  commit_lat_avg: number;
  commit_lat_var: number;
  contention_time_avg: number | null;
  contention_time_var: number | null;
  count: Int8 | null;
  cpu_sql_nanos_avg: number | null;
  cpu_sql_nanos_var: number | null;
  idle_lat_avg: number;
  idle_lat_var: number;
  key: string | null;
  max_disk_usage_avg: number | null;
  max_disk_usage_var: number | null;
  max_mem_usage_avg: number | null;
  max_mem_usage_var: number | null;
  max_retries: Int8 | null;
  mvcc_block_bytes_avg: number | null;
  mvcc_block_bytes_in_cache_avg: number | null;
  mvcc_block_bytes_in_cache_var: number | null;
  mvcc_block_bytes_var: number | null;
  mvcc_key_bytes_avg: number | null;
  mvcc_key_bytes_var: number | null;
  mvcc_point_count_avg: number | null;
  mvcc_point_count_var: number | null;
  mvcc_points_covered_by_range_tombstones_avg: number | null;
  mvcc_points_covered_by_range_tombstones_var: number | null;
  mvcc_range_key_contained_points_avg: number | null;
  mvcc_range_key_contained_points_var: number | null;
  mvcc_range_key_count_avg: number | null;
  mvcc_range_key_count_var: number | null;
  mvcc_range_key_skipped_points_avg: number | null;
  mvcc_range_key_skipped_points_var: number | null;
  mvcc_seek_avg: number | null;
  mvcc_seek_internal_avg: number | null;
  mvcc_seek_internal_var: number | null;
  mvcc_seek_var: number | null;
  mvcc_step_avg: number | null;
  mvcc_step_internal_avg: number | null;
  mvcc_step_internal_var: number | null;
  mvcc_step_var: number | null;
  mvcc_value_bytes_avg: number | null;
  mvcc_value_bytes_var: number | null;
  network_bytes_avg: number | null;
  network_bytes_var: number | null;
  network_msgs_avg: number | null;
  network_msgs_var: number | null;
  node_id: Int8;
  retry_lat_avg: number;
  retry_lat_var: number;
  rows_read_avg: number;
  rows_read_var: number;
  service_lat_avg: number;
  service_lat_var: number;
  statement_ids: string[] | null;
}

export interface CrdbInternalNodeTxnExecutionInsights {
  app_name: string;
  causes: string[];
  contention: Interval | null;
  cpu_sql_nanos: Int8 | null;
  end_time: Timestamp;
  implicit_txn: boolean;
  last_error_code: string | null;
  last_error_redactable: string | null;
  last_retry_reason: string | null;
  priority: string;
  problems: string[];
  query: string;
  retries: Int8;
  rows_read: Int8;
  rows_written: Int8;
  session_id: string;
  start_time: Timestamp;
  status: string;
  stmt_execution_ids: string[];
  txn_fingerprint_id: Buffer;
  txn_id: string;
  user_name: string;
}

export interface CrdbInternalNodeTxnStats {
  application_name: string;
  committed_count: Int8;
  implicit_count: Int8;
  node_id: Int8;
  txn_count: Int8;
  txn_time_avg_sec: number;
  txn_time_var_sec: number;
}

export interface CrdbInternalPartitions {
  column_names: string | null;
  columns: Int8;
  index_id: Int8;
  list_value: string | null;
  name: string;
  parent_name: string | null;
  range_value: string | null;
  subzone_id: Int8 | null;
  table_id: Int8;
  zone_id: Int8 | null;
}

export interface CrdbInternalPgCatalogTableIsImplemented {
  implemented: boolean | null;
  name: string;
}

export interface CrdbInternalRanges {
  end_key: Buffer | null;
  end_pretty: string | null;
  learner_replicas: ArrayType<Int8> | null;
  lease_holder: Int8 | null;
  non_voting_replicas: ArrayType<Int8> | null;
  range_id: Int8 | null;
  range_size: Int8 | null;
  replica_localities: string[] | null;
  replicas: ArrayType<Int8> | null;
  split_enforced_until: Timestamp | null;
  start_key: Buffer | null;
  start_pretty: string | null;
  voting_replicas: ArrayType<Int8> | null;
}

export interface CrdbInternalRangesNoLeases {
  end_key: Buffer;
  end_pretty: string;
  learner_replicas: ArrayType<Int8>;
  non_voting_replicas: ArrayType<Int8>;
  range_id: Int8;
  replica_localities: string[];
  replicas: ArrayType<Int8>;
  split_enforced_until: Timestamp | null;
  start_key: Buffer;
  start_pretty: string;
  voting_replicas: ArrayType<Int8>;
}

export interface CrdbInternalRegions {
  region: string;
  zones: string[];
}

export interface CrdbInternalSchemaChanges {
  direction: string;
  name: string;
  parent_id: Int8;
  state: string;
  table_id: Int8;
  target_id: Int8 | null;
  target_name: string | null;
  type: string;
}

export interface CrdbInternalSessionTrace {
  age: Interval;
  duration: Interval | null;
  loc: string;
  message: string;
  message_idx: Int8;
  operation: string | null;
  span_idx: Int8;
  tag: string;
  timestamp: Timestamp;
}

export interface CrdbInternalSessionVariables {
  hidden: boolean;
  value: string;
  variable: string;
}

export interface CrdbInternalStatementActivity {
  agg_interval: Interval | null;
  aggregated_ts: Timestamp | null;
  app_name: string | null;
  contention_time_avg_seconds: number | null;
  cpu_sql_avg_nanos: number | null;
  execution_count: Int8 | null;
  execution_total_cluster_seconds: number | null;
  execution_total_seconds: number | null;
  fingerprint_id: Buffer | null;
  index_recommendations: string[] | null;
  metadata: Json | null;
  plan: Json | null;
  plan_hash: Buffer | null;
  service_latency_avg_seconds: number | null;
  service_latency_p99_seconds: number | null;
  statistics: Json | null;
  transaction_fingerprint_id: Buffer | null;
}

export interface CrdbInternalStatementStatistics {
  aggregated_ts: Timestamp | null;
  aggregation_interval: Interval | null;
  app_name: string | null;
  fingerprint_id: Buffer | null;
  index_recommendations: string[] | null;
  metadata: Json | null;
  plan_hash: Buffer | null;
  sampled_plan: Json | null;
  statistics: Json | null;
  transaction_fingerprint_id: Buffer | null;
}

export interface CrdbInternalStatementStatisticsPersisted {
  agg_interval: Interval | null;
  aggregated_ts: Timestamp | null;
  app_name: string | null;
  contention_time: number | null;
  cpu_sql_nanos: number | null;
  execution_count: Int8 | null;
  fingerprint_id: Buffer | null;
  index_recommendations: string[] | null;
  indexes_usage: Json | null;
  metadata: Json | null;
  node_id: Int8 | null;
  p99_latency: number | null;
  plan: Json | null;
  plan_hash: Buffer | null;
  service_latency: number | null;
  statistics: Json | null;
  total_estimated_execution_time: number | null;
  transaction_fingerprint_id: Buffer | null;
}

export interface CrdbInternalStatementStatisticsPersistedV222 {
  agg_interval: Interval | null;
  aggregated_ts: Timestamp | null;
  app_name: string | null;
  fingerprint_id: Buffer | null;
  index_recommendations: string[] | null;
  metadata: Json | null;
  node_id: Int8 | null;
  plan: Json | null;
  plan_hash: Buffer | null;
  statistics: Json | null;
  transaction_fingerprint_id: Buffer | null;
}

export interface CrdbInternalSuperRegions {
  database_name: string;
  id: Int8;
  regions: string[] | null;
  super_region_name: string;
}

export interface CrdbInternalSystemJobs {
  claim_instance_id: Int8 | null;
  claim_session_id: Buffer | null;
  created: Timestamp;
  created_by_id: Int8 | null;
  created_by_type: string | null;
  id: Int8;
  job_type: string | null;
  last_run: Timestamp | null;
  num_runs: Int8 | null;
  payload: Buffer;
  progress: Buffer | null;
  status: string;
}

export interface CrdbInternalTableColumns {
  column_id: Int8;
  column_name: string;
  column_type: string;
  default_expr: string | null;
  descriptor_id: Int8 | null;
  descriptor_name: string;
  hidden: boolean;
  nullable: boolean;
}

export interface CrdbInternalTableIndexes {
  create_statement: string;
  created_at: Timestamp | null;
  descriptor_id: Int8 | null;
  descriptor_name: string;
  index_id: Int8;
  index_name: string;
  index_type: string;
  is_inverted: boolean;
  is_sharded: boolean;
  is_unique: boolean;
  is_visible: boolean;
  shard_bucket_count: Int8 | null;
  visibility: number;
}

export interface CrdbInternalTableRowStatistics {
  estimated_row_count: Int8 | null;
  table_id: Int8;
  table_name: string;
}

export interface CrdbInternalTables {
  audit_mode: string;
  database_name: string | null;
  drop_time: Timestamp | null;
  format_version: string;
  locality: string | null;
  mod_time: Timestamp;
  mod_time_logical: Numeric;
  name: string;
  parent_id: Int8;
  parent_schema_id: Int8;
  sc_lease_expiration_time: Timestamp | null;
  sc_lease_node_id: Int8 | null;
  schema_name: string;
  state: string;
  table_id: Int8;
  version: Int8;
}

export interface CrdbInternalTableSpans {
  descriptor_id: Int8;
  end_key: Buffer;
  start_key: Buffer;
}

export interface CrdbInternalTenantUsageDetails {
  tenant_id: Int8 | null;
  total_cross_region_network_ru: number | null;
  total_external_io_egress_bytes: Int8 | null;
  total_external_io_ingress_bytes: Int8 | null;
  total_kv_ru: number | null;
  total_pgwire_egress_bytes: Int8 | null;
  total_read_bytes: Int8 | null;
  total_read_requests: Int8 | null;
  total_ru: number | null;
  total_sql_pod_seconds: number | null;
  total_write_bytes: Int8 | null;
  total_write_requests: Int8 | null;
}

export interface CrdbInternalTransactionActivity {
  agg_interval: Interval | null;
  aggregated_ts: Timestamp | null;
  app_name: string | null;
  contention_time_avg_seconds: number | null;
  cpu_sql_avg_nanos: number | null;
  execution_count: Int8 | null;
  execution_total_cluster_seconds: number | null;
  execution_total_seconds: number | null;
  fingerprint_id: Buffer | null;
  metadata: Json | null;
  query: string | null;
  service_latency_avg_seconds: number | null;
  service_latency_p99_seconds: number | null;
  statistics: Json | null;
}

export interface CrdbInternalTransactionContentionEvents {
  blocking_txn_fingerprint_id: Buffer;
  blocking_txn_id: string;
  collection_ts: Timestamp;
  contending_key: Buffer;
  contending_pretty_key: string;
  contention_duration: Interval;
  contention_type: string;
  database_name: string;
  index_name: string | null;
  schema_name: string;
  table_name: string;
  waiting_stmt_fingerprint_id: Buffer;
  waiting_stmt_id: string;
  waiting_txn_fingerprint_id: Buffer;
  waiting_txn_id: string;
}

export interface CrdbInternalTransactionStatistics {
  aggregated_ts: Timestamp | null;
  aggregation_interval: Interval | null;
  app_name: string | null;
  fingerprint_id: Buffer | null;
  metadata: Json | null;
  statistics: Json | null;
}

export interface CrdbInternalTransactionStatisticsPersisted {
  agg_interval: Interval | null;
  aggregated_ts: Timestamp | null;
  app_name: string | null;
  contention_time: number | null;
  cpu_sql_nanos: number | null;
  execution_count: Int8 | null;
  fingerprint_id: Buffer | null;
  metadata: Json | null;
  node_id: Int8 | null;
  p99_latency: number | null;
  service_latency: number | null;
  statistics: Json | null;
  total_estimated_execution_time: number | null;
}

export interface CrdbInternalTransactionStatisticsPersistedV222 {
  agg_interval: Interval | null;
  aggregated_ts: Timestamp | null;
  app_name: string | null;
  fingerprint_id: Buffer | null;
  metadata: Json | null;
  node_id: Int8 | null;
  statistics: Json | null;
}

export interface CrdbInternalZones {
  database_name: string | null;
  full_config_sql: string | null;
  full_config_yaml: string;
  index_name: string | null;
  partition_name: string | null;
  range_name: string | null;
  raw_config_protobuf: Buffer;
  raw_config_sql: string | null;
  raw_config_yaml: string;
  schema_name: string | null;
  subzone_id: Int8;
  table_name: string | null;
  target: string | null;
  zone_id: Int8;
}

export interface User {
  email: string;
  id: Generated<Int8>;
  image_id: string | null;
  image_url: string | null;
  username: string;
}

export interface Work {
  club_id: Int8;
  external_id: string | null;
  id: Generated<Int8>;
  image_url: string | null;
  title: string;
  type: WorkType;
}

export interface WorkList {
  club_id: Int8;
  id: Generated<Int8>;
  title: string | null;
  type: WorkListType;
}

export interface WorkListItem {
  created_date: Timestamp;
  list_id: Int8;
  work_id: Int8;
}

export interface DB {
  club: Club;
  club_member: ClubMember;
  "crdb_internal.active_range_feeds": CrdbInternalActiveRangeFeeds;
  "crdb_internal.backward_dependencies": CrdbInternalBackwardDependencies;
  "crdb_internal.builtin_functions": CrdbInternalBuiltinFunctions;
  "crdb_internal.cluster_contended_indexes": CrdbInternalClusterContendedIndexes;
  "crdb_internal.cluster_contended_keys": CrdbInternalClusterContendedKeys;
  "crdb_internal.cluster_contended_tables": CrdbInternalClusterContendedTables;
  "crdb_internal.cluster_contention_events": CrdbInternalClusterContentionEvents;
  "crdb_internal.cluster_database_privileges": CrdbInternalClusterDatabasePrivileges;
  "crdb_internal.cluster_distsql_flows": CrdbInternalClusterDistsqlFlows;
  "crdb_internal.cluster_execution_insights": CrdbInternalClusterExecutionInsights;
  "crdb_internal.cluster_inflight_traces": CrdbInternalClusterInflightTraces;
  "crdb_internal.cluster_locks": CrdbInternalClusterLocks;
  "crdb_internal.cluster_queries": CrdbInternalClusterQueries;
  "crdb_internal.cluster_sessions": CrdbInternalClusterSessions;
  "crdb_internal.cluster_settings": CrdbInternalClusterSettings;
  "crdb_internal.cluster_statement_statistics": CrdbInternalClusterStatementStatistics;
  "crdb_internal.cluster_transaction_statistics": CrdbInternalClusterTransactionStatistics;
  "crdb_internal.cluster_transactions": CrdbInternalClusterTransactions;
  "crdb_internal.cluster_txn_execution_insights": CrdbInternalClusterTxnExecutionInsights;
  "crdb_internal.create_function_statements": CrdbInternalCreateFunctionStatements;
  "crdb_internal.create_procedure_statements": CrdbInternalCreateProcedureStatements;
  "crdb_internal.create_schema_statements": CrdbInternalCreateSchemaStatements;
  "crdb_internal.create_statements": CrdbInternalCreateStatements;
  "crdb_internal.create_type_statements": CrdbInternalCreateTypeStatements;
  "crdb_internal.cross_db_references": CrdbInternalCrossDbReferences;
  "crdb_internal.databases": CrdbInternalDatabases;
  "crdb_internal.default_privileges": CrdbInternalDefaultPrivileges;
  "crdb_internal.feature_usage": CrdbInternalFeatureUsage;
  "crdb_internal.forward_dependencies": CrdbInternalForwardDependencies;
  "crdb_internal.gossip_alerts": CrdbInternalGossipAlerts;
  "crdb_internal.gossip_liveness": CrdbInternalGossipLiveness;
  "crdb_internal.gossip_network": CrdbInternalGossipNetwork;
  "crdb_internal.gossip_nodes": CrdbInternalGossipNodes;
  "crdb_internal.index_columns": CrdbInternalIndexColumns;
  "crdb_internal.index_spans": CrdbInternalIndexSpans;
  "crdb_internal.index_usage_statistics": CrdbInternalIndexUsageStatistics;
  "crdb_internal.invalid_objects": CrdbInternalInvalidObjects;
  "crdb_internal.jobs": CrdbInternalJobs;
  "crdb_internal.kv_builtin_function_comments": CrdbInternalKvBuiltinFunctionComments;
  "crdb_internal.kv_catalog_comments": CrdbInternalKvCatalogComments;
  "crdb_internal.kv_catalog_descriptor": CrdbInternalKvCatalogDescriptor;
  "crdb_internal.kv_catalog_namespace": CrdbInternalKvCatalogNamespace;
  "crdb_internal.kv_catalog_zones": CrdbInternalKvCatalogZones;
  "crdb_internal.kv_dropped_relations": CrdbInternalKvDroppedRelations;
  "crdb_internal.kv_flow_control_handles": CrdbInternalKvFlowControlHandles;
  "crdb_internal.kv_flow_controller": CrdbInternalKvFlowController;
  "crdb_internal.kv_flow_token_deductions": CrdbInternalKvFlowTokenDeductions;
  "crdb_internal.kv_inherited_role_members": CrdbInternalKvInheritedRoleMembers;
  "crdb_internal.kv_node_liveness": CrdbInternalKvNodeLiveness;
  "crdb_internal.kv_node_status": CrdbInternalKvNodeStatus;
  "crdb_internal.kv_protected_ts_records": CrdbInternalKvProtectedTsRecords;
  "crdb_internal.kv_repairable_catalog_corruptions": CrdbInternalKvRepairableCatalogCorruptions;
  "crdb_internal.kv_store_status": CrdbInternalKvStoreStatus;
  "crdb_internal.kv_system_privileges": CrdbInternalKvSystemPrivileges;
  "crdb_internal.leases": CrdbInternalLeases;
  "crdb_internal.lost_descriptors_with_data": CrdbInternalLostDescriptorsWithData;
  "crdb_internal.node_build_info": CrdbInternalNodeBuildInfo;
  "crdb_internal.node_contention_events": CrdbInternalNodeContentionEvents;
  "crdb_internal.node_distsql_flows": CrdbInternalNodeDistsqlFlows;
  "crdb_internal.node_execution_insights": CrdbInternalNodeExecutionInsights;
  "crdb_internal.node_inflight_trace_spans": CrdbInternalNodeInflightTraceSpans;
  "crdb_internal.node_memory_monitors": CrdbInternalNodeMemoryMonitors;
  "crdb_internal.node_metrics": CrdbInternalNodeMetrics;
  "crdb_internal.node_queries": CrdbInternalNodeQueries;
  "crdb_internal.node_runtime_info": CrdbInternalNodeRuntimeInfo;
  "crdb_internal.node_sessions": CrdbInternalNodeSessions;
  "crdb_internal.node_statement_statistics": CrdbInternalNodeStatementStatistics;
  "crdb_internal.node_tenant_capabilities_cache": CrdbInternalNodeTenantCapabilitiesCache;
  "crdb_internal.node_transaction_statistics": CrdbInternalNodeTransactionStatistics;
  "crdb_internal.node_transactions": CrdbInternalNodeTransactions;
  "crdb_internal.node_txn_execution_insights": CrdbInternalNodeTxnExecutionInsights;
  "crdb_internal.node_txn_stats": CrdbInternalNodeTxnStats;
  "crdb_internal.partitions": CrdbInternalPartitions;
  "crdb_internal.pg_catalog_table_is_implemented": CrdbInternalPgCatalogTableIsImplemented;
  "crdb_internal.ranges": CrdbInternalRanges;
  "crdb_internal.ranges_no_leases": CrdbInternalRangesNoLeases;
  "crdb_internal.regions": CrdbInternalRegions;
  "crdb_internal.schema_changes": CrdbInternalSchemaChanges;
  "crdb_internal.session_trace": CrdbInternalSessionTrace;
  "crdb_internal.session_variables": CrdbInternalSessionVariables;
  "crdb_internal.statement_activity": CrdbInternalStatementActivity;
  "crdb_internal.statement_statistics": CrdbInternalStatementStatistics;
  "crdb_internal.statement_statistics_persisted": CrdbInternalStatementStatisticsPersisted;
  "crdb_internal.statement_statistics_persisted_v22_2": CrdbInternalStatementStatisticsPersistedV222;
  "crdb_internal.super_regions": CrdbInternalSuperRegions;
  "crdb_internal.system_jobs": CrdbInternalSystemJobs;
  "crdb_internal.table_columns": CrdbInternalTableColumns;
  "crdb_internal.table_indexes": CrdbInternalTableIndexes;
  "crdb_internal.table_row_statistics": CrdbInternalTableRowStatistics;
  "crdb_internal.table_spans": CrdbInternalTableSpans;
  "crdb_internal.tables": CrdbInternalTables;
  "crdb_internal.tenant_usage_details": CrdbInternalTenantUsageDetails;
  "crdb_internal.transaction_activity": CrdbInternalTransactionActivity;
  "crdb_internal.transaction_contention_events": CrdbInternalTransactionContentionEvents;
  "crdb_internal.transaction_statistics": CrdbInternalTransactionStatistics;
  "crdb_internal.transaction_statistics_persisted": CrdbInternalTransactionStatisticsPersisted;
  "crdb_internal.transaction_statistics_persisted_v22_2": CrdbInternalTransactionStatisticsPersistedV222;
  "crdb_internal.zones": CrdbInternalZones;
  user: User;
  work: Work;
  work_list: WorkList;
  work_list_item: WorkListItem;
}
