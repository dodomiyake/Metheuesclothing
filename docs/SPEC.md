# Metheues Clothings — T-Shirt-First MVP

**Document status:** Authoritative launch MVP  
**Version:** 2.0  
**Product:** Metheues Clothings  
**Launch market:** United Kingdom, with controlled international delivery  
**Launch channel:** Responsive web store  
**Currency:** GBP

---

## 1. Executive summary

Metheues Clothings will launch as a focused, premium T-shirt brand. The first release will not present the business as a general apparel store. Hoodies, shirts, trousers, jackets, sets, hats, bags, footwear, jewellery and other accessories are explicitly deferred.

The MVP enables customers to discover a T-shirt drop, understand each design and garment specification, select the correct colour and size, pay securely, and track an order. It also gives the business a protected administration area for managing T-shirts, variants, inventory, orders, fulfilment, returns and storefront content.

The architecture should remain extensible enough to support future apparel, but the launch interface, navigation, content, filters, product forms and testing scope must contain only T-shirt-related functionality.

### Core value proposition

> Premium T-shirts shaped by music, identity and original expression—presented through a refined, culturally rooted shopping experience.

### Launch principle

Metheues Clothings should feel like an intentional specialist T-shirt label, not a general clothing store with most categories empty.

---

## 2. Review of the previous MVP

### What remains valid

The following elements from the previous MVP remain necessary:

- Mobile-first responsive storefront
- Product discovery, search and collection pages
- Colour and size variants
- Server-authoritative prices
- Variant-level inventory
- Guest checkout
- Customer accounts and order history
- Stripe Checkout and verified webhooks
- Persistent orders and immutable order-item snapshots
- Admin product, inventory, order and return management
- Transactional email
- Accessibility target of WCAG 2.2 AA
- Automated testing, CI/CD, monitoring and audit logs

### What was over-scoped

The previous MVP incorrectly assumed a broad apparel catalogue. This introduced unnecessary launch complexity:

- Categories for trousers, outerwear, sets and accessories
- Multiple garment-specific measurement systems
- Product forms supporting unrelated clothing construction details
- Navigation that implied a much larger catalogue
- Homepage imagery and collections covering garments not sold at launch
- Filters that would produce empty or nearly empty results

### Corrective decision

The launch product model is now:

```text
Metheues Clothings
└── T-shirts
    ├── Graphic Tees
    ├── Essential Tees
    ├── Oversized Tees
    ├── Limited Editions
    └── Future T-shirt collections
```

Other product types are future platform extensions and must not be visible as launch inventory.

---

## 3. Product vision and objectives

### Vision

Create a premium digital home for original Metheues T-shirts that combines editorial brand storytelling with a fast, transparent and trustworthy commerce experience.

### MVP objectives

The launch must allow Metheues Clothings to:

1. Present a credible first T-shirt drop.
2. Explain the story, material, fit and construction of every T-shirt.
3. Sell colour-and-size variants without price or stock manipulation.
4. Accept secure payments without handling card details directly.
5. Create exactly one durable order for each completed checkout.
6. Track stock by exact T-shirt variant.
7. Process, dispatch, cancel, return and refund orders safely.
8. Give customers clear delivery and order-status information.
9. Operate effectively across mobile, tablet and desktop.
10. Demonstrate production-quality product design and engineering.

### Suggested initial catalogue size

Launch with approximately **3–6 original T-shirt designs**. Each design may have one or more colours and sizes, but placeholder products should not be used to create the appearance of a larger catalogue.

---

## 4. Scope boundaries

### Included in the MVP

- Graphic, essential, oversized and limited-edition T-shirts
- Product collections or drops
- Sizes XS–XXL where actually stocked
- Colour variants
- Variant-level price, SKU and inventory
- T-shirt-specific size and fit guidance
- Guest and registered checkout
- UK delivery and selected international destinations
- Stripe Checkout
- Customer accounts, orders and addresses
- Admin management of T-shirts, stock, orders, fulfilment and returns
- Transactional email
- Basic homepage content management
- Responsive and accessible web experience

### Explicitly excluded from launch

- Hoodies
- Sweatshirts
- Shirts
- Trousers
- Jackets and outerwear
- Coordinated sets
- Hats and caps
- Bags
- Jewellery
- Footwear
- General accessories
- Made-to-measure ordering
- Customer design customization
- Multi-vendor marketplace
- Wholesale portal
- Native mobile application
- Multiple warehouses
- Multiple currencies
- Multiple languages
- Wish lists
- Customer reviews
- Loyalty points
- Gift cards
- Subscriptions
- AI styling or recommendations
- Buy-now-pay-later unless added through a later approved payment phase

---

## 5. Users and permissions

### 5.1 Visitor

Can:

- View the homepage and brand story
- Browse drops and T-shirts
- Search and filter
- View size and fit guidance
- Add T-shirts to the bag
- Begin guest checkout

### 5.2 Guest customer

Can:

- Complete checkout without registering
- Receive order confirmation and dispatch email
- Access an order through a secure order-status mechanism
- Request a return using verified order information
- Create an account after purchase if offered

### 5.3 Registered customer

Can:

- Sign in and sign out
- Reset a password
- Maintain a profile
- Save delivery addresses
- View their own order history
- Track their own orders
- Submit eligible cancellation or return requests

### 5.4 Administrator

Can:

- Manage T-shirts, images, variants and collections
- Adjust inventory with a recorded reason
- Publish, unpublish and archive T-shirts
- View and process orders
- Add tracking information
- Manage return requests
- Initiate controlled refunds
- Manage homepage content and store settings
- Review audit activity

All permissions must be enforced on the server. Hiding a button in the interface is not authorization.

---

## 6. Brand and experience direction

### Positioning

Metheues Clothings should combine contemporary streetwear, music, identity and culturally rooted visual storytelling.

### Experience attributes

- Editorial
- Refined
- Warm
- Confident
- Original
- Crafted
- Culturally rooted
- Simple to shop

### Recommended visual foundation

| Role | Colour | Hex |
|---|---|---:|
| Primary | Metheues Black | `#12100E` |
| Background | Warm Ivory | `#F7F2E8` |
| Surface | Soft Cream | `#FFFDF8` |
| Secondary | Deep Espresso | `#2B160F` |
| Accent | Antique Gold | `#B58A3C` |
| Editorial accent | Oxblood | `#6D2633` |
| Success | Forest | `#276749` |
| Error | Deep Red | `#B42318` |
| Supporting text | Stone | `#68635D` |
| Borders | Sand | `#DDD4C7` |

Antique Gold is a restrained brand accent, not the universal colour for focus, warnings and selected states.

### Typography

- Editorial serif for campaign and collection headings
- Readable sans-serif for navigation, product details, prices, forms and administration
- Minimum practical 16px text for mobile body copy and form controls
- Visible, high-contrast keyboard focus states

---

## 7. Information architecture

### Primary navigation

```text
New Drop
Shop T-Shirts
Collections
Our Story
Search
Account
Bag
```

### Shop T-Shirts navigation

Show only sections that contain products:

```text
Shop All
Graphic Tees
Essential Tees
Oversized Tees
Limited Editions
Best Sellers
```

The navigation must not show future apparel categories before those products exist.

### Footer

- Our Story
- Contact
- Delivery
- Returns and Exchanges
- Size Guide
- Privacy Policy
- Terms and Conditions
- Cookie Policy
- Newsletter
- Social profiles
- Required business information

---

## 8. Customer-facing MVP

### 8.1 Homepage

Recommended order:

1. Announcement bar
2. Responsive navigation
3. Current T-shirt campaign hero
4. Latest drop
5. Featured T-shirts
6. Story behind the designs
7. Fabric, print and construction quality
8. T-shirt style or collection discovery
9. Best sellers when sufficient sales data exists
10. Fit and size guidance
11. Metheues brand story
12. Newsletter and drop alerts
13. Delivery, returns and payment reassurance
14. Footer

Suggested launch hero:

> **Wear the Vibe**  
> Premium T-shirts shaped by music, identity and original expression.  
> **Shop the First Drop**

Use one focused campaign rather than an automatic hero carousel.

### 8.2 Product listing and collections

Each card displays:

- Consistent 4:5 T-shirt image
- Product name
- Price in GBP
- Available colours
- New, limited, low-stock or sold-out label where applicable
- Alternative desktop hover image
- Visible keyboard focus

Filters:

- Size
- Colour
- Fit
- Design style
- Collection
- Price
- Availability

Sorting:

- Featured
- Newest
- Price: low to high
- Price: high to low

Mobile filtering uses an accessible full-height sheet with active-filter count, individual removal, Clear All, result count and a large Apply/Show Results action.

### 8.3 Search

Search supports:

- T-shirt name
- Design name
- Collection or drop
- Colour
- Fit
- Descriptive keywords

No-results screens should suggest related T-shirts, current drops and corrected search terms rather than ending the journey.

### 8.4 T-shirt product page

Purchase-critical order:

1. Image gallery
2. Product name
3. Price
4. Short design story
5. Colour selector
6. Size selector
7. Find Your Fit link
8. Stock state
9. Add to Bag
10. Delivery and returns summary
11. Fabric and construction
12. Care instructions
13. Full design story
14. Related T-shirts

Required product information:

- Front, back and side views where useful
- Print close-up
- Fabric/construction detail
- Model and lifestyle images
- Fit: regular, relaxed or oversized
- Fabric composition
- Fabric weight in GSM
- Neckline
- Print or embroidery method
- Print placement
- Model height and size worn
- Care instructions
- Delivery estimate
- Return eligibility summary

Unavailable sizes remain visible but disabled. If no size is selected, show a specific error and move focus to the size selector:

> Choose a size before adding this T-shirt.

Mobile should include a sticky purchase action that does not obscure content or keyboard focus.

### 8.5 Size and fit guide

The guide must be specific to the actual T-shirt blank or manufactured garment and include:

- Chest width
- Body length
- Shoulder width
- Sleeve length
- Centimetres and inches
- Explanation that the values are garment measurements
- How to measure an existing T-shirt
- Regular, relaxed or oversized fit explanation
- Model height and worn size
- Advice such as “choose your usual size” only when accurate

Example data must be replaced by verified production measurements before launch.

### 8.6 Add-to-bag interaction

After adding a variant:

- Confirm product, colour, size, quantity and price
- Update the bag count
- Open a side panel on desktop or bottom sheet on mobile
- Offer View Bag and Continue Shopping
- Do not force immediate navigation to the bag

### 8.7 Shopping bag

Display:

- Product image
- Name
- Colour
- Size
- Quantity control
- Unit price
- Line subtotal
- Remove action
- Delivery guidance
- Complete subtotal
- Secure Checkout action

Price and stock are revalidated on the server before checkout is created.

### 8.8 Checkout

Use Stripe-hosted or Stripe-embedded Checkout for the MVP. Do not store or process raw card details in the Metheues application.

Flow:

1. Customer reviews the bag.
2. Browser sends variant IDs and quantities—not prices.
3. Server retrieves authoritative product and price data.
4. Server confirms variants are active and sufficiently stocked.
5. Server creates Stripe Checkout Session.
6. Customer provides contact, delivery and payment information.
7. Stripe confirms payment through a signed webhook.
8. Application creates exactly one order.
9. Inventory is decreased exactly once.
10. Confirmation email is sent.

Guest checkout is the primary path. Account creation must not be required before payment.

### 8.9 Order confirmation and tracking

Confirmation displays:

- Persistent order number
- Purchased T-shirts and variants
- Amount paid
- Delivery address summary
- Delivery estimate
- Next steps

Customer-facing order timeline:

```text
Confirmed → Preparing → Shipped → Delivered
```

Internal states:

```text
pending_payment
paid
processing
shipped
delivered
cancelled
refunded
```

The confirmation page retrieves an existing order. It must never generate a new order number.

### 8.10 Customer account

- Register
- Verify email
- Sign in and sign out
- Reset password
- Edit profile
- Save addresses
- View own orders
- View tracking
- Submit eligible cancellation or return request

Customers must never be able to retrieve another customer’s order by changing a URL or identifier.

### 8.11 Returns

Customer return request includes:

- Eligible order
- T-shirt variant
- Quantity
- Reason
- Optional explanation
- Return-policy acknowledgement
- Expected refund destination

Return states:

```text
requested
approved
rejected
received
refunded
closed
```

Automatic return labels are deferred. The published return policy must be reviewed for the countries in which the business sells.

---

## 9. Administration MVP

### 9.1 Dashboard

Display:

- Today’s orders
- Paid revenue
- Orders awaiting fulfilment
- Low-stock variants
- Sold-out variants
- Recent orders
- Returns awaiting review

### 9.2 T-shirt management

Administrators can:

- Create and edit a T-shirt
- Save a draft
- Preview
- Publish or unpublish
- Archive
- Assign collection/drop
- Upload and arrange images
- Generate size-and-colour variants
- Configure fit and garment specifications
- Add SEO title and description

T-shirt editor sections:

1. Basic information
2. Short description and design story
3. Images
4. Collection and style
5. Fit and garment specification
6. Colours and sizes
7. SKUs, prices and inventory
8. Care instructions
9. Delivery data
10. SEO preview
11. Publishing status

### 9.3 Variant and inventory management

Every purchasable variant includes:

- T-shirt ID
- Colour
- Size
- Unique SKU
- Price
- Optional compare-at price
- Stock quantity
- Low-stock threshold
- Active/inactive state

Rules:

- Stock cannot become negative.
- Only active, published variants can be purchased.
- Paid orders decrease stock once.
- Duplicate webhook delivery cannot decrease stock twice.
- Restocking after cancellation or return requires a defined, audited action.
- Manual adjustments require a reason.

### 9.4 Order management

Order list supports:

- Search by order number, customer or email
- Payment-status filter
- Fulfilment-status filter
- Date range
- Delivery country
- Newest/oldest sorting

Order details include:

- Customer and delivery details
- Immutable item snapshots
- Payment state and Stripe references
- Fulfilment timeline
- Internal notes
- Tracking carrier, number and URL
- Cancellation and refund controls
- Audit history

### 9.5 Fulfilment

Admin flow:

```text
Paid order
→ Begin processing
→ Pick exact colour/size variants
→ Pack
→ Add carrier and tracking
→ Mark shipped
→ Send dispatch email
```

### 9.6 Returns and refunds

Admin can:

- Review request and eligibility
- Approve or reject with reason
- Mark item received
- Record condition
- Decide whether stock is restored
- Initiate controlled Stripe refund
- Close request

Refund, cancellation, product archive and negative stock adjustments require explicit confirmation and audit logging.

### 9.7 Content management

MVP content controls:

- Announcement bar
- Hero campaign
- Featured drop
- Featured T-shirts
- Brand/craft story
- Newsletter text
- Delivery and return highlights

This is a limited content system, not a general page builder.

---

## 10. Data model

### Core tables

| Table | Purpose |
|---|---|
| `profiles` | Customer and administrator profile data |
| `addresses` | Saved customer addresses |
| `collections` | Drops and T-shirt collections |
| `products` | T-shirt product records; future-extensible product type |
| `product_images` | Ordered product imagery and alt text |
| `product_variants` | Colour, size, SKU, price and stock |
| `inventory_adjustments` | Audited stock changes |
| `carts` | Persistent authenticated carts if implemented |
| `cart_items` | Variant and quantity selections |
| `orders` | Customer, totals, payment and fulfilment state |
| `order_items` | Immutable purchased-item snapshots |
| `payments` | Stripe session/payment references and state |
| `fulfilments` | Carrier, tracking and dispatch data |
| `returns` | Return request lifecycle |
| `return_items` | Returned variants and quantities |
| `webhook_events` | Stripe event idempotency |
| `newsletter_subscribers` | Consent-backed subscriptions |
| `store_settings` | Delivery, contact and store configuration |
| `homepage_sections` | Limited managed homepage content |
| `audit_logs` | Sensitive administrator actions |

### Essential constraints

- Product slugs are unique.
- Variant SKUs are unique.
- Order numbers are unique.
- Stripe Checkout Session IDs are unique.
- Stripe Payment Intent IDs are unique where present.
- Stripe webhook event IDs are unique.
- Prices and quantities cannot be negative.
- Order items store purchased name, SKU, size, colour and price snapshots.
- Customer access is limited to owned records.
- Admin mutations require verified administrative authorization.

### Future extensibility

The data model may retain a controlled `product_type` value such as `tshirt`, but only `tshirt` is permitted at launch. Do not build future garment workflows until they are approved.

---

## 11. Technical architecture

### Recommended stack

- Next.js App Router and TypeScript
- Tailwind CSS and accessible component primitives
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Row Level Security
- Stripe Checkout and webhooks
- Resend transactional email
- Zod validation
- Vitest and React Testing Library
- Playwright end-to-end testing
- GitHub Actions
- Vercel deployment
- Error monitoring after environment setup

### Architecture principle

Use a modular monolith. Do not recreate the previous split Next.js/Express architecture unless a verified requirement justifies it.

Suggested feature boundaries:

```text
catalogue
collections
cart
checkout
orders
inventory
fulfilment
returns
customers
admin
content
```

---

## 12. Security and payment integrity

Required controls:

- Rotate any secrets previously committed to the ZenHaven repository.
- Never migrate old `.env` files into the new project.
- Never accept payable price, discount or total from the browser.
- Accept only variant ID and quantity during checkout creation.
- Verify Stripe webhook signatures using the raw request body.
- Process every webhook event idempotently.
- Store application secrets only in protected server environments.
- Never expose Supabase server secrets in browser code.
- Enforce RLS and server-side authorization.
- Rate-limit authentication and sensitive mutations.
- Validate every mutation with explicit schemas.
- Use secure, HTTP-only session cookies where applicable.
- Protect state-changing operations against CSRF.
- Restrict upload file types, sizes and destinations.
- Avoid logging tokens, addresses, full webhook payloads or payment details.
- Add security headers and Content Security Policy.
- Audit refunds, cancellations, fulfilment and inventory changes.

---

## 13. Accessibility and responsive UX

### Target

WCAG 2.2 AA as a design and implementation requirement.

### Required behaviours

- Full keyboard access
- Skip-to-content link
- Visible focus indicators
- Logical focus order
- Semantic headings and landmarks
- Persistent visible form labels
- Field-specific errors and useful suggestions
- Programmatic error association
- Screen-reader status announcements
- Text alternatives for meaningful product imagery
- Decorative imagery ignored appropriately
- No information communicated by colour alone
- Support for 200% zoom and narrow-screen reflow
- Reduced-motion support
- Large touch targets
- No keyboard traps
- No action requiring drag alone
- Accessible authentication compatible with password managers

### Required design widths

- 390px mobile
- 768px tablet
- 1440px desktop

Tablet layouts must be intentionally designed, particularly for product pages, checkout, account screens and admin operations.

---

## 14. Transactional email

Required templates:

- Verify email
- Password reset
- Order confirmation
- Cancellation confirmation
- Dispatch and tracking
- Refund completed
- Return request received
- Return approved
- Return rejected

Emails must use Metheues Clothings branding and should not expose internal notes or sensitive operational data.

---

## 15. Analytics and monitoring

### MVP commerce events

- Product viewed
- Collection viewed
- Search performed
- No search results
- Size guide opened
- Variant selected
- Add to bag
- Remove from bag
- Checkout started
- Checkout completed
- Checkout failed or abandoned where measurable
- Return requested

Analytics must respect the published privacy and cookie policy. Non-essential tracking should not run before any required consent.

### Operational monitoring

- Failed webhook processing
- Email delivery failures
- Checkout creation failures
- Inventory constraint failures
- Unhandled server errors
- Repeated authentication abuse

---

## 16. Testing requirements

### Unit and integration tests

- Money and price calculations
- Variant validation
- Stock validation
- T-shirt publishing rules
- Order-state transitions
- Return eligibility
- Authorization policies
- Input schemas
- Shipping calculations
- Webhook idempotency

### Critical end-to-end journeys

#### Customer purchase

```text
Home
→ First Drop
→ T-shirt
→ Select colour
→ Select size
→ Add to bag
→ Guest checkout
→ Delivery
→ Stripe test payment
→ Confirmation
→ Order tracking
```

#### Registered customer

```text
Register
→ Verify email
→ Sign in
→ View own order
→ Request eligible return
```

#### Administrator publishing

```text
Admin sign in
→ Create T-shirt
→ Add images
→ Generate size/colour variants
→ Add inventory
→ Preview
→ Publish
```

#### Administrator fulfilment

```text
Paid order
→ Begin processing
→ Add tracking
→ Mark shipped
→ Dispatch email sent
```

### Security assertions

- Browser-modified price is ignored.
- Invalid or inactive variant is rejected.
- Insufficient stock is rejected.
- Duplicate webhook does not create duplicate order.
- Duplicate webhook does not reduce inventory twice.
- Customer cannot access another customer’s order.
- Customer cannot access admin operations.
- Administrator actions are audited.

### CI checks

Every pull request should run:

1. Formatting
2. ESLint
3. Type checking
4. Unit and integration tests
5. Database tests where applicable
6. Production build
7. Playwright smoke tests
8. Dependency scanning
9. Secret scanning
10. Preview deployment

---

## 17. Required UI screens

### Customer storefront

1. Mobile navigation drawer
2. Desktop navigation/Shop T-shirts menu
3. Homepage
4. First Drop/collection page
5. Shop All T-shirts
6. Search overlay
7. Search results
8. Search no-results state
9. T-shirt product page
10. Size and fit guide
11. Add-to-bag confirmation
12. Shopping bag
13. Empty bag
14. Guest checkout entry
15. Delivery information
16. Stripe payment transition or embedded experience
17. Order review where supported by chosen checkout
18. Processing state
19. Order confirmation
20. Sign in
21. Registration
22. Forgot/reset password
23. Email verification state
24. Account overview
25. Profile settings
26. Saved addresses
27. Order history
28. Order details
29. Order tracking
30. Return request
31. Return confirmation/status
32. Our Story
33. Delivery and Returns
34. Contact
35. Privacy, Terms and Cookie pages

### Administration

1. Admin sign in
2. Dashboard
3. T-shirts table
4. Create/edit T-shirt
5. Product image manager
6. Size-and-colour variant generator
7. Inventory table
8. Inventory adjustment dialog
9. Collections/drops list
10. Collection editor
11. Orders table
12. Order details
13. Fulfilment flow
14. Add tracking dialog
15. Cancellation confirmation
16. Refund confirmation
17. Returns queue
18. Return details
19. Customers table
20. Customer details
21. Homepage content editor
22. Store settings
23. Audit log

### System states

Every critical flow requires:

- Loading
- Empty
- Error
- Success
- Disabled
- Offline/retry where meaningful
- Sold out
- Low stock
- Validation failure
- Unauthorized
- Payment failed
- Webhook/order processing delayed

---

## 18. Definition of done

The MVP is launch-ready only when:

- Only T-shirts are exposed as launch products.
- A real customer can browse and buy on mobile.
- Every T-shirt has verified garment specifications and size measurements.
- The customer selects an exact colour-and-size variant.
- The amount charged comes exclusively from server-authoritative data.
- Stripe signatures are verified.
- One successful checkout creates exactly one durable order.
- Stock decreases exactly once and cannot become negative.
- Customers can access only their own protected data.
- Administrators can create, publish and fulfil T-shirt orders.
- Confirmation, dispatch, return and refund emails work.
- Critical journeys pass automatically.
- CI prevents lint, type, test or build failures from reaching production.
- Mobile, tablet and desktop layouts are verified.
- Keyboard and screen-reader testing has been completed.
- Delivery, return, privacy, terms and cookie policies are published.
- All historical secrets have been rotated.
- Multiple Stripe test-mode purchases, failures and webhook retries have been verified.

---

## 19. Delivery milestones

### Milestone 0 — Business and product readiness

- Confirm brand and domain
- Define first drop and product names
- Confirm target audience and fit model
- Obtain final T-shirt measurements
- Confirm GSM, fabric, blanks/manufacturer and print method
- Define UK and international delivery rules
- Draft return, privacy and legal policies

### Milestone 1 — UX and design system

- Correct Google Stitch scope to T-shirts only
- Complete mobile, tablet and desktop screens
- Complete customer and admin prototypes
- Establish design tokens and accessible components
- Conduct usability testing on product selection and checkout

### Milestone 2 — Foundation

- Create clean repository
- Configure Next.js, Supabase and environments
- Implement migrations and RLS
- Configure authentication and admin roles
- Configure CI/CD and preview deployments

### Milestone 3 — Catalogue and administration

- T-shirt/collection management
- Image storage
- Variant generator
- Inventory
- Storefront listing, search and product pages

### Milestone 4 — Commerce

- Bag
- Server-authoritative checkout
- Stripe Checkout
- Verified webhook processing
- Durable orders
- Atomic inventory update
- Confirmation email

### Milestone 5 — Accounts and operations

- Customer account and order history
- Admin fulfilment
- Tracking
- Returns and controlled refunds
- Content settings

### Milestone 6 — Launch readiness

- Automated test completion
- Security review
- Accessibility review
- Performance review
- Production content and photography
- Test-mode order exercises
- Private beta
- Controlled live launch

---

## 20. Future expansion rule

New apparel or accessory types must be introduced through a separate scoped milestone. Before adding a new product type, define:

- Product-specific attributes
- Size and fit system
- Variant model
- Inventory implications
- Photography requirements
- Filters and navigation
- Shipping implications
- Returns implications
- Required tests

The T-shirt MVP must not be delayed by speculative features for products that are not part of the first drop.

