export const generateGuestName = () => {
  // Use crypto API for better randomness
  const array = new Uint8Array(5);
  crypto.getRandomValues(array);

  // Convert to digits (0-9)
  const randomNumbers = Array.from(array)
    .map((byte) => byte % 10)
    .join("");

  return `guest-${randomNumbers}`;
};
