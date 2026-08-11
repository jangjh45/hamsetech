package com.hamsetech.hamsetech.notice;

import com.hamsetech.hamsetech.admin.AdminLog;
import com.hamsetech.hamsetech.admin.AdminLoggable;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

@RestController
@RequestMapping("/api/notices/attachments")
public class NoticeAttachmentController {

    private final NoticeAttachmentService attachmentService;
    private final AttachmentStorage storage;

    public NoticeAttachmentController(NoticeAttachmentService attachmentService,
                                      AttachmentStorage storage) {
        this.attachmentService = attachmentService;
        this.storage = storage;
    }

    @AdminLoggable(action = AdminLog.Action.CREATE, entityType = AdminLog.EntityType.NOTICE,
            details = "공지 첨부파일 업로드")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    @PostMapping
    public NoticeAttachmentDto upload(@RequestParam("file") MultipartFile file,
                                      @RequestParam(name = "kind", defaultValue = "FILE") AttachmentKind kind) {
        return attachmentService.upload(file, kind);
    }

    /**
     * 파일 내려받기. 조회는 로그인한 사람이면 누구나 할 수 있다.
     *
     * 여기에는 @AdminLoggable을 붙이지 않는다. 본문 이미지가 여러 개인 글을 열 때마다
     * 조회 로그가 이미지 수만큼 쌓여 AdminReadLog가 금방 불어난다.
     */
    @GetMapping("/{id}/content")
    public ResponseEntity<Resource> content(@PathVariable @NonNull Long id) {
        NoticeAttachment a = attachmentService.get(id);
        if (a == null) return ResponseEntity.notFound().build();

        Path path = storage.load(a.getRelativePath());
        if (!Files.exists(path)) return ResponseEntity.notFound().build();

        HttpHeaders headers = new HttpHeaders();
        // 브라우저가 내용을 보고 타입을 다시 추측하지 못하게 한다
        headers.add("X-Content-Type-Options", "nosniff");
        headers.add(HttpHeaders.CACHE_CONTROL, "private, max-age=3600");

        if (a.getKind() == AttachmentKind.IMAGE) {
            // 본문에 그려야 하므로 inline. 여기까지 온 것은 검증을 통과한 이미지뿐이다.
            headers.add(HttpHeaders.CONTENT_TYPE, a.getContentType());
            headers.add(HttpHeaders.CONTENT_DISPOSITION, "inline");
        } else {
            // 일반 첨부는 브라우저가 절대 해석하지 못하게 한다.
            // .html이나 .js를 올려도 실행되지 않고 그대로 내려받힌다.
            headers.add(HttpHeaders.CONTENT_TYPE, "application/octet-stream");
            headers.add(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(a.getOriginalFilename()));
        }

        return ResponseEntity.ok().headers(headers).body(new FileSystemResource(path));
    }

    @AdminLoggable(action = AdminLog.Action.DELETE, entityType = AdminLog.EntityType.NOTICE,
            details = "공지 첨부파일 삭제")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable @NonNull Long id) {
        return attachmentService.deleteById(id)
                ? ResponseEntity.ok(Map.of("deleted", true))
                : ResponseEntity.notFound().build();
    }

    /** 한글 파일명은 ASCII 폴백과 RFC 5987 형식을 함께 준다 (OvertimeRecordController와 같은 방식). */
    private String contentDisposition(String filename) {
        String encoded = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20");
        String ascii = filename.replaceAll("[^\\x20-\\x7E]", "_");
        return "attachment; filename=\"" + ascii + "\"; filename*=UTF-8''" + encoded;
    }
}
