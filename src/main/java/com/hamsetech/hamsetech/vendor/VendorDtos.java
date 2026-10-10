package com.hamsetech.hamsetech.vendor;

import java.time.Instant;
import java.util.List;

public final class VendorDtos {
    private VendorDtos() {}

    public record CategoryResponse(Long id, String name, boolean active) {}

    public record ContactResponse(
            Long id,
            String name,
            String department,
            String position,
            String phone,
            String mobile,
            String email,
            String memo,
            boolean primary
    ) {}

    public record VendorSummary(
            Long id,
            String name,
            Long categoryId,
            String categoryName,
            String mainPhone,
            String mainEmail,
            String primaryContactName,
            String primaryContactPhone
    ) {}

    public record VendorDetail(
            Long id,
            String name,
            Long categoryId,
            String categoryName,
            String businessRegistrationNo,
            String mainPhone,
            String mainEmail,
            String address,
            String website,
            String memo,
            String createdBy,
            String updatedBy,
            Instant createdAt,
            Instant updatedAt,
            List<ContactResponse> contacts
    ) {}
}
