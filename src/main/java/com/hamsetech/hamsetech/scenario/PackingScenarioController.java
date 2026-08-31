package com.hamsetech.hamsetech.scenario;

import com.hamsetech.hamsetech.admin.AdminLog;
import com.hamsetech.hamsetech.admin.AdminLoggable;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/scenarios")
@PreAuthorize("isAuthenticated()")
public class PackingScenarioController {

    private final PackingScenarioService service;

    public PackingScenarioController(PackingScenarioService service) {
        this.service = service;
    }

    public record CreateScenarioRequest(
            @NotBlank(message = "시나리오 이름을 입력해주세요") String name,
            String description,
            @NotNull(message = "트럭 가로 크기를 입력해주세요") @Positive(message = "트럭 가로 크기는 양수여야 합니다") Integer truckWidth,
            @NotNull(message = "트럭 세로 크기를 입력해주세요") @Positive(message = "트럭 세로 크기는 양수여야 합니다") Integer truckHeight,
            Boolean allowRotate,
            Integer margin,
            Boolean preserveOrder,
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
            Boolean preserveOrder,
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
            Boolean preserveOrder,
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
            Integer quantity,
            Integer sortOrder
    ) {}

    @AdminLoggable(action = AdminLog.Action.READ, entityType = AdminLog.EntityType.SCENARIO, details = "시나리오 전체 목록 조회")
    @GetMapping
    public List<ScenarioResponse> getAllScenarios() {
        return toResponses(service.listMine());
    }

    @AdminLoggable(action = AdminLog.Action.READ, entityType = AdminLog.EntityType.SCENARIO, details = "즐겨찾기 시나리오 목록 조회")
    @GetMapping("/favorites")
    public List<ScenarioResponse> getFavoriteScenarios() {
        return toResponses(service.listFavorites());
    }

    @AdminLoggable(action = AdminLog.Action.READ, entityType = AdminLog.EntityType.SCENARIO, details = "시나리오 검색")
    @GetMapping("/search")
    public List<ScenarioResponse> searchScenarios(@RequestParam String q) {
        return toResponses(service.search(q));
    }

    @AdminLoggable(action = AdminLog.Action.READ, entityType = AdminLog.EntityType.SCENARIO, details = "시나리오 상세 조회")
    @GetMapping("/{id}")
    public ScenarioResponse getScenario(@PathVariable("id") @NonNull Long id) {
        return toResponse(service.get(id));
    }

    @AdminLoggable(action = AdminLog.Action.CREATE, entityType = AdminLog.EntityType.SCENARIO, details = "시나리오 생성")
    @PostMapping
    public ScenarioResponse createScenario(@Valid @RequestBody CreateScenarioRequest request) {
        return toResponse(service.create(
                request.name(), request.description(), request.truckWidth(), request.truckHeight(),
                request.allowRotate(), request.margin(), request.preserveOrder(),
                toItemSpecs(request.items())));
    }

    @AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.SCENARIO, details = "시나리오 수정")
    @PutMapping("/{id}")
    public ScenarioResponse updateScenario(@PathVariable("id") @NonNull Long id,
                                           @Valid @RequestBody UpdateScenarioRequest request) {
        return toResponse(service.update(
                id, request.name(), request.description(), request.truckWidth(), request.truckHeight(),
                request.allowRotate(), request.margin(), request.preserveOrder(),
                toItemSpecs(request.items())));
    }

    @AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.SCENARIO, details = "시나리오 즐겨찾기 토글")
    @PatchMapping("/{id}/favorite")
    public ScenarioResponse toggleFavorite(@PathVariable("id") @NonNull Long id) {
        return toResponse(service.toggleFavorite(id));
    }

    @AdminLoggable(action = AdminLog.Action.DELETE, entityType = AdminLog.EntityType.SCENARIO, details = "시나리오 삭제")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteScenario(@PathVariable("id") @NonNull Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    private List<PackingScenarioService.ItemSpec> toItemSpecs(List<ItemRequest> items) {
        return items.stream()
                .map(i -> new PackingScenarioService.ItemSpec(i.name(), i.width(), i.height(), i.quantity()))
                .toList();
    }

    private List<ScenarioResponse> toResponses(List<PackingScenario> scenarios) {
        return scenarios.stream().map(this::toResponse).toList();
    }

    private ScenarioResponse toResponse(PackingScenario scenario) {
        List<ItemResponse> items = scenario.getItems().stream()
                .map(item -> new ItemResponse(
                        item.getId(),
                        item.getName(),
                        item.getWidth(),
                        item.getHeight(),
                        item.getQuantity(),
                        item.getSortOrder()
                ))
                .toList();

        return new ScenarioResponse(
                scenario.getId(),
                scenario.getName(),
                scenario.getDescription(),
                scenario.getTruckWidth(),
                scenario.getTruckHeight(),
                scenario.getAllowRotate(),
                scenario.getMargin(),
                scenario.getPreserveOrder(),
                scenario.getIsFavorite(),
                scenario.getCreatedAt().toString(),
                scenario.getUpdatedAt().toString(),
                items
        );
    }
}
