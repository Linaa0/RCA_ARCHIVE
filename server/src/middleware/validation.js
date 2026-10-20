function validatePasswordStrength(password) {
  if (!password || password.length < 8) {
    return {
      valid: false,
      message: "Password must be at least 8 characters long",
    };
  }

  if (!/[a-zA-Z]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one letter",
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one number",
    };
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return {
      valid: false,
      message:
        "Password must contain at least one special character (!@#$%^&*()_+-=[]{};':\"\\|,.<>/?)",
    };
  }

  return { valid: true };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "");
}

module.exports = {
  validatePasswordStrength,
  isValidEmail,
};
