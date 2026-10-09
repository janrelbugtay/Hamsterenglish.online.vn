const users = [
  { isAnonymous: false, email: "User" },
  { isAnonymous: true, email: "test@example.com" },
  { isAnonymous: false, email: "teacher@example.com" }
];

const registeredUsersList = users.filter((u) => {
  // If explicitly marked anonymous, it's a guest
  if (u.isAnonymous === true) return false;
  // If email is missing or just "User", it's a guest
  if (!u.email || u.email === "User") return false;
  // Otherwise it's registered
  return true;
});

console.log(registeredUsersList);
