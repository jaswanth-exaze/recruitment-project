const authService = require("../services/auth.service");
const {
  REFRESH_COOKIE_NAME,
  getRefreshCookieOptions,
} = require("../utils/jwt.util");

exports.login = async (req, res) => {
  try {
    const result = await authService.login(req.body);

    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());

    res.json({
      message: result.message,
      token: result.token,
      role: result.role,
    });
  } catch (err) {
    res.status(401).json({ message: err.message });
  }
};

exports.signupCandidate = async (req, res) => {
  try {
    const result = await authService.signupCandidate(req.body);

    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());

    return res.status(201).json({
      message: result.message,
      token: result.token,
      role: result.role,
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Email already exists" });
    }
    return res.status(400).json({ message: err.message || "Signup failed" });
  }
};

exports.profile = async (req, res) => {
  try {
    const profile = await authService.getProfile(req.user.user_id);
    res.json({ profile });
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    const result = await authService.refreshAccessToken(refreshToken);

    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());

    return res.json({
      message: result.message,
      token: result.token,
      role: result.role,
    });
  } catch (err) {
    return res.status(401).json({ message: err.message });
  }
};

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
