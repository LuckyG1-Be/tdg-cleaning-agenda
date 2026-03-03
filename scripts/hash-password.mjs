import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password) {
  console.log("Usage: npm run hash:password -- <PASSWORD>");
  process.exit(1);
}
const hash = await bcrypt.hash(password, 10);
console.log(hash);
