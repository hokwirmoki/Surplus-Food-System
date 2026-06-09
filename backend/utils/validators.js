// ==============================
// EMAIL VALIDATION
// ==============================
const isValidEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

// ==============================
// UGANDA PHONE VALIDATION
// Accepts:
// 070..., 071..., 075..., 077..., 078...
// +2567...
// ==============================
const isValidUgandaPhone = (phone) => {
  const regex = /^(?:\+256|0)(7[0-9]{8})$/;
  return regex.test(phone);
};

module.exports = {
  isValidEmail,
  isValidUgandaPhone
};