package com.hamsetech.hamsetech.notice;

/**
 * 첨부의 쓰임새.
 *
 * 내려보낼 때의 처리가 달라진다. IMAGE는 본문에 그려야 해서 inline으로 주고,
 * FILE은 브라우저가 해석하지 못하게 octet-stream + attachment로 준다.
 */
public enum AttachmentKind {
    IMAGE,
    FILE
}
