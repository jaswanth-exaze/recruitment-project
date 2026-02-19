const authService = require("../services/auth.service");
const {
  REFRESH_COOKIE_NAME,
  getRefreshCookieOptions,
} = require("../utils/jwt.util");


// Validates credentials via service and returns JWT payload on success.
exports.login = async (req, res) => {
  try {
    const result = await authService.login(req.body);

    res.cookie(
      REFRESH_COOKIE_NAME,
      result.refreshToken,
      getRefreshCookieOptions(),
    );

    res.json({
      message: result.message,
      token: result.token,
      role: result.role,
    });
  } catch (err) {
    res.status(401).json({ message: err.message });
  }
};

// Exchanges a valid refresh token cookie for a new access token and rotated refresh token.
exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token missing" });
    }

    const result = await authService.refreshAccessToken(refreshToken);

    res.cookie(
      REFRESH_COOKIE_NAME,
      result.refreshToken,
      getRefreshCookieOptions(),
    );

    return res.json({
      message: result.message,
      token: result.token,
      role: result.role,
    });
  } catch (err) {
    return res.status(401).json({ message: err.message });
  }
};

// Revokes current refresh token and clears cookie to terminate the session.
exports.logout = async (req, res) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (refreshToken) {
      await authService.revokeRefreshToken(refreshToken);
    }

    const clearOptions = { ...getRefreshCookieOptions() };
    delete clearOptions.maxAge;
    res.clearCookie(REFRESH_COOKIE_NAME, clearOptions);

    return res.json({ message: "Logged out successfully" });
  } catch (err) {
    return res.status(500).json({ message: "Logout failed" });
  }
};