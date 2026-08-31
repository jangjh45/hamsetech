package com.hamsetech.hamsetech.api;

import com.hamsetech.hamsetech.admin.AdminLog;
import com.hamsetech.hamsetech.admin.AdminLogRepository;
import com.hamsetech.hamsetech.admin.AdminLoggable;
import com.hamsetech.hamsetech.admin.AdminLogSpecification;
import com.hamsetech.hamsetech.admin.AdminReadLog;
import com.hamsetech.hamsetech.admin.AdminReadLogRepository;
import com.hamsetech.hamsetech.admin.AdminPasswordResetService;
import com.hamsetech.hamsetech.admin.AdminReadLogSpecification;
import com.hamsetech.hamsetech.user.UserAccount;
import com.hamsetech.hamsetech.user.UserAccountRepository;
import com.hamsetech.hamsetech.user.UserRole;
import com.hamsetech.hamsetech.user.UserStatus;
import com.hamsetech.hamsetech.user.UserWithdrawalService;
import org.springframework.data.domain.Page;
import org.springframework.security.core.Authentication;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private static final Logger logger = LoggerFactory.getLogger(AdminController.class);

	private final UserAccountRepository userRepo;
	private final AdminLogRepository adminLogRepo;
	private final AdminReadLogRepository adminReadLogRepo;
	private final UserWithdrawalService withdrawalService;
	private final AdminPasswordResetService passwordResetService;

	public AdminController(UserAccountRepository userRepo, AdminLogRepository adminLogRepo,
			AdminReadLogRepository adminReadLogRepo, UserWithdrawalService withdrawalService,
			AdminPasswordResetService passwordResetService) {
		this.userRepo = userRepo;
		this.adminLogRepo = adminLogRepo;
		this.adminReadLogRepo = adminReadLogRepo;
		this.withdrawalService = withdrawalService;
		this.passwordResetService = passwordResetService;
	}

	@GetMapping("/ping")
	public String ping() {
		return "admin pong";
	}

	public record UserDto(Long id, String username, String displayName, Set<UserRole> roles, UserStatus status,
			String withdrawRequestedAt, String withdrawnAt, String withdrawReason, String withdrawnBy) {}

	public record UpdateDisplayNameReq(String displayName) {}

	public record WithdrawUserReq(String reason) {}

	private static UserDto toDto(UserAccount u) {
		return new UserDto(u.getId(), u.getUsername(), u.getDisplayName(), u.getRoles(), u.getStatus(),
				u.getWithdrawRequestedAt() == null ? null : u.getWithdrawRequestedAt().toString(),
				u.getWithdrawnAt() == null ? null : u.getWithdrawnAt().toString(),
				u.getWithdrawReason(), u.getWithdrawnBy());
	}

	@AdminLoggable(action = AdminLog.Action.READ, entityType = AdminLog.EntityType.USER, details = "사용자 목록 조회")
	@GetMapping("/users")
	public List<UserDto> listUsers(@RequestParam(name = "q", defaultValue = "") String q,
			@RequestParam(name = "status", required = false) String status) {
		List<UserAccount> all = userRepo.findAll(Sort.by(Sort.Direction.DESC, "id"));
		String qq = q == null ? "" : q.toLowerCase();
		// 알 수 없는 status 값이면 필터를 적용하지 않는다(=전체 조회)
		UserStatus wanted = parseStatus(status);
		return all.stream()
				.filter(u -> qq.isBlank()
					|| (u.getUsername() != null && u.getUsername().toLowerCase().contains(qq))
					|| (u.getDisplayName() != null && u.getDisplayName().toLowerCase().contains(qq)))
				.filter(u -> wanted == null || u.getStatus() == wanted)
				.map(AdminController::toDto)
				.collect(Collectors.toList());
	}

	private UserStatus parseStatus(String raw) {
		if (raw == null || raw.isBlank()) return null;
		try {
			return UserStatus.valueOf(raw.trim().toUpperCase());
		} catch (IllegalArgumentException ex) {
			return null;
		}
	}

	@AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.USER, details = "가입 승인")
	@PostMapping("/users/{id}/approve")
	public ResponseEntity<?> approveUser(@PathVariable(name = "id") @NonNull Long id) {
		return userRepo.findById(id)
				.map(u -> {
					u.setStatus(UserStatus.APPROVED);
					userRepo.save(u);
					logger.info("Approved user account: {}", u.getUsername());
					return ResponseEntity.ok(toDto(u));
				})
				.orElseGet(() -> ResponseEntity.notFound().build());
	}

	@AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.USER, details = "가입 거절")
	@PostMapping("/users/{id}/reject")
	public ResponseEntity<?> rejectUser(@PathVariable(name = "id") @NonNull Long id) {
		return userRepo.findById(id)
				.<ResponseEntity<?>>map(u -> {
					// 최고 관리자를 잠그면 아무도 승인할 수 없게 된다
					if (u.getRoles().contains(UserRole.SUPER_ADMIN)) {
						return ResponseEntity.badRequest().body(Map.of("error", "SUPER_ADMIN 계정은 거절할 수 없습니다."));
					}
					// 탈퇴 확정된 계정을 거절 상태로 되돌리면 탈퇴 이력이 가려진다
					if (u.isWithdrawn()) {
						return ResponseEntity.badRequest().body(Map.of("error", "이미 탈퇴 처리된 계정입니다."));
					}
					u.setStatus(UserStatus.REJECTED);
					userRepo.save(u);
					logger.info("Rejected user account: {}", u.getUsername());
					return ResponseEntity.ok(toDto(u));
				})
				.orElseGet(() -> ResponseEntity.notFound().build());
	}

	@AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.USER, details = "관리자 권한 부여")
	@PostMapping("/users/{id}/grant-admin")
	public ResponseEntity<?> grantAdmin(@PathVariable(name = "id") @NonNull Long id) {
		return userRepo.findById(id)
				.map(u -> {
					u.getRoles().add(UserRole.ADMIN);
					userRepo.save(u);
					return ResponseEntity.ok(Map.of("granted", true));
				})
				.orElseGet(() -> ResponseEntity.notFound().build());
	}

	@AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.USER, details = "관리자 권한 해제")
	@PostMapping("/users/{id}/revoke-admin")
	public ResponseEntity<?> revokeAdmin(@PathVariable(name = "id") @NonNull Long id) {
		return userRepo.findById(id)
				.map(u -> {
					// SUPER_ADMIN는 해제 불가 보호
					if (u.getRoles().contains(UserRole.SUPER_ADMIN)) {
						return ResponseEntity.badRequest().body(Map.of("error", "cannot revoke SUPER_ADMIN"));
					}
					u.getRoles().remove(UserRole.ADMIN);
					userRepo.save(u);
					return ResponseEntity.ok(Map.of("revoked", true));
				})
				.orElseGet(() -> ResponseEntity.notFound().build());
	}

	/**
	 * 회원 탈퇴 확정. 사용자가 신청한 건을 처리할 때도, 퇴사자를 관리자가 직접 정리할 때도 이 경로를 쓴다.
	 * 행을 지우지 않는 소프트 탈퇴이며 실제 익명화는 UserWithdrawalService가 맡는다.
	 */
	@AdminLoggable(action = AdminLog.Action.DELETE, entityType = AdminLog.EntityType.USER, details = "회원 탈퇴 처리")
	@PostMapping("/users/{id}/withdraw")
	public ResponseEntity<?> withdrawUser(@PathVariable(name = "id") @NonNull Long id,
			@RequestBody(required = false) WithdrawUserReq req, Authentication authentication) {
		return userRepo.findById(id)
				.<ResponseEntity<?>>map(u -> {
					// 자기 계정을 잠그면 관리자 자신이 락아웃된다
					if (authentication != null && u.getUsername() != null
							&& u.getUsername().equals(authentication.getName())) {
						return ResponseEntity.badRequest().body(Map.of("error", "본인 계정은 관리자 화면에서 탈퇴할 수 없습니다."));
					}
					try {
						withdrawalService.confirmWithdraw(u, authentication == null ? "system" : authentication.getName(),
								req == null ? null : req.reason());
					} catch (UserWithdrawalService.WithdrawalNotAllowedException e) {
						return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
					}
					return ResponseEntity.ok(toDto(u));
				})
				.orElseGet(() -> ResponseEntity.notFound().build());
	}

	/** 탈퇴 신청 반려. 계정을 원래 승인 상태로 되돌린다. */
	@AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.USER, details = "탈퇴 신청 반려")
	@PostMapping("/users/{id}/withdraw/reject")
	public ResponseEntity<?> rejectWithdraw(@PathVariable(name = "id") @NonNull Long id) {
		return userRepo.findById(id)
				.<ResponseEntity<?>>map(u -> {
					try {
						withdrawalService.cancelWithdrawRequest(u);
					} catch (UserWithdrawalService.WithdrawalNotAllowedException e) {
						return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
					}
					logger.info("Rejected withdrawal request: {}", u.getUsername());
					return ResponseEntity.ok(toDto(u));
				})
				.orElseGet(() -> ResponseEntity.notFound().build());
	}

	@AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.USER, details = "사용자 표시이름 변경")
	@PutMapping("/users/{id}/display-name")
	public ResponseEntity<?> updateDisplayName(@PathVariable(name = "id") @NonNull Long id, @RequestBody UpdateDisplayNameReq req) {
		if (req == null || req.displayName() == null || req.displayName().isBlank()) {
			return ResponseEntity.badRequest().body(Map.of("error", "displayName is required"));
		}
		return userRepo.findById(id)
				.map(u -> {
					u.setDisplayName(req.displayName().trim());
					userRepo.save(u);
					return ResponseEntity.ok(toDto(u));
				})
				.orElseGet(() -> ResponseEntity.notFound().build());
	}

	/** 임시 비밀번호. getId()를 노출하지 않아 감사 로그가 이 객체에서 값을 읽지 않는다. */
	public record TempPasswordDto(String username, String temporaryPassword) {}

	/**
	 * 비밀번호 초기화.
	 *
	 * 자가 재설정(/api/auth/reset-by-identity)을 대체한다. 그쪽은 아이디와 가입
	 * 이메일만 맞으면 인증 없이 비밀번호를 바꿔 줬는데, 이메일 소유를 확인하지
	 * 않아 계정 탈취 경로였다.
	 *
	 * 임시 비밀번호는 이 응답에만 실린다. details는 고정 문자열이라 감사 로그에
	 * 평문이 닿지 않는다.
	 */
	@AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.USER, details = "비밀번호 초기화")
	@PostMapping("/users/{id}/reset-password")
	public ResponseEntity<?> resetPassword(@PathVariable(name = "id") @NonNull Long id) {
		return userRepo.findById(id)
				.<ResponseEntity<?>>map(u -> {
					try {
						String temporary = passwordResetService.resetPassword(u);
						logger.info("Reset password for user account: {}", u.getUsername());
						return ResponseEntity.ok(new TempPasswordDto(u.getUsername(), temporary));
					} catch (AdminPasswordResetService.ResetNotAllowedException e) {
						return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
					}
				})
				.orElseGet(() -> ResponseEntity.notFound().build());
	}

	// 관리자 로그 조회 API
	public record AdminLogDto(Long id, String timestamp, String adminUsername, String action, String entityType,
							 Long entityId, String details, String ipAddress) {}

	@GetMapping("/logs")
	public Page<AdminLogDto> getAdminLogs(
			@RequestParam(name = "page", defaultValue = "0") int page,
			@RequestParam(name = "size", defaultValue = "20") int size,
			@RequestParam(name = "adminUsername", required = false) String adminUsername,
			@RequestParam(name = "entityType", required = false) String entityTypeStr,
			@RequestParam(name = "action", required = false) String actionStr,
			@RequestParam(name = "startDate", required = false) String startDate,
			@RequestParam(name = "endDate", required = false) String endDate) {

		try {
			// 정렬은 Pageable로 일원화 (Specification / 단순 조회 모두 동일하게 적용)
			Pageable pageable = PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "timestamp"));

			Instant startInstant = parseStartDate(startDate);
			Instant endInstant = parseEndDate(endDate);
			AdminLog.EntityType entityType = parseEntityType(entityTypeStr);

			// 조회(READ)는 admin_read_logs로 분리됐으므로 이 API에서는 무시한다
			AdminLog.Action action = parseAction(actionStr);
			if (action == AdminLog.Action.READ) {
				action = null;
			}

			// adminUsername이 빈 문자열인 경우 null로 처리
			String effectiveAdminUsername = blankToNull(adminUsername);

			logger.info("Admin logs request - page: {}, size: {}, adminUsername: '{}', entityType: {}, action: {}, startDate: '{}', endDate: '{}'",
				page, size, effectiveAdminUsername, entityType, action, startDate, endDate);

			Page<AdminLog> logs;
			if (effectiveAdminUsername != null || entityType != null || action != null || startInstant != null || endInstant != null) {
				// 필터 적용 - Specification을 사용한 동적 쿼리
				logs = adminLogRepo.findAll(
					AdminLogSpecification.withFilters(effectiveAdminUsername, entityType, action, startInstant, endInstant),
					pageable
				);
			} else {
				logs = adminLogRepo.findAll(pageable);
			}

			return logs.map(log -> new AdminLogDto(
					log.getId(),
					formatTimestamp(log.getTimestamp()),
					log.getAdminUsername(),
					log.getAction() == null ? "UNKNOWN" : log.getAction().toString(),
					log.getEntityType() == null ? "UNKNOWN" : log.getEntityType().toString(),
					log.getEntityId(),
					log.getDetails(),
					log.getIpAddress()
			));
		} catch (Exception e) {
			logger.error("Error in getAdminLogs: {}", e.getMessage(), e);
			throw e;
		}
	}

	// 조회(READ) 이력 - admin_read_logs 전용 (보존기간이 지나면 자동 삭제됨)
	@GetMapping("/logs/read")
	public Page<AdminLogDto> getAdminReadLogs(
			@RequestParam(name = "page", defaultValue = "0") int page,
			@RequestParam(name = "size", defaultValue = "20") int size,
			@RequestParam(name = "adminUsername", required = false) String adminUsername,
			@RequestParam(name = "entityType", required = false) String entityTypeStr,
			@RequestParam(name = "startDate", required = false) String startDate,
			@RequestParam(name = "endDate", required = false) String endDate) {

		try {
			Pageable pageable = PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "timestamp"));

			Instant startInstant = parseStartDate(startDate);
			Instant endInstant = parseEndDate(endDate);
			AdminLog.EntityType entityType = parseEntityType(entityTypeStr);
			String effectiveAdminUsername = blankToNull(adminUsername);

			Page<AdminReadLog> logs;
			if (effectiveAdminUsername != null || entityType != null || startInstant != null || endInstant != null) {
				logs = adminReadLogRepo.findAll(
					AdminReadLogSpecification.withFilters(effectiveAdminUsername, entityType, startInstant, endInstant),
					pageable
				);
			} else {
				logs = adminReadLogRepo.findAll(pageable);
			}

			return logs.map(log -> new AdminLogDto(
					log.getId(),
					formatTimestamp(log.getTimestamp()),
					log.getAdminUsername(),
					AdminLog.Action.READ.toString(),
					log.getEntityType() == null ? "UNKNOWN" : log.getEntityType().toString(),
					log.getEntityId(),
					log.getDetails(),
					log.getIpAddress()
			));
		} catch (Exception e) {
			logger.error("Error in getAdminReadLogs: {}", e.getMessage(), e);
			throw e;
		}
	}

	@GetMapping("/logs/stats")
	public Map<String, Object> getAdminLogStats() {
		Instant since24h = Instant.now().minusSeconds(86400);

		Set<String> adminUsernames = new TreeSet<>(adminLogRepo.findDistinctAdminUsernames());
		adminUsernames.addAll(adminReadLogRepo.findDistinctAdminUsernames());

		return Map.of(
			"totalLogs", adminLogRepo.count(),
			"todayLogs", adminLogRepo.countLogsSince(since24h),
			"totalReadLogs", adminReadLogRepo.count(),
			"todayReadLogs", adminReadLogRepo.countLogsSince(since24h),
			"adminUsers", adminUsernames.size(),
			"adminUsernames", List.copyOf(adminUsernames)
		);
	}

	private String formatTimestamp(Instant timestamp) {
		if (timestamp == null) return "";
		return LocalDateTime.ofInstant(timestamp, ZoneId.systemDefault())
				.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
	}

	private String blankToNull(String value) {
		return (value != null && !value.trim().isEmpty()) ? value.trim() : null;
	}

	private Instant parseStartDate(String startDate) {
		if (blankToNull(startDate) == null) return null;
		try {
			return LocalDate.parse(startDate.trim()).atStartOfDay(ZoneId.systemDefault()).toInstant();
		} catch (Exception e) {
			logger.warn("Invalid startDate format: '{}' (will be ignored)", startDate);
			return null;
		}
	}

	private Instant parseEndDate(String endDate) {
		if (blankToNull(endDate) == null) return null;
		try {
			return LocalDate.parse(endDate.trim()).atTime(23, 59, 59).atZone(ZoneId.systemDefault()).toInstant();
		} catch (Exception e) {
			logger.warn("Invalid endDate format: '{}' (will be ignored)", endDate);
			return null;
		}
	}

	// 잘못된 값이나 빈 문자열이 들어와도 예외 없이 무시한다
	private AdminLog.EntityType parseEntityType(String entityTypeStr) {
		if (blankToNull(entityTypeStr) == null) return null;
		try {
			return AdminLog.EntityType.valueOf(entityTypeStr.trim());
		} catch (IllegalArgumentException e) {
			logger.warn("Invalid entityType: '{}' (will be ignored)", entityTypeStr);
			return null;
		}
	}

	private AdminLog.Action parseAction(String actionStr) {
		if (blankToNull(actionStr) == null) return null;
		try {
			return AdminLog.Action.valueOf(actionStr.trim());
		} catch (IllegalArgumentException e) {
			logger.warn("Invalid action: '{}' (will be ignored)", actionStr);
			return null;
		}
	}
}


