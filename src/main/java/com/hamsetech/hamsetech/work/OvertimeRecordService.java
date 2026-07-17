package com.hamsetech.hamsetech.work;

import com.hamsetech.hamsetech.security.SecurityUtils;
import com.hamsetech.hamsetech.user.UserAccount;
import com.hamsetech.hamsetech.user.UserAccountRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional
public class OvertimeRecordService {

    private final OvertimeRecordRepository repository;
    private final UserAccountRepository userAccountRepository;
    private final SecurityUtils securityUtils;

    public OvertimeRecordService(OvertimeRecordRepository repository,
                                  UserAccountRepository userAccountRepository,
                                  SecurityUtils securityUtils) {
        this.repository = repository;
        this.userAccountRepository = userAccountRepository;
        this.securityUtils = securityUtils;
    }

    public OvertimeRecord create(LocalDate workDate, OvertimeType type, LocalTime startTime, LocalTime endTime,
                                  Integer totalMinutes, String reason) {
        UserAccount user = currentUser();

        OvertimeRecord record = new OvertimeRecord();
        record.setUserId(user.getId());
        record.setUsername(user.getUsername());
        record.setDisplayName(securityUtils.currentUserDisplayName());
        record.setWorkDate(workDate);
        record.setType(type);
        record.setStartTime(startTime);
        record.setEndTime(endTime);
        record.setTotalMinutes(resolveTotalMinutes(startTime, endTime, totalMinutes));
        record.setReason(reason);
        record.setStatus(OvertimeRecord.Status.PENDING);
        return repository.save(record);
    }

    @Transactional(readOnly = true)
    public List<OvertimeRecord> listMine(LocalDate from, LocalDate to) {
        UserAccount user = currentUser();
        if (from != null && to != null) {
            return repository.findByUserIdAndWorkDateBetweenOrderByWorkDateDesc(user.getId(), from, to);
        }
        return repository.findByUserIdOrderByWorkDateDesc(user.getId());
    }

    public ResponseEntity<?> update(@NonNull Long id, LocalDate workDate, OvertimeType type, LocalTime startTime,
                                     LocalTime endTime, Integer totalMinutes, String reason) {
        String me = securityUtils.currentUsername();
        return repository.findById(id)
                .map((@NonNull OvertimeRecord record) -> {
                    if (!record.getUsername().equals(me)) {
                        return ResponseEntity.status(403).body(Map.of("error", "forbidden"));
                    }
                    if (record.getStatus() != OvertimeRecord.Status.PENDING) {
                        return ResponseEntity.status(409).body(Map.of("error", "승인/반려된 기록은 수정할 수 없습니다"));
                    }
                    record.setWorkDate(workDate);
                    record.setType(type);
                    record.setStartTime(startTime);
                    record.setEndTime(endTime);
                    record.setTotalMinutes(resolveTotalMinutes(startTime, endTime, totalMinutes));
                    record.setReason(reason);
                    return ResponseEntity.ok(repository.save(record));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    public ResponseEntity<?> delete(@NonNull Long id) {
        String me = securityUtils.currentUsername();
        boolean admin = securityUtils.isAdmin();
        return repository.findById(id)
                .map((@NonNull OvertimeRecord record) -> {
                    if (!admin && !record.getUsername().equals(me)) {
                        return ResponseEntity.status(403).body(Map.of("error", "forbidden"));
                    }
                    if (!admin && record.getStatus() != OvertimeRecord.Status.PENDING) {
                        return ResponseEntity.status(409).body(Map.of("error", "승인/반려된 기록은 삭제할 수 없습니다"));
                    }
                    repository.delete(record);
                    return ResponseEntity.ok(Map.of("deleted", true));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @Transactional(readOnly = true)
    public Page<OvertimeRecord> listAll(String username, OvertimeType type, OvertimeRecord.Status status,
                                         LocalDate from, LocalDate to, @NonNull Pageable pageable) {
        return repository.findAll(
                OvertimeRecordSpecification.withFilters(username, type, status, from, to),
                pageable);
    }

    public ResponseEntity<?> approve(@NonNull Long id) {
        return repository.findById(id)
                .map((@NonNull OvertimeRecord record) -> {
                    if (record.getStatus() != OvertimeRecord.Status.PENDING) {
                        return ResponseEntity.status(409).body(Map.of("error", "이미 처리된 기록입니다"));
                    }
                    record.setStatus(OvertimeRecord.Status.APPROVED);
                    record.setApproverUsername(securityUtils.currentUsername());
                    record.setApprovedAt(Instant.now());
                    record.setRejectReason(null);
                    return ResponseEntity.ok(repository.save(record));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    public ResponseEntity<?> reject(@NonNull Long id, String reason) {
        return repository.findById(id)
                .map((@NonNull OvertimeRecord record) -> {
                    if (record.getStatus() != OvertimeRecord.Status.PENDING) {
                        return ResponseEntity.status(409).body(Map.of("error", "이미 처리된 기록입니다"));
                    }
                    record.setStatus(OvertimeRecord.Status.REJECTED);
                    record.setApproverUsername(securityUtils.currentUsername());
                    record.setApprovedAt(Instant.now());
                    record.setRejectReason(reason);
                    return ResponseEntity.ok(repository.save(record));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> monthlySummary(LocalDate monthStart, LocalDate monthEnd) {
        List<OvertimeRecord> records = repository.findByStatusAndWorkDateBetween(
                OvertimeRecord.Status.APPROVED, monthStart, monthEnd);

        Map<String, Map<String, Object>> byUser = new LinkedHashMap<>();
        for (OvertimeRecord r : records) {
            Map<String, Object> summary = byUser.computeIfAbsent(r.getUsername(), k -> {
                Map<String, Object> m = new HashMap<>();
                m.put("username", r.getUsername());
                m.put("displayName", r.getDisplayName());
                m.put("overtimeMinutes", 0);
                m.put("specialMinutes", 0);
                m.put("overtimeDays", 0);
                m.put("specialDays", 0);
                return m;
            });
            if (r.getType() == OvertimeType.OVERTIME) {
                summary.put("overtimeMinutes", (int) summary.get("overtimeMinutes") + r.getTotalMinutes());
                summary.put("overtimeDays", (int) summary.get("overtimeDays") + 1);
            } else {
                summary.put("specialMinutes", (int) summary.get("specialMinutes") + r.getTotalMinutes());
                summary.put("specialDays", (int) summary.get("specialDays") + 1);
            }
        }
        return new ArrayList<>(byUser.values());
    }

    private UserAccount currentUser() {
        String username = securityUtils.currentUsername();
        return userAccountRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다"));
    }

    private Integer resolveTotalMinutes(LocalTime startTime, LocalTime endTime, Integer totalMinutes) {
        if (startTime != null && endTime != null) {
            long minutes = Duration.between(startTime, endTime).toMinutes();
            if (minutes < 0) minutes += 24 * 60;
            return (int) minutes;
        }
        if (totalMinutes == null) {
            throw new IllegalArgumentException("시작/종료 시간 또는 총 시간을 입력해주세요");
        }
        return totalMinutes;
    }
}
