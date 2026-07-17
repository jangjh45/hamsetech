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

    /** 특근 시 점심 휴게시간(분) — 총 근무시간에서 차감 */
    private static final int LUNCH_BREAK_MINUTES = 60;
    /** 이 시간 이상 근무한 특근에만 점심 차감 적용 (짧은 특근은 점심을 안 먹으므로 제외) */
    private static final int LUNCH_DEDUCTION_THRESHOLD_MINUTES = 6 * 60;

    /** 최초 조회 시 시드되는 구분별 초기 기본 근무시간 */
    private static final LocalTime DEFAULT_SPECIAL_START = LocalTime.of(7, 0);
    private static final LocalTime DEFAULT_SPECIAL_END = LocalTime.of(16, 0);
    private static final LocalTime DEFAULT_OVERTIME_START = LocalTime.of(16, 0);
    private static final LocalTime DEFAULT_OVERTIME_END = LocalTime.of(19, 0);

    private final OvertimeRecordRepository repository;
    private final OvertimeDefaultTimeRepository defaultTimeRepository;
    private final UserAccountRepository userAccountRepository;
    private final SecurityUtils securityUtils;

    public OvertimeRecordService(OvertimeRecordRepository repository,
                                  OvertimeDefaultTimeRepository defaultTimeRepository,
                                  UserAccountRepository userAccountRepository,
                                  SecurityUtils securityUtils) {
        this.repository = repository;
        this.defaultTimeRepository = defaultTimeRepository;
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
        record.setTotalMinutes(resolveTotalMinutes(type, startTime, endTime, totalMinutes));
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
        boolean admin = securityUtils.isAdmin();
        return repository.findById(id)
                .map((@NonNull OvertimeRecord record) -> {
                    if (!admin && !record.getUsername().equals(me)) {
                        return ResponseEntity.status(403).body(Map.of("error", "forbidden"));
                    }
                    record.setWorkDate(workDate);
                    record.setType(type);
                    record.setStartTime(startTime);
                    record.setEndTime(endTime);
                    record.setTotalMinutes(resolveTotalMinutes(type, startTime, endTime, totalMinutes));
                    record.setReason(reason);
                    // 이미 처리된 기록을 수정하면 다시 승인 대기로 되돌려 재승인을 받게 한다.
                    if (record.getStatus() != OvertimeRecord.Status.PENDING) {
                        record.setStatus(OvertimeRecord.Status.PENDING);
                        record.setApproverUsername(null);
                        record.setApprovedAt(null);
                        record.setRejectReason(null);
                    }
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
                    // 승인된 기록은 급여/집계에 반영되므로 관리자만 삭제할 수 있다. (대기/반려는 본인 삭제 허용)
                    if (!admin && record.getStatus() == OvertimeRecord.Status.APPROVED) {
                        return ResponseEntity.status(409).body(Map.of("error", "승인된 기록은 관리자만 삭제할 수 있습니다"));
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

    public OvertimeDefaultsDto getDefaults() {
        OvertimeDefaultTime overtime = ensureDefault(OvertimeType.OVERTIME);
        OvertimeDefaultTime special = ensureDefault(OvertimeType.SPECIAL);
        return new OvertimeDefaultsDto(
                overtime.getStartTime().toString(), overtime.getEndTime().toString(),
                special.getStartTime().toString(), special.getEndTime().toString());
    }

    public OvertimeDefaultsDto updateDefaults(OvertimeDefaultsDto req) {
        String me = securityUtils.currentUsername();
        OvertimeDefaultTime overtime = applyDefault(OvertimeType.OVERTIME, req.overtimeStart(), req.overtimeEnd(), me);
        OvertimeDefaultTime special = applyDefault(OvertimeType.SPECIAL, req.specialStart(), req.specialEnd(), me);
        return new OvertimeDefaultsDto(
                overtime.getStartTime().toString(), overtime.getEndTime().toString(),
                special.getStartTime().toString(), special.getEndTime().toString());
    }

    private OvertimeDefaultTime ensureDefault(OvertimeType type) {
        return defaultTimeRepository.findByType(type).orElseGet(() -> {
            LocalTime start = type == OvertimeType.SPECIAL ? DEFAULT_SPECIAL_START : DEFAULT_OVERTIME_START;
            LocalTime end = type == OvertimeType.SPECIAL ? DEFAULT_SPECIAL_END : DEFAULT_OVERTIME_END;
            return defaultTimeRepository.save(new OvertimeDefaultTime(type, start, end));
        });
    }

    private OvertimeDefaultTime applyDefault(OvertimeType type, String startStr, String endStr, String updatedBy) {
        LocalTime start = parseTime(startStr, "시작 시간");
        LocalTime end = parseTime(endStr, "종료 시간");
        OvertimeDefaultTime setting = ensureDefault(type);
        setting.setStartTime(start);
        setting.setEndTime(end);
        setting.setUpdatedBy(updatedBy);
        return defaultTimeRepository.save(setting);
    }

    private LocalTime parseTime(String value, String label) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(label + "을 입력해주세요");
        }
        try {
            return LocalTime.parse(value);
        } catch (Exception e) {
            throw new IllegalArgumentException(label + " 형식이 올바르지 않습니다 (HH:mm)");
        }
    }

    private UserAccount currentUser() {
        String username = securityUtils.currentUsername();
        return userAccountRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다"));
    }

    private Integer resolveTotalMinutes(OvertimeType type, LocalTime startTime, LocalTime endTime, Integer totalMinutes) {
        if (startTime != null && endTime != null) {
            long minutes = Duration.between(startTime, endTime).toMinutes();
            if (minutes < 0) minutes += 24 * 60;
            if (type == OvertimeType.SPECIAL && minutes >= LUNCH_DEDUCTION_THRESHOLD_MINUTES) {
                minutes -= LUNCH_BREAK_MINUTES;
            }
            return (int) minutes;
        }
        if (totalMinutes == null) {
            throw new IllegalArgumentException("시작/종료 시간 또는 총 시간을 입력해주세요");
        }
        return totalMinutes;
    }
}
