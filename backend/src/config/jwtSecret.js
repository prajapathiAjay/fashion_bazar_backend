// The key used to sign and check login tokens (JWT).
// It lives in .env as JWT_SECRET, never in the code: anyone who knows it can create
// a token for any user, including the admin.
//
// Read when it's used (not when this file is imported), because server.js loads .env
// after the imports have already run.
export function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error("JWT_SECRET is missing or too short in .env (use at least 32 random characters)");
    }
    return secret;
}
