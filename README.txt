ACCESSORIES ADDA HUB — COMPLETE SHOP
========================================

Included:
Customer:
- Product browsing
- Cart
- Checkout
- Cash on Delivery
- bKash manual payment + Transaction ID
- Nagad manual payment + Transaction ID
- Automatic Order ID
- Order confirmation

Admin:
- Separate /admin.html
- Product image upload/change
- Add/edit/delete products
- Edit price/name/description/availability
- Store settings
- bKash/Nagad number settings
- View all orders
- Change order status
- Verify/reject bKash/Nagad payment

SETUP:
1. Install Node.js 20+.
2. Open terminal in this folder.
3. Run: npm install
4. Set ADMIN_PASSWORD to your own strong password.
5. Run: npm start
6. Customer: http://localhost:3000
7. Admin: http://localhost:3000/admin.html

PAYMENT NOTE:
This version supports Cash on Delivery and manual bKash/Nagad payment with Transaction ID.
For automatic gateway payment/verification, you must have the relevant merchant account
and credentials/API access. Those credentials must never be placed in frontend HTML.
The backend is structured so a gateway integration can be added safely later.

SECURITY:
Before public launch use HTTPS, a persistent production database, secure session/auth,
rate limiting, backups, and production image storage. Change the default admin password.
