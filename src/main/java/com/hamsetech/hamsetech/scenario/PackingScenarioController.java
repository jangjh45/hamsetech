package com.hamsetech.hamsetech.scenario;

import com.hamsetech.hamsetech.admin.AdminLog;
import com.hamsetech.hamsetech.admin.AdminLoggable;
import com.hamsetech.hamsetech.user.UserAccountRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/scenarios")
public class PackingScenarioController {

    private static final Logger logger = LoggerFactory.getLogger(PackingScenarioController.class);

    private final PackingScenarioRepository scenarioRepository;
    private final UserAccountRepository userRepository;

    public PackingScenarioController(PackingScenarioRepository scenarioRepository, UserAccountRepository userRepository) {
        this.scenarioRepository = scenarioRepository;
        this.userRepository = userRepository;
    }

    public record CreateScenarioRequest(
            @NotBlank(message = "시나리오 이름을 입력해주세요") String name,
            String description,
            @NotNull(message = "트럭 가로 크기를 입력해주세요") @Positive(message = "트럭 가로 크기는 양수여야 합니다") Integer truckWidth,
            @NotNull(message = "트럭 세로 크기를 입력해주세요") @Positive(message = "트럭 세로 크기는 양수여야 합니다") Integer truckHeight,
            Boolean allowRotate,
            Integer margin,
            @NotNull(message = "아이템 목록을 입력해주세요") List<ItemRequest> items
    ) {}

    public record ItemRequest(
            @NotBlank(message = "아이템 이름을 입력해주세요") String name,
            @NotNull(message = "아이템 가로 크기를 입력해주세요") @Positive(message = "아이템 가로 크기는 양수여야 합니다") Integer width,
            @NotNull(message = "아이템 세로 크기를 입력해주세요") @Positive(message = "아이템 세로 크기는 양수여야 합니다") Integer height,
            @NotNull(message = "아이템 수량을 입력해주세요") @Positive(message = "아이템 수량은 양수여야 합니다") Integer quantity
    ) {}

    public record UpdateScenarioRequest(
            @NotBlank(message = "시나리오 이름을 입력해주세요") String name,
            String description,
            @NotNull(message = "트럭 가로 크기를 입력해주세요") @Positive(message = "트럭 가로 크기는 양수여야 합니다") Integer truckWidth,
            @NotNull(message = "트럭 세로 크기를 입력해주세요") @Positive(message = "트럭 세로 크기는 양수여야 합니다") Integer truckHeight,
            Boolean allowRotate,
            Integer margin,
            @NotNull(message = "아이템 목록을 입력해주세요") List<ItemRequest> items
    ) {}

    public record ScenarioResponse(
            Long id,
            String name,
            String description,
            Integer truckWidth,
            Integer truckHeight,
            Boolean allowRotate,
            Integer margin,
            Boolean isFavorite,
            String createdAt,
            String updatedAt,
            List<ItemResponse> items
    ) {}

    public record ItemResponse(
            Long id,
            String name,
            Integer width,
            Integer height,
            Integer quantity
    ) {}

    @AdminLoggable(action = AdminLog.Action.READ, entityType = AdminLog.EntityType.SCENARIO, details = "시나리오 전체 목록 조회")
    @GetMapping
    public ResponseEntity<List<ScenarioResponse>> getAllScenarios() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).body(null);
        }

        var user = userRepository.findByUsername(auth.getName()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(401).body(null);
        }

        List<PackingScenario> scenarios = scenarioRepository.findByUserOrderByCreatedAtDesc(user);
        List<ScenarioResponse> responses = scenarios.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());

        return ResponseEntity.ok(responses);
    }

    @AdminLoggable(action = AdminLog.Action.READ, entityType = AdminLog.EntityType.SCENARIO, details = "즐겨찾기 시나리오 목록 조회")
    @GetMapping("/favorites")
    public ResponseEntity<List<ScenarioResponse>> getFavoriteScenarios() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).body(null);
        }

        var user = userRepository.findByUsername(auth.getName()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(401).body(null);
        }

        List<PackingScenario> scenarios = scenarioRepository.findByUserAndIsFavoriteTrueOrderByUpdatedAtDesc(user);
        List<ScenarioResponse> responses = scenarios.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());

        return ResponseEntity.ok(responses);
    }

    @AdminLoggable(action = AdminLog.Action.READ, entityType = AdminLog.EntityType.SCENARIO, details = "시나리오 검색")
    @GetMapping("/search")
    public ResponseEntity<List<ScenarioResponse>> searchScenarios(@RequestParam String q) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).body(null);
        }

        var user = userRepository.findByUsername(auth.getName()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(401).body(null);
        }

        List<PackingScenario> scenarios = scenarioRepository.findByUserAndNameOrDescriptionContainingIgnoreCase(user, q);
        List<ScenarioResponse> responses = scenarios.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());

        return ResponseEntity.ok(responses);
    }

    @AdminLoggable(action = AdminLog.Action.READ, entityType = AdminLog.EntityType.SCENARIO, details = "시나리오 상세 조회")
    @GetMapping("/{id}")
    public ResponseEntity<ScenarioResponse> getScenario(@PathVariable("id") @NonNull Long id) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).body(null);
        }

        var user = userRepository.findByUsername(auth.getName()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(401).body(null);
        }

        var scenario = scenarioRepository.findById(id).orElse(null);
        if (scenario == null) {
            return ResponseEntity.notFound().build();
        }

        if (!scenario.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body(null);
        }

        return ResponseEntity.ok(convertToResponse(scenario));
    }

    @AdminLoggable(action = AdminLog.Action.CREATE, entityType = AdminLog.EntityType.SCENARIO, details = "시나리오 생성")
    @PostMapping
    public ResponseEntity<ScenarioResponse> createScenario(@Valid @RequestBody CreateScenarioRequest request) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).body(null);
        }

        var user = userRepository.findByUsername(auth.getName()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(401).body(null);
        }

        // 이름 중복 체크
        if (scenarioRepository.existsByUserAndName(user, request.name())) {
            return ResponseEntity.badRequest().body(null);
        }

        PackingScenario scenario = new PackingScenario();
        scenario.setName(request.name());
        scenario.setDescription(request.description());
        scenario.setUser(user);
        scenario.setTruckWidth(request.truckWidth());
        scenario.setTruckHeight(request.truckHeight());
        scenario.setAllowRotate(request.allowRotate() != null ? request.allowRotate() : true);
        scenario.setMargin(request.margin() != null ? request.margin() : 0);

        // 아이템들 추가
        List<PackingItem> items = request.items().stream()
                .map(itemRequest -> {
                    PackingItem item = new PackingItem();
                    item.setScenario(scenario);
                    item.setName(itemRequest.name());
                    item.setWidth(itemRequest.width());
                    item.setHeight(itemRequest.height());
                    item.setQuantity(itemRequest.quantity());
                    return item;
                })
                .collect(Collectors.toList());
        scenario.setItems(items);

        PackingScenario savedScenario = scenarioRepository.save(scenario);
        return ResponseEntity.ok(convertToResponse(savedScenario));
    }

    @AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.SCENARIO, details = "시나리오 수정")
    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<ScenarioResponse> updateScenario(@PathVariable("id") @NonNull Long id, @Valid @RequestBody UpdateScenarioRequest request) {
        logger.info("시나리오 수정 요청 - ID: {}, 이름: {}", id, request.name());
        
        try {
            var auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || auth.getName() == null) {
                logger.warn("인증되지 않은 사용자의 시나리오 수정 시도");
                return ResponseEntity.status(401).body(null);
            }

            var user = userRepository.findByUsername(auth.getName()).orElse(null);
            if (user == null) {
                logger.warn("사용자를 찾을 수 없음: {}", auth.getName());
                return ResponseEntity.status(401).body(null);
            }

            var scenario = scenarioRepository.findById(id).orElse(null);
            if (scenario == null) {
                logger.warn("시나리오를 찾을 수 없음: {}", id);
                return ResponseEntity.notFound().build();
            }

            if (!scenario.getUser().getId().equals(user.getId())) {
                logger.warn("권한이 없는 사용자의 시나리오 수정 시도 - 사용자: {}, 시나리오 소유자: {}", user.getId(), scenario.getUser().getId());
                return ResponseEntity.status(403).body(null);
            }

            // 이름 중복 체크 (자기 자신 제외)
            if (!scenario.getName().equals(request.name()) && scenarioRepository.existsByUserAndName(user, request.name())) {
                logger.warn("시나리오 이름 중복: {}", request.name());
                return ResponseEntity.badRequest().body(null);
            }

            scenario.setName(request.name());
            scenario.setDescription(request.description());
            scenario.setTruckWidth(request.truckWidth());
            scenario.setTruckHeight(request.truckHeight());
            scenario.setAllowRotate(request.allowRotate() != null ? request.allowRotate() : true);
            scenario.setMargin(request.margin() != null ? request.margin() : 0);

            logger.info("시나리오 기본 정보 업데이트 완료 - 아이템 수: {}", request.items().size());

            // 기존 아이템들을 모두 삭제하고 새로 추가
            List<PackingItem> items = scenario.getItems();
            items.clear(); // 기존 아이템들 제거
            
            // 새 아이템들 추가
            for (var itemRequest : request.items()) {
                PackingItem item = new PackingItem();
                item.setScenario(scenario);
                item.setName(itemRequest.name());
                item.setWidth(itemRequest.width());
                item.setHeight(itemRequest.height());
                item.setQuantity(itemRequest.quantity());
                items.add(item);
            }

            logger.info("아이템 업데이트 완료 - 총 {}개 아이템", items.size());

            PackingScenario savedScenario = scenarioRepository.save(scenario);
            logger.info("시나리오 수정 완료 - ID: {}", savedScenario.getId());

            return ResponseEntity.ok(convertToResponse(savedScenario));
            
        } catch (Exception e) {
            logger.error("시나리오 수정 중 오류 발생 - ID: {}, 오류: {}", id, e.getMessage(), e);
            return ResponseEntity.status(500).body(null);
        }
    }

    @AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.SCENARIO, details = "시나리오 즐겨찾기 토글")
    @PatchMapping("/{id}/favorite")
    public ResponseEntity<ScenarioResponse> toggleFavorite(@PathVariable("id") @NonNull Long id) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).body(null);
        }

        var user = userRepository.findByUsername(auth.getName()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(401).body(null);
        }

        var scenario = scenarioRepository.findById(id).orElse(null);
        if (scenario == null) {
            return ResponseEntity.notFound().build();
        }

        if (!scenario.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body(null);
        }

        scenario.setIsFavorite(!scenario.getIsFavorite());
        PackingScenario savedScenario = scenarioRepository.save(scenario);

        return ResponseEntity.ok(convertToResponse(savedScenario));
    }

    @AdminLoggable(action = AdminLog.Action.DELETE, entityType = AdminLog.EntityType.SCENARIO, details = "시나리오 삭제")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteScenario(@PathVariable("id") @NonNull Long id) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).body(null);
        }

        var user = userRepository.findByUsername(auth.getName()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(401).body(null);
        }

        var scenario = scenarioRepository.findById(id).orElse(null);
        if (scenario == null) {
            return ResponseEntity.notFound().build();
        }

        if (!scenario.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body(null);
        }

        scenarioRepository.delete(scenario);
        return ResponseEntity.noContent().build();
    }

    private ScenarioResponse convertToResponse(PackingScenario scenario) {
        List<ItemResponse> items = scenario.getItems().stream()
                .map(item -> new ItemResponse(
                        item.getId(),
                        item.getName(),
                        item.getWidth(),
                        item.getHeight(),
                        item.getQuantity()
                ))
                .collect(Collectors.toList());

        return new ScenarioResponse(
                scenario.getId(),
                scenario.getName(),
                scenario.getDescription(),
                scenario.getTruckWidth(),
                scenario.getTruckHeight(),
                scenario.getAllowRotate(),
                scenario.getMargin(),
                scenario.getIsFavorite(),
                scenario.getCreatedAt().toString(),
                scenario.getUpdatedAt().toString(),
                items
        );
    }
}
