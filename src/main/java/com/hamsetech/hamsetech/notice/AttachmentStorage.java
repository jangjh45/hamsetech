package com.hamsetech.hamsetech.notice;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 첨부파일 디스크 입출력.
 *
 * 디스크에 닿는 경로는 전부 여기를 거친다. 파일명은 서버가 만든 UUID만 쓰고
 * 사용자가 보낸 원본 이름은 DB에만 남긴다. 원본 이름을 그대로 쓰면
 * "../../.." 같은 경로나 실행 가능한 확장자가 그대로 디스크에 올라간다.
 */
@Component
public class AttachmentStorage {

    private static final Logger logger = LoggerFactory.getLogger(AttachmentStorage.class);

    private static final DateTimeFormatter MONTH_DIR = DateTimeFormatter.ofPattern("yyyy/MM");

    /** 본문 이미지로 허용할 타입. */
    private static final Set<String> IMAGE_TYPES =
            Set.of("image/png", "image/jpeg", "image/gif", "image/webp");

    /**
     * 일반 첨부로 허용할 타입.
     *
     * image/svg+xml은 일부러 뺐다. SVG는 스크립트를 품을 수 있어서
     * 업로드 후 브라우저로 열면 그대로 저장형 XSS가 된다.
     */
    private static final Set<String> FILE_TYPES = Set.of(
            "image/png", "image/jpeg", "image/gif", "image/webp",
            "application/pdf",
            "application/haansofthwp", "application/x-hwp", "application/vnd.hancom.hwp",
            "application/msword",
            "application/vnd.ms-excel",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "text/plain", "text/csv",
            "application/zip", "application/x-zip-compressed");

    /** 저장 확장자는 원본 파일명이 아니라 검증된 타입에서 얻는다. */
    private static final Map<String, String> EXT_BY_TYPE = Map.ofEntries(
            Map.entry("image/png", "png"),
            Map.entry("image/jpeg", "jpg"),
            Map.entry("image/gif", "gif"),
            Map.entry("image/webp", "webp"),
            Map.entry("application/pdf", "pdf"),
            Map.entry("application/haansofthwp", "hwp"),
            Map.entry("application/x-hwp", "hwp"),
            Map.entry("application/vnd.hancom.hwp", "hwp"),
            Map.entry("application/msword", "doc"),
            Map.entry("application/vnd.ms-excel", "xls"),
            Map.entry("application/vnd.ms-powerpoint", "ppt"),
            Map.entry("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"),
            Map.entry("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"),
            Map.entry("application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"),
            Map.entry("text/plain", "txt"),
            Map.entry("text/csv", "csv"),
            Map.entry("application/zip", "zip"),
            Map.entry("application/x-zip-compressed", "zip"));

    private final UploadProperties properties;
    private Path baseDir;

    public AttachmentStorage(UploadProperties properties) {
        this.properties = properties;
    }

    /** 저장 결과. DB에 남길 값들. */
    public record Stored(String storedFilename, String relativePath, String contentType, long size) {}

    /**
     * 업로드 경로를 만들고 실제로 쓸 수 있는지 확인한다.
     *
     * 권한 문제는 첫 업로드가 아니라 기동 시점에 드러나는 편이 낫다.
     * (비root로 뜨는 prod 컨테이너에서 볼륨이 root 소유로 생기면 여기서 걸린다.)
     */
    @PostConstruct
    void init() {
        baseDir = Path.of(properties.getDir()).toAbsolutePath().normalize();
        try {
            Files.createDirectories(baseDir);
            Path probe = baseDir.resolve(".write-probe");
            Files.writeString(probe, "ok");
            Files.delete(probe);
            logger.info("Notice attachment storage ready at {}", baseDir);
        } catch (IOException e) {
            logger.error("업로드 디렉터리에 쓸 수 없습니다: {} — 첨부파일 업로드가 실패합니다", baseDir, e);
        }
    }

    public Stored store(MultipartFile file, AttachmentKind kind) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("빈 파일은 올릴 수 없습니다");
        }

        long limit = kind == AttachmentKind.IMAGE ? properties.getMaxImageSize() : properties.getMaxFileSize();
        if (file.getSize() > limit) {
            throw new IllegalArgumentException(
                    "파일이 너무 큽니다 (최대 " + (limit / 1024 / 1024) + "MB)");
        }

        String declared = normalizeType(file.getContentType());
        Set<String> allowed = kind == AttachmentKind.IMAGE ? IMAGE_TYPES : FILE_TYPES;
        if (!allowed.contains(declared)) {
            throw new IllegalArgumentException("허용되지 않는 파일 형식입니다");
        }

        // 클라이언트가 보낸 Content-Type은 그대로 믿지 않는다.
        // 이미지는 실제로 디코딩되는지까지 확인해서 확장자만 바꾼 파일을 걸러낸다.
        if (IMAGE_TYPES.contains(declared) && !isReadableImage(file)) {
            throw new IllegalArgumentException("이미지 파일이 아니거나 형식이 올바르지 않습니다");
        }

        String ext = EXT_BY_TYPE.getOrDefault(declared, "bin");
        String storedName = UUID.randomUUID() + "." + ext;
        String relative = YearMonth.now().format(MONTH_DIR) + "/" + storedName;

        Path dest = resolveInside(relative);
        try {
            Files.createDirectories(dest.getParent());
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, dest, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            throw new IllegalStateException("파일 저장에 실패했습니다", e);
        }

        return new Stored(storedName, relative, declared, file.getSize());
    }

    public Path load(String relativePath) {
        return resolveInside(relativePath);
    }

    /** 파일이 없어도 조용히 넘어간다. 이미 지워진 경우가 정상 흐름에 있다. */
    public void delete(String relativePath) {
        try {
            Files.deleteIfExists(resolveInside(relativePath));
        } catch (Exception e) {
            logger.warn("Failed to delete attachment file: {}", relativePath, e);
        }
    }

    /**
     * 업로드 루트 밖으로 나가는 경로를 막는다.
     *
     * 지금은 저장 경로를 서버가 UUID로 만들어 "../"가 끼어들 여지가 없지만,
     * DB 값이 어떤 이유로든 오염되면 이 검사만 남는다.
     */
    private Path resolveInside(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) {
            throw new IllegalArgumentException("잘못된 파일 경로입니다");
        }
        Path resolved = baseDir.resolve(relativePath).normalize();
        if (!resolved.startsWith(baseDir)) {
            throw new IllegalArgumentException("잘못된 파일 경로입니다");
        }
        return resolved;
    }

    private String normalizeType(String contentType) {
        if (contentType == null) return "";
        int semi = contentType.indexOf(';');
        return (semi < 0 ? contentType : contentType.substring(0, semi)).trim().toLowerCase();
    }

    /** ImageIO는 JDK 내장이라 의존성이 늘지 않는다. */
    private boolean isReadableImage(MultipartFile file) {
        try (InputStream in = file.getInputStream()) {
            return ImageIO.read(in) != null;
        } catch (Exception e) {
            return false;
        }
    }
}
