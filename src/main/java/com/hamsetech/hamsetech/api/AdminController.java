package com.hamsetech.hamsetech.api;

import com.hamsetech.hamsetech.user.UserAccount;
import com.hamsetech.hamsetech.user.UserAccountRepository;
import com.hamsetech.hamsetech.user.UserRole;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

	private final UserAccountRepository userRepo;

	public AdminController(UserAccountRepository userRepo) {
		this.userRepo = userRepo;
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
	public ResponseEntity<?> grantAdmin(@PathVariable(name = "id") Long id) {
		return userRepo.findById(id)
				.map(u -> {
					u.getRoles().add(UserRole.ADMIN);
					userRepo.save(u);
					return ResponseEntity.ok(Map.of("granted", true));
				})
				.orElseGet(() -> ResponseEntity.notFound().build());
	}

	@PostMapping("/users/{id}/revoke-admin")
	public ResponseEntity<?> revokeAdmin(@PathVariable(name = "id") Long id) {
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
	public ResponseEntity<?> updateDisplayName(@PathVariable(name = "id") Long id, @RequestBody UpdateDisplayNameReq req) {
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
}


