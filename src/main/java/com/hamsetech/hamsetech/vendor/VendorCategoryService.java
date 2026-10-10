package com.hamsetech.hamsetech.vendor;

import com.hamsetech.hamsetech.security.SecurityUtils;
import com.hamsetech.hamsetech.web.ApiExceptions.ConflictException;
import com.hamsetech.hamsetech.web.ApiExceptions.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static com.hamsetech.hamsetech.vendor.VendorDtos.CategoryResponse;

@Service
@Transactional
public class VendorCategoryService {
    private final VendorCategoryRepository repository;
    private final SecurityUtils securityUtils;

    public VendorCategoryService(VendorCategoryRepository repository, SecurityUtils securityUtils) {
        this.repository = repository;
        this.securityUtils = securityUtils;
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> listActive() {
        return repository.findByActiveTrueOrderByNameAsc().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> listAll() {
        return repository.findAllByOrderByNameAsc().stream().map(this::toResponse).toList();
    }

    public CategoryResponse create(String name) {
        String normalized = normalizeName(name);
        if (repository.existsByNameIgnoreCase(normalized)) {
            throw new ConflictException("이미 등록된 분류입니다.");
        }
        String username = securityUtils.currentUsernameOrThrow();
        VendorCategory category = new VendorCategory();
        category.setName(normalized);
        category.setActive(true);
        category.setCreatedBy(username);
        category.setUpdatedBy(username);
        return toResponse(repository.save(category));
    }

    public CategoryResponse update(Long id, String name, boolean active) {
        VendorCategory category = repository.findById(id)
                .orElseThrow(() -> new NotFoundException("분류를 찾을 수 없습니다."));
        String normalized = normalizeName(name);
        if (repository.findByNameIgnoreCaseAndIdNot(normalized, id).isPresent()) {
            throw new ConflictException("이미 등록된 분류입니다.");
        }
        category.setName(normalized);
        category.setActive(active);
        category.setUpdatedBy(securityUtils.currentUsernameOrThrow());
        return toResponse(repository.save(category));
    }

    private String normalizeName(String name) {
        if (name == null || name.isBlank()) throw new IllegalArgumentException("분류명을 입력해주세요.");
        String normalized = name.trim();
        if (normalized.length() > 80) throw new IllegalArgumentException("분류명은 80자 이하여야 합니다.");
        return normalized;
    }

    private CategoryResponse toResponse(VendorCategory category) {
        return new CategoryResponse(category.getId(), category.getName(), category.isActive());
    }
}
