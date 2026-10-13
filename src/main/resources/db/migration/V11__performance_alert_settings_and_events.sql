CREATE TABLE performance_alert_settings (
    setting_id                       smallint PRIMARY KEY CHECK (setting_id = 1),
    p95_latency_ms                   double precision NOT NULL CHECK (p95_latency_ms BETWEEN 1 AND 3600000),
    error_rate_percent               double precision NOT NULL CHECK (error_rate_percent BETWEEN 0 AND 100),
    heap_used_percent                double precision NOT NULL CHECK (heap_used_percent BETWEEN 0 AND 100),
    db_pool_used_percent             double precision NOT NULL CHECK (db_pool_used_percent BETWEEN 0 AND 100),
    container_memory_used_percent    double precision NOT NULL CHECK (container_memory_used_percent BETWEEN 0 AND 100),
    system_cpu_percent               double precision NOT NULL CHECK (system_cpu_percent BETWEEN 0 AND 100),
    system_memory_used_percent       double precision NOT NULL CHECK (system_memory_used_percent BETWEEN 0 AND 100),
    upload_storage_free_percent      double precision NOT NULL CHECK (upload_storage_free_percent BETWEEN 0 AND 100),
    updated_at                       timestamp with time zone NOT NULL,
    updated_by                       varchar(255) NOT NULL
);

CREATE TABLE performance_alert_state (
    alert_key       varchar(64) PRIMARY KEY,
    message         varchar(400) NOT NULL,
    observed_value  double precision NOT NULL,
    threshold_value double precision,
    unit            varchar(16) NOT NULL,
    opened_at       timestamp with time zone NOT NULL,
    updated_at      timestamp with time zone NOT NULL
);

CREATE TABLE performance_alert_events (
    id              bigserial PRIMARY KEY,
    alert_key       varchar(64) NOT NULL,
    event_type      varchar(16) NOT NULL CHECK (event_type IN ('TRIGGERED', 'RESOLVED')),
    message         varchar(400) NOT NULL,
    observed_value  double precision NOT NULL,
    threshold_value double precision,
    unit            varchar(16) NOT NULL,
    occurred_at     timestamp with time zone NOT NULL
);

CREATE INDEX idx_performance_alert_events_occurred_at
    ON performance_alert_events (occurred_at DESC, id DESC);
