# marwadikhana.com landing page

This folder is the main website for **www.marwadikhana.com**:

- `index.html`: the "Choose How You'd Like to Order" page with two choices
  - **Catering** → `catering.html` (enquire on WhatsApp / call)
  - **Ordering** → **https://orders.marwadikhana.com** (the ordering site in the rest of this repo)
- `catering.html`: catering enquiry page
- `css/landing.css`, `images/`: styles and photos

It's plain HTML/CSS with no build step, so it can be uploaded to any web host.

**Preview it now:** https://unnatichoudharyy.github.io/orders.marwadi-khana/landing/
The "Ordering" button won't open until step 1 below is done.

**Before going live:** replace the placeholder WhatsApp number `919999999999` and phone `+919999999999` in `catering.html`.

---

## 1. Put the ordering site on orders.marwadikhana.com

**Order matters.** Do the DNS step first. If you set the custom domain in GitHub before the DNS works, the ordering site stops loading until it does.

1. **DNS:** log in where you bought the domain (GoDaddy, Hostinger, BigRock, …). Open the DNS settings for `marwadikhana.com` and add this record:

   | Type | Name / Host | Value / Points to | TTL |
   | --- | --- | --- | --- |
   | CNAME | `orders` | `unnatichoudharyy.github.io` | default |

2. Wait 10–30 minutes. (Optional check: open https://dnschecker.org and look up `orders.marwadikhana.com`. It should point to `unnatichoudharyy.github.io`.)
3. **GitHub:** in the `orders.marwadi-khana` repo, go to **Settings → Pages → Custom domain**. Type `orders.marwadikhana.com` and click **Save**.
4. When the DNS check turns green, tick **Enforce HTTPS**. This can take up to an hour to become available.

The ordering site then opens on https://orders.marwadikhana.com. The old github.io address redirects there automatically.

## 2. Put this landing page on www.marwadikhana.com

Pick the option that matches how your domain is set up.

### Option A: you already have web hosting with the domain (cPanel / Hostinger / GoDaddy hosting)
1. Open the hosting **File Manager** and go to `public_html`.
2. Upload everything **inside** this `landing` folder (`index.html`, `catering.html`, `css/`, `images/`). Upload the contents, not the folder itself.
3. Open https://www.marwadikhana.com.

### Option B: host it free on GitHub Pages too
1. Create a new GitHub repo, e.g. `marwadikhana-home`. Put the **contents** of this folder at its root and turn on **Settings → Pages → Deploy from a branch → main / (root)**.
2. **DNS:** add these records at your domain provider:

   | Type | Name / Host | Value |
   | --- | --- | --- |
   | CNAME | `www` | `unnatichoudharyy.github.io` |
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |

3. In that repo: **Settings → Pages → Custom domain** → `www.marwadikhana.com` → Save. Then tick **Enforce HTTPS** once it's available.

`marwadikhana.com` (without www) then redirects to `www.marwadikhana.com`.

**Careful with existing DNS records:** if your domain already has email (MX records) or another website, only add or replace the records listed above. Don't delete MX records, or your email will stop working.
