/**
 * Base class for authentication with external services
 * 
 * Services must return some kind of token, this is for now a defunct oauth concept
 * that just works with ZenTransfer for now and this base class is really just
 * another ridicilous abstraction that is not needed.
 * 
 * TODO: We should support login via a browser, token and refresh token
 */

class AuthenticationServiceBase {
    constructor() {
    }
    
    async verifyToken(token) {
        throw new Error('Not implemented');
    }
    
    async refreshToken(token) {
        return {
            success: false,
            token: null,
        }
    }
    
    /* Check the health of the service, can we call other methods? */
    async healthCheck() {
        return false;
    }
}

module.exports = { AuthenticationServiceBase }; 