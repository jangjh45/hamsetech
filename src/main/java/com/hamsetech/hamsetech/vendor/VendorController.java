package com.hamsetech.hamsetech.vendor;

import com.hamsetech.hamsetech.admin.AdminLog;
import com.hamsetech.hamsetech.admin.AdminLoggable;
import com.hamsetech.hamsetech.vendor.VendorRequests.VendorInput;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import static com.hamsetech.hamsetech.vendor.VendorDtos.VendorDetail;
import static com.hamsetech.hamsetech.vendor.VendorDtos.VendorSummary;

@RestController
@RequestMapping("/api/vendors")
@PreAuthorize("isAuthenticated()")
public class VendorController {
    private static final int MAX_PAGE_SIZE = 100;

    private final VendorService service;

    public VendorController(VendorService service) {
        this.service = service;
    }

    @AdminLoggable(action = AdminLog.Action.READ, entityType = AdminLog.EntityType.VENDOR,
            details = "업체 주소록 목록 조회", adminOnly = false)
    @GetMapping
    public Page<VendorSummary> list(@RequestParam(defaultValue = "") String q,
                                    @RequestParam(required = false) Long categoryId,
                                    @RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "20") int size) {
        if (page < 0) throw new IllegalArgumentException("페이지 번호가 올바르지 않습니다.");
        if (size < 1) throw new IllegalArgumentException("페이지 크기가 올바르지 않습니다.");
        return service.search(q, categoryId,
                PageRequest.of(page, Math.min(size, MAX_PAGE_SIZE), Sort.by(Sort.Direction.ASC, "name")));
    }

    @AdminLoggable(action = AdminLog.Action.READ, entityType = AdminLog.EntityType.VENDOR,
            details = "업체 상세 조회", adminOnly = false)
    @GetMapping("/{id}")
    public VendorDetail get(@PathVariable("id") Long id) {
        return service.get(id);
    }

    @AdminLoggable(action = AdminLog.Action.CREATE, entityType = AdminLog.EntityType.VENDOR,
            details = "업체 등록", adminOnly = false)
    @PostMapping
    public VendorDetail create(@Valid @RequestBody VendorInput input) {
        return service.create(input);
    }

    @AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.VENDOR,
            details = "업체 정보 수정", adminOnly = false)
    @PutMapping("/{id}")
    public VendorDetail update(@PathVariable("id") Long id, @Valid @RequestBody VendorInput input) {
        return service.update(id, input);
    }
}
