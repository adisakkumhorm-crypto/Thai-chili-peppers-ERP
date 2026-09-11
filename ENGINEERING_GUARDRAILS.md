# Thai Chili Pepper ERP — Engineering Patterns & Guardrails

เอกสารนี้รวบรวม Engineering Patterns และ Guardrails ที่ได้รับการยืนยันจากการนำไปใช้งานจริง (Implementation & Regression) ในโปรเจกต์ โดยเฉพาะจาก Phase 7 (Inventory Engine) เพื่อให้ Coding Worker และ Review Worker ใช้เป็นบรรทัดฐานในการทำงาน

---

### 1. Inventory quantity source of truth
- **RULE:** `inventory_balances` คือ Source of Truth เดียวสำหรับจำนวนสินค้าคงคลังในแต่ละสถานที่
- **WHY:** ระบบ ERP ต้องรู้ตำแหน่งและจำนวนที่แท้จริงของสินค้า การตรวจสอบความถูกต้องของการเบิก/ย้าย ต้องอ้างอิงจาก Location balance เสมอ
- **MUST DO:** อัปเดตและตรวจสอบ `on_hand_quantity` และ `allocated_quantity` ในตาราง `inventory_balances` ทุกครั้งที่มีการเคลื่อนไหว
- **MUST NOT DO:** ห้ามใช้ตาราง `products` เป็นเกณฑ์ในการตัดสินใจว่ามีของให้เบิก/ย้ายหรือไม่
- **ตัวอย่างที่ถูกต้อง:** `SELECT * FROM inventory_balances WHERE product_id = X AND location_id = Y FOR UPDATE;`
- **ตัวอย่างที่ห้ามทำ:** `SELECT stock_quantity FROM products WHERE id = X;` แล้วนำมาคำนวณตัดสต็อก

### 2. products.stock_quantity cached aggregate
- **RULE:** `products.stock_quantity` เป็นเพียง Cached Aggregate (ผลรวม) ที่เกิดจากการ Sync ข้อมูล
- **WHY:** เพื่อลดภาระการ Query ยอดรวม (Performance) เมื่อแสดงผลในหน้า Product List
- **MUST DO:** ควรอัปเดตค่านี้ในขั้นตอนสุดท้ายของ Transaction (RPC) เดียวกัน โดยใช้ผลรวม `SUM(on_hand_quantity)` จาก `inventory_balances`
- **MUST NOT DO:** ห้ามบวก/ลบค่า `stock_quantity` โดยตรงด้วยตัวแปร (เช่น `stock_quantity = stock_quantity - 10`) โดยไม่คำนวณจาก balance จริง
- **ตัวอย่างที่ถูกต้อง:** `UPDATE products SET stock_quantity = (SELECT SUM(on_hand_quantity) FROM inventory_balances WHERE product_id = p_product_id) ...`
- **ตัวอย่างที่ห้ามทำ:** `UPDATE products SET stock_quantity = stock_quantity + p_quantity ...`

### 3. Moving Average valuation
- **RULE:** `average_cost` ของสินค้าจะถูกคำนวณใหม่เฉพาะใน Inbound Flow ที่สร้างมูลค่าเพิ่มทางบัญชีเท่านั้น (เช่น Receive PO, Opening Inventory)
- **WHY:** การทำ Direct Receive (ไม่มีบิล), Transfer, หรือ Issue ไม่ควรทำให้ต้นทุนเฉลี่ย (Moving Average Cost) หรือ Total Inventory Value ของบริษัทเปลี่ยนแปลงโดยไม่มีที่มาทางการเงิน
- **MUST DO:** ใช้ `average_cost` เดิมของสินค้าเพื่อบันทึกต้นทุนใน Inventory Transactions สำหรับขาออกหรือย้าย
- **MUST NOT DO:** ห้ามเปลี่ยนแปลง `products.cost` หรือ `products.average_cost` เมื่อทำ Inventory Transfer หรือ Direct Issue
- **ตัวอย่างที่ถูกต้อง:** ดึงค่า `v_unit_cost := COALESCE(v_product.average_cost, 0);` ไปใช้บันทึก `inventory_transactions` ของ Transfer
- **ตัวอย่างที่ห้ามทำ:** อัปเดต `average_cost` ใหม่เมื่อทำ Direct Receive หรือ Transfer

### 4. RPC mutation pattern
- **RULE:** การเปลี่ยนแปลงสถานะของ Inventory (Mutation) ต้องทำผ่าน PostgreSQL RPC (Stored Procedure)
- **WHY:** ป้องกัน Race Condition และลด Round-trip ของ Network ระหว่าง Application กับ Database
- **MUST DO:** รวบรวม Logic การตรวจสอบ (Validation), การล็อค (Locking), และการ Insert/Update ไว้ใน RPC เดียว
- **MUST NOT DO:** ห้ามเขียน Logic อ่านค่าจาก DB, ประมวลผลใน Node.js/Next.js (actions.ts), แล้วค่อยสั่งอัปเดตกลับไปที่ DB
- **ตัวอย่างที่ถูกต้อง:** เรียก `supabase.rpc('rpc_transfer_stock', { ... })` จาก Server Action
- **ตัวอย่างที่ห้ามทำ:** `const bal = await getBalance(); if (bal > 10) await updateBalance();`

### 5. Atomicity
- **RULE:** ทุกๆ State change ที่เกี่ยวข้องกัน ต้องอยู่ใน Database Transaction เดียวกัน (All or Nothing)
- **WHY:** ป้องกันข้อมูลไม่สอดคล้องกัน (Inconsistency) หากเกิดข้อผิดพลาดคั่นกลาง
- **MUST DO:** พึ่งพา Transaction boundary ของ PL/pgSQL
- **MUST NOT DO:** ห้ามใช้ Application-level Multi-step writes
- **ตัวอย่างที่ถูกต้อง:** Insert source Tx, Insert destination Tx, Update balance ใน 1 function block (`BEGIN ... END;`)
- **ตัวอย่างที่ห้ามทำ:** สั่ง `supabase.from('tx').insert(...)` แล้วตามด้วย `supabase.from('balance').update(...)` แยกกันใน TypeScript

### 6. Lock hierarchy
- **RULE:** ต้อง Lock ข้อมูล (Row-level lock) อย่างเป็นลำดับชั้น: 1. `products` 2. `inventory_balances` (เรียงตาม UUID)
- **WHY:** ป้องกัน Deadlock เมื่อเกิด Concurrent execution ที่เข้าถึง Resource เดียวกันพร้อมกันแบบสลับฝั่ง (เช่น Transfer A->B และ B->A พร้อมกัน)
- **MUST DO:** ใช้ `FOR UPDATE` ล็อค `products` ก่อน จากนั้นเปรียบเทียบ Location ID เพื่อล็อค Location ที่มี UUID ต่ำกว่าก่อนเสมอ
- **MUST NOT DO:** ห้ามล็อค Location แบบสุ่ม หรือล็อค Destination ก่อน Source โดยไม่เช็ค UUID
- **ตัวอย่างที่ถูกต้อง:** `IF loc_a < loc_b THEN lock(loc_a); lock(loc_b); ELSE lock(loc_b); lock(loc_a); END IF;`
- **ตัวอย่างที่ห้ามทำ:** `lock(p_from_location_id); lock(p_to_location_id);` (ก่อให้เกิด Deadlock ได้)

### 7. Idempotency
- **RULE:** การทำ Mutation ต้องรองรับ Idempotency (รันคำสั่งเดิมซ้ำ ต้องได้ผลลัพธ์เดิมและไม่พัง)
- **WHY:** ป้องกันการเกิด Transaction ซ้ำซ้อน (Double spending) เวลา Network กระตุกหรือผู้ใช้กดปุ่มรัวๆ
- **MUST DO:** ส่ง `idempotency_key` (UUID) มาด้วยเสมอ และมี Unique Index ฝั่ง Database รอรับ
- **MUST NOT DO:** ห้ามสร้าง Mutation ที่ไม่มีกลไกป้องกันการทำรายการซ้ำ (Silent pass if matched, fail if conflict)
- **ตัวอย่างที่ถูกต้อง:** ตรวจ `EXISTS (SELECT 1 FROM inventory_transactions WHERE idempotency_key = p_idempotency_key)` ใน RPC ต้นทาง
- **ตัวอย่างที่ห้ามทำ:** อนุมัติการบันทึกข้อมูลทุกครั้งที่ถูกเรียก API โดยไม่สนว่า Payload เหมือนเดิมเป๊ะหรือไม่

### 8. Inventory transaction history
- **RULE:** ทุกการเคลื่อนไหวของสต็อก ต้องบันทึกลง `inventory_transactions`
- **WHY:** เพื่อให้สามารถ Audit ย้อนหลังได้ว่าของเข้า/ออก/ย้ายไปไหน ใครเป็นคนทำ
- **MUST DO:** บันทึก Quantity ติดลบ (-) สำหรับขาออก และค่าบวก (+) สำหรับขาเข้า พร้อมผูก `idempotency_key`
- **MUST NOT DO:** ห้ามแอบ Update จำนวน `inventory_balances` ข้ามขั้นตอนโดยไม่มี Transaction Log
- **ตัวอย่างที่ถูกต้อง:** ขา Transfer สร้าง 2 Record: ขาออก (QTY: -10) และขาเข้า (QTY: +10)
- **ตัวอย่างที่ห้ามทำ:** Update `inventory_balances` อย่างเดียวโดยถือว่าผลลัพธ์สต็อกรวมเท่าเดิม (เช่น Transfer)

### 9. Accounting journal protection
- **RULE:** Accounting Journal และ GL (General Ledger) เป็น Immutable
- **WHY:** เพื่อรักษาความถูกต้องของงบการเงินและ Audit Trail ตามมาตรฐานบัญชี
- **MUST DO:** หากมีการบันทึกบัญชีผิดพลาด ต้องบันทึกรายการปรับปรุง (Adjusting Journal Entry) หรือ Reverse Entry
- **MUST NOT DO:** ห้ามใช้คำสั่ง `UPDATE` บน Table บัญชีเพื่อเปลี่ยนตัวเลขที่ถูก Post (Approved) ไปแล้ว
- **ตัวอย่างที่ถูกต้อง:** สร้าง Journal ใหม่เพื่อ Reverse ตัวเลขเดิม หรือหักล้าง
- **ตัวอย่างที่ห้ามทำ:** `UPDATE finance_journal_entries SET credit = 0 WHERE id = ...`

### 10. Business Transaction → Accounting boundary
- **RULE:** แยกระบบ Operations (เช่น รับ/จ่าย/ย้ายสต็อก) ออกจากระบบ Accounting (เช่น สร้าง Journal, กระทบยอด)
- **WHY:** การทำ Business Tx บางอย่างอาจจะไม่มีผลกระทบต่อ General Ledger เสมอไป (เช่น Direct Receive ไม่ผูก AP หรือ Transfer ระหว่างสาขา)
- **MUST DO:** ควบคุมการออกเอกสารฝั่ง Operation ให้เรียบร้อยก่อน แล้วปล่อยให้กลไก Financial Engine (เช่น Trigger หรือ Cron/Queue) เป็นตัวหยิบไปบันทึกบัญชี
- **MUST NOT DO:** ห้ามฝัง Logic บันทึกบัญชี GL ดิบๆ ปนอยู่ใน Inventory RPC เดียวกันจนแยกไม่ออก
- **ตัวอย่างที่ถูกต้อง:** RPC Inventory ทำเสร็จจบที่ตาราง `inventory_transactions` 
- **ตัวอย่างที่ห้ามทำ:** แทรกการ Insert `finance_journal_entries` เข้าไปใน `rpc_transfer_stock` โดยตรง

### 11. Error/validation pattern
- **RULE:** ตรวจสอบความถูกต้องที่ระดับ Database ควบคู่กับ Zod Schema ในระดับ Application เสมอ (Fail Fast)
- **WHY:** Frontend / API ป้องกัน Error เชิง Logic เบื้องต้น ส่วน DB ป้องกันข้อมูลไม่สอดคล้องระดับลึกและ Constraint
- **MUST DO:** เขียน `RAISE EXCEPTION` ใน RPC พร้อมระบุข้อความชัดเจน และรองรับ Type Check บน Next.js
- **MUST NOT DO:** ห้ามพึ่งพา Validation บน UI/Client-side เพียงอย่างเดียว 
- **ตัวอย่างที่ถูกต้อง:** `IF v_available < p_quantity THEN RAISE EXCEPTION 'Insufficient available quantity'; END IF;`
- **ตัวอย่างที่ห้ามทำ:** แค่ return `{ success: false }` เงียบๆ โดยไม่สื่อความหมาย หรือยอมให้ข้อมูลเละเทะถ้าเรียก API ตรง

### 12. Testing/regression pattern
- **RULE:** การรัน Test ต้องใช้ Valid User / Valid Fixture Data จากระบบเสมอ
- **WHY:** ทดสอบในสภาพแวดล้อมที่จำลองคล้าย Production มากที่สุด โดยไม่ทำลาย Data Integrity หรือ Schema
- **MUST DO:** ดึง `user_id` และ `org_id` จากตารางที่มีอยู่จริง (เช่น จาก `seed.sql`) มาใส่ใน Test Harness
- **MUST NOT DO:** ห้ามแก้ Foreign Key constraint, ลบ Schema หรือแก้ Production Code เพียงเพื่อให้ Test ของตัวเองผ่าน
- **ตัวอย่างที่ถูกต้อง:** `SELECT user_id, org_id FROM memberships LIMIT 1` มาเก็บในตัวแปรสำหรับรันเทสต์
- **ตัวอย่างที่ห้ามทำ:** `ALTER TABLE inventory_transactions DROP CONSTRAINT ...` ชั่วคราวเพื่อเทสต์

### 13. Migration pattern
- **RULE:** สคริปต์ Migration (Supabase) ต้องทำงานแบบระบุลำดับเวลา และห้ามย้อนกลับไปแก้ไขไฟล์เก่าที่ Deploy หรือ Merge แล้ว
- **WHY:** ป้องกัน Schema หลุด Sync หรือพังเมื่อ Deploy ขึ้น Production
- **MUST DO:** สร้างไฟล์ใหม่เสมอเมื่อมีการปรับโครงสร้างตารางหรือแก้ RPC 
- **MUST NOT DO:** ห้ามแก้ไขไฟล์ SQL Migration ของวันก่อนหน้าที่ถูก Push ไปแล้ว
- **ตัวอย่างที่ถูกต้อง:** สร้างไฟล์ `20260911010000_step35_transfer.sql` สำหรับ Logic ใหม่
- **ตัวอย่างที่ห้ามทำ:** แอบเข้าไปเพิ่ม Column ในไฟล์ `20260630090000_init_schema.sql`

### 14. Production code mutation rules
- **RULE:** จำกัดการแก้ไขไฟล์โค้ด (Max 3 ไฟล์ต่อ Task) และแก้ไขเฉพาะจุดที่จำเป็น
- **WHY:** รักษา Scope ให้แคบ, กันงบบานปลาย, และง่ายต่อการทำ Code Review
- **MUST DO:** ใช้ Tool เช่น `sed`, หรือ `cat` ผสม `grep` หรือ Tool `edit` ในการเปลี่ยนบรรทัดที่มีปัญหาโดยตรง
- **MUST NOT DO:** ห้ามสั่ง Rewrite (เขียนทับ) ไฟล์ขนาดใหญ่ทั้งไฟล์ หากไม่ได้เปลี่ยน โครงสร้างทั้งหมด
- **ตัวอย่างที่ถูกต้อง:** การเปลี่ยน syntax `"use server"` ด้วยการใช้ `sed -i`
- **ตัวอย่างที่ห้ามทำ:** สั่งสร้างไฟล์ `actions.ts` ใหม่ทั้งหมดทับของเดิมเพียงเพื่อแก้จุดเดียว

### 15. Git checkpoint/recovery rules
- **RULE:** เมื่อการ Implement และ Test ในแต่ละ Step ผ่านสมบูรณ์ ต้องทำ Commit Checkpoint ขึ้น GitHub ทันที โดยไม่รวมไฟล์ Secrets
- **WHY:** เพื่อให้สามารถ Rollback มายังจุดที่ปลอดภัยที่สุดได้หาก Step ต่อไปเกิดพัง และรักษาประวัติการพัฒนา
- **MUST DO:** ตรวจ `git status` และ `git diff` เพื่อยืนยันว่าไม่มี `.env` หรือ Credentials หลุดเข้า Staging area ก่อน Commit & Push
- **MUST NOT DO:** ห้าม Force Push (`git push -f`), ลบ Commit ที่อยู่บน Remote, หรือ Commit ไฟล์ `.env` ขึ้น Repository เด็ดขาด
- **ตัวอย่างที่ถูกต้อง:** `git add app/ supabase/ && git commit -m "checkpoint: inventory transfer engine complete" && git push`
- **ตัวอย่างที่ห้ามทำ:** `git add . && git commit -m "update" && git push -f`

---