package com.hamsetech.hamsetech.notice;

public record NoticeAttachmentDto(
        Long id,
        String originalFilename,
        String contentType,
        long size,
        AttachmentKind kind,
        /** 본문 img의 src이자 내려받기 주소. 새니타이저가 이 형태만 허용한다. */
        String url) {

    public static NoticeAttachmentDto of(NoticeAttachment a) {
        return new NoticeAttachmentDto(
                a.getId(),
                a.getOriginalFilename(),
                a.getContentType(),
                a.getFileSize(),
                a.getKind(),
                "/api/notices/attachments/" + a.getId() + "/content");
    }
}
