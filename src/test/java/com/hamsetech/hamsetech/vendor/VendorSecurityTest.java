package com.hamsetech.hamsetech.vendor;

import com.hamsetech.hamsetech.config.SecurityConfig;
import com.hamsetech.hamsetech.security.SessionAuthenticationFilter;
import com.hamsetech.hamsetech.user.UserAccountRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@WebMvcTest(controllers = {VendorController.class, VendorCategoryController.class})
@Import({SecurityConfig.class, SessionAuthenticationFilter.class})
@ActiveProfiles("test")
class VendorSecurityTest {

    private static RequestPostProcessor testSecurityContext() {
        return request -> {
            var authenticated = org.springframework.security.test.web.servlet.request
                    .SecurityMockMvcRequestPostProcessors.testSecurityContext().postProcessRequest(request);
            return csrf().postProcessRequest(authenticated);
        };
    }
    @Autowired private MockMvc mvc;

    @MockitoBean private VendorService vendorService;
    @MockitoBean private VendorCategoryService categoryService;
    @MockitoBean private UserAccountRepository userAccountRepository;

    @Test
    @WithMockUser(roles = "USER")
    @DisplayName("일반 사용자는 업체를 등록할 수 있다")
    void regularUserCanCreateVendor() throws Exception {
        when(vendorService.create(any())).thenReturn(new VendorDtos.VendorDetail(
                1L, "한빛물류", 2L, "운송·택배", null, null, null, null, null, null,
                "user", "user", null, null, List.of()));

        mvc.perform(post("/api/vendors")
                        .with(testSecurityContext())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"한빛물류","categoryId":2,"contacts":[]}
                                """))
                .andExpect(status().isOk());

        verify(vendorService).create(any());
    }

    @Test
    @WithMockUser(roles = "USER")
    @DisplayName("일반 사용자는 분류를 추가할 수 없다")
    void regularUserCannotCreateVendorCategory() throws Exception {
        mvc.perform(post("/api/vendor-categories")
                        .with(testSecurityContext())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"새 분류\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("관리자는 업체 분류를 추가할 수 있다")
    void adminCanCreateVendorCategory() throws Exception {
        when(categoryService.create("새 분류")).thenReturn(new VendorDtos.CategoryResponse(8L, "새 분류", true));

        mvc.perform(post("/api/vendor-categories")
                        .with(testSecurityContext())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"새 분류\"}"))
                .andExpect(status().isOk());

        verify(categoryService).create("새 분류");
    }
}
