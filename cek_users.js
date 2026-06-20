const { db } = require("./db");

async function cekUser() {
  console.log("📋 LIST USER DI DATABASE:\n");
  
  const users = await db.all("SELECT id, name, email, created_at FROM users");
  
  if (users.length === 0) {
    console.log("❌ Tidak ada user.");
    return;
  }
  
  console.log("┌────┬─────────────────┬────────────────────────┬─────────────────────┐");
  console.log("│ ID │ Nama            │ Email                  │ Dibuat              │");
  console.log("├────┼─────────────────┼────────────────────────┼─────────────────────┤");
  
  users.forEach(u => {
    const nama = u.name.padEnd(15, ' ');
    const email = u.email.padEnd(22, ' ');
    const tanggal = u.created_at.padEnd(19, ' ');
    console.log(`│ ${u.id.toString().padStart(2)} │ ${nama} │ ${email} │ ${tanggal} │`);
  });
  
  console.log("└────┴─────────────────┴────────────────────────┴─────────────────────┘");
  console.log(`\n📊 Total: ${users.length} user`);
}

cekUser().catch(console.error);