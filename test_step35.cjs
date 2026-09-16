const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Valid fixture from seed.sql
const ORG_ID = 'a0000000-0000-0000-0000-000000000001';
const USER_ID = 'b0000000-0000-0000-0000-000000000001';

async function runTests() {
  console.log('--- TRANSFER TESTS ---');
  
  // Verify user exists and has membership
  const { data: memCheck, error: errMem } = await supabase.from('memberships').select('*').eq('user_id', USER_ID).eq('org_id', ORG_ID).single();
  if (errMem || !memCheck) {
    console.error("Auth User missing from memberships:", errMem);
    process.exit(1);
  }

  const runId = crypto.randomUUID().slice(0, 8);
  const { data: locA } = await supabase.from('inventory_locations').insert({ org_id: ORG_ID, name: `WH-A-${runId}` }).select().single();
  const { data: locB } = await supabase.from('inventory_locations').insert({ org_id: ORG_ID, name: `WH-B-${runId}` }).select().single();
  const { data: locC } = await supabase.from('inventory_locations').insert({ org_id: ORG_ID, name: `WH-C-${runId}` }).select().single();

  const { data: prod } = await supabase.from('products').insert({ org_id: ORG_ID, name: `TF-PROD-${runId}`, sku: `TF-1-${runId}`, price: 100, cost: 0, stock_quantity: 0 }).select().single();
  
  // INIT
  const { error: errInit } = await supabase.rpc('rpc_receive_stock_direct', {
    p_org_id: ORG_ID, p_location_id: locA.id, p_product_id: prod.id, p_quantity: 100, p_unit_cost: 50,
    p_reference_no: 'INIT', p_batch_qr_code: null, p_idempotency_key: crypto.randomUUID(), p_user_id: USER_ID
  });
  if (errInit) {
      console.log("INIT ERROR:", errInit);
      process.exit(1);
  }

  const { data: p_init } = await supabase.from('products').select('*').eq('id', prod.id).single();
  console.log(`Initial state: Qty=${p_init?.stock_quantity}, Val=${p_init?.total_inventory_value}, Avg=${p_init?.average_cost}`);
  
  const idemKey1 = crypto.randomUUID();
  const { error: err1 } = await supabase.rpc('rpc_transfer_stock', {
    p_org_id: ORG_ID, p_product_id: prod.id, p_from_location_id: locA.id, p_to_location_id: locB.id,
    p_quantity: 20, p_reference_no: 'TR-001', p_idempotency_key: idemKey1, p_user_id: USER_ID
  });
  console.log(`Test A (Normal Transfer 20 to WH-B): ${err1 ? 'FAIL ' + JSON.stringify(err1) : 'PASS'}`);

  const { data: balA } = await supabase.from('inventory_balances').select('on_hand_quantity').eq('product_id', prod.id).eq('location_id', locA.id).single();
  const { data: balB } = await supabase.from('inventory_balances').select('on_hand_quantity').eq('product_id', prod.id).eq('location_id', locB.id).single();
  console.log(`  -> Balance WH-A: ${balA?.on_hand_quantity} (Exp 80), WH-B: ${balB?.on_hand_quantity} (Exp 20)`);

  const { data: p_after1 } = await supabase.from('products').select('*').eq('id', prod.id).single();
  console.log(`  -> Aggregate check: Qty=${p_after1?.stock_quantity}, Val=${p_after1?.total_inventory_value}, Avg=${p_after1?.average_cost}`);

  const { error: err2 } = await supabase.rpc('rpc_transfer_stock', {
    p_org_id: ORG_ID, p_product_id: prod.id, p_from_location_id: locA.id, p_to_location_id: locB.id,
    p_quantity: 20, p_reference_no: 'TR-001', p_idempotency_key: idemKey1, p_user_id: USER_ID
  });
  console.log(`Test L (Idempotent Retry): ${err2 ? 'FAIL ' + JSON.stringify(err2) : 'PASS'}`);

  const { data: balB_retry } = await supabase.from('inventory_balances').select('on_hand_quantity').eq('product_id', prod.id).eq('location_id', locB.id).single();
  console.log(`  -> Balance WH-B after retry: ${balB_retry?.on_hand_quantity} (Exp 20)`);

  const { error: err3 } = await supabase.rpc('rpc_transfer_stock', {
    p_org_id: ORG_ID, p_product_id: prod.id, p_from_location_id: locA.id, p_to_location_id: locC.id, 
    p_quantity: 10, p_reference_no: 'TR-001X', p_idempotency_key: idemKey1, p_user_id: USER_ID
  });
  console.log(`Test M (Conflicting Idempotency): ${err3 ? 'PASS expected error: ' + err3.message : 'FAIL allowed conflicting retry'}`);

  await supabase.from('inventory_balances').update({ allocated_quantity: 75 }).eq('product_id', prod.id).eq('location_id', locA.id);
  const { error: err4 } = await supabase.rpc('rpc_transfer_stock', {
    p_org_id: ORG_ID, p_product_id: prod.id, p_from_location_id: locA.id, p_to_location_id: locC.id,
    p_quantity: 10, p_reference_no: 'TR-002', p_idempotency_key: crypto.randomUUID(), p_user_id: USER_ID
  });
  console.log(`Test D (Insufficient Available - 80 on hand, 75 allocated, requesting 10): ${err4 ? 'PASS expected error: ' + err4.message : 'FAIL allowed over-transfer'}`);

  await supabase.from('inventory_balances').update({ allocated_quantity: 0 }).eq('product_id', prod.id).eq('location_id', locA.id);

  const { error: err5 } = await supabase.rpc('rpc_transfer_stock', {
    p_org_id: ORG_ID, p_product_id: prod.id, p_from_location_id: locA.id, p_to_location_id: locA.id,
    p_quantity: 10, p_reference_no: 'TR-003', p_idempotency_key: crypto.randomUUID(), p_user_id: USER_ID
  });
  console.log(`Test F (Same Source/Dest): ${err5 ? 'PASS expected error: ' + err5.message : 'FAIL allowed same location transfer'}`);

  const { error: err6 } = await supabase.rpc('rpc_transfer_stock', {
    p_org_id: ORG_ID, p_product_id: prod.id, p_from_location_id: locA.id, p_to_location_id: locC.id,
    p_quantity: 0, p_reference_no: 'TR-004', p_idempotency_key: crypto.randomUUID(), p_user_id: USER_ID
  });
  console.log(`Test G (Zero qty): ${err6 ? 'PASS expected error' : 'FAIL'}`);

  const { error: err7 } = await supabase.rpc('rpc_transfer_stock', {
    p_org_id: ORG_ID, p_product_id: prod.id, p_from_location_id: locA.id, p_to_location_id: locC.id,
    p_quantity: -5, p_reference_no: 'TR-005', p_idempotency_key: crypto.randomUUID(), p_user_id: USER_ID
  });
  console.log(`Test H (Negative qty): ${err7 ? 'PASS expected error' : 'FAIL'}`);

  const { data: txs } = await supabase.from('inventory_transactions').select('*').in('idempotency_key', [idemKey1]);
  console.log(`Test W (Tx Records): Found ${txs?.length} records. (Expected: 2)`);
  if (txs?.length === 2) {
    const srcTx = txs.find(t => t.location_id === locA.id);
    const destTx = txs.find(t => t.location_id === locB.id);
    console.log(`  -> Source Tx: qty=${srcTx?.quantity}, cost=${srcTx?.total_cost}`);
    console.log(`  -> Dest Tx: qty=${destTx?.quantity}, cost=${destTx?.total_cost}`);
  }

  console.log('Testing concurrency...');
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(supabase.rpc('rpc_transfer_stock', {
      p_org_id: ORG_ID, p_product_id: prod.id, p_from_location_id: locA.id, p_to_location_id: locB.id,
      p_quantity: 2, p_reference_no: `CONC-AB-${i}`, p_idempotency_key: crypto.randomUUID(), p_user_id: USER_ID
    }));
    promises.push(supabase.rpc('rpc_transfer_stock', {
      p_org_id: ORG_ID, p_product_id: prod.id, p_from_location_id: locB.id, p_to_location_id: locA.id,
      p_quantity: 2, p_reference_no: `CONC-BA-${i}`, p_idempotency_key: crypto.randomUUID(), p_user_id: USER_ID
    }));
  }
  const results = await Promise.all(promises);
  const failed = results.filter(r => r.error);
  console.log(`Test N/O (Concurrency - 10 criss-cross requests): ${failed.length} failed. (Expected: 0)`);
  
  const { data: balA_final } = await supabase.from('inventory_balances').select('on_hand_quantity').eq('product_id', prod.id).eq('location_id', locA.id).single();
  const { data: balB_final } = await supabase.from('inventory_balances').select('on_hand_quantity').eq('product_id', prod.id).eq('location_id', locB.id).single();
  console.log(`  -> Final Balances: WH-A=${balA_final?.on_hand_quantity} (Exp 80), WH-B=${balB_final?.on_hand_quantity} (Exp 20)`);
  
  const { data: p_final } = await supabase.from('products').select('*').eq('id', prod.id).single();
  console.log(`  -> Final Aggregate: Qty=${p_final?.stock_quantity}, Val=${p_final?.total_inventory_value}, Avg=${p_final?.average_cost} (Expected: 100, 5000, 50)`);
}

runTests().catch(console.error);
