package com.hamsetech.hamsetech.vendor;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface VendorCategoryRepository extends JpaRepository<VendorCategory, Long> {
    List<VendorCategory> findByActiveTrueOrderByNameAsc();
    List<VendorCategory> findAllByOrderByNameAsc();
    boolean existsByNameIgnoreCase(String name);
    Optional<VendorCategory> findByNameIgnoreCaseAndIdNot(String name, Long id);
}
