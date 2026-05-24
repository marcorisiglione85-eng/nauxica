# Nauxica Dashboard Assets

This folder contains the dashboard visuals for the Nauxica website.

## Files

- `dashboard-homeowner`  
  Use for the owner dashboard section.

- `dashboard-guest-concierge`  
  Use for the WhatsApp AI concierge / guest journey section.

- `dashboard-partner-cleaning`  
  Use for partner marketplace examples, cleaning company dashboard.

- `dashboard-partner-transfer`  
  Use for partner marketplace examples, transfer company dashboard.

## Recommended usage in the site

Use the `.webp` files in the website for faster loading, with `.png` files as master references.

Suggested HTML pattern:

```html
<picture>
  <source srcset="assets/dashboard/dashboard-homeowner.webp" type="image/webp">
  <img src="assets/dashboard/dashboard-homeowner.png" alt="Nauxica homeowner dashboard">
</picture>
```

## Suggested placement

- Hero visual or Owner dashboard section:
  `dashboard-homeowner.webp`

- WhatsApp AI concierge section:
  `dashboard-guest-concierge.webp`

- Partner marketplace section:
  `dashboard-partner-cleaning.webp`
  `dashboard-partner-transfer.webp`
