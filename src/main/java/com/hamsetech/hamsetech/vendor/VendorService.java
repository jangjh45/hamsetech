package com.hamsetech.hamsetech.vendor;

import com.hamsetech.hamsetech.security.SecurityUtils;
import com.hamsetech.hamsetech.web.ApiExceptions.ConflictException;
import com.hamsetech.hamsetech.web.ApiExceptions.NotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.hamsetech.hamsetech.vendor.VendorDtos.ContactResponse;
import static com.hamsetech.hamsetech.vendor.VendorDtos.VendorDetail;
import static com.hamsetech.hamsetech.vendor.VendorDtos.VendorSummary;
import static com.hamsetech.hamsetech.vendor.VendorRequests.ContactInput;
import static com.hamsetech.hamsetech.vendor.VendorRequests.VendorInput;

@Service
@Transactional
public class VendorService {
    private static final Comparator<VendorContact> CONTACT_ORDER =
            Comparator.comparing(VendorContact::isPrimary).reversed()
                    .thenComparingInt(VendorContact::getSortOrder)
                    .thenComparing(VendorContact::getId, Comparator.nullsLast(Comparator.naturalOrder()));

    private final VendorCompanyRepository vendorRepository;
    private final VendorContactRepository contactRepository;
    private final VendorCategoryRepository categoryRepository;
    private final SecurityUtils securityUtils;

    public VendorService(VendorCompanyRepository vendorRepository,
                         VendorContactRepository contactRepository,
                         VendorCategoryRepository categoryRepository,
                         SecurityUtils securityUtils) {
        this.vendorRepository = vendorRepository;
        this.contactRepository = contactRepository;
        this.categoryRepository = categoryRepository;
        this.securityUtils = securityUtils;
    }

    @Transactional(readOnly = true)
    public Page<VendorSummary> search(String query, Long categoryId, Pageable pageable) {
        String normalizedQuery = query == null ? "" : query.trim();
        Page<Long> ids = vendorRepository.searchIds(normalizedQuery, categoryId, pageable);
        if (ids.isEmpty()) return ids.map(id -> null);

        Map<Long, VendorCompany> vendors = vendorRepository.findByIdIn(ids.getContent()).stream()
                .collect(Collectors.toMap(VendorCompany::getId, Function.identity()));
        Map<Long, List<VendorContact>> contacts = contactRepository.findByVendorIdIn(ids.getContent()).stream()
                .collect(Collectors.groupingBy(contact -> contact.getVendor().getId()));

        return ids.map(id -> toSummary(vendors.get(id), contacts.getOrDefault(id, List.of())));
    }

    @Transactional(readOnly = true)
    public VendorDetail get(Long id) {
        VendorCompany vendor = vendorRepository.findDetailsById(id)
                .orElseThrow(() -> new NotFoundException("업체를 찾을 수 없습니다."));
        List<ContactResponse> contacts = vendor.getContacts().stream()
                .sorted(CONTACT_ORDER)
                .map(this::toContactResponse)
                .toList();
        return toDetail(vendor, contacts);
    }

    public VendorDetail create(VendorInput input) {
        validatePrimaryContacts(input.contacts());
        VendorCategory category = requireCategory(input.categoryId(), null);
        String username = securityUtils.currentUsernameOrThrow();

        VendorCompany vendor = new VendorCompany();
        apply(vendor, input, category);
        vendor.setCreatedBy(username);
        vendor.setUpdatedBy(username);
        applyContacts(vendor, input.contacts());
        return getSavedDetails(vendorRepository.save(vendor));
    }

    public VendorDetail update(Long id, VendorInput input) {
        validatePrimaryContacts(input.contacts());
        VendorCompany vendor = vendorRepository.findDetailsById(id)
                .orElseThrow(() -> new NotFoundException("업체를 찾을 수 없습니다."));
        VendorCategory category = requireCategory(input.categoryId(), vendor.getCategory().getId());

        apply(vendor, input, category);
        vendor.setUpdatedBy(securityUtils.currentUsernameOrThrow());
        applyContacts(vendor, input.contacts());
        vendor.touch();
        vendorRepository.save(vendor);
        return toDetail(vendor, vendor.getContacts().stream()
                .sorted(CONTACT_ORDER).map(this::toContactResponse).toList());
    }

    private VendorCategory requireCategory(Long categoryId, Long currentCategoryId) {
        VendorCategory category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new NotFoundException("분류를 찾을 수 없습니다."));
        if (!category.isActive() && !category.getId().equals(currentCategoryId)) {
            throw new ConflictException("사용 중지된 분류는 새 업체에 지정할 수 없습니다.");
        }
        return category;
    }

    private void apply(VendorCompany vendor, VendorInput input, VendorCategory category) {
        vendor.setName(input.name().trim());
        vendor.setCategory(category);
        vendor.setBusinessRegistrationNo(clean(input.businessRegistrationNo()));
        vendor.setMainPhone(clean(input.mainPhone()));
        vendor.setMainEmail(clean(input.mainEmail()));
        vendor.setAddress(clean(input.address()));
        vendor.setWebsite(clean(input.website()));
        vendor.setMemo(clean(input.memo()));
    }

    private void applyContacts(VendorCompany vendor, List<ContactInput> inputs) {
        Map<Long, VendorContact> existing = new HashMap<>();
        for (VendorContact contact : new ArrayList<>(vendor.getContacts())) {
            if (contact.getId() != null) existing.put(contact.getId(), contact);
        }

        Set<Long> retainedIds = new HashSet<>();
        for (int index = 0; index < inputs.size(); index++) {
            ContactInput input = inputs.get(index);
            VendorContact contact;
            if (input.id() == null) {
                contact = new VendorContact();
                vendor.addContact(contact);
            } else {
                contact = existing.get(input.id());
                if (contact == null || !retainedIds.add(input.id())) {
                    throw new NotFoundException("담당자 정보가 변경되었습니다. 화면을 새로고침해주세요.");
                }
            }
            contact.setName(input.name().trim());
            contact.setDepartment(clean(input.department()));
            contact.setPosition(clean(input.position()));
            contact.setPhone(clean(input.phone()));
            contact.setMobile(clean(input.mobile()));
            contact.setEmail(clean(input.email()));
            contact.setMemo(clean(input.memo()));
            contact.setPrimary(Boolean.TRUE.equals(input.primary()));
            contact.setSortOrder(index);
        }

        for (VendorContact contact : new ArrayList<>(vendor.getContacts())) {
            if (contact.getId() != null && !retainedIds.contains(contact.getId())) {
                vendor.removeContact(contact);
            }
        }
    }

    private void validatePrimaryContacts(List<ContactInput> contacts) {
        long count = contacts.stream().filter(contact -> Boolean.TRUE.equals(contact.primary())).count();
        if (count > 1) throw new IllegalArgumentException("대표 담당자는 한 명만 지정할 수 있습니다.");
    }

    private VendorDetail getSavedDetails(VendorCompany vendor) {
        VendorCompany saved = vendorRepository.findDetailsById(vendor.getId()).orElse(vendor);
        return toDetail(saved, saved.getContacts().stream()
                .sorted(CONTACT_ORDER).map(this::toContactResponse).toList());
    }

    private VendorSummary toSummary(VendorCompany vendor, List<VendorContact> contacts) {
        VendorContact primary = contacts.stream().min(CONTACT_ORDER).orElse(null);
        return new VendorSummary(
                vendor.getId(), vendor.getName(), vendor.getCategory().getId(), vendor.getCategory().getName(),
                vendor.getMainPhone(), vendor.getMainEmail(),
                primary == null ? null : primary.getName(),
                primary == null ? null : firstNonBlank(primary.getMobile(), primary.getPhone()));
    }

    private VendorDetail toDetail(VendorCompany vendor, List<ContactResponse> contacts) {
        return new VendorDetail(
                vendor.getId(), vendor.getName(), vendor.getCategory().getId(), vendor.getCategory().getName(),
                vendor.getBusinessRegistrationNo(), vendor.getMainPhone(), vendor.getMainEmail(),
                vendor.getAddress(), vendor.getWebsite(), vendor.getMemo(), vendor.getCreatedBy(),
                vendor.getUpdatedBy(), vendor.getCreatedAt(), vendor.getUpdatedAt(), contacts);
    }

    private ContactResponse toContactResponse(VendorContact contact) {
        return new ContactResponse(contact.getId(), contact.getName(), contact.getDepartment(),
                contact.getPosition(), contact.getPhone(), contact.getMobile(), contact.getEmail(),
                contact.getMemo(), contact.isPrimary());
    }

    private String firstNonBlank(String first, String second) {
        return first != null && !first.isBlank() ? first : second;
    }

    private String clean(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
