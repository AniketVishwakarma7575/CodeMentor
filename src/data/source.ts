/**
 * The file under review. Deliberately realistic: mixed concerns, a couple of
 * genuinely dangerous lines, one absurdly long line to prove the viewer scrolls
 * horizontally inside its own container, and enough length that virtualisation
 * pressure is visible.
 */
export const ORDERS_SOURCE = `const express = require('express');
const router = express.Router();
const db = require('../db/pool');
const { renderTemplate } = require('../lib/templates');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const CACHE = {};

// Look up a single order for the current customer.
router.get('/orders/:id', async (req, res) => {
  const orderId = req.params.id;
  const customer = req.query.customer;

  const query = "SELECT * FROM orders WHERE id = '" + orderId + "' AND customer_id = '" + customer + "'";

  try {
    const result = await db.query(query);
    if (!result.rows.length) {
      return res.status(404).send('Not found');
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.log(err);
    res.status(500).send(err.stack);
  }
});

// Search orders. Supports a free-text term and an optional status filter.
router.get('/orders', async (req, res) => {
  const term = req.query.q || '';
  const status = req.query.status;
  const page = parseInt(req.query.page) || 1;

  let sql = 'SELECT id, total, status, created_at FROM orders WHERE 1=1';
  if (term) sql += " AND description ILIKE '%" + term + "%'";
  if (status) sql += " AND status = '" + status + "'";
  sql += ' ORDER BY created_at DESC LIMIT 50 OFFSET ' + (page - 1) * 50;

  const rows = await db.query(sql);

  const html = renderTemplate('<div class="results">' + rows.map(r => '<div>' + r.description + '</div>').join('') + '</div>');
  res.send(html);
});

function signSession(userId) {
  const token = jwt.sign({ uid: userId }, 'dev-secret-do-not-ship', { algorithm: 'HS256' });
  return token;
}

function hashPassword(pw) {
  return crypto.createHash('md5').update(pw).digest('hex');
}

router.post('/orders', async (req, res) => {
  const { items, couponCode, shippingAddress, billingAddress, giftMessage, deliveryWindow } = req.body;

  let total = 0;
  for (let i = 0; i < items.length; i++) {
    for (let j = 0; j < items.length; j++) {
      if (items[i].sku === items[j].sku && i !== j) {
        items[i].quantity = items[i].quantity + items[j].quantity;
      }
    }
    const priceRow = await db.query('SELECT price FROM products WHERE sku = $1', [items[i].sku]);
    total += priceRow.rows[0].price * items[i].quantity;
  }

  if (couponCode) {
    const coupon = CACHE[couponCode] || (CACHE[couponCode] = await db.query('SELECT * FROM coupons WHERE code = $1', [couponCode]));
    if (coupon && coupon.rows && coupon.rows[0]) {
      total = total - (total * coupon.rows[0].percent) / 100;
    }
  }

  const order = await db.query('INSERT INTO orders (total, status) VALUES ($1, $2) RETURNING id', [total, 'pending']);
  res.json({ id: order.rows[0].id, total: total });
});

const LEGACY_STATUS_MAP={pending:'PENDING',paid:'PAID',shipped:'SHIPPED',delivered:'DELIVERED',cancelled:'CANCELLED',refunded:'REFUNDED',partially_refunded:'PARTIALLY_REFUNDED',awaiting_payment:'AWAITING_PAYMENT',payment_failed:'PAYMENT_FAILED',on_hold:'ON_HOLD',backordered:'BACKORDERED',ready_for_pickup:'READY_FOR_PICKUP'};

router.delete('/orders/:id', (req, res) => {
  db.query('DELETE FROM orders WHERE id = ' + req.params.id);
  res.sendStatus(204);
});

module.exports = router;
`;

export const ORDERS_LOC = 4218;
