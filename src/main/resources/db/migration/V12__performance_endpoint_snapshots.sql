-- Keep only normalized route aggregates, never raw paths or request-level records.
CREATE TABLE performance_endpoint_snapshots (
    captured_at          timestamp with time zone NOT NULL,
    method               varchar(10) NOT NULL,
    path                 varchar(200) NOT NULL,
    request_count        bigint NOT NULL CHECK (request_count > 0),
    server_errors        bigint NOT NULL CHECK (server_errors >= 0),
    total_duration_nanos bigint NOT NULL CHECK (total_duration_nanos >= 0),
    p95_latency_ms       double precision,
    p99_latency_ms       double precision,
    PRIMARY KEY (captured_at, method, path)
);

CREATE INDEX idx_performance_endpoint_snapshots_captured_at
    ON performance_endpoint_snapshots (captured_at DESC);
