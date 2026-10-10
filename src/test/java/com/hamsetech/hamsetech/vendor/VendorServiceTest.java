package com.hamsetech.hamsetech.vendor;

import com.hamsetech.hamsetech.security.SecurityUtils;
import com.hamsetech.hamsetech.vendor.VendorRequests.ContactInput;
import com.hamsetech.hamsetech.vendor.VendorRequests.VendorInput;
import com.hamsetech.hamsetech.web.ApiExceptions.ConflictException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VendorServiceTest {
    @Mock private VendorCompanyRepository vendorRepository;
    @Mock private VendorContactRepository contactRepository;
    @Mock private VendorCategoryRepository categoryRepository;
    @Mock private SecurityUtils securityUtils;

    private VendorService service;

    @BeforeEach
    void setUp() {
        service = new VendorService(vendorRepository, contactRepository, categoryRepository, securityUtils);
    }

    private VendorCategory category(boolean active) {
        VendorCategory category = new VendorCategory();
        ReflectionTestUtils.setField(category, "id", 4L);
        category.setName("운송·택배");
        category.setActive(active);
        return category;
    }

    private VendorInput input(Long categoryId, List<ContactInput> contacts) {
        return new VendorInput("  한빛 물류  ", categoryId, "", "02-1111-2222", "", "", "", "", contacts);
    }

    @Test
    @DisplayName("사업자등록번호와 주소를 비워도 업체를 등록하고 등록자를 기록한다")
    void createsVendorWithoutOptionalRegistrationAndAddress() {
        VendorCategory category = category(true);
        when(categoryRepository.findById(4L)).thenReturn(Optional.of(category));
        when(securityUtils.currentUsernameOrThrow()).thenReturn("minsu");
        when(vendorRepository.save(any())).thenAnswer(invocation -> {
            VendorCompany vendor = invocation.getArgument(0);
            ReflectionTestUtils.setField(vendor, "id", 15L);
            return vendor;
        });
        when(vendorRepository.findDetailsById(15L)).thenReturn(Optional.empty());

        var created = service.create(input(4L, List.of()));

        assertThat(created.name()).isEqualTo("한빛 물류");
        assertThat(created.businessRegistrationNo()).isNull();
        assertThat(created.address()).isNull();
        assertThat(created.createdBy()).isEqualTo("minsu");
        assertThat(created.contacts()).isEmpty();
    }

    @Test
    @DisplayName("새 업체에는 비활성 분류를 지정할 수 없다")
    void cannotCreateVendorWithInactiveCategory() {
        when(categoryRepository.findById(4L)).thenReturn(Optional.of(category(false)));

        assertThatThrownBy(() -> service.create(input(4L, List.of())))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("사용 중지");
        verify(vendorRepository, never()).save(any());
    }

    @Test
    @DisplayName("한 업체의 대표 담당자는 최대 한 명이다")
    void allowsAtMostOnePrimaryContact() {
        ContactInput first = new ContactInput(null, "담당자1", null, null, null, null, null, null, true);
        ContactInput second = new ContactInput(null, "담당자2", null, null, null, null, null, null, true);

        assertThatThrownBy(() -> service.create(input(4L, List.of(first, second))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("한 명만");
        verify(categoryRepository, never()).findById(any());
        verify(vendorRepository, never()).save(any());
    }

    @Test
    @DisplayName("업체를 만든 사람이 아니어도 로그인한 사용자는 수정할 수 있고 수정자를 갱신한다")
    void anyAuthenticatedUserCanUpdateAndAttributionChanges() {
        VendorCategory category = category(true);
        VendorCompany vendor = new VendorCompany();
        ReflectionTestUtils.setField(vendor, "id", 15L);
        vendor.setName("이전 이름");
        vendor.setCategory(category);
        vendor.setCreatedBy("first-user");
        vendor.setUpdatedBy("first-user");

        when(vendorRepository.findDetailsById(15L)).thenReturn(Optional.of(vendor));
        when(categoryRepository.findById(4L)).thenReturn(Optional.of(category));
        when(securityUtils.currentUsernameOrThrow()).thenReturn("another-user");
        when(vendorRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var updated = service.update(15L, input(4L, List.of()));

        assertThat(updated.name()).isEqualTo("한빛 물류");
        assertThat(updated.createdBy()).isEqualTo("first-user");
        assertThat(updated.updatedBy()).isEqualTo("another-user");
    }
}
