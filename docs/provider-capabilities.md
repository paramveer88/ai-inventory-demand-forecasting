# Provider assessment — Shopify candidate

Assessed November 3, 2026. Candidate only: no development store, credentials, business account, or authorized sample responses are available. No live provider calls were made. The reference adapter is not a Shopify adapter.

The user confirmed that no test account is available. This does not block accepting `reference-v1` as a versioned synthetic contract; it blocks claims that Shopify compatibility or account permissions have been verified.

| Capability | Status | Evidence and unresolved work |
| --- | --- | --- |
| Legitimate account access | Unknown / pending access | Need an authorized development store before sample retrieval |
| Orders and historical retention | Documented-only | [Order](https://shopify.dev/docs/api/admin-graphql/latest/objects/Order): default access covers the last 60 days; older history requires additional access. Do not assume a 90-day backfill works. |
| Fulfillment identities and line quantities | Documented-only | [Fulfillment](https://shopify.dev/docs/api/admin-graphql/latest/objects/Fulfillment) describes separate shipments and fulfillment line items. Verify actual statuses, stable line identifiers and an acceptable fulfillment occurrence timestamp in sample responses. |
| Product/variant mappings | Unknown in account | Verify product/variant and inventory-item identity joins; no name/SKU matching |
| Stock quantity semantics | Documented-only | [InventoryLevel](https://shopify.dev/docs/api/admin-graphql/latest/objects/InventoryLevel) exposes quantity states at an item/location, including available/on-hand/incoming/committed; requires inventory permissions. They are not interchangeable. |
| Pagination and order filtering | Documented-only | [orders](https://shopify.dev/docs/api/admin-graphql/latest/queries/orders) supports pagination/filtering/sorting. Verify update filters, time boundaries, nested pagination and corrections against actual data. |
| Ordered revision behavior | Unknown | Do not assume timestamps are monotonic integer revisions like the reference source |
| Deletion discovery and historic corrections | Unknown | Establish supported notification/refetch/reconciliation behavior before promising completeness |
| Inbound timing, commitments, lead times | Unknown | Quantity availability does not establish a delivery schedule or complete inventory position. Purchase suggestions remain unavailable. |
| Historical inventory availability | Unknown | Current balances cannot establish historical stockout flags |
| Rate limits / webhook access | Pending implementation | Verify current official requirements and account permissions before implementation |

## Authorized sample procedure when access exists

Retrieve a small set of products/variants, an order with dated partial fulfillments, and inventory quantities by location. Record actual scopes, field visibility, null timestamps and pagination. Make a controlled correction/cancellation in the test store and inspect update discovery. Sanitize customer/payment data before retaining fixtures. Confirm history coverage and whether source balances already include shipments. Record each observed capability separately from documented capabilities.

The first slice uses product variants, fulfillment lines and quantity-typed stock inspired by these documented distinctions. Its fixtures are deliberately synthetic and its integer revisions/full-snapshot API are reference-specific assumptions, not Shopify behavior.
