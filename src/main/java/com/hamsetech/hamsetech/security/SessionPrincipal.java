package com.hamsetech.hamsetech.security;

import java.io.Serializable;
import java.security.Principal;

/**
 * Principal kept in the server-side HTTP session.
 *
 * The auth version lets the request filter revoke all of a user's sessions
 * after a password reset or account withdrawal without maintaining a separate
 * session registry.
 */
public record SessionPrincipal(String username, int authVersion) implements Principal, Serializable {

    private static final long serialVersionUID = 1L;

    @Override
    public String getName() {
        return username;
    }
}
