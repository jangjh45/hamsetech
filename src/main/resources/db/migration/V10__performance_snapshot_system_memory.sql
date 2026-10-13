-- NAS 시스템 메모리는 애플리케이션 컨테이너의 cgroup 메모리와 별도로 보관한다.
ALTER TABLE performance_snapshots
    ADD COLUMN system_memory_used_bytes double precision,
    ADD COLUMN system_memory_total_bytes double precision;
