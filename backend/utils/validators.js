// EMAIL VALIDATION
const isValidEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

const isValidUgandaPhone = (phone) => {
  const regex = /^(?:\+256|0)(7[0-9]{8})$/;
  return regex.test(phone);
};

module.exports = {
  isValidEmail,
  isValidUgandaPhone
};