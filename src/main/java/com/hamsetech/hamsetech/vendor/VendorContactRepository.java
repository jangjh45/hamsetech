package com.hamsetech.hamsetech.vendor;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface VendorContactRepository extends JpaRepository<VendorContact, Long> {
    List<VendorContact> findByVendorIdIn(Collection<Long> vendorIds);
}
