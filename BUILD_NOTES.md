# macklin-site Build Notes

## Build Status: ✅ SUCCESS

`astro build` completes successfully. 12 pages generated.

## Tech Stack
- Astro v5 (latest)
- @astrojs/mdx for MDX support
- astro-expressive-code for syntax highlighting (github-light/github-dark themes)
- Inter font via Google Fonts
- Content Collections with glob loader (Astro v6 API)

## Content Successfully Extracted

### Blog Posts (6)
1. **Where Classes in TypeScript Fall Short** → `/writing/classes-in-typescript`
2. **All the Tools I Used to Build this Website** → `/writing/everything-i-used-to-build-this-website`
3. **7 Useful Tools for Tracking Web Performance** → `/writing/7-useful-tools-for-monitoring-web-performance-user-experience`
4. **How to Create AWS Route53 Subdomains with Multiple Accounts** → `/writing/share-aws-route-53-subdomains-across-multiple-accounts`
5. **Understanding and Managing the Node.js Application Lifecycle** → `/writing/understanding-and-managing-the-node-js-application-lifecycle`
6. **Configuring Access Management in Amazon EKS with IAM Roles for Service Accounts** → `/writing/configure-access-management-amazon-eks-iam-roles-for-service-accounts-cloudformation`

### Talks (5)
1. **Just-in-time Architecture** → `/talks/talk-just-in-time-architecture`
2. **How Fast is your Website Really?** → `/talks/talk-how-fast-is-your-website-really`
3. **Web Accessibility in Practice** → `/talks/web-accessibility-in-practice`
4. **Every Good Outage Starts with a Queue** → `/talks/every-good-outage-starts-with-a-queue`
5. **Everything is a Feature Toggle** → `/talks/everything-is-a-feature-toggle`

### Homepage Sections
- Bio (2 paragraphs + email/github/linkedin links)
- Writing list (6 posts with dates)
- Talks list (5 talks with dates)
- Certifications (6 badges: 3 AWS, Terraform, Snowflake, CKA)
- Experience (4 companies: WeMoney, VGW, Cash Converters, NEC with logos and roles)
- Volunteering (She Codes, DDD Perth — hardcoded text, images not available)

## Images
- **Total images downloaded: 46** (including heroes, inline post images, cert badges, company logos)
- **Image failures: 0**
- Hero images downloaded for all 6 blog posts
- Talk pages had no hero images in Notion
- Volunteering section had no images (showed text only)

## Notion Block Types — Conversion Status

| Block Type | Status |
|---|---|
| paragraph | ✅ Converted |
| heading_1/2/3 | ✅ Converted |
| code | ✅ Converted (with language tag) |
| bulleted_list_item | ✅ Converted |
| numbered_list_item | ✅ Converted |
| image | ✅ Downloaded + embedded |
| callout | ✅ Converted to blockquote |
| divider | ✅ Converted to --- |
| quote | ✅ Converted to blockquote |
| toggle | ✅ Converted (bold heading + expanded content) |
| table | ✅ Converted to markdown table |
| column_list / column | ✅ Flattened to sequential content |
| embed | ✅ Converted to link |
| video | ✅ Converted to link |
| bookmark | ✅ Converted to link |
| link_preview | ✅ Converted to link |
| **synced_block** | ⚠️ Not supported — 4 instances found |

### Unsupported: `synced_block`
Found in:
- `configure-access-management-amazon-eks-iam-roles-for-service-accounts-cloudformation.mdx` (1 instance)
- `everything-i-used-to-build-this-website.mdx` (1 instance)
- `everything-is-a-feature-toggle.mdx` (1 instance)
- `talk-how-fast-is-your-website-really.mdx` (1 instance)

These are Notion "synced blocks" (reusable block references). The API doesn't easily expose their content inline. Each occurrence was replaced with a JSX comment `{/* synced_block */}`. You may want to check what these blocks contain in Notion and add the content manually.

## Notes on Post Content
- Each post begins with a Notion-style "read time" line (e.g. `_26th January 2023 · 15 minute read_`) — this was in the Notion page body and has been preserved as-is
- The `description` frontmatter field currently contains this read-time line. Consider updating to an actual summary

## File Structure
```
macklin-site/
├── astro.config.mjs
├── src/
│   ├── content.config.ts       # Collection definitions (glob loader)
│   ├── styles/global.css       # All styles (Inter font, Notion-inspired)
│   ├── layouts/BaseLayout.astro
│   ├── pages/
│   │   ├── index.astro         # Homepage
│   │   ├── writing/[slug].astro
│   │   └── talks/[slug].astro
│   └── content/
│       ├── posts/              # 6 MDX post files
│       └── talks/              # 5 MDX talk files
├── public/
│   ├── favicon.svg
│   └── images/                 # 46 images (heroes, inline, certs, logos)
└── dist/                       # Built output (12 pages)
```

## Next Steps / TODO
1. Deploy `dist/` to hosting (Netlify, Vercel, or Caddy static file server)
2. Set up redirect rules if old Notion URLs need to forward
3. Handle `synced_block` content (4 instances) — check Notion for what they contain
4. Consider adding description meta to posts (currently shows read-time line)
5. May want to add Open Graph images for social sharing
6. Verify talk pages — some talks had no content blocks (just a title)
