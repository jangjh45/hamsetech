package com.hamsetech.hamsetech.vendor;

import com.hamsetech.hamsetech.admin.AdminLog;
import com.hamsetech.hamsetech.admin.AdminLoggable;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

import static com.hamsetech.hamsetech.vendor.VendorDtos.CategoryResponse;

@RestController
@RequestMapping("/api/vendor-categories")
@PreAuthorize("isAuthenticated()")
public class VendorCategoryController {
    private final VendorCategoryService service;

    public VendorCategoryController(VendorCategoryService service) {
        this.service = service;
    }

    public record CreateCategoryRequest(
            @NotBlank(message = "분류명을 입력해주세요")
            @Size(max = 80, message = "분류명은 80자 이하여야 합니다") String name) {}

    public record UpdateCategoryRequest(
            @NotBlank(message = "분류명을 입력해주세요")
            @Size(max = 80, message = "분류명은 80자 이하여야 합니다") String name,
            boolean active) {}

    @AdminLoggable(action = AdminLog.Action.READ, entityType = AdminLog.EntityType.VENDOR_CATEGORY,
            details = "사용 중인 업체 분류 조회")
    @GetMapping
    public List<CategoryResponse> listActive() {
        return service.listActive();
    }

    @AdminLoggable(action = AdminLog.Action.READ, entityType = AdminLog.EntityType.VENDOR_CATEGORY,
            details = "업체 분류 관리 목록 조회")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    @GetMapping("/manage")
    public List<CategoryResponse> listAll() {
        return service.listAll();
    }

    @AdminLoggable(action = AdminLog.Action.CREATE, entityType = AdminLog.EntityType.VENDOR_CATEGORY,
            details = "업체 분류 등록")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    @PostMapping
    public CategoryResponse create(@Valid @RequestBody CreateCategoryRequest request) {
        return service.create(request.name());
    }

    @AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.VENDOR_CATEGORY,
            details = "업체 분류 수정")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    @PutMapping("/{id}")
    public CategoryResponse update(@PathVariable("id") Long id,
                                   @Valid @RequestBody UpdateCategoryRequest request) {
        return service.update(id, request.name(), request.active());
    }
}
