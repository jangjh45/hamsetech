package com.hamsetech.hamsetech.scenario;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** 적재 시뮬레이터가 쓰는 프리셋 목록. 조회는 로그인한 사용자 누구나 한다. 편집은 관리자 전용이다. */
@RestController
@RequestMapping("/api/truck-presets")
@PreAuthorize("isAuthenticated()")
public class TruckPresetController {

    private final TruckPresetService service;

    public TruckPresetController(TruckPresetService service) {
        this.service = service;
    }

    public record TruckPresetResponse(Long id, String label, Integer width, Integer height, Integer sortOrder) {}

    @GetMapping
    public List<TruckPresetResponse> list() {
        return service.list().stream().map(TruckPresetController::toResponse).toList();
    }

    static TruckPresetResponse toResponse(TruckPreset preset) {
        return new TruckPresetResponse(
                preset.getId(), preset.getLabel(), preset.getWidth(), preset.getHeight(), preset.getSortOrder());
    }
}
