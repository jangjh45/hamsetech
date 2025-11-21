package com.hamsetech.hamsetech.api;

import com.hamsetech.hamsetech.admin.AdminLog;
import com.hamsetech.hamsetech.admin.AdminLogRepository;
import com.hamsetech.hamsetech.admin.AdminLogSpecification;
import com.hamsetech.hamsetech.user.UserAccount;
import com.hamsetech.hamsetech.user.UserAccountRepository;
import com.hamsetech.hamsetech.user.UserRole;
import org.springframework.data.domain.Page;
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
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private static final Logger logger = LoggerFactory.getLogger(AdminController.class);

	private final UserAccountRepository userRepo;
	private final AdminLogRepository adminLogRepo;

	public AdminController(UserAccountRepository userRepo, AdminLogRepository adminLogRepo) {
		this.userRepo = userRepo;
		this.adminLogRepo = adminLogRepo;
	}

	@GetMapping("/ping")
	public String ping() {
		return "admin pong";
	}

	public record UserDto(Long id, String username, String displayName, Set<UserRole> roles) {}

	public record UpdateDisplayNameReq(String displayName) {}

	@GetMapping("/users")
	public List<UserDto> listUsers(@RequestParam(name = "q", defaultValue = "") String q) {
		List<UserAccount> all = userRepo.findAll(Sort.by(Sort.Direction.DESC, "id"));
		String qq = q == null ? "" : q.toLowerCase();
		return all.stream()
				.filter(u -> qq.isBlank()
					|| (u.getUsername() != null && u.getUsername().toLowerCase().contains(qq))
					|| (u.getDisplayName() != null && u.getDisplayName().toLowerCase().contains(qq)))
				.map(u -> new UserDto(u.getId(), u.getUsername(), u.getDisplayName(), u.getRoles()))
				.collect(Collectors.toList());
	}

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

	@PutMapping("/users/{id}/display-name")
	public ResponseEntity<?> updateDisplayName(@PathVariable(name = "id") @NonNull Long id, @RequestBody UpdateDisplayNameReq req) {
		if (req == null || req.displayName() == null || req.displayName().isBlank()) {
			return ResponseEntity.badRequest().body(Map.of("error", "displayName is required"));
		}
		return userRepo.findById(id)
				.map(u -> {
					u.setDisplayName(req.displayName().trim());
					userRepo.save(u);
					return ResponseEntity.ok(new UserDto(u.getId(), u.getUsername(), u.getDisplayName(), u.getRoles()));
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
			// JPQL에서 이미 ORDER BY를 지정했으므로 Pageable에서는 정렬을 제거
			Pageable pageable = PageRequest.of(page, Math.min(size, 100));

			Instant startInstant = null;
			if (startDate != null && !startDate.trim().isEmpty()) {
				try {
					LocalDate localDate = LocalDate.parse(startDate.trim());
					startInstant = localDate.atStartOfDay(ZoneId.systemDefault()).toInstant();
				} catch (Exception e) {
					logger.warn("Invalid startDate format: '{}' (will be ignored)", startDate);
				}
			}

			Instant endInstant = null;
			if (endDate != null && !endDate.trim().isEmpty()) {
				try {
					LocalDate localDate = LocalDate.parse(endDate.trim());
					endInstant = localDate.atTime(23, 59, 59).atZone(ZoneId.systemDefault()).toInstant();
				} catch (Exception e) {
					logger.warn("Invalid endDate format: '{}' (will be ignored)", endDate);
				}
			}

			// Enum 변환 (잘못된 값이나 빈 문자열이 들어와도 예외 발생하지 않도록)
			AdminLog.EntityType entityType = null;
			if (entityTypeStr != null && !entityTypeStr.trim().isEmpty()) {
				try {
					entityType = AdminLog.EntityType.valueOf(entityTypeStr.trim());
				} catch (IllegalArgumentException e) {
					logger.warn("Invalid entityType: '{}' (will be ignored)", entityTypeStr);
				}
			}

			AdminLog.Action action = null;
			if (actionStr != null && !actionStr.trim().isEmpty()) {
				try {
					action = AdminLog.Action.valueOf(actionStr.trim());
				} catch (IllegalArgumentException e) {
					logger.warn("Invalid action: '{}' (will be ignored)", actionStr);
				}
			}

			// adminUsername이 빈 문자열인 경우 null로 처리
			String effectiveAdminUsername = (adminUsername != null && !adminUsername.trim().isEmpty()) ? adminUsername.trim() : null;

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
				logs = adminLogRepo.findAllByOrderByTimestampDesc(pageable);
			}

			return logs.map(log -> {
				String timestampStr = LocalDateTime.ofInstant(log.getTimestamp(), ZoneId.systemDefault())
						.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
				return new AdminLogDto(
						log.getId(),
						timestampStr,
						log.getAdminUsername(),
						log.getAction().toString(),
						log.getEntityType().toString(),
						log.getEntityId(),
						log.getDetails(),
						log.getIpAddress()
				);
			});
		} catch (Exception e) {
			logger.error("Error in getAdminLogs: {}", e.getMessage(), e);
			throw e;
		}
	}

	@GetMapping("/logs/stats")
	public Map<String, Object> getAdminLogStats() {
		List<String> adminUsernames = adminLogRepo.findDistinctAdminUsernames();
		long totalLogs = adminLogRepo.count();
		long todayLogs = adminLogRepo.countLogsSince(Instant.now().minusSeconds(86400)); // 24시간

		return Map.of(
			"totalLogs", totalLogs,
			"todayLogs", todayLogs,
			"adminUsers", adminUsernames.size(),
			"adminUsernames", adminUsernames
		);
	}
}


