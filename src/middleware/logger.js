const morgan = require('morgan');

// Custom token: authenticated user id
morgan.token('user-id', (req) => (req.user && req.user.sub) || '-');

/**
 * Request logger in combined format extended with the authenticated user ID.
 * Example: ::1 - - [29/Apr/2026:19:00:00 +0000] "GET /api/v1/profiles HTTP/1.1" 200 1234 - user:abc123
 */
const requestLogger = morgan(
  ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" user::user-id'
);

module.exports = { requestLogger };
