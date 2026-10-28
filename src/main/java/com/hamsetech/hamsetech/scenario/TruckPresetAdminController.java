package com.hamsetech.hamsetech.scenario;

import com.hamsetech.hamsetech.admin.AdminLog;
import com.hamsetech.hamsetech.admin.AdminLoggable;
import com.hamsetech.hamsetech.scenario.TruckPresetController.TruckPresetResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** 프리셋 편집. SecurityConfig의 /api/admin/** 규칙과 같은 권한을 메서드에도 건다. */
@RestController
@RequestMapping("/api/admin/truck-presets")
@PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
public class TruckPresetAdminController {

    private final TruckPresetService service;

    public TruckPresetAdminController(TruckPresetService service) {
        this.service = service;
    }

    public record PresetRequest(
            @NotBlank(message = "프리셋 이름을 입력해주세요")
            @Size(max = TruckPreset.MAX_LABEL_LENGTH, message = "프리셋 이름은 50자 이하여야 합니다")
            String label,
            @NotNull(message = "가로 크기를 입력해주세요")
            @Min(value = 1, message = "가로 크기는 양수여야 합니다")
            @Max(value = TruckPreset.MAX_DIMENSION_MM, message = "가로 크기는 20000mm 이하여야 합니다")
            Integer width,
            @NotNull(message = "세로 크기를 입력해주세요")
            @Min(value = 1, message = "세로 크기는 양수여야 합니다")
            @Max(value = TruckPreset.MAX_DIMENSION_MM, message = "세로 크기는 20000mm 이하여야 합니다")
            Integer height,
            @PositiveOrZero(message = "정렬 순서는 0 이상이어야 합니다")
            Integer sortOrder
    ) {}

    @AdminLoggable(action = AdminLog.Action.CREATE, entityType = AdminLog.EntityType.TRUCK_PRESET, details = "적재함 프리셋 생성")
    @PostMapping
    public TruckPresetResponse create(@Valid @RequestBody PresetRequest request) {
        return TruckPresetController.toResponse(service.create(
                request.label(), request.width(), request.height(), request.sortOrder()));
    }

    @AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.TRUCK_PRESET, details = "적재함 프리셋 수정")
    @PutMapping("/{id}")
    public TruckPresetResponse update(@PathVariable("id") @NonNull Long id,
                                      @Valid @RequestBody PresetRequest request) {
        return TruckPresetController.toResponse(service.update(
                id, request.label(), request.width(), request.height(), request.sortOrder()));
    }

    @AdminLoggable(action = AdminLog.Action.DELETE, entityType = AdminLog.EntityType.TRUCK_PRESET, details = "적재함 프리셋 삭제")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable("id") @NonNull Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
