const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const ORG_ID = 'a0000000-0000-0000-0000-000000000001';
const USER_ID = 'u0000000-0000-0000-0000-000000000001';

async function runTests() {
  console.log('--- DIRECT RECEIVE TESTS ---');
  
  // 1. Setup: Create Location and Product
  const { data: loc } = await supabase.from('inventory_locations').insert({ org_id: ORG_ID, name: 'Main WH (DR Test)' }).select().single();
  const { data: prod } = await supabase.from('products').insert({ org_id: ORG_ID, name: 'DR-PROD-1', sku: 'DR1', price: 100, cost: 0, stock_quantity: 0 }).select().single();
  const { data: prod2 } = await supabase.from('products').insert({ org_id: ORG_ID, name: 'DR-PROD-LEGACY', sku: 'DR2', price: 100, cost: 0, stock_quantity: 10 }).select().single();

  console.log(`Created Product 1: ${prod?.id || 'failed'} (stock: 0)`);
  console.log(`Created Product 2: ${prod2?.id || 'failed'} (stock: 10, value: 0) - Legacy`);
  
  if (!prod || !loc) {
      console.log('Failed to setup test data, aborting');
      return;
  }

  // Test A & B: Zero-stock first receipt
  const idemKey1 = crypto.randomUUID();
  const { error: err1 } = await supabase.rpc('rpc_receive_stock_direct', {
    p_org_id: ORG_ID,
    p_location_id: loc.id,
    p_product_id: prod.id,
    p_quantity: 10,
    p_unit_cost: 50,
    p_reference_no: 'REF-001',
    p_batch_qr_code: null,
    p_idempotency_key: idemKey1,
    p_user_id: USER_ID
  });
  console.log(`Test A/B (Zero-stock receipt): ${err1 ? 'FAIL ' + err1.message : 'PASS'}`);

  // Validate Test A/B
  const { data: p1 } = await supabase.from('products').select('stock_quantity, average_cost, total_inventory_value').eq('id', prod.id).single();
  console.log(`  -> Product 1 state: qty=${p1.stock_quantity}, avg_cost=${p1.average_cost}, total_value=${p1.total_inventory_value} (Expected: 10, 50, 500)`);

  // Test M & N: Idempotent retry
  const { error: err2 } = await supabase.rpc('rpc_receive_stock_direct', {
    p_org_id: ORG_ID, p_location_id: loc.id, p_product_id: prod.id, p_quantity: 10, p_unit_cost: 50,
    p_reference_no: 'REF-001', p_batch_qr_code: null, p_idempotency_key: idemKey1, p_user_id: USER_ID
  });
  console.log(`Test M/N (Idempotent retry): ${err2 ? 'FAIL ' + err2.message : 'PASS'}`);
  
  const { data: p1_idem } = await supabase.from('products').select('stock_quantity').eq('id', prod.id).single();
  console.log(`  -> Product 1 qty after retry: ${p1_idem.stock_quantity} (Expected: 10)`);

  // Test C & D & S: Existing valued stock receipt (Different cost for Moving Average)
  const idemKey2 = crypto.randomUUID();
  const { error: err3 } = await supabase.rpc('rpc_receive_stock_direct', {
    p_org_id: ORG_ID, p_location_id: loc.id, p_product_id: prod.id, p_quantity: 5, p_unit_cost: 80,
    p_reference_no: 'REF-002', p_batch_qr_code: null, p_idempotency_key: idemKey2, p_user_id: USER_ID
  });
  console.log(`Test C/D/S (Existing valued stock / MA): ${err3 ? 'FAIL ' + err3.message : 'PASS'}`);
  
  const { data: p1_ma } = await supabase.from('products').select('stock_quantity, average_cost, total_inventory_value').eq('id', prod.id).single();
  // Old: qty=10, val=500. In: qty=5, val=400. New: qty=15, val=900, avg=60
  console.log(`  -> Product 1 MA state: qty=${p1_ma.stock_quantity}, avg_cost=${p1_ma.average_cost}, total_value=${p1_ma.total_inventory_value} (Expected: 15, 60, 900)`);

  // Test I: Zero quantity
  const { error: err4 } = await supabase.rpc('rpc_receive_stock_direct', {
    p_org_id: ORG_ID, p_location_id: loc.id, p_product_id: prod.id, p_quantity: 0, p_unit_cost: 50,
    p_reference_no: 'REF-003', p_batch_qr_code: null, p_idempotency_key: crypto.randomUUID(), p_user_id: USER_ID
  });
  console.log(`Test I (Zero qty): ${err4 ? 'PASS expected error: ' + err4.message : 'FAIL allowed zero qty'}`);

  // Test J: Negative quantity
  const { error: err5 } = await supabase.rpc('rpc_receive_stock_direct', {
    p_org_id: ORG_ID, p_location_id: loc.id, p_product_id: prod.id, p_quantity: -5, p_unit_cost: 50,
    p_reference_no: 'REF-003', p_batch_qr_code: null, p_idempotency_key: crypto.randomUUID(), p_user_id: USER_ID
  });
  console.log(`Test J (Negative qty): ${err5 ? 'PASS expected error: ' + err5.message : 'FAIL allowed negative qty'}`);

  // Test K: Negative unit cost
  const { error: err6 } = await supabase.rpc('rpc_receive_stock_direct', {
    p_org_id: ORG_ID, p_location_id: loc.id, p_product_id: prod.id, p_quantity: 5, p_unit_cost: -10,
    p_reference_no: 'REF-003', p_batch_qr_code: null, p_idempotency_key: crypto.randomUUID(), p_user_id: USER_ID
  });
  console.log(`Test K (Negative unit cost): ${err6 ? 'PASS expected error: ' + err6.message : 'FAIL allowed negative cost'}`);

  // Test L: Legacy unvalued stock
  const { error: err7 } = await supabase.rpc('rpc_receive_stock_direct', {
    p_org_id: ORG_ID, p_location_id: loc.id, p_product_id: prod2.id, p_quantity: 5, p_unit_cost: 50,
    p_reference_no: 'REF-004', p_batch_qr_code: null, p_idempotency_key: crypto.randomUUID(), p_user_id: USER_ID
  });
  console.log(`Test L (Legacy unvalued stock): ${err7 ? 'PASS expected error: ' + err7.message : 'FAIL allowed receiving into unvalued legacy stock'}`);

  // Test O: Concurrent different receipts (Simulated by Promise.all)
  console.log('Testing concurrency...');
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(supabase.rpc('rpc_receive_stock_direct', {
      p_org_id: ORG_ID, p_location_id: loc.id, p_product_id: prod.id, p_quantity: 2, p_unit_cost: 60,
      p_reference_no: `CONC-${i}`, p_batch_qr_code: null, p_idempotency_key: crypto.randomUUID(), p_user_id: USER_ID
    }));
  }
  const results = await Promise.all(promises);
  const failed = results.filter(r => r.error);
  console.log(`Test O (Concurrency - 5 requests): ${failed.length} failed. (Expected: 0)`);
  
  const { data: p1_conc } = await supabase.from('products').select('stock_quantity, average_cost, total_inventory_value').eq('id', prod.id).single();
  // Before: qty=15, val=900. Added 5 * 2 = 10 units at 60 each (600 value).
  // New qty = 25, new val = 1500, avg = 60.
  console.log(`  -> Product 1 state after concurrency: qty=${p1_conc.stock_quantity}, avg_cost=${p1_conc.average_cost}, total_value=${p1_conc.total_inventory_value} (Expected: 25, 60, 1500)`);

  const { data: bal } = await supabase.from('inventory_balances').select('on_hand_quantity').eq('product_id', prod.id).eq('location_id', loc.id).single();
  console.log(`  -> Inventory Balance (on_hand): ${bal.on_hand_quantity} (Expected: 25)`);

}

runTests().catch(console.error);
