const { db } = require("./db");

async function hapusMami() {
  console.log("🗑️  Menghapus user test...");
  
  // Hapus user mami (ID: 2)
  const result = await db.run("DELETE FROM users WHERE id = ?", [4]);
  
  console.log(`✅ User "test" dihapus! (${result.changes} baris terhapus)`);
  
  // Cek sisa user
  const users = await db.all("SELECT id, name, email FROM users");
  console.log("\n📋 User tersisa di database:");
  users.forEach(u => console.log(`  ID ${u.id}: ${u.name} (${u.email})`));
}

hapusMami().catch(err => {
  console.error("❌ Error:", err.message);
});