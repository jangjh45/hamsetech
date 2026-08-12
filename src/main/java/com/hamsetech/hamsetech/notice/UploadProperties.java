package com.hamsetech.hamsetech.notice;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.upload")
public class UploadProperties {

    /** 업로드 루트. 컨테이너에서는 도커 볼륨이 붙는 /app/uploads. */
    private String dir = "./uploads";

    /** 본문 삽입 이미지 상한(바이트). */
    private long maxImageSize = 5L * 1024 * 1024;

    /** 일반 첨부 상한(바이트). */
    private long maxFileSize = 20L * 1024 * 1024;

    /** 글에 붙지 못한 첨부를 지우기까지 기다리는 시간. */
    private int orphanRetentionHours = 24;

    public String getDir() { return dir; }
    public void setDir(String dir) { this.dir = dir; }
    public long getMaxImageSize() { return maxImageSize; }
    public void setMaxImageSize(long maxImageSize) { this.maxImageSize = maxImageSize; }
    public long getMaxFileSize() { return maxFileSize; }
    public void setMaxFileSize(long maxFileSize) { this.maxFileSize = maxFileSize; }
    public int getOrphanRetentionHours() { return orphanRetentionHours; }
    public void setOrphanRetentionHours(int orphanRetentionHours) { this.orphanRetentionHours = orphanRetentionHours; }
}
