-- 분 단위 성능 추이를 제한된 기간 동안 보관한다. 요청별 원시 로그는 저장하지 않는다.
CREATE TABLE performance_snapshots (
    captured_at                    timestamp(6) with time zone PRIMARY KEY,
    requests_per_second            double precision NOT NULL,
    error_rate_percent             double precision NOT NULL,
    average_latency_ms             double precision,
    p95_latency_ms                 double precision,
    p99_latency_ms                 double precision,
    jvm_heap_used_bytes            double precision,
    jvm_heap_max_bytes             double precision,
    db_connections_active          double precision,
    db_connections_max             double precision,
    jvm_non_heap_used_bytes        double precision,
    jvm_non_heap_max_bytes         double precision,
    process_cpu_percent            double precision,
    system_cpu_percent             double precision,
    container_memory_used_bytes    double precision,
    container_memory_max_bytes     double precision,
    db_connections_idle            double precision,
    db_connections_pending         double precision,
    upload_storage_usable_bytes    double precision,
    upload_storage_total_bytes     double precision
);

CREATE INDEX idx_performance_snapshots_captured_at
    ON performance_snapshots (captured_at DESC);
