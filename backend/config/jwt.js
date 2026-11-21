const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (typeof secret !== "string" || !secret.trim()) {
    throw new Error("JWT_SECRET is required. Configure it before starting the server.");
  }

  return secret;
};

module.exports = { getJwtSecret };
