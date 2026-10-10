package com.hamsetech.hamsetech.vendor;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public final class VendorRequests {
    private VendorRequests() {}

    public record ContactInput(
            Long id,
            @NotBlank(message = "담당자 이름을 입력해주세요")
            @Size(max = 120, message = "담당자 이름은 120자 이하여야 합니다") String name,
            @Size(max = 120, message = "부서는 120자 이하여야 합니다") String department,
            @Size(max = 120, message = "직책은 120자 이하여야 합니다") String position,
            @Size(max = 50, message = "전화번호는 50자 이하여야 합니다") String phone,
            @Size(max = 50, message = "휴대전화는 50자 이하여야 합니다") String mobile,
            @Email(message = "올바른 이메일 주소를 입력해주세요")
            @Size(max = 254, message = "이메일은 254자 이하여야 합니다") String email,
            @Size(max = 5000, message = "담당자 메모는 5000자 이하여야 합니다") String memo,
            Boolean primary
    ) {}

    public record VendorInput(
            @NotBlank(message = "업체명을 입력해주세요")
            @Size(max = 200, message = "업체명은 200자 이하여야 합니다") String name,
            @NotNull(message = "분류를 선택해주세요") Long categoryId,
            @Size(max = 32, message = "사업자등록번호는 32자 이하여야 합니다") String businessRegistrationNo,
            @Size(max = 50, message = "대표 전화번호는 50자 이하여야 합니다") String mainPhone,
            @Email(message = "올바른 이메일 주소를 입력해주세요")
            @Size(max = 254, message = "대표 이메일은 254자 이하여야 합니다") String mainEmail,
            @Size(max = 500, message = "주소는 500자 이하여야 합니다") String address,
            @Size(max = 500, message = "웹사이트 주소는 500자 이하여야 합니다") String website,
            @Size(max = 5000, message = "메모는 5000자 이하여야 합니다") String memo,
            @NotNull(message = "담당자 목록을 입력해주세요") List<@Valid ContactInput> contacts
    ) {}
}
