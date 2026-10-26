<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/130c3047-71e2-42b5-a9a7-1dce26b8f05e

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy checklist (ads + admin hardening)
1. Supabase SQL Editor → run `supabase/e4f_ad_security.sql` (LAST, after any other SQL).
2. Vercel env: ADMIN_SECRET, SESSION_SECRET, TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
3. Redeploy. Admin login works only with ADMIN_SECRET.
4. Admin panel: tap the E4F logo 15 times within 3 seconds, then enter the admin password. Notices and tasks created there are saved in Supabase (table `e4f_content`, created by `e4f_ad_security.sql`) and appear instantly for all users, no redeploy needed.
5. Optional env: `ALLOWED_ORIGINS` (comma list) for extra allowed web origins; `baseReferralBoostCount` in admin settings controls the base mining boost (default 12).

## Final notes
- AI_STUDIO_INSTRUCTIONS.md must be followed when copying this project through any AI tool: files must stay unchanged.
- Everything the admin creates (settings, notices, tasks, task reviews) is stored in Supabase and works instantly without redeploy.
