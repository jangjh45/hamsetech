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
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional
public class OvertimeRecordService {

    /** 특근 시 점심 휴게시간(분) — 총 근무시간에서 차감 */
    private static final int LUNCH_BREAK_MINUTES = 60;
    /** 이 시간 이상 근무한 특근에만 점심 차감 적용 (짧은 특근은 점심을 안 먹으므로 제외) */
    private static final int LUNCH_DEDUCTION_THRESHOLD_MINUTES = 6 * 60;

    /** 저녁 휴게 구간 — 근무 시간이 이 구간에 걸치면 겹친 만큼 총 근무시간에서 차감 (구분 무관) */
    private static final LocalTime DINNER_BREAK_START = LocalTime.of(17, 0);
    private static final LocalTime DINNER_BREAK_END = LocalTime.of(17, 30);

    /** 최초 조회 시 시드되는 구분별 초기 기본 근무시간 */
    private static final LocalTime DEFAULT_SPECIAL_START = LocalTime.of(7, 0);
    private static final LocalTime DEFAULT_SPECIAL_END = LocalTime.of(16, 0);
    private static final LocalTime DEFAULT_OVERTIME_START = LocalTime.of(16, 0);
    private static final LocalTime DEFAULT_OVERTIME_END = LocalTime.of(19, 0);

    /** 급여 주기 시작일 초기값 — 달력 월과 동일하게 동작한다. */
    private static final int DEFAULT_PAYROLL_START_DAY = 1;

    /** 엑셀 내보내기 기간 상한. 실수로 전 기간을 요청해 응답이 폭주하는 것을 막는다. */
    private static final long MAX_EXPORT_DAYS = 366;

    /** 일괄 등록 1회 인원 상한. 잘못된 요청으로 대량 생성되는 것을 막는다. */
    private static final int MAX_BULK_USERS = 100;

    private final OvertimeRecordRepository repository;
    private final OvertimeDefaultTimeRepository defaultTimeRepository;
    private final OvertimePayrollSettingRepository payrollSettingRepository;
    private final UserAccountRepository userAccountRepository;
    private final SecurityUtils securityUtils;
    private final OvertimeExcelExporter excelExporter;

    public OvertimeRecordService(OvertimeRecordRepository repository,
                                  OvertimeDefaultTimeRepository defaultTimeRepository,
                                  OvertimePayrollSettingRepository payrollSettingRepository,
                                  UserAccountRepository userAccountRepository,
                                  SecurityUtils securityUtils,
                                  OvertimeExcelExporter excelExporter) {
        this.repository = repository;
        this.defaultTimeRepository = defaultTimeRepository;
        this.payrollSettingRepository = payrollSettingRepository;
        this.userAccountRepository = userAccountRepository;
        this.securityUtils = securityUtils;
        this.excelExporter = excelExporter;
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

    /** 일괄 등록에서 제외된 직원 한 명. name은 화면에 그대로 보여줄 이름이다. */
    public record BulkSkip(String name, String reason) {}

    public record BulkCreateResult(int created, List<OvertimeRecord> records, List<BulkSkip> skipped) {}

    /**
     * 관리자가 여러 직원의 잔업/특근을 같은 조건(근무일·구분·시간)으로 한 번에 등록한다.
     *
     * 이미 같은 날 같은 구분으로 기록이 있는 직원은 건너뛴다. 버튼을 두 번 눌러도,
     * 앞서 등록한 명단에 몇 명만 더해 다시 등록해도 중복이 생기지 않는다.
     *
     * @param approveNow 관리자가 직접 넣은 기록이라 바로 승인 처리할지 여부.
     *                   false면 본인 신청과 같은 승인 대기 상태로 들어간다.
     */
    public BulkCreateResult createForUsers(List<Long> userIds, LocalDate workDate, OvertimeType type,
                                            LocalTime startTime, LocalTime endTime, Integer totalMinutes,
                                            String reason, boolean approveNow) {
        if (userIds == null || userIds.isEmpty()) {
            throw new IllegalArgumentException("직원을 한 명 이상 선택해주세요");
        }
        List<Long> ids = userIds.stream().filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) {
            throw new IllegalArgumentException("직원을 한 명 이상 선택해주세요");
        }
        if (ids.size() > MAX_BULK_USERS) {
            throw new IllegalArgumentException("한 번에 등록할 수 있는 인원은 최대 " + MAX_BULK_USERS + "명입니다");
        }

        // 모두 같은 근무 조건이라 시간 계산은 한 번만 한다. 입력이 잘못됐다면 아무것도 만들기 전에 걸린다.
        Integer minutes = resolveTotalMinutes(type, startTime, endTime, totalMinutes);

        Set<Long> alreadyRegistered = repository.findByWorkDateAndTypeAndUserIdIn(workDate, type, ids).stream()
                .map(OvertimeRecord::getUserId)
                .collect(Collectors.toSet());
        Map<Long, UserAccount> users = userAccountRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(UserAccount::getId, Function.identity()));

        String approver = securityUtils.currentUsername();
        Instant now = Instant.now();
        List<OvertimeRecord> toSave = new ArrayList<>();
        List<BulkSkip> skipped = new ArrayList<>();

        for (Long id : ids) {
            UserAccount user = users.get(id);
            if (user == null) {
                skipped.add(new BulkSkip("ID " + id, "없는 계정"));
                continue;
            }
            String name = displayNameOf(user);
            // 탈퇴 계정의 기존 기록은 보존하지만 새 기록을 더하지는 않는다.
            if (user.isWithdrawn()) {
                skipped.add(new BulkSkip(name, "탈퇴한 계정"));
                continue;
            }
            if (alreadyRegistered.contains(id)) {
                skipped.add(new BulkSkip(name, "같은 날 같은 구분으로 이미 등록됨"));
                continue;
            }

            OvertimeRecord record = new OvertimeRecord();
            record.setUserId(user.getId());
            record.setUsername(user.getUsername());
            record.setDisplayName(name);
            record.setWorkDate(workDate);
            record.setType(type);
            record.setStartTime(startTime);
            record.setEndTime(endTime);
            record.setTotalMinutes(minutes);
            record.setReason(reason);
            if (approveNow) {
                record.setStatus(OvertimeRecord.Status.APPROVED);
                record.setApproverUsername(approver);
                record.setApprovedAt(now);
            } else {
                record.setStatus(OvertimeRecord.Status.PENDING);
            }
            toSave.add(record);
        }

        List<OvertimeRecord> saved = repository.saveAll(toSave);
        return new BulkCreateResult(saved.size(), saved, skipped);
    }

    private String displayNameOf(UserAccount user) {
        String name = user.getDisplayName();
        return (name != null && !name.isBlank()) ? name : user.getUsername();
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
                special.getStartTime().toString(), special.getEndTime().toString(),
                ensurePayrollSetting().getCycleStartDay());
    }

    public OvertimeDefaultsDto updateDefaults(OvertimeDefaultsDto req) {
        String me = securityUtils.currentUsername();
        OvertimeDefaultTime overtime = applyDefault(OvertimeType.OVERTIME, req.overtimeStart(), req.overtimeEnd(), me);
        OvertimeDefaultTime special = applyDefault(OvertimeType.SPECIAL, req.specialStart(), req.specialEnd(), me);
        OvertimePayrollSetting payroll = applyPayrollStartDay(req.payrollStartDay(), me);
        return new OvertimeDefaultsDto(
                overtime.getStartTime().toString(), overtime.getEndTime().toString(),
                special.getStartTime().toString(), special.getEndTime().toString(),
                payroll.getCycleStartDay());
    }

    private OvertimePayrollSetting ensurePayrollSetting() {
        return payrollSettingRepository.findTopByOrderByIdAsc()
                .orElseGet(() -> payrollSettingRepository.save(
                        new OvertimePayrollSetting(DEFAULT_PAYROLL_START_DAY)));
    }

    /** 값이 없으면 기존 설정을 유지한다 — 이 필드를 모르는 클라이언트가 저장해도 설정이 초기화되지 않는다. */
    private OvertimePayrollSetting applyPayrollStartDay(Integer day, String updatedBy) {
        // DB를 건드리기 전에 먼저 거른다.
        OvertimePayrollSetting.validateCycleStartDay(day);
        OvertimePayrollSetting setting = ensurePayrollSetting();
        if (day == null) {
            return setting;
        }
        setting.setCycleStartDay(day);
        setting.setUpdatedBy(updatedBy);
        return payrollSettingRepository.save(setting);
    }

    /**
     * 지정한 기간의 잔업/특근을 엑셀 워크북(byte[])으로 만든다.
     * 급여 주기가 달력 월과 어긋날 수 있어 월이 아닌 임의 기간을 받는다.
     */
    @Transactional(readOnly = true)
    public byte[] exportRange(LocalDate from, LocalDate to) {
        if (from == null || to == null) {
            throw new IllegalArgumentException("시작일과 종료일을 모두 입력해주세요");
        }
        if (from.isAfter(to)) {
            throw new IllegalArgumentException("시작일이 종료일보다 늦을 수 없습니다");
        }
        if (ChronoUnit.DAYS.between(from, to) + 1 > MAX_EXPORT_DAYS) {
            throw new IllegalArgumentException("한 번에 내보낼 수 있는 기간은 최대 " + MAX_EXPORT_DAYS + "일입니다");
        }

        // 페이징 없이 기간 전량. 근무일 오름차순 정렬은 exporter가 보장한다
        // (공용 Specification이 workDate DESC를 강제로 걸지만 여기서 고치면 목록 화면의 정렬까지 바뀐다).
        List<OvertimeRecord> records = repository.findAll(
                OvertimeRecordSpecification.withFilters(null, null, null, from, to));

        return excelExporter.build(from, to, records, monthlySummary(from, to));
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

    Integer resolveTotalMinutes(OvertimeType type, LocalTime startTime, LocalTime endTime, Integer totalMinutes) {
        if (startTime != null && endTime != null) {
            // 휴게 차감은 실제 근무한 시간대를 봐야 하므로 차감 전 경과 시간(gross)을 기준으로 계산한다.
            long gross = Duration.between(startTime, endTime).toMinutes();
            if (gross < 0) gross += 24 * 60;

            long net = gross;
            if (type == OvertimeType.SPECIAL && gross >= LUNCH_DEDUCTION_THRESHOLD_MINUTES) {
                net -= LUNCH_BREAK_MINUTES;
            }
            net -= dinnerOverlapMinutes(startTime, gross);
            return (int) Math.max(0, net);
        }
        if (totalMinutes == null) {
            throw new IllegalArgumentException("시작/종료 시간 또는 총 시간을 입력해주세요");
        }
        return totalMinutes;
    }

    /** 근무 구간과 저녁 휴게 구간이 겹치는 분 */
    private long dinnerOverlapMinutes(LocalTime start, long grossMinutes) {
        long workStart = start.toSecondOfDay() / 60;
        long workEnd = workStart + grossMinutes; // 자정을 넘긴 근무는 1440 이상이 된다
        long dinnerStart = DINNER_BREAK_START.toSecondOfDay() / 60;
        long dinnerEnd = DINNER_BREAK_END.toSecondOfDay() / 60;
        // 자정을 넘긴 근무는 다음 날 저녁 구간과도 겹칠 수 있어 이틀치를 모두 확인한다.
        return overlapMinutes(workStart, workEnd, dinnerStart, dinnerEnd)
                + overlapMinutes(workStart, workEnd, dinnerStart + 24 * 60, dinnerEnd + 24 * 60);
    }

    private long overlapMinutes(long aStart, long aEnd, long bStart, long bEnd) {
        return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
    }
}
