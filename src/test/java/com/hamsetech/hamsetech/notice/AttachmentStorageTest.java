package com.hamsetech.hamsetech.notice;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 첨부파일 디스크 입출력 단위 테스트.
 *
 * 이 클래스는 디스크에 닿는 경로를 전부 거친다. 파일명은 서버가 만든 UUID만 쓰고
 * 사용자가 보낸 원본 이름은 DB에만 남기는데, 그 경계를 여기서 확인한다.
 *
 * 기동 시점에 만드는 업로드 디렉터리(@TempDir 아래)와 실패해도 조용히 넘어가는
 * 점까지 그대로 재현한다. Thread 관여가 없어 Mockito가 필요 없다.
 */
class AttachmentStorageTest {

    @TempDir
    Path tempDir;

    private AttachmentStorage storage;

    @BeforeEach
    void setUp() {
        UploadProperties props = new UploadProperties();
        props.setDir(tempDir.toString());
        storage = new AttachmentStorage(props);
        storage.init();
    }

    /** ImageIO가 실제로 풀 수 있는 PNG 바이트. 위조 이미지 테스트의 기준이 된다. */
    private static byte[] realPng() throws Exception {
        BufferedImage img = new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    private MultipartFile file(String name, String type, byte[] body) {
        return new MockMultipartFile("file", name, type, body);
    }

    private static final byte[] PNG = safePng();

    private static byte[] safePng() {
        try {
            return realPng();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @Nested
    @DisplayName("저장 경로를 지킨다")
    class Store {

        @Test
        @DisplayName("원본 파일명이 아니라 UUID로 저장한다")
        void usesUuidName() throws Exception {
            AttachmentStorage.Stored stored = storage.store(
                    file("../../etc/passwd.png", "image/png", PNG), AttachmentKind.IMAGE);

            // 경로 조작이 먹히면 안 된다. 저장 파일명에는 원본 이름이 절대 없다.
            assertThat(stored.storedFilename()).doesNotContain("passwd").doesNotContain("..");
            assertThat(Files.exists(tempDir.resolve(stored.relativePath()))).isTrue();
        }

        @Test
        @DisplayName("저장 확장자는 검증된 타입에서 온다")
        void extensionFromTypeNotName() throws Exception {
            // 확장자만 바꿔서 올린 파일도 타입 기준으로 확장자를 정한다.
            AttachmentStorage.Stored stored = storage.store(
                    file("photo.gif", "image/png", PNG), AttachmentKind.IMAGE);
            assertThat(stored.storedFilename()).endsWith(".png");
            assertThat(stored.contentType()).isEqualTo("image/png");
        }

        @Test
        @DisplayName("저장 경로는 연-월 폴더 아래에 놓인다")
        void storesUnderYearMonth() throws Exception {
            AttachmentStorage.Stored stored = storage.store(
                    file("a.png", "image/png", PNG), AttachmentKind.IMAGE);
            assertThat(stored.relativePath()).matches("\\d{4}/\\d{2}/[0-9a-f\\-]+\\.png");
        }

        @Test
        @DisplayName("빈 파일은 거부한다")
        void rejectsEmpty() {
            assertThatThrownBy(() -> storage.store(
                    file("a.png", "image/png", new byte[0]), AttachmentKind.IMAGE))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("빈 파일");
        }

        @Test
        @DisplayName("null 파일도 거부한다")
        void rejectsNull() {
            assertThatThrownBy(() -> storage.store(null, AttachmentKind.IMAGE))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    @DisplayName("형식 검증")
    class TypeValidation {

        @Test
        @DisplayName("SVG는 저장형 XSS라 일부러 막는다")
        void svgRejected() {
            // SVG는 스크립트를 품을 수 있어서 업로드 후 브라우저로 열면 그대로
            // 저장형 XSS가 된다. 화이트리스트에서 뺀 값을 여기서 확인한다.
            assertThatThrownBy(() -> storage.store(
                    file("x.svg", "image/svg+xml", "<svg onload=\"alert(1)\"/>".getBytes(StandardCharsets.UTF_8)),
                    AttachmentKind.FILE))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("허용되지 않는");
        }

        @Test
        @DisplayName("클라이언트가 보낸 Content-Type을 그대로 믿지 않는다")
        void rejectsDisguisedImage() throws Exception {
            // 확장자만 바꾼 위조 이미지. isReadableImage()가 실제로 디코딩해 본다.
            assertThatThrownBy(() -> storage.store(
                    file("evil.png", "image/png", "이건 이미지가 아니다".getBytes(StandardCharsets.UTF_8)),
                    AttachmentKind.IMAGE))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("이미지 파일이 아니거나");
        }

        @Test
        @DisplayName("Content-Type에 매개변수가 붙어도 정규화해서 통과시킨다")
        void normalizesContentTypeWithParameters() throws Exception {
            AttachmentStorage.Stored stored = storage.store(
                    file("a.png", "image/png; charset=binary", PNG), AttachmentKind.IMAGE);
            assertThat(stored.contentType()).isEqualTo("image/png");
        }

        @Test
        @DisplayName("일반 첨부는 20MB까지 받는다")
        void fileUsesFileLimit() throws Exception {
            // 6MB는 20MB 상한 안이므로 통과해야 한다. 아래 imageUsesImageLimit와
            // 같은 크기를 쓴다 — 상한이 kind로 갈리는지 보려면 두 값 사이에 있어야 한다.
            AttachmentStorage.Stored stored = storage.store(
                    file("big.txt", "text/plain", bigBytes(6)), AttachmentKind.FILE);
            assertThat(stored.size()).isEqualTo(6L * 1024 * 1024);
        }

        @Test
        @DisplayName("본문 이미지는 5MB 상한이라 같은 6MB도 거절한다")
        void imageUsesImageLimit() throws Exception {
            assertThatThrownBy(() -> storage.store(
                    file("big.png", "image/png", bigBytes(6)), AttachmentKind.IMAGE))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("너무 큽니다");
        }

        private byte[] bigBytes(int mb) {
            byte[] big = new byte[mb * 1024 * 1024];
            java.util.Arrays.fill(big, (byte) 'a');
            return big;
        }
    }

    @Nested
    @DisplayName("경로 탈출을 막는다")
    class PathEscape {

        @Test
        @DisplayName("업로드 루트 밖으로 나가는 상대 경로를 거절한다")
        void rejectsTraversal() {
            // 지금 저장 경로는 서버가 UUID로 만들기 때문에 "../"가 끼어들 여지가
            // 없다. 하지만 DB 값이 오염되면 이 검사만 남는다.
            assertThatThrownBy(() -> storage.load("../../etc/passwd"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("잘못된 파일 경로");
        }

        @Test
        @DisplayName("빈 경로도 거절한다")
        void rejectsBlankPath() {
            assertThatThrownBy(() -> storage.load(" "))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("루트 안의 경로는 통과시킨다")
        void allowsInsideRoot() throws Exception {
            AttachmentStorage.Stored stored = storage.store(
                    file("a.png", "image/png", PNG), AttachmentKind.IMAGE);
            assertThat(storage.load(stored.relativePath())).startsWith(tempDir.toAbsolutePath().normalize());
        }
    }

    @Nested
    @DisplayName("삭제는 조용히 넘어간다")
    class Delete {

        @Test
        @DisplayName("이미 없는 파일을 지워도 예외가 없다")
        void missingFileIsFine() {
            assertThatCode(() -> storage.delete("2020/01/nothing.png")).doesNotThrowAnyException();
        }

        @Test
        @DisplayName("저장한 파일은 실제로 지워진다")
        void deletesStoredFile() throws Exception {
            AttachmentStorage.Stored stored = storage.store(
                    file("a.png", "image/png", PNG), AttachmentKind.IMAGE);
            Path path = tempDir.resolve(stored.relativePath());
            assertThat(path).exists();
            storage.delete(stored.relativePath());
            assertThat(path).doesNotExist();
        }
    }
}