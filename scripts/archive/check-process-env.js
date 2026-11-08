console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
if (process.env.DATABASE_URL) {
  console.log('DATABASE_URL:', process.env.DATABASE_URL.substring(0, 20) + '...');
}
