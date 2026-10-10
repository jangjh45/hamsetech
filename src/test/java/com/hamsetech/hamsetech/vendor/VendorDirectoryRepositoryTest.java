package com.hamsetech.hamsetech.vendor;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers(disabledWithoutDocker = true)
@DataJpaTest(properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
@ActiveProfiles("test")
class VendorDirectoryRepositoryTest {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired private VendorCompanyRepository vendorRepository;
    @Autowired private VendorCategoryRepository categoryRepository;
    @Autowired private VendorContactRepository contactRepository;

    @Test
    @DisplayName("업체명과 담당자 이메일을 검색하고 분류·페이지 조건을 함께 적용한다")
    void searchesVendorAndContactFields() {
        VendorCategory category = categoryRepository.findByActiveTrueOrderByNameAsc().getFirst();
        VendorCompany vendor = new VendorCompany();
        vendor.setName("새길 운송");
        vendor.setCategory(category);
        vendor.setCreatedBy("admin");
        vendor.setUpdatedBy("admin");

        VendorContact contact = new VendorContact();
        contact.setName("홍길동");
        contact.setEmail("logistics@example.test");
        contact.setPrimary(true);
        vendor.addContact(contact);
        vendorRepository.saveAndFlush(vendor);

        var byContactEmail = vendorRepository.searchIds("example.test", category.getId(),
                PageRequest.of(0, 10, Sort.by("name").ascending()));
        var byName = vendorRepository.searchIds("새길", null,
                PageRequest.of(0, 10, Sort.by("name").ascending()));
        var wrongCategory = vendorRepository.searchIds("새길", category.getId() + 1000,
                PageRequest.of(0, 10, Sort.by("name").ascending()));

        assertThat(byContactEmail.getContent()).containsExactly(vendor.getId());
        assertThat(byName.getTotalElements()).isEqualTo(1);
        assertThat(wrongCategory.getTotalElements()).isZero();
    }

    @Test
    @DisplayName("업체 수정에서 담당자를 추가·수정·제거할 수 있다")
    void updatesContactCollectionWithOrphanRemoval() {
        VendorCategory category = categoryRepository.findByActiveTrueOrderByNameAsc().getFirst();
        VendorCompany vendor = new VendorCompany();
        vendor.setName("새길 운송");
        vendor.setCategory(category);
        vendor.setCreatedBy("admin");
        vendor.setUpdatedBy("admin");
        VendorContact oldContact = new VendorContact();
        oldContact.setName("이전 담당자");
        vendor.addContact(oldContact);
        Long vendorId = vendorRepository.saveAndFlush(vendor).getId();

        VendorCompany loaded = vendorRepository.findDetailsById(vendorId).orElseThrow();
        VendorContact retained = loaded.getContacts().getFirst();
        retained.setName("변경 담당자");
        VendorContact added = new VendorContact();
        added.setName("새 담당자");
        loaded.addContact(added);
        vendorRepository.saveAndFlush(loaded);

        assertThat(contactRepository.findByVendorIdIn(java.util.List.of(vendorId)))
                .extracting(VendorContact::getName)
                .containsExactly("변경 담당자", "새 담당자");

        loaded.removeContact(retained);
        vendorRepository.saveAndFlush(loaded);

        assertThat(contactRepository.findByVendorIdIn(java.util.List.of(vendorId)))
                .extracting(VendorContact::getName)
                .containsExactly("새 담당자");
    }
}
